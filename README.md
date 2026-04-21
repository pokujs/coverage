<div align="center">
<img height="180" alt="Poku's Logo" src="https://raw.githubusercontent.com/wellwelwel/poku/main/.github/assets/readme/poku.svg">

# @pokujs/coverage

_**Stage: Experimental**_ 🧟

Enjoying **Poku**? [Give him a star to show your support](https://github.com/wellwelwel/poku) ⭐

---

📚 [**Documentation**](https://poku.io/docs/documentation/helpers/coverage/coverage)

</div>

---

☔️ [**@pokujs/coverage**](https://github.com/pokujs/coverage) is a **Poku** plugin that unifies coverage collection across **Node.js**, **Deno**, and **Bun**.

> [!TIP]
>
> [**@pokujs/coverage**](https://github.com/pokujs/coverage) supports **JSONC**, **YAML**, and **TOML** config files out of the box. You can also use **JavaScript** and **TypeScript** by setting the options directly in the plugin.

> [!IMPORTANT]
>
> While **@pokujs/coverage** is in the experimental stage (`0.x.x`), **any release may introduce breaking changes**.

---

## Quickstart

### Install

```bash
npm i -D poku @pokujs/coverage
```

### Usage

```json
{
  "scripts": {
    "test:bun": "bun poku --coverage",
    "test:deno": "deno run -A npm:poku --coverage",
    "test:node": "poku --coverage"
  }
}
```

- Then run the tests and a coverage summary will be printed after the suite results.

---

## Options

### › `reporter`

- **Type:** `ReporterName | ReporterName[]`
- **Default:** `'text'`

Available:

- `'text'`
- `'lcov'`
- `'lcovonly'`
- `'text-lcov'`
- `'v8'`
- `'jsc'`
- `'text-summary'`
- `'teamcity'`
- `'json'`
- `'json-summary'`
- `'cobertura'`
- `'clover'`
- `'none'`

> [!NOTE]
>
> - On **Bun**, `'v8'` falls back to `'jsc'`.
> - On **Node.js** or **Deno**, `'jsc'` falls back to `'v8'`.

---

### › `include`

- **Type:** `string[]`
- **Default:** `[]`

Glob patterns for files to include. When non-empty, only matching files appear in reports.

---

### › `exclude`

- **Type:** `string[]`
- **Default:** (extends `@istanbuljs/schema`)

Glob patterns for files to exclude. Replaces the default list when provided.

---

### › `all`

- **Type:** `boolean`
- **Default:** `false`

Walk the filesystem and report every source file under `cwd`, including those never touched by tests (reported as zero coverage).

---

### › `checkCoverage`

- **Type:** `number | CheckCoverageThresholds`
- **Default:** `undefined`

Fail the run when coverage falls below configured percentages. Pass a bare number to apply to all metrics, or an object with per-metric values. Set `perFile: true` to enforce per-file.

---

### › `skipFull`

- **Type:** `boolean`
- **Default:** `false`

Hide fully-covered files (every non-null metric ≥ 100%) from the `text` reporter table. Totals are unaffected.

---

### › `skipEmpty`

- **Type:** `boolean`
- **Default:** `false`

Hide files with no executable code from the `text` reporter table. Totals are unaffected.

---

### › `watermarks`

- **Type:** `Partial<Watermarks>`
- **Default:** `[50, 80]` per metric

`[lowMax, highMin]` thresholds for classifying percentages as `low` / `medium` / `high` in the `text` reporter.

---

### › `hyperlinks`

- **Type:** `boolean | IdeName`
- **Default:** `true`

Controls clickable file links in the `text` reporter.

- `true`: plain `file://` links.
- `<ide>`: emit IDE-specific URLs.
- `false`: disabled.

Available:

- `'vscode'`
- `'jetbrains'`
- `'cursor'`
- `'windsurf'`
- `'vscode-insiders'`

---

### › `reportsDirectory`

- **Type:** `string`
- **Default:** `'./coverage'`

Directory where report files are written. Resolved relative to the Poku working directory.

---

### › `excludeAfterRemap`

- **Type:** `boolean`
- **Default:** `true`

When `true`, globs match original source paths (post source-map remap). When `false`, globs match transpiled paths (pre-remap, mirrors c8).

---

### › `tempDirectory`

- **Type:** `string`
- **Default:** auto

Directory where raw coverage data is written. When omitted, a temp dir is created and cleaned up automatically.

---

### › `clean`

- **Type:** `boolean`
- **Default:** auto

Override temp-directory cleanup at teardown.

- `undefined`: auto (clean only if auto-generated).
- `true`: always clean.
- `false`: never clean.

---

### › `config`

- **Type:** `string | false`
- **Default:** `undefined`

Path to a config file, or `false` to disable auto-discovery.

---

## Examples

### Require `--coverage` flag

When using via plugin, by default, coverage runs whenever the plugin is active. Use `requireFlag` to only collect coverage when `--coverage` is passed to the **CLI**:

```js
// poku.config.js
import { coverage } from '@pokujs/c8';
import { defineConfig } from 'poku';

export default defineConfig({
  plugins: [
    coverage({
      requireFlag: true,
    }),
  ],
});
```

```bash
# No coverage (plugin is a no-op)
poku test/

# With coverage
poku --coverage test/
```

### Using a config file

```jsonc
// .coveragerc
{
  // ...
}
```

```js
coverage({
  config: '.coveragerc', // or false to disable auto-discovery
});
```

> [!TIP]
>
> When no `config` is specified, the plugin automatically searches for `.coveragerc`, `.coverage.json`, `.coverage.jsonc`, `.coverage.yaml`, or `.coverage.toml` in the working directory.

You can also specify the config path via **CLI**:

```bash
poku --coverage --coverageConfig=.coveragerc test/
```

> [!NOTE]
>
> **Priority order:**
>
> - For config file discovery: `--coverageConfig` (**CLI**) > `config` (plugin option) > auto-discovery
> - For coverage options: plugin options > config file options

---

## Why Bun Users Should Care

[**@pokujs/coverage**](https://github.com/pokujs/coverage) extends **Bun**'s coverage by tapping into the **JSC** **Inspector** directly, unlocking:

- The full set of reporters (`html`, `html-spa`, `json`, `cobertura`, `clover`, etc.) that **Bun** does not provide on its own.
- Consistent options across runtimes (`all`, `include`, `exclude`, `checkCoverage`, `skipFull`, `skipEmpty`, `watermarks`, etc.), so the same configuration produces equivalent reports on **Node.js**, **Deno**, and **Bun**.
- Support for `/* jsc ignore */` directives (`next`, `start`/`stop`), aligned with **Node.js** and **Deno**.
- Real function names with per-function execution counts.
- Accurate line hit counts derived from basic blocks, instead of binary covered/uncovered.
- A richer **LCOV** built from the **JSC** data, with function records and real per-line counts.

> [!NOTE]
>
> Branch coverage is not yet available under **Bun**. [This is a limitation of the **JSC** **Inspector**](https://webkit.org/blog/3846/type-profiling-and-code-coverage-profiling-for-javascript/), which **Bun** depends on.

---

## How It Works

- 🐢 Under **Node.js**, the plugin sets `NODE_V8_COVERAGE` before **Poku** spawns tests. On teardown, the plugin reads the **V8** **JSON** files from `<tempDir>` and forwards the data.
- 🦕 Under **Deno**, the plugin sets `DENO_COVERAGE_DIR` before **Poku** spawns tests. On teardown, the plugin shells out to `deno coverage <tempDir>` and forwards the data.
- 🍞 Under **Bun**, the plugin attaches to the **JSC** **Inspector** over WebSocket and captures basic-block execution counts via `Runtime.getBasicBlocks`. On teardown, the plugin reads the **JSON** files from `<tempDir>` and forwards the data.

---

### File Exclusions

The plugin strips the following files from every report before they are emitted, so the numbers reflect only the source code you actually care about:

- Every file **Poku** passes through its `runner` hook is recorded and dropped from reports since they are test files.
- **`node_modules/` and `.git/`.** directories are unconditionally banned from coverage output.

---

## Acknowledgements and Credits

[**@pokujs/coverage**](https://github.com/pokujs/coverage) internally adapts parts of the projects [**v8-to-istanbul**](https://github.com/istanbuljs/v8-to-istanbul), [**@jridgewell/trace-mapping**](https://github.com/jridgewell/sourcemaps), and [**istanbul-reports**](https://github.com/istanbuljs/istanbuljs) for multi-runtime support, enabling **Istanbul** reports for both **Node.js**, **Deno**, and **Bun**.

- `.js`, `.css`, `.png`, and `.ico` assets from `html` and `html-spa` reporters are copied verbatim from [**istanbul-reports**](https://github.com/istanbuljs/istanbuljs).

Also, a special thanks to [**c8**](https://github.com/bcoe/c8) and [**Monocart Coverage Reports**](https://github.com/cenfun/monocart-coverage-reports), repositories that served as a study base and as a reference for comparing results.

---

## License

**MIT** © [**wellwelwel**](https://github.com/wellwelwel) and [**contributors**](https://github.com/pokujs/coverage/graphs/contributors).
