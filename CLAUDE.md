# @pokujs/coverage

The first code coverage package that targets Node.js, Bun, and Deno simultaneously. Exclusive plugin for **Poku**, the only test runner that executes the same test suite natively on the three runtimes.

---

## Types

- **Use `type`, never `interface`.**
- **100% of `type` definitions live under [src/@types/](src/@types/), one file per domain.** Open the directory to see the current inventory. If a new type doesn't fit any existing domain, create a new file — never a `misc.ts`, never an `index.ts` barrel.
- **Always `import type { ... }`** from `@types/`. Every consumer imports directly from the domain file, never from an aggregator.
- **No `any`.** No `as unknown as T` (or variants). Direct `as T` only at real boundaries (`JSON.parse(content) as MyShape`), never to force compatibility between types you own.
- **Prefer named types over `string` / `unknown` / broad generics.** If a specific union already exists (e.g. `Runtime`), use it. Broad types are a smell — investigate before accepting.
- **Deduplicate.** If the same type appears in two places (even via `Foo['bar']`), unify it under `@types/` and import from both sides.
- **When introducing a new type:** identify its domain → export it from the matching file (or create a new domain file) → import it in consumers via the specific path.

---

## Variable Naming

Code is not minified. Every identifier must be chosen for the person who will open the file six months from now with zero context. Abbreviations and single letters force the reader to reconstruct meaning — that is tech debt, not concision.

- **Forbidden: names shorter than 5 characters**, except the exceptions below. Applies to local variables, function parameters, callback parameters, destructured parameters, and loop iterators.
- **Forbidden: cryptic abbreviations**, even at 5+ characters. None of: `brf`, `brh`, `fnAgg`, `fnKey`, `lnStr`, `takenIdx`, `subs`, `agg`, `ctx`, `buf`, `bin`, `dir`, `ext`, `rel`, `fc`, `col`, `idx`, `fn` (as a variable), `ln`, `st`, `raw`, `cur`, `prev`. Write the full word: `branchesFound`, `branchesHit`, `functionEntry`, `functionKey`, `lineNumberStr`, `takenIndex`, `sortedSubRanges`, `aggregation`, `context`, `buffer`, `binary`, `coverageDir`, `extension`, `relativePath`, `fileCoverage`, `column`, `columnIndex`, `scriptFunction`, `lineNumber`, `stats`, `rawLine`, `current`, `previous`.
- **If the name is ambiguous, it is wrong.** If the reader must check the type or surrounding context to learn what a variable represents, rename it. `out`, `any`, generic `value` / `result` when a more specific name exists — all signals.
- **Callbacks and iterators inherit the name of what they iterate.** In `files.map((file) => …)`, `lineHits.filter((hits) => …)`, `for (const scriptFunction of script.functions)`. Never `(f)`, `(h)`, `(fn)`.
- **Sort comparators use `left` and `right`, not `a` and `b`.** No exception for "language idiom".
- **Loop indices are named after their role.** Never `let i = 0`. Use `byteIndex`, `rangeIndex`, `columnIndex`, `childIndex`, etc.
- **Binary search uses `low` / `high` / `middle`**, not `lo` / `hi` / `mid`.
- **Unused parameters follow the same rule with a `_` prefix:** `_context`, not `_ctx`.
- **Allowed exceptions (and only these):** `cwd`, `url`, `hit` (field on `Metric`), `key`, `row`, `pad` / `BOX`. Any other exception requires explicit justification at review time.
- **When reviewing existing code, treat short variables as readability bugs:** rename them as part of the change you are already making — never defer to "later".

---

## File and Directory Architecture

> **Note to the agent:** this section is a living document. If you complete a plan that changes the project structure (extract a shared module, promote a file into a folder, introduce a new grouping pattern), update the rules and examples below in the same commit. Do not let this section drift from repository reality.

The directory structure exists to make each thing's scope self-evident. Anyone opening the project should be able to locate any responsibility from the structure alone — without opening files to discover what lives where. Separation by file is communication; separation by comment is noise.

