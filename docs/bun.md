# Bun JSC Coverage Surface

Reference notes on how Bun exposes JSC's coverage data, what its dump shape includes, and what the JavaScript and TypeScript variants actually produce. Drawn from direct observation of the dumps Bun emits for the same Poku test suite that the Node notes were drawn from, against mirrored JavaScript and TypeScript playgrounds.

---

## 1. Capture model

Bun does not write coverage data to a directory. It does not consume `NODE_V8_COVERAGE` and does not have a `BUN_COVERAGE` analogue. Coverage capture is an active session against the running isolate, mediated by the JSC Inspector over a WebSocket the runtime starts on demand.

The mechanism is enabled by launching Bun with an Inspector flag:

- `--inspect-wait=<host>:<port>` instructs Bun to start a JSC Inspector at the given address and pause execution until a frontend connects. With port `0`, the runtime picks a free port and announces the resulting WebSocket URL to stderr.

A coverage tool reads stderr until it sees a line of the form `ws://127.0.0.1:<port>/<token>`, then connects an Inspector client to that URL. Once the handshake completes, Bun unblocks and the user code runs.

There is no flag that produces a fire-and-forget dump file. The only coverage path is the live session.

The entry point is **`bun <file>`**, not `bun test`. The `bun test` subcommand has its own native LCOV path (`--coverage`) that does not interact cleanly with an external Inspector client. Worse, `bun test` reaches process termination through a code path that bypasses the JavaScript-level lifecycle hooks any coverage frontend would use to flush state. `process.on('beforeExit')` is not invoked when Bun exits via the test runner, monkey-patching `process.exit` does not intercept the shutdown, and the `TestReporter.end` event only fires for tests written against `bun:test` rather than third-party runners. The reliable path is `bun <file>`, which evaluates the file as a regular ES module, runs whatever the file imports, and exits naturally when the event loop empties. The Inspector frontend is alive throughout that lifecycle and can flush before the socket closes.

---

## 2. The handshake

After the WebSocket is open, the canonical handshake order is:

1. `Runtime.enable`. Start receiving `Runtime` notifications, including the parsed-context events.
2. `Debugger.enable`. Start receiving `Debugger.scriptParsed` events that announce every compiled script with its `scriptId` and `url`.
3. `Runtime.enableControlFlowProfiler`. Turn on the basic-block instrumentation. Required before any `getBasicBlocks` call returns meaningful data. Recompiles existing code blocks under instrumentation, so the latest moment to call this without losing data is before user code begins to run.
4. `Inspector.enable` and `Inspector.initialized`. Signal the frontend is ready. Bun unblocks here and starts running user code.

Order matters. `enableControlFlowProfiler` recompiles already-loaded code, and calling it later forfeits block coverage for everything compiled before the call. The `--inspect-wait` flag exists precisely so a coverage frontend can perform this handshake before any user code executes.

Two negative facts complete the picture. First, **there is no `Debugger.resume` step**. Tools ported from a V8 Chrome DevTools Protocol baseline often expect to call `Debugger.resume` after the handshake to release a paused isolate. Issuing it here returns the protocol error `"Must be paused or waiting to pause"`, because `--inspect-wait` does not actually pause JS at any breakpoint. It accepts the connection and continues. The handshake itself is what unblocks Bun. Second, **`Runtime.runIfWaitingForDebugger` does not exist in JSC at all**, since it is V8-only. Both omissions are protocol-level, not implementation gaps in Bun.

After handshake, the consumer collects `Debugger.scriptParsed` notifications to learn which `scriptId`s the isolate has loaded. Each notification carries `scriptId`, `url`, the script's start/end line and column, a `module` boolean, and a `sourceMapURL` string when the script's source advertised one inline.

The consumer drives coverage capture by calling, per script, two protocol commands:

- `Runtime.getBasicBlocks({ sourceID })` returns the current block array for that script.
- `Debugger.getScriptSource({ scriptId })` returns the source text JSC compiled for that script.

Optionally, the consumer also calls `Debugger.getBreakpointLocations({ start, end })` per script to obtain the AST-driven set of pausable positions (Section 7 of [docs/jsc.md](jsc.md)).

Block state is cumulative throughout the session. Polling can be repeated, and each call returns the running state at that moment, not a delta.

---

