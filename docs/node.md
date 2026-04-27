# Node.js V8 Coverage Surface

Reference notes on how Node.js's raw V8 coverage data is shaped, what it includes, and what its TypeScript variants actually produce. Drawn from direct observation of the dumps Node emits for the same Poku test suite that the Deno notes were drawn from, against mirrored JavaScript and TypeScript playgrounds.

---

## 1. Envelope shape

Node packages all V8 coverage data into one document per process:

```jsonc
{
  "result": [
    {
      "scriptId": "...",
      "url": "...",
      "functions": [
        /* ... */
      ],
    },
    /* one entry per script the process touched */
  ],
  "timestamp": 1777262804424,
  "source-map-cache": {
    /* present only when TypeScript is in play. See Section 6 */
  },
}
```

The dump is written to the directory pointed at by `NODE_V8_COVERAGE`. That env var is the entire mechanism: V8 inspects it on process startup, instruments accordingly, and flushes to disk on exit. No flags, no orchestration. If `NODE_V8_COVERAGE` is absent, no dump is produced.

---

## 2. File emission cadence

Files are named `coverage-<pid>-<timestamp>-<index>.json`. Each segment is informational rather than load-bearing:

- `<pid>` is the process id.
- `<timestamp>` is a millisecond epoch from the moment the dump was scheduled.
- `<index>` is `0` for the main V8 isolate of the process. Higher indices appear when the process spawns additional isolates that V8 instruments separately (see Section 4).

| Suite                | Process count | Files emitted | Per-process file count |
| -------------------- | ------------- | ------------- | ---------------------- |
| JavaScript           | 5             | 5             | 1 (`-0` only)          |
| TypeScript via `tsx` | 5             | 10            | 2 (`-0` + `-1`)        |

The cadence is process-aligned. A test runner that spawns N worker processes produces a dump per worker. Each dump is self-contained: it lists every script that worker touched, including all of `node:*`, all of `node_modules/`, and the user code that worker exercised.

---

## 3. URL surface

What Node records is broad. A typical JS dump includes around 187 distinct URLs for a small playground, only two of which are user code (the source under test plus the test itself):

| Category                                        | Node JS    | Node TS via `tsx` |
| ----------------------------------------------- | ---------- | ----------------- |
| `file://` user code                             | yes        | yes               |
| `file://` `node_modules/*` of test runner       | yes        | yes               |
| `file://` `node_modules/tsx`, esbuild internals | n/a        | yes               |
| `node:*` built-in modules                       | yes (~130) | yes (~170)        |

**Node surfaces every `node:*` built-in module the process touched.** `node:assert`, `node:fs`, `node:buffer`, `node:url`, `node:path`, and so on. They appear as scripts in `result[]` with their own `functions[]` arrays. Filtering them out is a consumer responsibility.

The size consequence is significant. A typical JS process produces a dump of around 440 KB. The same workload under TypeScript via `tsx` produces around 614 KB per process, plus the secondary loader-subprocess file. Most of that bulk is built-in module instrumentation, not user code.

---

## 4. The process model and the loader subprocess

Each Node process is its own V8 isolate, with its own coverage state, its own dump file, and its own `node:*` instrumentation. Multi-process orchestration is the responsibility of whatever spawned the workers. Coverage merge across processes is a separate step that happens after all workers exit.

When a TypeScript loader is active (`tsx`, `ts-node`, or any `--import` / `--loader` hook), Node runs the loader hooks in a separate worker thread or process. V8 instruments that worker independently and writes its dump as the `-1`-indexed file:

- The `-0` file is the main process. It contains user code, `node_modules/`, `node:*`, plus the loader internals the main thread invoked.
- The `-1` file is the loader worker. It contains `node:*`, the loader's `node_modules/` (`tsx`, esbuild, etc.), and **no user files**. It carries no `source-map-cache` (the cache is attached to the main process, where user TypeScript was actually transpiled and executed).

For user-code coverage, the `-1` file is operational noise. It can be skipped without losing information. For total-runtime coverage, both files are needed.

