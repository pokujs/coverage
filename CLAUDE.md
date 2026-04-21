# @pokujs/coverage

The first code coverage package that targets Node.js (V8), Bun (JSC), and Deno (V8) simultaneously. Exclusive plugin for Poku, the only test runner that executes the same test suite natively on the three runtimes.

> Note to the agent: this document is living. If you complete a plan that changes the project structure (e.g., extract a shared module, introduce a new group/pattern), update the rules and examples below in the same commit. Do not let this document drift from repository reality.
>
> - Always ask before changing this document.

---

## Types

- **Prefer `type` over `interface`.**
- **Put 100% of `type` definitions under [src/@types/](src/@types/), one file per domain.** Open the directory to see the current inventory. If a new type does not fit any existing domain, create a new file.
  - Never a `misc.ts`. Never an `index.ts` barrel.
- **Always `import type { ... }` from `@types/`.** Every consumer imports directly from the domain file, never from an aggregator.
- **No `any`. No `as unknown as T` (or variants).** Direct `as T` only at real boundaries (`JSON.parse(content) as MyShape`), never to force compatibility between types you own.
- **Prefer named types over `string`, `unknown`, or broad generics.** If a specific union already exists (e.g. `Runtime`), use it.
- **Deduplicate.** If the same type appears in two places (even via `Foo['bar']`), unify it under `@types/` and import from both sides.
- **When introducing a new type:** identify its domain, export it from the matching file (or create a new domain file), import it in consumers via the specific path.

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
  - [src/runtimes/lifecycle.ts](src/runtimes/lifecycle.ts) for runtime setup and teardown.
  - `shared/` subfolders under [src/reporters/](src/reporters/), [src/converters/](src/converters/), and [test/**utils**/readers/](test/__utils__/readers/) for cross-consumer helpers.
  - AST primitives live in [src/converters/shared/](src/converters/shared/).
- **Promote on second consumer. Never duplicate. Never import from a sibling.** The moment a helper in `reporters/text/` is needed by `reporters/html/`, it moves to `reporters/shared/` in the same commit. A sibling reporter (or converter) reaching into another's internals is a bug to fix, not a shortcut to use.
- **Single file vs. directory with `index.ts` barrel.** When a file accumulates distinct responsibilities (discovery, parsing, serialization, orchestration), promote it to a directory. `index.ts` is strictly the orchestrator and public entry. Each responsibility goes into its own file. Established patterns: [src/reporters/text/](src/reporters/text/), [src/converters/v8-to-lcov/](src/converters/v8-to-lcov/), [src/reporters/lcovonly/](src/reporters/lcovonly/), [src/configs/](src/configs/).
- **`index.ts` is never a type aggregator.** Types still come from `@types/`.

### Exports

- **Prefer object-approach over prefixed functions.** `lcov.filter`, not `filterLcov`. `state.create`, not `createState`. `converters.v8ToLcov`, not `convertV8ToLcov`. Export a single `const` named after the module, aggregating the operations as properties.
  - Applies from day one, including single-method modules. The namespace is the future extension point AND the present consistency point.
- **Pick the module by what the operation produces or transforms, not by who imports it.** `filterLcov` is LCOV to LCOV, so `lcov.filter`. `convertV8ToLcov` is V8 JSON to LCOV (distinct formats), so `converters.v8ToLcov`.
  - A converter is a format to format transformation between distinct formats (V8 to LCOV, V8 to istanbul). Same-format transformations stay in their format's own domain, never under `converters/`.
- **Wire external consumers through the namespace:** `lcov.parse(...)`, `reporters.run(...)`. Sibling files inside the same directory may import each other directly when going through `index.ts` would create a cycle. When importing the namespace shadows a local variable, rename the local, never the import (e.g. `state` to `coverageState`).
- **Update this file in the same commit.** If you introduced a new pattern or structure, add it to the rules above. Architecture drift happens the moment a refactor is committed without the doc update.

### Tests, fixtures, snapshots

End-to-end tests live under [test/](test/). Open the directory to see the current layout.

- **Follow established patterns before inventing a new one.** Look for a similar structure in the project and replicate it.
  - If the existing pattern does not fit, understand why before diverging.
- **Directories that do not hold actual tests carry the `__` prefix and suffix** (`__utils__`, `__fixtures__`, `__resources__`, `__snapshots__`). Visual signal: "this is infrastructure, not a test".
- **One test file per `(reporter, case)` pair.** Runtime is not a filename segment. It is the iteration axis inside the file. The test iterates the runtimes list and opens a `test` block per runtime. The runtime prefix in the title is the filter point for `npm run test:<runtime>`.
- **Case is always its own path segment** in tests, in fixtures, in snapshots. Never flatten it into the filename. The three artifacts share the same `<case>` name so they can be located from one another by substitution.
- **Runtime-agnostic test body.** Resolve fixture, run poku, compare against snapshot. Legitimate divergence between runtimes lives in the snapshot, never in the test.
- **Fixtures are hydrated at setup time.** Each `<reporter>/<runtime>/<case>/` directory versions only its `poku.config.js`. `src/` and `test/` are copied in from [test/\_\_resources\_\_/](test/__resources__/) by the `hydrate()` step in [poku.config.js](poku.config.js).
- **Fixture source of truth lives under [test/\_\_resources\_\_/](test/__resources__/).** Pattern resolution is done by a Map in [poku.config.js](poku.config.js).
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
npm run test:node    # runs all tests for Node.js
npm run test:deno    # runs all tests for Deno
npm run test:bun     # runs all tests for Bun
npm test             # runs all tests for each runtime
```

Always ask before regenerating snapshots after a deliberate change to a reporter's output.

```sh
npm run build:snapshots
```
