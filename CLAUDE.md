# @pokujs/coverage

The first code coverage package that targets Node.js (V8), Bun (JSC), and Deno (V8) simultaneously.

> Notes to the agent:
>
> - When an implementation goes wrong, avoid fixing progressively on top of errors, eliminate the error and implement the right approach in a clean and concise way.
> - This document is living. If you complete a plan that changes the project structure (e.g., extract a shared module, introduce a new group/pattern), update the rules and examples below in the same commit. Do not let this document drift from repository reality.
>   - **CLAUDE.md edits require explicit per-edit authorization.** "Plan approval", "Edit automatically" does not count.
> - Do not write to "/tmp", instead use the "tools/debug" directory which is not tracked by Git.

---

## How It Works

- Under **Node.js**, the plugin sets `NODE_V8_COVERAGE` before **Poku** spawns tests. On teardown, the plugin reads the **V8** **JSON** files from `<tempDir>` and forwards the data.
- Under **Deno**, the plugin sets `DENO_COVERAGE_DIR` before **Poku** spawns tests. On teardown, the plugin reads the **V8** **JSON** files from `<tempDir>` (emitted as bare `V8ScriptCoverage` entries, without the Node-style envelope) and forwards the data.
- Under **Bun**, the plugin attaches to the **JSC** **Inspector** over WebSocket and captures basic-block execution counts via `Runtime.getBasicBlocks`. On teardown, the plugin reads the **JSON** files from `<tempDir>` and forwards the data.

> V8 vs. JSC reports have structural distinctions, therefore, the focus is not that all runtimes present exactly the same lines and percentages, but rather that coverage within the limits of each engine and runtime is coherent and consistent with the reality of each fixture and their respective snapshots.
>
> - When the Istanbul convention and the reality of the coverage report diverge, you should ask me how to proceed.

---

## Types

- **Forbidden: declaring `type X = ...` (or `interface X`) anywhere outside [src/@types/](src/@types/).** This includes non-exported, file-local, and "helper" types. There is no "local enough to skip" exception. The only directories where inline types are allowed: `.claude/skills/` and `./tools/`.
  - One file per domain. Open the directory to see the current inventory before adding a new file. If a new type does not fit any existing domain, create a new domain file.
  - Never a `misc.ts`. Never an `index.ts` barrel.
  - **Self-check before finishing any edit:** `npm run lint:types` must exit zero. Any hit is a bug to fix in the same edit, not a follow-up.
- **Always `import type { ... }` from `@types/`.** Every consumer imports directly from the domain file, never from an aggregator.
- **Prefer `type` over `interface`.**
- **No `any`. No `as unknown as T` (or variants).** Direct `as T` only at real boundaries (`JSON.parse(content) as MyShape`), never to force compatibility between types you own.
- **Prefer named types over `string`, `unknown`, or broad generics.** If a specific union already exists (e.g. `Runtime`), use it.
- **Deduplicate.** If the same type appears in two places (even via `Foo['bar']`), unify it under `@types/` and import from both sides.

---

## Variable Naming

- **Forbidden: abbreviated names.** Applies to local variables, function parameters, callback parameters, destructured parameters, and loop iterators.
- **Forbidden: cryptic abbreviations, even at 5+ characters.** None of `brf`, `brh`, `fnAgg`, `fn`, etc. Write the full word: `branchesFound`, `branchesHit`, etc.
- **If the name is ambiguous, it is wrong.** If the reader must check the type or surrounding context to learn what a variable represents, rename it.
  - Signals: `out`, `any`, generic `value` or `result` when a more specific name exists.
- **Name callbacks and iterators after what they iterate.** `files.map((file) => …)`, `lineHits.filter((hits) => …)`, `for (const scriptFunction of script.functions)`. Never `(f)`, `(h)`, `(fn)`.
- **Name loop indices by role.** Never `let i = 0`. Use `byteIndex`, `rangeIndex`, `columnIndex`, `childIndex`, etc.
- **Sort comparators use `left` and `right`, not `a` and `b`.**