---

## 5. The TypeScript story under Node

Node has more than one path for TypeScript, and they behave differently in the V8 dump. The discriminator is the transpiler the loader uses, not Node itself.

### 5.1 The expansive path: `tsx`, `ts-node` (compile mode), Babel, SWC

These tools transpile `.ts` to `.js` before V8 sees the script. The dump reflects what V8 actually executed:

- `result[].url` still points at the `.ts` path. The loader rewrites it on the way to V8 to preserve the original location for tooling.
- Offsets inside `functions[].ranges[]` are bytes into the **transpiled JavaScript body**, not the `.ts`.
- The transpiled body is typically three to six times the size of the original `.ts`. An example with `tsx`'s esbuild defaults: a 363-byte `math.ts` becomes a 1569-byte transpiled module body.
- A `source-map-cache` entry is embedded inline, keyed by the `.ts` URL. It carries the V3 source map (with `sourcesContent` embedding the original `.ts` literally) and the `lineLengths` of the transpiled body. Both pieces are required to project V8 offsets onto the `.ts`.
- Transpiler helpers leak into the function list. esbuild injects a `__name` helper into every `src/*.ts` (not into tests), with `count` equal to the number of named exported functions in the module. It does not exist in the original `.ts`.

A naive consumer that takes `result[].url` at face value, opens the `.ts` from disk, and reads bytes at the reported offsets will produce broken results. The source map is mandatory.

### 5.2 The strip-only path: `--experimental-strip-types`

Node 22+ ships native TypeScript support behind an experimental flag. The semantics are different:

- Type annotations are removed at parse time. Code outside annotations preserves its byte positions.
- The reported V8 offsets target the `.ts` directly, modulo the stripped annotations.
- No transpiler helpers are injected.
- Source-map-cache emission is conditional on the flag set, but in practice strip-only loaders typically do not embed a remap step because positions already correspond.

This path converges with Deno's TypeScript story (see [docs/deno.md](deno.md), Section 5). For consumers, scripts produced by strip-only loaders behave the same as plain JavaScript scripts in terms of how offsets map to source.

### 5.3 What both paths share

- The per-script payload shape is identical V8 protocol output: `{ scriptId, url, functions: [{ functionName, isBlockCoverage, ranges: [{ startOffset, endOffset, count }] }] }`.
- `result[].url` carries the `.ts` path in both cases.
- The ambiguity is **what those offsets mean**, and the only honest discriminator is the presence or absence of a corresponding `source-map-cache` entry.

A consumer that branches on `if (scriptUrl.endsWith('.ts'))` to decide remap behavior is already wrong. The correct branch is on whether `source-map-cache[scriptUrl]` exists.

---

## 6. The `source-map-cache` in detail

When present, this top-level key sits beside `result[]`:

```jsonc
{
  "result": [
    /* ... */
  ],
  "source-map-cache": {
    "file:///.../math.ts": {
      "data": {
        /* V3 source map */
      },
      "lineLengths": [429, 0, 1138],
      "url": null,
    },
    /* one entry per user .ts script transpiled in this process */
  },
}
```

Reliable properties:

- The outer key is the URL exactly as it appears in `result[].url`. This is the join key for tooling.
- `data.version` is `3`. `data.sources` is a single-element array. `data.sourcesContent[0]` is the literal text of the original `.ts`.
- `data.mappings` is the standard VLQ-encoded mapping string. It projects positions in the transpiled body onto positions in the original `.ts`.
- `lineLengths` describes the **transpiled** body, line by line. A 3-line transpiled module appears as a 3-element array. The sum of the entries plus the inter-line newlines equals the byte length of the transpiled body, which matches the wrapper function's `endOffset`.

Properties that are **not** reliable:

- `data.file` is `null` in practice. Do not use it as an identifier.
- The cache entry's `url` field is also `null` in practice. Same caveat.
- `data.sourceRoot` is empty.
- `data.names` is empty (esbuild does not preserve symbol names this way).

