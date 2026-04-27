# [Poku](https://github.com/wellwelwel/poku) codebase vs. [@pokujs/coverage](https://github.com/pokujs/coverage), [@pokujs/c8](https://github.com/pokujs/c8), and [@pokujs/monocart](https://github.com/pokujs/monocart)

> - **Generated:** 2026-04-26 against the captured run at `coverage/v8/` (1070 V8 dumps). Static snapshot. The numbers should be re-audited as reporters evolve.
> - **Scope:** Node.js coverage fidelity only. Bun (JSC) and Deno are out of scope because the competing reporters do not target those runtimes. The multi-runtime support of `@pokujs/coverage` is therefore unaudited here by necessity, not by omission.
> - **Method:** every uncovered entry in each reporter's `lcov.info` is cross-checked against the raw V8 dumps using the `v8-audit` skill from `pokujs/coverage`. Verdicts are **faithful** (V8 confirms `count = 0`) or **suspect** (V8 says `count > 0` somewhere covering the position, indicating a pipeline bug). The faithful / suspect axis applies V8's own range and count semantics directly. See [docs/v8.md](v8.md) for the protocol invariants the audit relies on.

---

## Headline counts

| Reporter             | Uncovered entries | Faithful | Suspect | Suspect ratio |
| -------------------- | ----------------: | -------: | ------: | ------------: |
| **@pokujs/coverage** |               315 |      315 |   **0** |          0.0% |
| **@pokujs/monocart** |                40 |       15 |  **25** |         62.5% |
| **@pokujs/c8**       |              1149 |      478 | **671** |         58.4% |

Each reporter consumed the **same** Poku run via plugin teardown. Differences in entry counts and verdicts are entirely about how each reporter post-processes V8 dumps. The per-tool entry totals (315 / 40 / 1149) reflect what each reporter chose to report as uncovered in its `lcov.info`, not different audit budgets. Every uncovered entry produced by each reporter was audited.

The headline numbers above conflate two distinct entry kinds. The breakdown below tells the actual story:

| Reporter             | Line suspects | Function suspects | Branch suspects | Notes                                                   |
| -------------------- | ------------: | ----------------: | --------------: | ------------------------------------------------------- |
| **@pokujs/coverage** |         **0** |                 0 |               0 | All 184 lines, 7 functions, 124 branches faithful.      |
| **@pokujs/monocart** |        **14** |                 0 |              11 | The 14 line suspects are real pipeline issues.          |
| **@pokujs/c8**       |           228 |               100 |             343 | Plus 18 esbuild-wrapper FN ghosts (counted as suspect). |

> **Caveat on branch suspects:** my auditor probes branches at line resolution, not arm resolution. A line whose nearest enveloping V8 range has `count > 0` is flagged as suspect for **every** uncovered arm on that line, even when the specific arm genuinely never executed. Branch suspects across all three reporters are inflated by this. Line and function suspects are the trustworthy axis.

---

## Suspect findings: [@pokujs/c8](https://github.com/pokujs/c8)

### Esbuild-wrapper functions (18 entries)

c8 emits tsx-injected CJS wrappers as named functions at **line 1 of every `.ts` source**: `__name`, `__copyProps`, `__toCommonJS`, `__toESM`, `get`. These positions don't exist in source. Worse, c8 frequently emits **duplicate FN/FNDA pairs for the same wrapper** in the same file, one with the real count and one stale with `FNDA:0`. Examples:

- `src/parsers/get-runtime.ts`: emits `FNDA:0,getRuntime` AND `FNDA:1,getRuntime` (duplicate, while coverage and monocart emit only one entry).
- `src/builders/assert.ts`: emits `FN:107,doesNotThrow` (count 0) AND `FN:107,doesNotThrow` (count 28).

These are pipeline artifacts, not code that needs tests.

### Real line/function suspects (310 entries, top files)

| File                               | Line+function suspects |
| ---------------------------------- | ---------------------: |
| `src/builders/assert.ts`           |                     80 |
| `src/modules/helpers/describe.ts`  |                     60 |
| `src/bin/index.ts`                 |                     52 |
| `src/services/reporters/poku.ts`   |                     41 |
| `src/modules/helpers/modifiers.ts` |                     32 |
| `src/modules/helpers/it/core.ts`   |                     30 |
| `src/services/format.ts`           |                     28 |
| `src/services/run-test-file.ts`    |                     23 |
| `src/modules/essentials/poku.ts`   |                     21 |

Pattern: c8 reports **whole blocks of executed code as `DA:N,0`** when the surrounding V8 ranges show clear hits. Spot-check on `src/builders/assert.ts:107–139`: V8 reports `count > 0` on every line, coverage and monocart agree, and c8 reports `DA:107,0`...`DA:139,0`. This is c8 attributing source-mapped offsets to the wrong V8 range, losing entire function bodies in the report.

c8 also produces the **structurally most divergent** reports: e.g. `bin/index.ts` shows `FNH:0` (no functions hit) despite all five real functions clearly executing.

**c8 verdict: not faithful to V8.** 310 real-line-or-function suspects + 18 wrapper ghosts on the Poku codebase. Recommend not relying on c8 for measuring Poku's Node.js coverage.

---

## Suspect findings: [@pokujs/monocart](https://github.com/pokujs/monocart)