---

## File and Directory Architecture

### Comments and dividers

- **Forbidden: comment separators to divide sections inside a file.** No `// ---- Section ----`, no `/* === */`, no decorative dividers. A file that "needs" them has multiple responsibilities. Split it.
- **Default to writing no comments.** Code and identifier names carry the meaning. The only allowed comment blocks are attribution headers (BSD, ISC, MIT) at the top of files vendored from upstream projects.

### Where code lives

- **Put generic utilities under [src/utils/](src/utils/), never in domain files.** If a function does not depend on the scope it was written in, it does not belong there. Categorize by nature (`strings.ts`, `paths.ts`), never by consumer, never a `misc.ts`.
- **Vendored code carries an attribution header.** Deliberate cuts from upstream are documented at the top of the vendored file, not here.
- **Extract duplicated logic between sibling modules to a shared module in the same layer.** If N files in the same folder share the same skeleton with small parameterizable differences, extract the skeleton. The `shared/` pattern applies equally to `src/` and to test helpers.
  - `src/runtimes/lifecycle/` for runtime setup and teardown.
  - `shared/` subfolders under [src/reporters/](src/reporters/), [src/converters/](src/converters/), and [test/**utils**/readers/](test/__utils__/readers/) for cross-consumer helpers.
  - AST primitives live in [src/converters/shared/](src/converters/shared/).
- **Promote on second consumer. Never duplicate. Never import from a sibling.** The moment a helper in `reporters/text/` is needed by `reporters/html/`, it moves to `reporters/shared/` in the same commit. A sibling reporter (or converter) reaching into another's internals is a bug to fix, not a shortcut to use.
- **Single file vs. directory with `index.ts` barrel.** When a file accumulates distinct responsibilities (discovery, parsing, serialization, orchestration), promote it to a directory. `index.ts` is strictly the orchestrator and public entry. Each responsibility goes into its own file. Established patterns: [src/reporters/text/](src/reporters/text/), [src/converters/v8-to-istanbul/](src/converters/v8-to-istanbul/), [src/converters/v8-nodefy/](src/converters/v8-nodefy/), [src/reporters/shared/lcov/](src/reporters/shared/lcov/), [src/configs/](src/configs/).
- **Runtime envelope handling stays at the entry boundary.** [src/converters/v8-nodefy/](src/converters/v8-nodefy/) is the only site where Node-vs-Deno V8 envelopes are inspected. Everything downstream operates on the uniform `V8NodefiedDocument`.
- **Bun's preload script lives at [src/runtimes/bun/preload.ts](src/runtimes/bun/preload.ts) and builds separately in `lib/preload-bun.js`.**
- **[src/core.ts](src/core.ts) is the boundary: [src/bin/](src/bin/) and [src/integrations/](src/integrations/) only import from it.**
- **Each runner under [src/integrations/](src/integrations/) adapts the core to the shape that runner expects (e.g., `poku`, `vitest`).** Same single-file-vs-directory rule as elsewhere applies.

### Exports

- **Prefer object-approach over prefixed functions.** `lcov.filter`, not `filterLcov`. `state.create`, not `createState`. `converters.v8ToLcov`, not `convertV8ToLcov`. Export a single `const` named after the module, aggregating the operations as properties.
  - Applies from day one, including single-method modules. The namespace is the future extension point AND the present consistency point.
- **Pick the module by what the operation produces or transforms, not by who imports it.** `filterLcov` is LCOV to LCOV, so `lcov.filter`. `convertV8ToIstanbul` is V8 JSON to Istanbul `CoverageMap` (distinct formats), so `converters.v8ToIstanbul.convert`.
  - A converter is a format to format transformation between distinct formats (V8 to istanbul, JSC to istanbul). Same-format transformations stay in their format's own domain, never under `converters/`.