### Comments and dividers

- **Forbidden: comment separators to divide sections inside a file.** No `// ---- Section ----`, no `/* === */`, no decorative dividers. A file that "needs" them has multiple responsibilities — split it.
- **Default to writing no comments.** Code and identifier names carry the meaning. The only allowed comment blocks are attribution headers (BSD/ISC/MIT) at the top of files vendored from upstream projects.

### Where code lives

- **Generic utilities live under [src/utils/](src/utils/), never in domain files.** If a function doesn't depend on the scope it was written in, it does not belong there. Categorize by nature (`strings.ts`, `paths.ts`), never by consumer, never a `misc.ts`.
- **Vendored code carries an attribution header.** Deliberate cuts from upstream are documented at the top of the vendored file — not here.
- **Duplicated logic between sibling modules must be extracted to a shared module in the same layer.** If N files in the same folder share the same skeleton with small parameterizable differences, extract the skeleton. Examples: [src/runtimes/lifecycle.ts](src/runtimes/lifecycle.ts) for runtime setup/teardown; `shared/` subfolders under [src/reporters/](src/reporters/), [src/converters/](src/converters/), and [test/**utils**/readers/](test/__utils__/readers/) for cross-consumer helpers. The `shared/` pattern applies equally to `src/` and to test helpers.
- **Promote on second consumer, never duplicate, never import from a sibling.** The moment a helper in `reporters/text/` is needed by `reporters/html/`, it moves to `reporters/shared/` in the same commit. A sibling reporter (or converter) reaching into another's internals is a bug to fix, not a shortcut to use.
- **Single file vs. directory with `index.ts` barrel.** When a file accumulates distinct responsibilities (discovery, parsing, serialization, orchestration…), promote it to a directory. `index.ts` is strictly the orchestrator / public entry; each responsibility goes into its own file. Established patterns: [src/reporters/text/](src/reporters/text/), [src/converters/v8-to-lcov/](src/converters/v8-to-lcov/), [src/reporters/lcovonly/](src/reporters/lcovonly/).
- **`index.ts` is never a type aggregator.** Types still come from `@types/`.

### Exports

- **Group related exports into a typed object when they represent a unified interface.** Export a single `const` named after the module (e.g. `node`, `lcov`, `converters`), typed via a handler type in `@types/`. Benefits: no repeated prefixes, coherence enforced by a shared type, uniform dispatch (`reporters[name].run(...)`).
- **Forbidden: prefixed top-level exports** like `lcovReporter`, `v8Reporter`, `normalizeReporters`, `convertV8ToLcov`, `createState`, `loadConfig`. They duplicate the folder/module name in every identifier and block uniform dispatch.
- **Every new module that exposes operations must follow the typed-object pattern from day one — no exceptions for single-method modules.** The namespace is the future extension point AND the present consistency point.
- **A converter is a format → format transformation between distinct formats** (V8 → LCOV, V8 → istanbul). Same-format transformations (`filter` over LCOV → LCOV) stay in their format's own domain, never under `converters/`.

### How to apply the typed-object rule when introducing or touching a module

Walk through this every time — it is the difference between coherence and drift.

1. **Recognize the smell.** Any of the following is the trigger:
   - A function exported with a prefix that repeats its folder/file name (`parseLcov` in `lcov/`, `createState` in `state.ts`).
   - A module that exports two or more loose top-level functions instead of grouping them.
   - A module that exports one operation today but has obvious room to grow. Single-method modules still adopt the namespace.

2. **Pick the domain by what the operation produces or transforms, NOT by who imports it.** The lone consumer is irrelevant. `filterLcov` is LCOV→LCOV → belongs to `lcov.filter`, not to `converters/`. `convertV8ToLcov` is V8 JSON → LCOV (distinct formats) → belongs to `converters.v8ToLcov`.