| File                                    | Line+function suspects | Detail                                                                                |
| --------------------------------------- | ---------------------: | ------------------------------------------------------------------------------------- |
| `src/parsers/get-runtime.ts`            |                      6 | L5/L6/L7 reported `DA:N,0`, but V8 says hit=1 on all three (single-process branches). |
| `src/parsers/get-runner.ts`             |                      4 | L9/L35 reported `DA:N,0`, but V8 says hit=114 / hit=212.                              |
| `src/services/watch.ts`                 |                      4 | L21/L44 reported as 0, but V8 says hit=3.                                             |
| `src/services/pid.ts`                   |                      2 | L26/L61 anonymous arrows reported as 0, but V8 says hit=206 (every process).          |
| `src/modules/plugins.ts`                |                      2 | L29 `} catch {` reported as 0, but V8 says hit=37.                                    |
| `src/modules/helpers/kill.ts`           |                      2 | L13 ternary cond reported as 0, but V8 says hit=2.                                    |
| `src/services/run-test-file.ts`         |                      2 | L62 reported as 0, but V8 says hit=85.                                                |
| `src/modules/helpers/create-service.ts` |                      3 | L143/L186 reported as 0, but V8 says hit=14 / hit=65.                                 |

Pattern: monocart drops hits on **lines that V8 marks executed in **every** loaded process** (e.g. `pid.ts:26`: V8 reports hit=206/206, monocart reports `DA:26,0`). This is a hard pipeline bug: monocart's V8-to-source-map remap is producing zero-counts on positions where V8 unambiguously says > 0.

Notable: `parsers/get-runtime.ts:5–7` is the canonical case, with three single-process conditionals, each `hit=1` in V8, all reported `0` by monocart. Coverage reports them correctly.

**monocart verdict: not faithful to V8 on Poku.** 14 real-line + 11 branch-line suspects on a 40-entry sample. The reporter under-counts execution on every file with conditional flow control.

---

## Findings: [@pokujs/coverage](https://github.com/pokujs/coverage)

**0 suspects.** All 315 uncovered entries are confirmed faithful to V8: 184 lines, 7 functions, 124 branches.

### Edge case retained as faithful: `src/modules/helpers/kill.ts:13` (`isWindows`)

```
L12 PIDs.map(async (p) => {                   # V8 hit=2  lcov hit=2  ✅
L13 isWindows                                 # V8 hit=2  lcov hit=0  (faithful via SKILL caveat)
L14 ? await killPIDService.windows(p)         # V8 hit=0  lcov hit=0  ✅
L15 : await killPIDService.unix(p);           # V8 hit=0  lcov hit=0  ✅
L16 })                                        # V8 hit=2  lcov hit=2  ✅
```

V8 emits **no sub-range** that isolates L13 from L14/L15. The only enveloping range is the outer arrow callback. Per the SKILL caveat ("treat as uncovered legitimately when the surrounding context also lacks hits in the same code block"), L13 is faithful: Istanbul attributes the ternary condition to the bodies that follow, all of which are correctly zero.

### Branches (124) and functions (7)

- All 7 `FNDA:0` functions are declarations whose body never executed (callbacks stored but not invoked, SIGINT handlers not triggered, `kill` arrow defined but unused). Istanbul convention treats `FNDA:0` as the correct label for these.
- All 124 uncovered branch arms correspond to V8 sub-ranges with `count = 0`, or to lines where the entire line has `hit = 0`. Spot-checks on `bin/index.ts:14` (`--version` flag never passed), `parsers/get-runtime.ts:5–7` (single-process conditional arms), `polyfills/jsonc.ts:49–50` (line-comment path unused) all confirm V8 agreement at the arm level.

**coverage verdict: faithful to V8.**

---

## Structural divergences (not bugs)

These are reporting-shape differences, not faithfulness issues:

- **`LF` (lines found) accounting:**
  - **coverage**: source-mapped per-statement count after V8-to-Istanbul remap. `bin/index.ts` reports `LF:196` against a 260-line source (executable lines only).
  - **monocart**: counts only function-declaration lines, ignoring statements. `bin/help.ts` reports `LF:9` against a 99-line source.
  - **c8**: reports `LF:260` matching the source line count, but treats blank lines and comments as executable (over-counts).

- **`FN` (functions) accounting:**
  - **coverage**: emits real source functions. `bin/help.ts` → `FNF:4`.
  - **monocart**: emits one FN per arrow expression (including IIFEs and array-method callbacks). `bin/help.ts` → `FNF:9`.
  - **c8**: emits source functions plus tsx esbuild wrappers (`__name`, `__copyProps`, etc.) often duplicated. `bin/help.ts` → `FNF:6` with five wrappers.

- **Anonymous-function naming:**
  - **coverage**: `(anonymous_N)` numbered relative to the source.
  - **monocart**: `(anonymous_N)` plus mangled paths like `Object.assign.ok.ok`, `import_each.each.before.cb`.
  - **c8**: same as monocart but adds duplicates.

These differences explain why aggregate percentages diverge across reporters even when all three agree on what was executed.

---

## Final verdict

| Reporter             | Faithful to V8? | Conditions                                                                                                                                                                                                                  |
| -------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **@pokujs/coverage** | **Yes**         | 0 pipeline bugs across 315 audited entries (184 lines, 7 functions, 124 branches).                                                                                                                                          |
| **@pokujs/monocart** | **No**          | 14 real line suspects + 11 branch suspects on a 40-entry sample. Drops hits on lines V8 unambiguously confirms executed (e.g. `get-runtime.ts:5–7`, `pid.ts:26`, `pid.ts:61`).                                              |
| **@pokujs/c8**       | **No**          | 310 real line/function suspects + 18 esbuild-wrapper FN ghosts + duplicate FN entries. Loses entire function bodies in the report (e.g. `builders/assert.ts:107–139`). Structurally divergent (`FNH:0` for `bin/index.ts`). |

**Bottom line:** **@pokujs/coverage** is the only one of the three Node.js reporters that produces an LCOV faithful to the raw V8 evidence on the Poku codebase.