## 3. Stop condition

The protocol has no "execution complete" event. There is no equivalent of process exit announcement: the test runner's child process ends and the WebSocket closes from the runtime side, which is too late for a graceful flush of pending `getScriptSource` requests.

Every observed coverage tool implements a stability heuristic: poll `getBasicBlocks` for every parsed script on a fixed interval, hash the aggregate execution-count totals, and consider the workload complete when the hash is unchanged for a number of consecutive ticks. Typical parameters in the wild are 50ms intervals with six stable ticks (300ms of quiescence) before flushing.

The heuristic has two known failure modes:

- **CPU-bound code**: long synchronous regions block the event loop and prevent the polling timer from firing, which can cause premature stability detection if the polling cadence is too coarse.
- **Hash collisions**: if two snapshots happen to produce identical aggregate counts despite different per-block distributions, the stability check declares completion incorrectly. In practice the keyspace is large enough that this is rare with reasonable hash construction.

JSC offers no native alternative. The closest event, `Debugger.globalObjectCleared`, signals context destruction (page navigation, isolate reset) rather than execution completion.

---

## 4. Inspector domain catalog

Before discussing what URLs the Inspector announces, a complementary fact: not every Chrome DevTools Protocol domain that a V8 frontend would expect is available. Bun's Inspector exposes a JSC-flavored subset, plus a few Bun-specific domains. Probing each domain for `enable` reveals the following surface:

| Domain                                       | Status  | Notes                                                                                                     |
| -------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------- |
| `Runtime`                                    | exposed | Required for `getBasicBlocks` and `enableControlFlowProfiler`                                             |
| `Debugger`                                   | exposed | Source of `scriptParsed` events and `getScriptSource` / `getBreakpointLocations`                          |
| `Inspector`                                  | exposed | Used to signal frontend readiness                                                                         |
| `Console`                                    | exposed | Standard console API surface                                                                              |
| `Heap`, `ScriptProfiler`                     | exposed | JSC's CPU profiler and heap-tracking domains. Not coverage-relevant                                       |
| `LifecycleReporter`, `TestReporter`          | exposed | Bun-specific. `TestReporter` only emits inside `bun test`, not under `bun <file>`                         |
| `BunCPUProfiler`, `BunHeapProfiler`, `Audit` | exposed | Bun-specific extensions                                                                                   |
| `Profiler` (V8 name)                         | absent  | The V8 CDP `Profiler.takePreciseCoverage` path does not exist. Coverage must use `Runtime.getBasicBlocks` |
| `HeapProfiler` (V8 name)                     | absent  | The V8 heap-snapshot domain is absent. JSC's `Heap` is the analogue                                       |
| `Target`, `Schema`, `Network`                | absent  | Multi-target/page-scoped CDP domains. Not part of JSC's Inspector surface                                 |

The absence of `Profiler` is the structural reason why every Bun coverage tool ends up calling `Runtime.getBasicBlocks` rather than a V8-style precise-coverage entry point.

---

## 5. URL surface

What Bun records is narrow compared to Node. A typical JSC Inspector session for a small playground exposes a few classes of script:

| Category                      | Bun JSC Inspector | Notes                                                                |
| ----------------------------- | ----------------- | -------------------------------------------------------------------- |
| User code (`.js`/`.ts`)       | yes               | `url` is an absolute filesystem path with no `file://` scheme prefix |
| Bun built-ins                 | yes               | `url` starts with `bun:`                                             |
| Node built-ins (compat layer) | yes               | `url` starts with `node:`                                            |
| `node_modules/`               | yes               | `url` is the absolute file path                                      |
| Inline `eval` / dynamic       | yes               | `url` is empty or synthetic                                          |

Bun does not include the equivalent of Node's full ~130 `node:*` URL surface in user-relevant data because Bun's standard library is not built on Node's modules. Most of what Node exposes as `node:*` becomes either a `bun:` builtin or a custom in-runtime implementation. The user-code-relevant surface is a small fraction of the total.

Coverage tools typically apply a script-level filter at session time. The four-rule filter observed in the wild reduces the surface to user code only:

