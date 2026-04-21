<div align="center">
<img height="180" alt="Poku's Logo" src="https://raw.githubusercontent.com/wellwelwel/poku/main/.github/assets/readme/poku.svg">

# @pokujs/coverage

_**Stage: Experimental**_ 🧟

Enjoying **Poku**? [Give him a star to show your support](https://github.com/wellwelwel/poku) ⭐

![GitHub Workflow Status (Node.js)](https://img.shields.io/github/actions/workflow/status/pokujs/coverage/ci_linux.yml?event=push&label=&branch=main&logo=nodedotjs&logoColor=535c68&color=badc58)
![GitHub Workflow Status (Bun)](https://img.shields.io/github/actions/workflow/status/pokujs/coverage/ci_linux.yml?event=push&label=&branch=main&logo=bun&logoColor=ffffff&color=f368e0)
![GitHub Workflow Status (Deno)](https://img.shields.io/github/actions/workflow/status/pokujs/coverage/ci_linux.yml?event=push&label=&branch=main&logo=deno&logoColor=ffffff&color=079992)  
![GitHub Workflow Status (Linux)](https://img.shields.io/github/actions/workflow/status/pokujs/coverage/ci_linux.yml?event=push&label=&branch=main&logo=ubuntu&logoColor=8897a9&color=dfe4ea)
![GitHub Workflow Status (OSX)](https://img.shields.io/github/actions/workflow/status/pokujs/coverage/ci_osx.yml?event=push&label=&branch=main&logo=apple&logoColor=8897a9&color=dfe4ea)
![GitHub Workflow Status (Windows)](https://img.shields.io/github/actions/workflow/status/pokujs/coverage/ci_windows.yml?event=push&label=&branch=main&logo=data:image/svg+xml;base64,PHN2ZyByb2xlPSJpbWciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjx0aXRsZT5XaW5kb3dzIDExPC90aXRsZT48cGF0aCBmaWxsPSIjODg5N2E5IiBkPSJNMTI2IDEuNjM3bC02NyA5LjgzNHY0OS44MzFsNjctLjUzNHpNMS42NDcgNjYuNzA5bC4wMDMgNDIuNDA0IDUwLjc5MSA2Ljk4My0uMDQtNDkuMDU3em01Ni44Mi42OGwuMDk0IDQ5LjQ2NSA2Ny4zNzYgOS41MDkuMDE2LTU4Ljg2M3pNMS42MSAxOS4yOTdsLjA0NyA0Mi4zODMgNTAuNzkxLS4yODktLjAyMy00OS4wMTZ6Ij48L3BhdGg+PC9zdmc+&color=dfe4ea)

</div>

---

☔️ [**@pokujs/coverage**](https://github.com/pokujs/coverage) is a **Poku** plugin that unifies coverage collection across **Node.js**, **Deno**, and **Bun**.

> [!TIP]
>
> - **@pokujs/coverage** supports **JSONC**, **YAML**, and **TOML** config files. You can also use **JavaScript** and **TypeScript** by setting the options directly in the plugin.
> - The default reporter is designed for easy consumption by **LLMs**, pinpointing uncovered code with precise locations.

---

## Why

- Move and combine entire test suites between **Node.js**, **Deno**, and **Bun** with zero configuration changes.
- Know exactly what is and isn't tested across each runtime using the same test suite.
- Whether it's **CommonJS**, **ES Modules**, **TypeScript**, or both, just install and use it.

---

## Quickstart

### Install

```bash
npm i -D @pokujs/coverage
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

| Option                                       | Type                     | Default                                                                                                             | Node.js | Deno | Bun |
| -------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------- | ---- | --- |
| [**reporter**](#-reporter)                   | `Reporter \| Reporter[]` | `'text'`                                                                                                            | ●       | ●    | ●   |
| [**include**](#-include)                     | `string[]`               | `[]`                                                                                                                | ●       | ●    | ●   |
| [**exclude**](#-exclude)                     | `string[]`               | [list](https://github.com/pokujs/coverage/blob/8e13d606503308f019f455b3feca4998326e3ef5/src/file-filter.ts#L13-L27) | ●       | ●    | ●   |
| [**all**](#-all)                             | `boolean`                | `false`                                                                                                             | ●       | ●    | ●   |
| [**src**](#-src)                             | `string \| string[]`     | `[cwd]`                                                                                                             | ●       | ●    | ●   |
| [**extension**](#-extension)                 | `string \| string[]`     | [list](https://github.com/pokujs/coverage/blob/8e13d606503308f019f455b3feca4998326e3ef5/src/all-files.ts#L8-L17)    | ●       | ●    | ●   |
| [**checkCoverage**](#-checkcoverage)         | `boolean \| number`      | `undefined`                                                                                                         | ●       | ●    | ●   |
| [**statements**](#-statements)               | `number`                 | `0`                                                                                                                 | ●       | ●    | ●   |
| [**branches**](#-branches)                   | `number`                 | `0`                                                                                                                 | ●       | ●    | –   |
| [**functions**](#-functions)                 | `number`                 | `0`                                                                                                                 | ●       | ●    | ●   |
| [**lines**](#-lines)                         | `number`                 | `0`                                                                                                                 | ●       | ●    | ●   |
| [**perFile**](#-perfile)                     | `boolean`                | `false`                                                                                                             | ●       | ●    | ●   |
| [**skipFull**](#-skipfull)                   | `boolean`                | `false`                                                                                                             | ●       | ●    | ●   |
| [**skipEmpty**](#-skipempty)                 | `boolean`                | `false`                                                                                                             | ●       | ●    | ●   |
| [**watermarks**](#-watermarks)               | `Partial<Watermarks>`    | `[50, 80]` per metric                                                                                               | ●       | ●    | ●   |
| [**hyperlinks**](#-hyperlinks)               | `boolean \| IDE`         | `true`                                                                                                              | ●       | ●    | ●   |
| [**reportsDirectory**](#-reportsdirectory)   | `string`                 | `'./coverage'`                                                                                                      | ●       | ●    | ●   |
| [**excludeAfterRemap**](#-excludeafterremap) | `boolean`                | `true`                                                                                                              | ●       | ●    | –   |
| [**tempDirectory**](#-tempdirectory)         | `string`                 | _auto_                                                                                                              | ●       | ●    | ●   |
| [**clean**](#-clean)                         | `boolean`                | _auto_                                                                                                              | ●       | ●    | ●   |
| [**config**](#-config)                       | `string \| false`        | `undefined`                                                                                                         | ●       | ●    | ●   |

> [!TIP]
>
> `.nycrc` and `.c8rc` config files are supported and are automatically remapped, for example:
>
> - `"check-coverage": true` → `"checkCoverage": true`
> - `"100": true` → `checkCoverage: 100`

> [!NOTE]
>
> On **Bun**, `branches` and `excludeAfterRemap` options are silently ignored.

---

### › reporter

| Reporter         | Node.js | Deno | Bun |
| ---------------- | ------- | ---- | --- |
| `'text'`         | ●       | ●    | ●   |
| `'lcov'`         | ●       | ●    | ●   |
| `'lcovonly'`     | ●       | ●    | ●   |
| `'text-lcov'`    | ●       | ●    | ●   |
| `'text-summary'` | ●       | ●    | ●   |
| `'teamcity'`     | ●       | ●    | ●   |
| `'json'`         | ●       | ●    | ●   |
| `'json-summary'` | ●       | ●    | ●   |
| `'cobertura'`    | ●       | ●    | ●   |
| `'clover'`       | ●       | ●    | ●   |
| `'none'`         | ●       | ●    | ●   |
| `'v8'`           | ●       | ●    | –   |
| `'jsc'`          | –       | –    | ●   |

> [!NOTE]
>
> - On **Bun**, `'v8'` falls back to `'jsc'`.
> - On **Node.js** or **Deno**, `'jsc'` falls back to `'v8'`.

```json
{
  "reporter": ["text", "lcov"]
}
```

---

### › include

Glob patterns for files to include. When non-empty, only matching files appear in reports.

```json
{
  "include": ["src/**"]
}
```

---

### › exclude

Glob patterns for files to exclude. Replaces the default list when provided.

```json
{
  "exclude": ["test/**", "**/*.spec.ts"]
}
```

---

### › all

Walk the filesystem and report every source file under `cwd`, including those never touched by tests (reported as zero coverage).

```json
{
  "all": true
}
```

---

#### › src

Root directories searched when `all: true`. Overrides `cwd` as the default walk root. Useful for monorepos. Relative paths are resolved against `cwd`.

```json
{
  "all": true,
  "src": ["./packages/core/src", "./packages/api/src"]
}
```

---

#### › extension

File extensions considered by `all: true` discovery. Overrides the default list entirely.

```json
{
  "all": true,
  "extension": [".ts", ".vue"]
}
```

---

### › checkCoverage

Fail the run when coverage falls below the configured thresholds.

- `true`: enable the check with all thresholds at `0` (silent no-op unless at least one per-metric threshold is set).
- `number`: default threshold applied to every metric. Per-metric root keys override.
- `false` / `undefined`: disabled.

```json
{
  "checkCoverage": 95,
  "branches": 80
}
```

Above: `statements`, `functions`, and `lines` require `95`; `branches` requires `80`.

---

#### › statements

Minimum statements coverage percentage. Requires `checkCoverage` to be active.

```json
{
  "checkCoverage": true,
  "statements": 90
}
```

---

#### › branches

Minimum branches coverage percentage. Requires `checkCoverage` to be active.

```json
{
  "checkCoverage": true,
  "branches": 80
}
```

---

#### › functions

Minimum functions coverage percentage. Requires `checkCoverage` to be active.

```json
{
  "checkCoverage": true,
  "functions": 90
}
```

---

#### › lines

Minimum lines coverage percentage. Requires `checkCoverage` to be active.

```json
{
  "checkCoverage": true,
  "lines": 95
}
```

---

#### › perFile

Enforce thresholds per file instead of on aggregated totals.

```json
{
  "checkCoverage": 95,
  "perFile": true
}
```

---

### › skipFull

Hide fully-covered files (every non-null metric ≥ 100%) from the `text` reporter table. Totals are unaffected.

```json
{
  "skipFull": true
}
```

---

### › skipEmpty

Hide files with no executable code from the `text` reporter table. Totals are unaffected.

```json
{
  "skipEmpty": true
}
```

---

### › watermarks

`[lowMax, highMin]` thresholds for classifying percentages as `low` / `medium` / `high` in the `text` reporter.

```json
{
  "watermarks": {
    "lines": [60, 85],
    "branches": [60, 85],
    "functions": [60, 85],
    "statements": [60, 85]
  }
}
```

---

### › hyperlinks

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

```json
{
  "hyperlinks": "vscode"
}
```

---

### › reportsDirectory

Directory where report files are written. Resolved relative to the Poku working directory.

```json
{
  "reportsDirectory": "./coverage"
}
```

---

### › excludeAfterRemap

When `true`, globs match original source paths (post source-map remap). When `false`, globs match transpiled paths (pre-remap, mirrors [**c8**](https://github.com/bcoe/c8)).

```json
{
  "excludeAfterRemap": false
}
```

---

### › tempDirectory

Directory where raw coverage data is written. When omitted, a temp dir is created and cleaned up automatically.

```json
{
  "tempDirectory": "./.tmp-coverage"
}
```

---

### › clean

Override temp-directory cleanup at teardown.

- `undefined`: auto (clean only if auto-generated).
- `true`: always clean.
- `false`: never clean.

```json
{
  "clean": false
}
```

---

### › config

Path to a config file, or `false` to disable auto-discovery.

```json
{
  "config": ".coveragerc"
}
```

You can also specify the config path via **CLI**:

```bash
poku --coverage --coverageConfig=.coveragerc test/
```

> [!TIP]
>
> When no `config` is specified, the plugin automatically searches for the following files in the working directory (in order):
>
> - `.coveragerc`, `.coveragerc.json`, `.coveragerc.jsonc`, `.coveragerc.toml`, `.coveragerc.yaml`, `.coveragerc.yml`
> - `.nycrc`, `.nycrc.json`, `.nycrc.jsonc`, `.nycrc.toml`, `.nycrc.yaml`, `.nycrc.yml`
> - `.c8rc`, `.c8rc.json`, `.c8rc.jsonc`, `.c8rc.toml`, `.c8rc.yaml`, `.c8rc.yml`

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

> [!NOTE]
>
> **Priority order:**
>
> - For config file discovery: `--coverageConfig` (**CLI**) > `config` (plugin option) > auto-discovery
> - For coverage options: plugin options > config file options

---

## 🍞 Why Bun Users Should Care

[**@pokujs/coverage**](https://github.com/pokujs/coverage) extends **Bun**'s coverage by tapping into the **JSC** **Inspector** directly, unlocking:

- The full set of reporters (`html`, `html-spa`, `jsc`, `json`, `json-summary`, `cobertura`, `clover`, `teamcity`, `text-summary`, etc.).
  - [**Bun** supports only `text` and `lcov` _(limited)_.](https://bun.com/docs/test/code-coverage)
- Consistent options across runtimes (`all`,`checkCoverage`, `include`, `exclude`, `extension`, `skipFull`, `skipEmpty`, `watermarks`, etc.).
- Support for `/* jsc ignore */` directives (`next`, `start`/`stop`).
- Real function names with per-function execution counts.
- Accurate line hit counts derived from basic blocks, instead of binary covered/uncovered.
- A richer **LCOV** built from the **JSC** data, with function records and real per-line counts.

> [!NOTE]
>
> Branch coverage is not yet available under **Bun**. [This is a limitation of the **JSC** **Inspector**](https://webkit.org/blog/3846/type-profiling-and-code-coverage-profiling-for-javascript/), which **Bun** depends on.

---

## 🦕 Why Deno Users Should Care

- The full set of reporters (`html-spa`, `v8`, `json`, `json-summary`, `cobertura`, `clover`, `teamcity`, `text-summary`, etc.).
  - [**Deno** supports only `text`, `lcov`, and `html`](https://docs.deno.com/runtime/reference/cli/coverage/).
- Consistent options across runtimes (`all`, `checkCoverage`, `include`, `exclude`, `extension`, `skipFull`, `skipEmpty`, `watermarks`, etc.).
- Compatibility with `.nycrc` / `.c8rc` config files, easing migration from existing coverage setups.

---

## How It Works

- 🐢 Under **Node.js**, the plugin sets `NODE_V8_COVERAGE` before **Poku** spawns tests. On teardown, the plugin reads the **V8** **JSON** files from `<tempDir>` and forwards the data.
- 🦕 Under **Deno**, the plugin sets `DENO_COVERAGE_DIR` before **Poku** spawns tests. On teardown, the plugin shells out to `deno coverage <tempDir>` and forwards the data.
- 🍞 Under **Bun**, the plugin attaches to the **JSC** **Inspector** over WebSocket and captures basic-block execution counts via `Runtime.getBasicBlocks`. On teardown, the plugin reads the **JSON** files from `<tempDir>` and forwards the data.

---

### File Exclusions

The plugin strips the following files from every report before they are emitted, so the numbers reflect only the source code you actually care about:

- Every file **Poku** passes through its `runner` hook is recorded and dropped from reports since they are test files.
- **`node_modules/` and `.git/`** directories are unconditionally banned from coverage output.

---

## Acknowledgements and Credits

[**@pokujs/coverage**](https://github.com/pokujs/coverage) internally adapts parts of the projects [**v8-to-istanbul**](https://github.com/istanbuljs/v8-to-istanbul), [**@jridgewell/trace-mapping**](https://github.com/jridgewell/sourcemaps), and [**istanbul-reports**](https://github.com/istanbuljs/istanbuljs) for multi-runtime support, enabling **Istanbul** reports for both **Node.js**, **Deno**, and **Bun**.

- `.js`, `.css`, `.png`, and `.ico` assets from `html` and `html-spa` reporters are copied verbatim from [**istanbul-reports**](https://github.com/istanbuljs/istanbuljs).

Also, a special thanks to [**c8**](https://github.com/bcoe/c8) and [**Monocart Coverage Reports**](https://github.com/cenfun/monocart-coverage-reports), repositories that served as a study base and as a reference for comparing results.

---

## License

**MIT** © [**wellwelwel**](https://github.com/wellwelwel) and [**contributors**](https://github.com/pokujs/coverage/graphs/contributors).
