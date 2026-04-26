---
name: v8-audit
user-invocable: true
description: Audit a coverage report (lcov) against raw V8 coverage to determine whether each uncovered entry is faithful (V8 confirms it was not executed) or suspect (V8 says it ran but the report claims it didn't — a pipeline bug). Output is a binary verdict per entry, not a roadmap of missing tests.
---

# v8-audit

Cross-checks every uncovered entry in an `lcov.info` against the raw V8 coverage JSONs that produced it. Confirms whether the report is faithful to V8 (the source of truth) or whether the pipeline is hiding something V8 saw.

## When to use

- A project's coverage report shows uncovered lines/branches/functions and you want to know whether the report is honest about what V8 actually executed.
- After a change to the coverage pipeline, you want to validate that the report still matches V8.

This skill does **not** recommend tests, estimate coverage gains, or classify _why_ code was left uncovered. Its only job is to confirm whether the lcov report agrees with V8.

## Inputs

- **`<project-root>`** _(required)_ — path to the project being audited. May be absolute or relative; relative paths resolve against the current workspace (`process.cwd()`). Used to resolve source paths (e.g. `src/foo.ts`) when reading source code.
- **`<coverage-dir>`** _(optional)_ — path to the coverage output directory from the most recent run. Defaults to `<project-root>/coverage`. Pass it explicitly only when the project uses a non-conventional name (e.g. Poku uses `<project-root>/poku-coverage`). May be absolute or relative; relative resolves against the workspace. The directory **must contain** both:
  - `<coverage-dir>/v8/` — directory of raw V8 coverage JSONs (Node `NODE_V8_COVERAGE` output).
  - `<coverage-dir>/lcov.info` — the lcov report produced from the same run.

### Halting rule

If `<project-root>` is missing, **stop immediately** and reply:

> This skill requires at least one input:
>
> - `<project-root>` — path to the project being audited (absolute or relative to the workspace).
> - `<coverage-dir>` — _optional_, defaults to `<project-root>/coverage`. Pass it only when the project uses a non-conventional coverage directory name.
>
> Please re-invoke with the project path, e.g.:
>
> `/v8-audit ts-lab` (uses `ts-lab/coverage` by default) or `/v8-audit poku poku-coverage` (custom dir).

Do not guess the project, do not fall back to a previous session's project. Wait for the user to re-invoke with the project path.

## Procedure

### 1. Resolve and confirm inputs

Resolve relative paths against the current workspace. If `<coverage-dir>` was omitted, set it to `<project-root>/coverage`. Then verify on disk:

- The project root exists and is a directory.
- The coverage directory exists and is a directory.
- `<coverage-dir>/lcov.info` exists and is non-empty.
- `<coverage-dir>/v8/` exists and contains at least one `.json` file.

If any of these checks fail, stop and ask the user to regenerate coverage (or pass an explicit `<coverage-dir>`) before continuing.

### 2. Extract every uncovered entry

Run `npx tsx .claude/skills/v8-audit/scripts/extract-uncovered.ts <coverage-dir>/lcov.info`. Output is tab-separated:

```
<file>\tline\t<lineNumber>
<file>\tbranch\t<lineNumber>\t<branchId>\t<armIndex>
<file>\tfunction\t<lineNumber>\t<name>
```

Group by file, then by entry kind. Note the totals — a file with hundreds of uncovered entries usually means the file is unused in the test suite (whole-file 0%); investigate it as a single unit, not line-by-line.

### 3. For each entry, cross-check V8

For lines, run:

```
npx tsx .claude/skills/v8-audit/scripts/check-lines.ts <project-root> [<v8-dir>] <relative/path/to/file> <line> [<line>...]
```

`<v8-dir>` is optional; when omitted it defaults to `<project-root>/coverage/v8`. Pass it explicitly only when the project's coverage directory is non-conventional. Both `<project-root>` and `<v8-dir>` may be relative to the workspace.

The script reports, per line:

- `loaded` — number of V8 processes that loaded the script.
- `hit` — number of processes where the **innermost range** covering the line's executable span has `count > 0`.
- `totalHits` — sum of those innermost counts.

Reading the surrounding source is only needed when probing a suspect (to identify which executable position to compare against the V8 range). Do not read source files just to describe the construct of a faithful entry — that is out of scope.

For branches and functions, the lcov BRDA / FNDA values already give the per-process aggregate — usually no need to re-probe V8 unless the lcov entry is uncovered AND you want to confirm whether V8 also reports `count = 0` for that exact arm/function. When in doubt, write a small ad-hoc TS script with `@jridgewell/trace-mapping` to traverse the V8 JSONs (template in `check-lines.ts`).

### 4. Classify each entry as faithful or suspect

Each uncovered entry gets exactly one of two verdicts:

| Verdict      | Meaning                                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| **faithful** | V8 confirms the entry was not executed (innermost range covering the position has `count = 0` in every loaded process). |
| **suspect**  | V8 says `count > 0` somewhere covering the position, but lcov reports the entry as uncovered. **Pipeline bug.**         |

Do not classify _why_ a faithful entry was not executed (runtime-specific, error path, feature without test, dead code, etc.). That is a coverage-design question, not an audit question, and is explicitly out of scope for this skill.

### 5. Produce the report

Write a markdown report with the **suspect section first** (escalated, never buried) and the **faithful section last** (aggregate counts only).

- **Top of report:** per-file totals — `<file>: N uncovered entries (M faithful, K suspect)`.
- **Suspect section:** for each suspect, show file, line, what V8 reports (innermost range count + which process JSON saw it), and what lcov reports for the same position. Include the V8 sub-range coordinates (`startOffset`, `endOffset`, `count`) so the pipeline bug is reproducible.
- **Faithful section:** aggregate count per file only. Do not list per-entry constructs, do not classify reasons, do not recommend tests, do not estimate coverage gains.
- **Final line:** total faithful vs. total suspect across the whole report. If suspect = 0, state explicitly: **"Report is faithful to V8."**

The report must not contain the words "missing test", "recommendation", "coverage gain", or any per-entry rationale for faithful entries. Those belong to a different workflow.

## What "fidelity to V8" means

V8 raw ranges are the source of truth. A given source position is covered iff the **innermost (smallest span) V8 range that fully envelopes it** has `count > 0` in **at least one** of the loaded processes. The lcov report should agree with this for every line/branch/function. Any disagreement is a reporter bug.

## Notes

- V8 offsets are **character-based** (UTF-16 code units), not bytes. The helper scripts already handle this.
- Source-mapped files (TypeScript via `--experimental-strip-types` on Node) require `@jridgewell/trace-mapping` to convert original (line, col) → generated offset before probing V8 ranges. The script handles this automatically when it detects the Node format.
- Functions reported as `(anonymous_N)` in lcov often correspond to genuine arrow callbacks; cross-check the line in the source before flagging as ghost.
- If a line has `loaded` > 0 but `hit` = 0 across all processes, V8 confirms it was never executed — classify as **faithful**.

### V8 dump formats (auto-detected)

The `check-lines.ts` script supports two raw V8 dump shapes:

- **Node (with `NODE_V8_COVERAGE`)**: each JSON groups multiple scripts under a top-level `result[]` array, plus an embedded `source-map-cache` for transpiled sources. Identified by the presence of `result: V8Script[]`. Probing uses `@jridgewell/trace-mapping` to convert original (line, col) → transpiled offset before searching ranges.
- **Deno (`DENO_COVERAGE_DIR`)**: each JSON is a single script with top-level `{ scriptId, url, functions }`. No source-map cache; offsets are reported directly against the original `.ts`/`.js` source. Identified by the absence of `result[]`. Probing maps line → char offset directly via `source.charCodeAt(...)`.

Bun is **not supported** by this skill: Bun uses JSC, not V8, and produces a different coverage shape. Audit Bun coverage requires a separate path that this skill doesn't implement.

The detection is per-JSON (`isNodeFormat(document)`); a `<v8-dir>` mixing Node and Deno dumps would still work, though that's unusual.

#### Caveat (Deno only)

Deno V8 sometimes emits sub-ranges with `count = 0` that envelope code that was definitely executed (visible because outer ranges have `count > 0` and surrounding lines are hit). This appears to be V8 sub-range tracking gaps under Deno's isolate model, not a probe bug. When a line probe returns `hit = 0` but neighboring lines in the same code block are hit, suspect this and confirm by reading the V8 sub-ranges directly (template in `check-lines.ts`). Treat as uncovered legitimately only when the surrounding context also lacks hits.
