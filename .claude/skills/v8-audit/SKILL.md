---
name: v8-audit
user-invocable: true
description: Audit uncovered lines, branches, and functions of a project against raw V8 coverage to determine whether each uncovered entry is legitimate (no test exercises it) or suspect (V8 says it ran but the report says otherwise). Produces a categorized markdown map with recommendations for missing tests.
---

# v8-audit

Cross-checks every uncovered entry in an `lcov.info` against the raw V8 coverage JSONs that produced it. Confirms whether the report is faithful to V8 (the source of truth) or whether the pipeline is hiding something V8 saw.

## When to use

- A project's coverage report shows uncovered lines/branches/functions and you want to know which are real gaps in tests vs. which might be reporter bugs.
- After a change to the coverage pipeline, you want to validate that the report still matches V8.
- You want a roadmap of missing tests grouped by category (runtime-specific, error paths, features without tests, dead code).

## Required inputs (no defaults — you MUST stop and ask if missing)

The user **must** provide both paths when invoking this skill. There are no defaults — auditing the wrong project silently is worse than asking.

- **`<project-root>`** — absolute path to the project being audited. Used to resolve relative source paths (e.g. `src/foo.ts`) when reading source code.
- **`<coverage-dir>`** — absolute path to the coverage output directory from the most recent run. Conventionally `<project-root>/coverage`, but other names exist (e.g. Poku uses `<project-root>/poku-coverage`). The directory **must contain** both:
  - `<coverage-dir>/v8/` — directory of raw V8 coverage JSONs (Node `NODE_V8_COVERAGE` output).
  - `<coverage-dir>/lcov.info` — the lcov report produced from the same run.

### Halting rule

Before doing any work, verify both inputs were provided by the user. If either is missing, **stop immediately** and reply:

> This skill requires two inputs:
>
> - `<project-root>` — absolute path to the project being audited.
> - `<coverage-dir>` — absolute path to the coverage output directory containing both `v8/*.json` and `lcov.info` from the same run.
>
> Please re-invoke with both paths, e.g.:
>
> `/v8-audit /path/to/project /path/to/project/coverage`

Do not guess paths, do not fall back to a previous session's project. Wait for the user to re-invoke with explicit inputs.

## Procedure

### 1. Confirm inputs exist

Once the user has provided both paths, verify on disk:

- The project root exists and is a directory.
- The coverage directory exists and is a directory.
- `<coverage-dir>/lcov.info` exists and is non-empty.
- `<coverage-dir>/v8/` exists and contains at least one `.json` file.

If any of these checks fail, stop and ask the user to regenerate coverage (or correct the path) before continuing.

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
npx tsx .claude/skills/v8-audit/scripts/check-lines.ts <project-root> <coverage-dir>/v8 <relative/path/to/file> <line> [<line>...]
```

The script reports, per line:

- `loaded` — number of V8 processes that loaded the script.
- `hit` — number of processes where the **innermost range** covering the line's executable span has `count > 0`.
- `totalHits` — sum of those innermost counts.

Read the surrounding source (Read tool) to understand the construct (which arm of an `if`, which case of a switch, which catch block, etc.).

For branches and functions, the lcov BRDA / FNDA values already give the per-process aggregate — usually no need to re-probe V8 unless you suspect the pipeline is mis-attributing. When in doubt, write a small ad-hoc TS script with `@jridgewell/trace-mapping` to traverse the V8 JSONs (template in `check-lines.ts`).

### 4. Categorize each entry

Place each uncovered entry into one of these buckets:

| Category                        | Meaning                                                                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Runtime/OS-specific**         | Branch only taken on Windows / Bun / Deno / a specific runtime not exercised.                                                                          |
| **Error/cleanup path**          | `} catch`, `uncaughtException` handler, `child.on('error')`, fallback in `}` finally — only triggered when something goes wrong.                       |
| **Feature without test**        | `--watch`, `--coverage`, plugin lifecycle, etc.: the test suite simply doesn't exercise this feature.                                                  |
| **Default arm in passing test** | `success ? 'success' : 'fail'` arm `'fail'` — covered when assertions fail; in the suite they pass.                                                    |
| **Dead code (genuine)**         | Caller short-circuits before this can be reached, or the call site always passes a flag that prevents this branch. Recommend removal.                  |
| **Suspect**                     | V8 says `count > 0` somewhere covering this position, but the lcov says the entry is uncovered. **This is a reporter bug — investigate the pipeline.** |

### 5. Produce the report

Write a markdown report grouped by category. For each entry include: file, line, the construct (one short phrase), and the reason. End with:

- A **Conclusion** stating how many entries fell into each bucket.
- A **Recommendations** section: for the _Feature without test_ and _Default arm_ buckets, suggest concrete missing tests grouped by feature. Estimate the resulting coverage % gain if those tests were added.
- For any **Suspect** entries, escalate immediately — don't bury them in the table. Open a separate section explaining what V8 reports vs. what the lcov shows.

## What "fidelity to V8" means

V8 raw ranges are the source of truth. A given source position is covered iff the **innermost (smallest span) V8 range that fully envelopes it** has `count > 0` in **at least one** of the loaded processes. The lcov report should agree with this for every line/branch/function. Any disagreement is a reporter bug.

## Notes

- V8 offsets are **character-based** (UTF-16 code units), not bytes. The helper scripts already handle this.
- Source-mapped files (TypeScript via `--experimental-strip-types` on Node) require `@jridgewell/trace-mapping` to convert original (line, col) → generated offset before probing V8 ranges. The script handles this automatically when it detects the Node format.
- Functions reported as `(anonymous_N)` in lcov often correspond to genuine arrow callbacks; cross-check the line in the source before flagging as ghost.
- If a line has `loaded` > 0 but `hit` = 0 across all processes, that line is genuinely never executed in the test suite — legitimate uncovered.

### V8 dump formats (auto-detected)

The `check-lines.ts` script supports two raw V8 dump shapes:

- **Node (with `NODE_V8_COVERAGE`)**: each JSON groups multiple scripts under a top-level `result[]` array, plus an embedded `source-map-cache` for transpiled sources. Identified by the presence of `result: V8Script[]`. Probing uses `@jridgewell/trace-mapping` to convert original (line, col) → transpiled offset before searching ranges.
- **Deno (`DENO_COVERAGE_DIR`)**: each JSON is a single script with top-level `{ scriptId, url, functions }`. No source-map cache; offsets are reported directly against the original `.ts`/`.js` source. Identified by the absence of `result[]`. Probing maps line → char offset directly via `source.charCodeAt(...)`.

Bun is **not supported** by this skill: Bun uses JSC, not V8, and produces a different coverage shape. Audit Bun coverage requires a separate path that this skill doesn't implement.

The detection is per-JSON (`isNodeFormat(document)`); a `<v8-dir>` mixing Node and Deno dumps would still work, though that's unusual.

#### Caveat (Deno only)

Deno V8 sometimes emits sub-ranges with `count = 0` that envelope code that was definitely executed (visible because outer ranges have `count > 0` and surrounding lines are hit). This appears to be V8 sub-range tracking gaps under Deno's isolate model, not a probe bug. When a line probe returns `hit = 0` but neighboring lines in the same code block are hit, suspect this and confirm by reading the V8 sub-ranges directly (template in `check-lines.ts`). Treat as uncovered legitimately only when the surrounding context also lacks hits.