3. **Place the handler type.** If the data type already lives in an `@types/` file, put the handler type there. Otherwise create a new domain file under `@types/`. Never split related types across files just to "keep handlers separate".

4. **Drop the redundant prefix from the function.** `parseLcov` → `parse`, `createState` → `create`. The local `const` carries the bare name; the exported typed object aggregates them. **Handler property keys are allowed to be shorter than the 5-char minimum** (`run`, `parse`, `load`) — that minimum applies to variables, not to stable interface keys consumers read at every call site.

5. **Wire consumers through the namespace.** External consumers always go through it: `lcov.parse(...)`, `reporters.run(...)`. Sibling files inside the same directory may import each other directly when going through `index.ts` would create a cycle. When importing the namespace shadows a local variable, **rename the local, never the import** (e.g. `state` → `coverageState`).

6. **Update this file in the same commit.** If you introduced a new pattern or structure, add it to the rules above. Architecture drift happens the moment a refactor is committed without the doc update.

### Tests, fixtures, snapshots

- Follow established patterns before inventing a new one.
- Look for a similar structure in the project and replicate it — coherence between folders is a sign of reading. If the existing pattern does not fit, understand why before diverging.

End-to-end tests live under [test/](test/). Open the directory to see the current layout — the rules below govern it.

- **Directories that do not hold actual tests carry the `__` prefix/suffix** (`__utils__`, `__fixtures__`, `__snapshots__`). It is the visual signal "this is infrastructure, not a test".
- **One test file per `(reporter, case)` pair.** Runtime is **not** a filename segment — it is the iteration axis inside the file. The test iterates the runtimes list and opens a `test` block per runtime; the runtime prefix in the title is the filter point for `npm run test:<runtime>`.
- **Case is always its own path segment** — in tests, in fixtures, in snapshots. Never flatten it into the filename. The three artifacts share the same `<case>` name so they can be located from one another by substitution.
- **Runtime-agnostic test body.** Resolve fixture → run poku → compare against snapshot. Legitimate divergence between runtimes lives in the **snapshot**, never in the test.
- **Fixtures are self-contained.** Each `<reporter>/<runtime>/<case>/` directory holds real `poku.config.js`, `src/` and `test/` plus its own runtime-generated `coverage/` output dir.
- **Test helpers follow the typed-object export pattern** — same rule as `src/`. Helper types live under `@types/` like any other domain.
- **The runtimes list is the single source of truth for E2E iteration.** It lives in the test utils directory.
- **Snapshots are stored per platform: `<reporter>/<runtime>/<platform>/<case>.<ext>`** where `<platform>` is one of `darwin`, `linux`, `win32`. There is no "shared" snapshot — every OS carries its own copy, even when content is identical. Rationale: diffs in PRs are always attributable to a specific OS and contributors never have to reason about fallback logic.
- **Snapshots are regenerated via `npm run build:snapshots`, never hand-edited.** Generation is per-OS: macOS runs natively on the contributor's machine; Linux snapshots are generated via `bash scripts/snapshots-linux.sh` (Docker); Windows snapshots come from the `workflow_dispatch`-only `.github/workflows/build-snapshots-windows.yml`, whose artifact the contributor downloads and commits. Paths inside snapshots are normalized relative to the fixture root — if an absolute path leaks in, fix the normalization, not the snapshot.
  - Always ask before regenerating snapshots.
- **No guards for missing runtimes.** If a runtime binary is absent, `spawn` fails with `ENOENT` and the test fails naturally.
- **Always `npm run build` before running E2E tests** — fixtures import from `lib/`.

### When in doubt

---

## Scripts

```sh
npm run typecheck
npm run build
npm test             # runs all tests for each runtime
npm run test:node    # runs all tests for Node.js
npm run test:deno    # runs all tests for Deno
npm run test:bun     # runs all tests for Bun
```

Always ask before regenerating snapshots after a deliberate change to a reporter's output:

```sh
npm run build:snapshots
```