To project an offset from a transpiled-body byte to an original-source position, both `lineLengths` and `data.mappings` are needed. `lineLengths` converts the byte offset to `(line, column)` in the transpiled body. `data.mappings` then projects that pair onto `(line, column)` in the original `.ts`. Skipping either step yields garbage.

---

## 7. Multi-process aggregation

Each Node process emits a self-contained dump. The consolidation strategy is:

- Concatenate `result[]` arrays from all dumps.
- Group entries by `url`.
- For each URL appearing in multiple processes, sum `count` values per range. The V8 protocol guarantees that the range geometry is identical across dumps for the same URL (same `startOffset` and `endOffset` for each function), so summing is safe.
- Source maps from any one dump are valid for all dumps of the same URL. There is no need to merge source-map entries across processes.

This is the inverse of Deno's situation. Deno emits one document per script-load, so the natural unit is per-URL aggregation across hundreds of small files. Node emits one document per process, so the natural unit is per-process consolidation across a handful of large files. The output of both is the same: per-URL, summed counts.

---

## 8. What Node does not include

- **No raw `scriptSource`**. Neither runtime embeds the JavaScript text V8 saw. Read the file from disk via the URL.
- **No persistent `scriptId` across processes.** Values are arbitrary numeric strings, valid only within one dump.
- **No `ext:` or other Deno-only schemes.** Those are exclusive to the other runtime.
- **No process-level identity beyond the filename.** The pid and timestamp in the filename are informational. They do not appear inside the JSON.
- **No source-map-cache for plain JavaScript dumps.** The key is omitted entirely when no TypeScript was loaded.

---

## 9. Operational implications

- **`NODE_V8_COVERAGE` is the only required configuration for raw coverage capture.** No flags, no orchestration. Set the variable, run the process, read the directory.
- **The TypeScript path is loader-defined, not runtime-defined.** Tooling that wants to be loader-agnostic must inspect `source-map-cache`, not infer from extension or runtime version.
- **The `-1` loader-subprocess file is skippable for user-code coverage.** It contains no user files. Including it adds noise without information.
- **Filtering `node:*` is a consumer task.** Node always surfaces those modules. A coverage tool oriented at user code typically drops every URL whose scheme is `node:`.
- **Source-map application requires both `lineLengths` and `data.mappings`.** Either alone is insufficient. Tools that take only one and try to derive the other from disk will silently produce wrong line numbers when the on-disk transpilation is regenerated.
- **`__name` and similar transpiler helpers leak through `result[].functions[]` if not filtered.** They have a real `count` and a plausible-looking `functionName`, but they have no original-source counterpart. Source-map-aware filtering removes them naturally because the projection of their offset range falls outside `data.sourcesContent[0]`.

---

## 10. Summary

| Axis                                  | Node.js                                            |
| ------------------------------------- | -------------------------------------------------- |
| Capture mechanism                     | `NODE_V8_COVERAGE` env var pointing at a directory |
| Envelope                              | one document per process, `result[]` array         |
| File count per worker                 | 1 for JS, 2 for TS (main + loader subprocess)      |
| Filename                              | `coverage-<pid>-<ts>-<index>.json`                 |
| URL space                             | `file://` plus full `node:*` surface               |
| Built-in module instrumentation       | included in every dump                             |
| Source-map-cache for TS               | inline, keyed by the `.ts` URL                     |
| TS offset target (transpiler-based)   | transpiled JS body                                 |
| TS offset target (strip-only)         | original `.ts`                                     |
| Reliable join key in source-map-cache | the outer map key (`data.file` is null)            |
| Aggregation expectation               | concatenate `result[]`, group by URL, sum counts   |

Node's V8 coverage is broad, organized per process, and faithful to V8's protocol. The complexity is concentrated in the TypeScript path, where loader choice fundamentally changes what offsets in `result[]` mean. Once the dump is in hand, the rest of the work is consolidation across processes and source-map projection where applicable.
