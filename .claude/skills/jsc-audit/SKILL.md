---
name: jsc-audit
user-invocable: true
description: Audit a Bun JSC coverage report (lcov.info) by inspecting raw `.jsc.json` dumps. Reports raw block data per probed line; the agent interprets divergences from lcov. No automatic verdicts.
---

# jsc-audit

Cross-checks a Bun-produced `lcov.info` against the raw JSC dumps (`.jsc.json`) that the same run emitted. The skill reads JSC dumps as data — it does not import any pipeline code from `src/`. If the pipeline that produced the lcov has a bug, the skill must remain capable of detecting it.

## When to use

- A Bun project's coverage report shows uncovered entries and you want to know whether the JSC dump agrees with the lcov.
- After a change to the JSC pipeline, you want to validate that the lcov it produces still matches what the raw `.jsc.json` data says.

This skill does not recommend tests, does not estimate coverage gains, and does not classify _why_ code was left uncovered. Its only purpose is to surface what JSC reported, in raw form, so the agent can compare with lcov.

## Inputs

- **`<project-root>`** _(required)_ — path to the project being audited. May be absolute or relative; relative paths resolve against the current workspace (`process.cwd()`).
- **`<coverage-dir>`** _(optional)_ — path to the coverage output directory. Defaults to `<project-root>/coverage`. Pass it explicitly only when the project uses a non-conventional name. May be absolute or relative. Must contain:
  - `<coverage-dir>/jsc/` — directory of `.jsc.json` dumps, flat or nested.
  - `<coverage-dir>/lcov.info` — the lcov report from the same Bun-only run.

The lcov input must come from a **Bun-only** run. Lcov merged with another runtime's output produces meaningless results — regenerate from a single Bun pass before invoking.

### Halting rule

If `<project-root>` is missing, **stop immediately** and reply:

> This skill requires at least one input:
>
> - `<project-root>` — path to the project being audited (absolute or relative to the workspace).
> - `<coverage-dir>` — _optional_, defaults to `<project-root>/coverage`.
>
> Please re-invoke with the project path, e.g.:
>
> `/jsc-audit playground/ts-lab` (uses `playground/ts-lab/coverage` by default) or `/jsc-audit poku poku-coverage` (custom dir).

Do not guess the project, do not fall back to a previous session's project. Wait for the user to re-invoke with the project path.

## Procedure

### 1. Resolve and confirm inputs

Resolve relative paths against the current workspace. If `<coverage-dir>` was omitted, set it to `<project-root>/coverage`. Then verify on disk:

- The project root exists and is a directory.
- The coverage directory exists and is a directory.
- `<coverage-dir>/lcov.info` exists and is non-empty.
- `<coverage-dir>/jsc/` exists and contains at least one `.jsc.json` file (flat or one level down).

If any check fails, stop and ask the user to regenerate coverage (or pass an explicit `<coverage-dir>`) before continuing.

### 2. Extract uncovered entries from lcov

Run `npx tsx .claude/skills/jsc-audit/scripts/extract-uncovered.ts <coverage-dir>/lcov.info`. Output is tab-separated:

```
<file>\tline\t<lineNumber>
<file>\tfunction\t<lineNumber>\t<name>
```

Lcov from a Bun-only run never contains `BRDA` records (JSC reports no branches). The extractor does not surface branch entries. If you ever see lcov with `BRF > 0` in a Bun run, the lcov was contaminated by another engine — abort and ask the user to regenerate from a Bun-only pass.

### 3. Probe JSC for each uncovered entry

For each line you want to investigate, run:

```
npx tsx .claude/skills/jsc-audit/scripts/probe-jsc.ts <project-root> [<jsc-dir>] <relative/path/to/file> <line> [<line>...]
```

`<jsc-dir>` is optional; default `<project-root>/coverage/jsc`. Both `<project-root>` and `<jsc-dir>` may be relative to the workspace.

The script reports for each line:

- The path of the `.jsc.json` dump whose `url` matches the source file, or `Dump: not found` if no dump exists for that file.
- The transpiled offsets `[start, end]` that the line maps to via the dump's inline source map.
- A list of every block in `dump.blocks` that has any non-empty intersection with that range. Each block is marked as `envelops` (covers the line range entirely) or `intersects` (covers only part of it; the overlapping transpiled offsets are printed alongside). Raw `executionCount` and `hasExecuted` are reported as JSC emitted them.

The script does not pick a "best" block, does not filter by span, does not derive a verdict. Interpretation is your job. Partial-intersection blocks matter: sub-statement scopes such as catch arms, ternary branches, and dead `return` paths often appear as count=0 sub-blocks that intersect a line without enveloping it.

### 4. Interpret raw block data

For each probed line, decide whether the lcov entry is consistent with what JSC reported. Useful patterns:

- **`Dump: not found`** — JSC never observed this file. Lcov reporting any coverage entries for it is a divergence: the pipeline is fabricating coverage. Treat as a finding.
- **All intersecting blocks have `executionCount = 0`** — JSC saw the position and reports it as not executed. Consistent with lcov uncovered.
- **All intersecting blocks have `executionCount > 0`** — JSC reports execution everywhere on the line. This may or may not be a divergence: read the source slice covered by the smallest block. If the smallest block spans a whole function or the whole module, an `executionCount > 0` only means the function/module was loaded or invoked at least once, not that this specific line ran. If the smallest block is a sub-statement scope and `intersects` (covers part of the line), `executionCount > 0` is concrete evidence the covered portion ran.
- **Mixed counts (some blocks > 0, some = 0)** — common pattern. A block marked `intersects` with `executionCount = 0` means JSC reports the _covered_ sub-range as never executed; if that sub-range contains the statement-significant portion of the line (the call, the assignment, the return), then the line did not execute and lcov uncovered is correct. If the count=0 block intersects only trivial trailing characters (a final `;` or `\n`), the rest of the line may still have executed.
- **Always inspect the snippet covered by the smallest block** before concluding. Span alone is not enough — you need to see what the bytes mean.

### 5. Produce the report

Write a markdown report. Free-form structure driven by the actual findings — there is no fixed template. Useful conventions:

- Lead with divergences (lcov vs JSC mismatches that warrant investigation), since those are the actionable output.
- For divergences, include: file, line, what lcov says, what JSC reports (the raw blocks), and your reasoning.
- Aggregate consistent entries (lcov agrees with JSC) at the end as a count, not item-by-item.
- If there are no divergences, state explicitly that lcov agrees with the JSC dumps.

## Notes on JSC

- JSC dumps are **per-script** — one `.jsc.json` per source file the Bun run loaded. Files imported but never executed at module evaluation may not get a dump at all.
- `dump.url` is an absolute filesystem path, no `file://` prefix.
- `dump.source` is the Bun-transpiled JS, ending with `//# sourceMappingURL=data:application/json;base64,...`. Probe decodes this to map original positions to transpiled offsets.
- JSC blocks vary in granularity: a single position may be enveloped by a sub-statement block, a function-body block, and a module-wide block simultaneously, each with its own `executionCount`. The skill shows them all without picking one.
- JSC does not report branches. Lcov from Bun-only runs has `BRF:0 BRH:0` everywhere.
- This skill does not handle V8 (Node.js / Deno) coverage.