1. Discard any `url` whose scheme prefix is `bun:`. These are runtime built-ins implemented internally.
2. Discard any `url` whose scheme prefix is `node:`. These are Bun's compatibility-layer scripts.
3. Discard any `url` whose path contains `/node_modules/`. Dependencies are out of scope for user-code coverage.
4. Keep only `url`s that start with the project's working directory (or the `file://` form of it). This rejects synthetic URLs from `eval`, `new Function`, dynamic imports outside the project, and any other off-tree script.

The filter happens before the dump is materialized, and the resulting on-disk artifacts contain only user files. A 5-source 5-test playground produces 10 user-file dump entries, regardless of whether the workload internally touched 200 or 2000 scripts.

---

## 6. File emission cadence

Coverage tools that materialize JSC data to disk emit one file per **user script**, not one per process. This is the structural inverse of Node's per-process emission.

| Suite                 | Process count    | User file count     | Dump file count               |
| --------------------- | ---------------- | ------------------- | ----------------------------- |
| JavaScript playground | 5 (one per test) | 10 (5 src + 5 test) | 10 (one per user file)        |
| TypeScript playground | 5                | 10                  | 10 (same files, `.ts` suffix) |

A single test run in Bun spawns one isolated JSC process per test file. Each isolate independently observes its own scripts, runs the code, and the coverage frontend captures the per-script blocks. When two isolates touch the same source file (e.g. two test files both importing `src/logic.js`), the per-script `executionCount`s reflect that isolate's view. Multiple isolates writing the same dump filename either race or, in practice, the coverage tool serializes by waiting for one isolate's session to flush before another begins.

The dump filename is derived from the script's URL by slugifying the absolute path. For a 10-file workload, this produces 10 stable filenames regardless of how many processes ran. The contents reflect the most recent isolate's coverage state to write that filename.

This is a different aggregation model from Node:

- **Node's model**: one self-contained dump per process, every dump lists every script that process touched, cross-process aggregation sums `count` per range.
- **Bun's model**: one dump per script, every dump lists exactly that one script's blocks. Cross-process aggregation requires the consumer to be aware that the same filename may be rewritten by successive isolates.

Both models converge on the same coverage truth at the per-URL level, but the file layout and the failure modes differ. Node's per-process files are large (~440 KB per process). Bun's per-script files are small (3-22 KB per script).

---

## 7. The TypeScript story under Bun

Bun has exactly one TypeScript path: built-in transpilation. The runtime parses `.ts`, strips type annotations, normalizes whitespace and quote style, appends an inline source map plus a `sourceURL` comment, and hands the result to JSC. There is no `tsx`, no `ts-node`, no loader subprocess, no `--experimental-strip-types` analogue. Every `.ts` file goes through the same pipeline.

This collapses the V8/Node bifurcation between strip-only and transpile-and-emit-map. From JSC's perspective, TypeScript and JavaScript are indistinguishable: both have been pre-processed by Bun's transpiler before JSC sees them, and both arrive with an inline source map already attached.

### 6.1 What Bun does to `.ts`

Observed transformations on a 363-byte `math.ts`:

- Type annotations are stripped (`(a: number, b: number): number` becomes `(a, b)`).
- Blank lines between top-level declarations are collapsed.
- Single-quoted strings are converted to double quotes.
- A `//# sourceMappingURL=data:application/json;base64,...` comment is appended carrying the V3 source map. `data.sourcesContent[0]` contains the original `.ts` text in full.
- A `//# sourceURL=<absolute .ts path>` comment is appended.

The post-transformation body, before the appended comments, is around 354 bytes. After the inline source map and `sourceURL` comment are concatenated, the full `source` field returned by `Debugger.getScriptSource` is around 1454 bytes. JSC's basic-block offsets index this full byte stream. The wrapper block's `endOffset` reflects the inflated length.

### 6.2 What Bun does to `.js`

The same pipeline runs for plain JavaScript. The transformations are subtler, since there are no types to strip, but they are not identity:

- Blank lines between top-level declarations are still collapsed.
- String-quote style is still normalized.
- An inline source map is still appended (with `data.sourcesContent[0]` containing the disk JS text in full).
- A `sourceURL` comment is still appended.

The same 267-byte `math.js` becomes 354 bytes of transpiled body and 1319 bytes of full `source` after concatenation. The geometry is structurally identical to the TS dump.

### 6.3 What converges