- **Wire external consumers through the namespace:** `lcov.parse(...)`, `reporters.run(...)`. Sibling files inside the same directory may import each other directly when going through `index.ts` would create a cycle. When importing the namespace shadows a local variable, rename the local, never the import (e.g. `state` to `coverageState`).
- **Update this file in the same commit.** If you introduced a new pattern or structure, add it to the rules above. Architecture drift happens the moment a refactor is committed without the doc update.

### Tests, fixtures, snapshots

End-to-end tests live under [test/](test/).

- **Follow established patterns before inventing a new one.** Look for a similar structure in the project and replicate it.
  - If the existing pattern does not fit, understand why before diverging.
- **Directories that do not hold actual tests carry the `__` prefix and suffix** (`__utils__`, `__fixtures__`, `__resources__`, `__snapshots__`). Visual signal: "this is infrastructure, not a test".
- **One test file per `(reporter, case)` pair.** Runtime is not a filename segment. It is the iteration axis inside the file. The test iterates the runtimes list and opens a `test` block per runtime. The runtime prefix in the title is the filter point for `npm run test:<runtime>`.
- **Case is always its own path segment** in tests, in fixtures, in snapshots. Never flatten it into the filename. The three artifacts share the same `<case>` name so they can be located from one another by substitution.
- **Runtime-agnostic test body.** Resolve fixture, run poku, compare against snapshot. Legitimate divergence between runtimes lives in the snapshot, never in the test.
- **Fixtures are hydrated at setup time.** Each `<reporter>/<runtime>/<case>/` directory versions only its `poku.config.js`. `src/` and `test/` are copied in from [test/\_\_resources\_\_/](test/__resources__/) by the `hydrate()` step in [poku.config.js](poku.config.js).
- **Test helpers follow the typed-object export pattern**, same rule as `src/`. Helper types live under `@types/` like any other domain.
- **Snapshots are stored per platform: `<reporter>/<runtime>/<platform>/<case>.<ext>`** where `<platform>` is one of `darwin`, `linux`, `win32`. There is no "shared" snapshot. Every OS carries its own copy, even when content is identical.
- **Every `.json` snapshot follows the canonical `CoverageSnapshot` shape in [src/@types/tests.ts](src/@types/tests.ts).** Each reporter fills only the fields it emits; simpler reporters are natural subsets of richer ones. Reader files in [test/**utils**/readers/](test/__utils__/readers/) parse the native format into that shape via builders in [test/**utils**/readers/shared/snapshot.ts](test/__utils__/readers/shared/snapshot.ts). Text reporters keep their `.txt` snapshots as-is.
- **Regenerate snapshots via tooling, never by hand.**
  - `npm run build:snapshots`.
  - Or `bash scripts/snapshots-<os>.sh`.
  - Always ask before regenerating.
- **No guards for missing runtimes.** If a runtime binary is absent, `spawn` fails with `ENOENT` and the test fails naturally.
- **Always `npm run build` before running E2E tests.** Fixtures import from `lib/`.

---

## Scripts

```sh
npm run typecheck
npm run lint:types
npm test               # runs all tests for each runtime
```

```sh
npm run build
npm run test:node      # runs all tests for Node.js
bun run test:bun       # runs all tests for Bun
deno task test:deno    # runs all tests for Deno
```

---

## Skills

- [.claude/skills/v8-audit/SKILL.md](.claude/skills/v8-audit/SKILL.md): audits uncovered lines/branches/functions of a project against raw V8 (Node.js / Deno).
  - **Usage:** `/v8-audit <project-path> [<coverage-path>]` (requires `lcov` and `v8` reporter outputs)
- [.claude/skills/jsc-audit/SKILL.md](.claude/skills/jsc-audit/SKILL.md): audits uncovered lines/functions of a project against raw JSC basic-blocks (Bun).
  - **Usage:** `/jsc-audit <project-path> [<coverage-path>]` (requires `lcov` and `jsc` reporter outputs from a Bun-only run)