Mirrored JS and TS playgrounds (same logic, one with type annotations and one without) produce JSC dumps with **identical block geometry**. Every `startOffset` and `endOffset` matches between `math.js` and `math.ts`, except for the wrapper block's `endOffset` (which scales with source length, dominated by the inline source map size). The `breakablePositions` arrays match position-for-position. The `executionCount`s match.

This is because Bun's transpiler converges JS and TS onto the same byte stream once stripping and normalization complete. The disk inputs differ. The JSC inputs do not (or differ only by small map-induced byte counts at the tail).

The discriminator at the dump level is:

- The `url`'s file extension.
- The inline source map's `sourcesContent[0]` (the original disk text).

Block-level analysis cannot distinguish "this was originally TS" from "this was originally JS", and does not need to. The transpiled body is the unit of truth for block offsets.

### 6.4 What does not converge

Bun's source map `sources` field carries an unreliable string. Observed values are truncated suffixes such as `"d/src/math.js"` (for `.js` dumps) or `"s/src/math.ts"` (for `.ts` dumps), apparently the last 12 characters of the original path. This field cannot be used as an identifier. The reliable identifier is the dump's top-level `url`.

The map's `data.file`, `data.sourceRoot`, and `data.names` are typically `null` or empty.

---

## 8. The post-filter dump shape

Coverage tools that materialize JSC data write one JSON file per user script. The observed shape is:

```jsonc
{
  "url": "/absolute/path/to/script.{js,ts}",
  "scriptId": "<isolate-local numeric string>",
  "source": "<JSC-compiled body, including trailing sourceMappingURL and sourceURL>",
  "blocks": [
    {
      "startOffset": 0,
      "endOffset": 1318,
      "hasExecuted": true,
      "executionCount": 1,
    },
    /* dozens more, with no fixed ordering */
  ],
  "breakablePositions": [
    {
      "scriptId": "<same as above>",
      "lineNumber": 0,
      "columnNumber": 0,
    },
    /* statement-level pause points, transpiled-body coordinates */
  ],
}
```

The file is the per-script aggregation of:

- `Debugger.scriptParsed` (delivers `url`, `scriptId`).
- `Debugger.getScriptSource` (delivers `source`).
- `Runtime.getBasicBlocks` (delivers `blocks`).
- `Debugger.getBreakpointLocations` (delivers `breakablePositions`, when included).

The `breakablePositions` field is not part of JSC's `Runtime.getBasicBlocks` response and is not strictly required for coverage. When present, it provides the AST-driven set of executable positions described in [docs/jsc.md](jsc.md), Section 7. Coverage tools include it to refine "which lines are statements" without recursive AST analysis on the consumer side.

Properties:

- `url` is the absolute path with no scheme.
- `scriptId` is isolate-local. Multiple files for the same script across runs will not share `scriptId`.
- `source` is the JSC-compiled body. Disk source must be recovered through the inline source map's `sourcesContent[0]`.
- `blocks` ordering is whatever JSC returned. Consumers re-sort if needed.
- `breakablePositions` line/column numbers are zero-based and reference the transpiled body, not the disk source.

Multi-process workloads can rewrite the same filename. The on-disk file reflects whichever isolate wrote last.

---

## 9. Multi-isolate aggregation

Each Bun test process is its own JSC isolate, with its own coverage state, its own scriptId space, and its own session. Multi-process orchestration is the responsibility of the test runner. Coverage merge across isolates happens after all isolates exit.

Two isolates that both load `src/logic.js` produce two `getBasicBlocks` streams for that file. The `startOffset`/`endOffset` geometry is identical across isolates (JSC is deterministic for the same compiled body). The `executionCount`s differ by what each isolate exercised.

The aggregation strategy is the inverse of Node's:

- **Node**: per-process file, group by `url` across files, sum `count` per range.
- **Bun**: per-script file, but multiple isolates may rewrite the same filename. Live merging at session-close time, before flush, is the path that preserves all isolates' counts. Naive last-write-wins discards the others' contributions.

When a coverage tool processes the dumps after the run, the per-script shape collapses any in-isolate sub-structure. There is no "per-isolate" view in the on-disk artifact unless the tool explicitly preserved it (for example, by suffixing filenames with isolate identifiers, which observed tools typically do not).

---

## 10. What Bun does not include

- **No `result[]` envelope.** The aggregation is per-script, not per-process. The closest analogue in shape is Deno's per-script-load model, but Bun arrives there through a different mechanism.
- **No `node:*` modules in the user-relevant surface.** Bun's compat layer does expose `node:*` to user code at runtime, but those scripts can be filtered at session time and are universally excluded from materialized dumps.
- **No persistent `scriptId` across processes.** Same as V8.
- **No process-level metadata in the JSON.** No PID, no timestamp, no isolate identifier. The per-script file stands alone.
- **No source-map-cache key separate from `source`.** The inline base64 map is part of the `source` field. There is no top-level `source-map-cache`.
- **No `lineLengths` array.** Consumers derive line breaks from the transpiled body. Where Node's `source-map-cache` carries `lineLengths` to spare consumers a re-parse, Bun's inline map does not.
- **No execution-context separation.** A script is a script. There is no equivalent of Node's `-1` loader-subprocess file.
- **No flag-driven block coverage on/off.** When `enableControlFlowProfiler` is called, every compiled function carries block counts. There is no analogue of V8's `isBlockCoverage: false` mode.

---

## 11. Operational implications

- **`--inspect-wait` is the only required flag.** No env var, no separate config. Setting the flag and parsing stderr for the WebSocket URL is the entire mechanism.
- **The Inspector session must be alive throughout the workload.** Disconnecting mid-run truncates coverage. Test runners that spawn subprocesses must keep one Inspector session per subprocess for the subprocess's lifetime.
- **The handshake order is load-bearing.** `enableControlFlowProfiler` must precede user code execution. With `--inspect-wait`, Bun pauses until the frontend completes its handshake, which makes this enforceable.
- **Polling stability is the only completion signal.** No native event marks workload end. Tools must poll, hash, and infer.
- **The TypeScript path is built-in and uniform.** No loader detection, no source-map-cache discrimination. Every script that arrives at JSC has been transpiled, every script carries an inline source map.
- **The plain-JS path is also transpiled.** A consequence of the unified pipeline. Block offsets index the transpiled body even for `.js` files. Reading bytes off disk at the reported offsets without applying the inline source map will produce wrong source slices.
- **`url` is the canonical join key.** The dump's `url` field, not the inline map's `sources[0]`, identifies the original disk source.
- **Multi-process aggregation must be live.** Multiple isolates writing the same per-script filename overwrite each other. Tools that need cross-isolate sums must aggregate before flushing.
- **Filtering is a session-time concern.** `bun:`, `node:`, `node_modules/`, and out-of-cwd URLs are typically dropped before any `getBasicBlocks` call is issued for them, both to reduce noise and to avoid wasted protocol round-trips.

---

## 12. Summary

| Axis                                | Bun                                                                                                         |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Capture mechanism                   | live JSC Inspector session over WebSocket                                                                   |
| Activation flag                     | `--inspect-wait=<host>:<port>`                                                                              |
| Envelope                            | one document per user script                                                                                |
| File count per workload             | one per user script (post-filter)                                                                           |
| Filename                            | path-slug derived from the script's URL                                                                     |
| URL space                           | absolute filesystem paths plus `bun:` / `node:` / `eval` (filtered before flush)                            |
| Built-in instrumentation            | exposed by the Inspector, dropped at the consumer                                                           |
| Source-map placement                | inline in `source` for every script                                                                         |
| TS offset target                    | transpiled JS body (always)                                                                                 |
| JS offset target                    | transpiled JS body (always)                                                                                 |
| Reliable join key                   | dump entry's `url`. Inline map's `sources[0]` is decorative                                                 |
| Aggregation expectation             | merge live across isolates. Per-URL summation post-flush works only if isolates do not overwrite each other |
| Completion signal                   | absent. Polling stability is the only path                                                                  |
| Cross-process scriptId stability    | not stable                                                                                                  |
| Distinction between JS and TS dumps | only via `url` extension and `sourcesContent[0]`. Block geometry converges                                  |

Bun's coverage surface is narrow, organized per script, and faithful to JSC's protocol. The complexity is concentrated in the live-session orchestration: handshake ordering, stop-condition heuristics, and cross-isolate merging. Once block data is in hand, the pipeline downstream works on the JSC primitives described in [docs/jsc.md](jsc.md), with the source-map projection handled identically for JS and TS.
