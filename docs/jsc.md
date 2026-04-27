# JSC Coverage Protocol

Reference notes on the JavaScriptCore coverage data model itself: what JSC's control-flow profiler records during execution, what it exposes through the Inspector protocol, and what shape that exposure takes regardless of the runtime hosting it. This document describes the foundation that Bun consumes and that any other JSC-hosted runtime would have to consume in the same way.

It complements [docs/bun.md](bun.md), which describes Bun's specific framing on top of this foundation. Where that document focuses on capture mechanism, file emission, and runtime policy, this one focuses on the per-script data model that is intrinsic to JSC.

---

## 1. One interface, an active session

JSC exposes coverage exclusively through the **Inspector protocol** over a WebSocket. There is no environment-variable-driven post-mortem dump. The only way to obtain coverage data is to attach an Inspector frontend to the JSC isolate while it is alive and ask for blocks before the isolate exits.

This is the first structural difference from V8. V8 supports both a fire-and-forget env-var dump and an Inspector-driven path. JSC supports only the second. As a consequence, every JSC coverage tool is fundamentally an Inspector client, with all that implies: handshake, message framing, asynchronous request/response correlation, and an always-alive socket throughout the workload.

Three protocol commands form the minimum surface:

- **`Runtime.enableControlFlowProfiler`**: turns on the per-isolate control-flow profiler. Required before any block data is meaningful. Idempotent. Recompiles existing code blocks under the profiler's instrumentation, so calling it after non-trivial code has already run loses block coverage for everything before the call.
- **`Runtime.getBasicBlocks`**: returns the current block array for a given source. Pull-driven. The set is cumulative. Every call returns the running state, not a delta.
- **`Debugger.getScriptSource`**: returns the source text JSC compiled for the script. JSC does not include source in the block payload. This is a separate request.

A fourth command, **`Debugger.getBreakpointLocations`**, is not strictly part of coverage but is closely related and is detailed in Section 7.

For the rest of this document, the term "JSC coverage data" refers to the per-script entries returned by `Runtime.getBasicBlocks` plus the script source returned by `Debugger.getScriptSource`.

---

## 2. The script entry

JSC has no equivalent to V8's `result[]` envelope. Coverage state is held in the running isolate, keyed by `sourceID`. A consumer that wants a dump assembles one per script by issuing one `getBasicBlocks` call per `sourceID` it cares about.

The minimum coherent per-script entry assembled from these calls has the following fields:

```jsonc
{
  "url": "...",
  "scriptId": "...",
  "source": "...",
  "blocks": [
    /* one entry per JSC basic block in this script */
  ],
}
```

Properties:

- **`url`**: the script's location as JSC saw it. The `Debugger.scriptParsed` event delivers it as a plain absolute filesystem path with no scheme prefix when the script came from disk. JSC imposes no schema.
- **`scriptId`** (or `sourceID` in the protocol): a numeric string identifier assigned by JSC at parse time. Stable within one isolate's lifetime. Not stable across isolates or runs.
- **`source`**: the script's source text exactly as JSC compiled it. Returned by `Debugger.getScriptSource`. This is the byte sequence the offsets in `blocks` index into. It is **not** necessarily the on-disk source, even for plain JavaScript. See Section 5.
- **`blocks[]`**: every basic block JSC instrumented in this script. Section 3 details the model.

---

## 3. The basic block

Each entry in `blocks[]` describes one basic block:

```jsonc
{
  "startOffset": 0,
  "endOffset": 267,
  "hasExecuted": true,
  "executionCount": 1,
}
```

- **`startOffset` / `endOffset`**: byte positions into `source`. The range is half-open: `[startOffset, endOffset)`. These are bytes into the JSC-compiled source, which on Bun is always the post-transpile body (see Section 5).
- **`hasExecuted`**: boolean. True when the block was reached at least once. Equivalent to `executionCount > 0`. Provided as a separate flag for cheap consumer checks.
- **`executionCount`**: integer counter. Records how many times the block's entry point was reached, cumulatively over the isolate's lifetime up to the moment of the `getBasicBlocks` call.

There is no function name, no scope identity, no parent block reference, no statement annotation, no branch metadata. The basic block is the only unit JSC reports.

### 3.1 Granularity

A basic block is a maximal straight-line code region with one entry and one exit. Every join point and every conditional split creates a block boundary. The result is that JSC reports many small blocks per source, including:

- **Whole-script wrapper blocks** spanning `[0, sourceLength - 1]`. Always present, always with `executionCount` equal to the number of times the module body ran (typically `1`).
- **Function-body blocks** spanning the body of every parsed function.
- **Sub-function blocks** for the body of an `if` arm, the body of a `for`, a ternary alternative, a `try` clause, a `catch` clause, a `finally` clause.
- **Single-byte boundary blocks** at structurally significant edges. Examples observed in real dumps: a block of span `1` covering the position immediately before the closing `}` of a function whose body always returned early. Its `executionCount` is `0` because control flow never reaches the brace through the normal exit path. This is a faithful representation of "code-after-return" reachability, exposed at byte-level precision V8 does not surface.
- **Keyword blocks** for `export` and similar leading tokens. A 6-byte block at offset `0` covering the `export` keyword commonly appears.

For a 267-byte JavaScript source compiled to a 354-byte transpiled body (under Bun's transpiler), JSC commonly produces around 20 blocks. The same source under V8 yields around 5 function entries with selective sub-ranges.

### 3.2 Ordering

Blocks within a script are not ordered by `startOffset`. The protocol's response order reflects whatever traversal the profiler used internally, which is not guaranteed and varies with VM internals. Tools must re-sort if they rely on positional traversal. Sorting by `startOffset` is safe and produces a stable view.

### 3.3 Containment, not strict nesting

Blocks within the same script can be contained inside each other but never partially overlap. Two blocks either:

- **Share no bytes** (siblings in the program structure), or
- **One strictly contains the other** (parent and descendant).

This is the same containment property V8's nested ranges have. The difference is granularity: JSC emits a block at every CFG boundary, whereas V8 emits sub-ranges only when execution count diverges from the enclosing block.

A consequence is that a single byte position is typically covered by several blocks at once: the module wrapper, the enclosing function body, the enclosing statement-level block, and any tighter sub-block. Every block carries its own `executionCount`. There is no "innermost wins" rule like V8's. Every count is an independent measurement of that exact block's entry point.

### 3.4 What `executionCount` means

`executionCount` is the number of times control reached the block's entry point. A few consequences flow from this:

- The whole-script wrapper's count equals the number of times the module body was evaluated. For typical ES modules, this is `1`.
- A function body's count equals the number of times that function was invoked.
- A sub-block inside a function with `count: 5` inside an enclosing block with `count: 10` means the enclosing block was entered 10 times but the inner block only 5 times. The inner count is absolute, not a delta.
- A block with `executionCount: 0` indicates that block's entry was never reached, regardless of the enclosing blocks. This is what coverage tools surface as uncovered code at sub-statement granularity.
- Loop bodies and repeated calls naturally produce counts greater than the enclosing function's count.

### 3.5 The wrapper convention

JSC always emits at least one block spanning `[0, sourceLength - 1]` for any script that compiled successfully, with `executionCount` equal to the module body invocation count. Conceptually equivalent to V8's implicit module wrapper, but not surfaced as a "function" since JSC has no function-entry abstraction. It is just another block.

For modules that load but never run their body, the wrapper block exists with `executionCount: 0`. For modules that execute at least once, the wrapper count is `1`. This is the reliable signal for "did the module execute at least once".

---

## 4. What JSC does not compute

The JSC coverage model is intentionally narrow. The following are **not** the profiler's responsibility:

- **Function ranges as a first-class structure.** This is more nuanced than absence. Internally JSC tracks two parallel data sources for coverage. The `ControlFlowProfiler` produces basic blocks with real execution counts, and a separate `FunctionHasExecutedCache` records, per declared function, only a binary "this function executed" flag with start and end offsets. The Inspector Protocol exposes the first source via `Runtime.getBasicBlocks`, which internally calls the `WithoutFunctionRange` variant of the C++ API. The second source is **not** exposed at all over the wire. The consequence for any consumer is that function-level coverage must be reconstructed downstream by walking the source AST and cross-referencing with block counts. JSC has the function-level signal, but the protocol withholds it.
- **Function names.** Even the surface that **is** exposed carries no symbols. Blocks reference byte ranges only. Mapping a block back to "this is the body of function `add`" requires AST analysis of `source` or external metadata. JSC's per-script payload contains zero symbol information.
- **Real per-function execution counts.** Even the unexposed `FunctionHasExecutedCache` only records a boolean. There is no function-level integer counter anywhere in the JSC coverage stack. The closest available signal is the `executionCount` of the basic block whose range coincides with a function body, derived downstream by AST cross-reference.
- **Branch metadata.** JSC reports basic blocks. It does not categorize them as `if`-arms, ternary alternatives, `case` bodies, or any other branch structure. Translating block counts into branch coverage is structural inference performed downstream against the source AST.
- **Statement boundaries.** Blocks are CFG units, not statements. The set of source positions JSC considers "executable statements" is exposed separately through `Debugger.getBreakpointLocations` (Section 7), not through `getBasicBlocks`.
- **Source maps.** Blocks reference offsets into the JSC-compiled source. If the host runtime executed transpiled code, the offsets are over the transpiled body. Projecting them onto a pre-transpilation source requires whatever source map the transpiler emitted alongside. JSC neither parses nor applies maps.
- **Per-line counts.** Lines are a source-text concept, not a JSC concept. Lines are derived by mapping byte offsets to line numbers using the script source.
- **A "block coverage" flag.** Unlike V8, which surfaces `isBlockCoverage: false` for sampling-only payloads, JSC has no equivalent. The control-flow profiler is either on or off. When it is on, every block of every compiled function carries an `executionCount`.

---

## 5. Source and source maps

JSC exposes the bytes it compiled, not the bytes that exist on disk. The two diverge whenever any transpilation precedes JSC's parse, which on Bun is the universal case.

### 5.1 Source provenance

The string returned by `Debugger.getScriptSource` is the script as JSC parsed it. For a runtime that hands JSC the file's disk bytes verbatim, this matches disk byte-for-byte. For a runtime with a built-in transpiler in front of JSC (Bun is the documented case), the returned string is the transpiled body. Block offsets index that body.

### 5.2 Trailing footers

In practice, dumps observed under Bun include two footers at the tail of `source`:

1. An inline `//# sourceMappingURL=data:application/json;base64,...` comment carrying the V3 source map as a base64-encoded payload. Always present.
2. A `//# sourceURL=<absolute-path>` comment carrying the original disk path. Always present.

Both are part of the bytes the consumer must walk if it byte-iterates over `source`. The basic-block wrapper's `endOffset` includes them (the wrapper spans the entire compiled body, which by definition includes the sourceMappingURL line that JSC parsed).

### 5.3 The inline source map

When the source map is present, its decoded shape is V3:

- `data.version` is `3`.
- `data.sources` is a single-element array with a path. **The path string is unreliable for identification.** Observed dumps carry truncated suffixes such as `"d/src/math.js"` or `"s/src/math.ts"` rather than the full absolute path. The reliable source identifier is the script entry's `url`.
- `data.sourcesContent[0]` is the literal text of the original disk source, embedded in full.
- `data.mappings` is the standard VLQ-encoded mapping string projecting positions in the transpiled body onto positions in the original.
- `data.file` and the cache entry's `url` field are typically `null`.
- `data.names` is empty.

To project an offset from a transpiled-body byte to an original-source position, walk the bytes-to-(line, column) using the transpiled body, then apply the mappings to obtain (line, column) in the original. There is no pre-computed `lineLengths` array as in Node's `source-map-cache`. The consumer derives line breaks from the transpiled body itself.

### 5.4 Source identity

Because the inline-map's `sources` field is unreliable, the canonical identity of the original source is the dump entry's top-level `url` field, which the host runtime populates from `Debugger.scriptParsed`. The map's `sourcesContent[0]` is the original text. The map's `sources[0]` is decorative.

---

## 6. The plain-JS path is also transpiled

A consequence of JSC being fronted by a transpiler in every observed runtime is that **plain JavaScript never reaches JSC unmodified**. Even files with no TypeScript and no JSX get a normalization pass:

- Whitespace and blank-line policy is enforced (consecutive blank lines collapsed).
- String-quote style is normalized (single quotes converted to double quotes in observed dumps).
- A trailing inline source map is appended.
- A trailing `sourceURL` comment is appended.

The size impact is non-trivial. A 267-byte plain-JS module has been observed to compile to a 354-byte body before the appended source map and `sourceURL` comment, then balloon to 1319 bytes once the inline base64 map is concatenated. The block offsets index the post-concatenation byte stream, so the wrapper block's `endOffset` reflects the inflated size.

This collapses the V8-style distinction between "plain JS path" (no source map) and "TypeScript path" (source map required). Under JSC-as-hosted-by-a-transpiling-runtime, every path is the source-map path. The wire shape of a plain-JS dump and a TypeScript dump is structurally identical: same `source` shape with footers, same `blocks` array, same offset semantics.

The discriminator between JS and TS at the block level is **non-existent**. A `math.js` and its mirror `math.ts` produce dumps with identical block geometry (same `startOffset` and `endOffset` per block), differing only in source-map size, the `sourcesContent[0]` payload, and the wrapper block's `endOffset` (which scales with source size). The blocks themselves are byte-identical positions in the transpiled body, because the transpiled body of mirrored JS and TS converges once Bun strips type annotations and normalizes whitespace.

This is a fundamental departure from V8. Under V8, JS dumps carry no `source-map-cache` while TS dumps do. Under JSC, both carry an inline map. The only signal that the original was TS is the file extension in `url`.

---

## 7. Breakable positions

Adjacent to coverage but architecturally separate, JSC's debugger exposes the set of source positions at which a breakpoint can be set, via `Debugger.getBreakpointLocations`. The command takes a `(start, end)` location pair and returns every breakable position in that range.

### 7.1 Granularity

Breakable positions are AST-driven, not CFG-driven. Each position is a `(scriptId, lineNumber, columnNumber)` triple. The set corresponds to JSC's debugger pause points: places in the parsed AST where control would naturally stop if the user set a breakpoint there. This includes:

- Statement starts (the position of the first non-whitespace character of each statement).
- Function close-braces (the position of `}` that ends a function body).
- Inside-expression boundaries that the debugger considers steppable.

It excludes:

- Pure structural keywords. `try`, `} else {`, `} finally {`, `} catch {`, `do {`, the standalone keyword positions of compound statements. The debugger pauses inside their child blocks, not at the keyword token itself.
- Whitespace and comment-only positions.
- Type-only constructs that the transpiler stripped before JSC saw them.

### 7.2 Coordinate system

`lineNumber` and `columnNumber` are zero-based and reference the **transpiled body**, the same byte stream the basic-block offsets reference. They do **not** reference the original disk source. To project a breakable position onto disk, the consumer applies the inline source map.

### 7.3 Relationship to coverage

`getBreakpointLocations` is independent of `getBasicBlocks`. The two sets reveal different aspects of the same script:

- A position appearing in both sets is "JSC considers this position executable, and JSC tracked execution counts for the surrounding block".
- A position appearing only in breakable positions is "JSC considers this position executable, but no separate block boundary lives there", typical for trivial statements inside a single contiguous block.
- A position appearing only inside a non-zero-count block but absent from breakable positions is "JSC's profiler instrumented this region but the debugger does not consider any specific position pausable here", typical for the structural keywords listed above.

Coverage tools that use breakable positions as a gate for "executable line" naturally exclude structural keywords. Whether to admit those keywords back as covered when their enclosing block executed is a consumer policy decision, not a protocol-level question.

---

## 8. What JSC does not surface

- **No raw V8-style `result[]` envelope.** Each script is queried independently. The consumer assembles a dump shape by aggregating per-script responses.
- **No persistent `scriptId` across isolates.** Values are arbitrary numeric strings, valid only within one isolate's lifetime.
- **No equivalent of `node:*` modules in Bun.** Scripts hosted by Bun's runtime layer are tagged with `bun:` URL prefixes and can be filtered or excluded by the client. The Inspector exposes them, but they are policy-distinct from user code.
- **No process-level identity in the data.** A multi-process workload produces multiple isolates, each emitting its own independent stream of script entries. There is no PID, no timestamp, no cross-isolate correlation key in the protocol payload.
- **No `Profiler.takePreciseCoverage`-equivalent that returns everything in one call.** Each `getBasicBlocks` call targets exactly one `sourceID`. A consumer must enumerate parsed scripts (via `Debugger.scriptParsed` events) and call `getBasicBlocks` once per script.
- **No incremental delta API.** The state is cumulative. To capture "what happened between two points in time", a consumer subtracts two snapshots itself.
- **No branch coverage.** This is a documented limitation of the JSC Inspector. Block counts are the maximum granularity exposed. Arm-level branch attribution requires AST inference downstream.
- **No `Runtime.runIfWaitingForDebugger`.** This command is V8 CDP. It does not exist in JSC. Tools ported from a Chrome DevTools Protocol baseline frequently expect to issue it after the handshake to release a paused isolate. JSC has no equivalent because JSC's "wait for inspector" mode does not pause execution at the JS level. See Section 2 of [docs/bun.md](bun.md) for the runtime-level consequence.

---

## 9. Determinism and runtime parity

For the same input bytes, JSC's control-flow profiler is deterministic. Two runs of the same workload against the same JSC build produce byte-identical block geometry. This holds across the JS/TS distinction once transpilation is taken into account: a `math.js` and a mirror `math.ts` whose Bun-transpiled bodies are byte-identical produce byte-identical `blocks` arrays.

Cross-runtime parity, in the V8 sense, **does not apply**. JSC and V8 are different engines with different control-flow profilers. The block geometry one engine reports for a given source is not the function-range geometry the other reports for the same source. Direct equality of dumps across engines is not a meaningful question. Structural equivalence (each engine's report faithfully describes its own execution) is the guarantee that holds.

What does generalize across runtimes hosting JSC is that **the protocol surface is determined by the JSC build, not by the host**. A future JSC-hosted runtime, given the same JSC build Bun ships, would expose the same `Runtime.getBasicBlocks` shape, the same block semantics, and the same block geometry for the same compiled body. The host's responsibility ends at deciding which scripts to surface and how to label them.

---

## 10. Operational implications

A few rules that fall out of the model:

- **The Inspector session is the dump.** Block data lives in the running isolate. Any tool that wants a post-mortem dump must observe and snapshot before the isolate exits. There is no env-var path.
- **Enable the profiler before user code runs.** `Runtime.enableControlFlowProfiler` recompiles existing code blocks. Calling it after non-trivial code has already run loses block coverage for the pre-call execution. The handshake order is: connect → `Runtime.enable` → `Debugger.enable` → `Runtime.enableControlFlowProfiler` → unblock the isolate.
- **Trust `executionCount` per block, not per line.** The protocol's unit is the block. Per-line counts are derived. Bugs in per-line aggregation are downstream of JSC.
- **Containment without "innermost wins".** Every block carries its own count. A position at the boundary of an inner block has both the inner count and every enclosing block's count available. Whether to "pick" one is a consumer convention, not a protocol rule.
- **Wrapper count is a load count, not an import count.** The whole-script wrapper has `executionCount: 1` for typical ES modules regardless of how many places imported them, because the host runtime evaluates the body once.
- **Source maps are mandatory.** Even for plain JS. The transpiled body diverges from disk. The inline map is the only reliable projection.
- **`url` is the canonical script identity, not `sources[0]`.** The inline source map's `sources` array is decorative. The dump entry's `url` field is the join key.
- **Block geometry survives JS/TS extension changes.** Mirrored JS/TS sources whose Bun-transpiled bodies converge produce identical block arrays. The discriminator between "this was originally TS" and "this was originally JS" is the file extension and the contents of `sourcesContent[0]`, not the block structure.

---

## 11. Summary

| Axis                         | JSC protocol                                                       |
| ---------------------------- | ------------------------------------------------------------------ |
| Capture mechanism            | Inspector session over WebSocket, no env-var dump                  |
| Required handshake           | `Runtime.enable` + `Debugger.enable` + `enableControlFlowProfiler` |
| Unit of measurement          | basic block with execution count                                   |
| Granularity                  | every CFG boundary, including 1-byte structural blocks             |
| Range semantics              | nested by containment, every count independent                     |
| Function model               | absent, with no function names and no scope identity               |
| Module wrapper               | a block spanning `[0, sourceLength - 1]`                           |
| Block coverage flag          | absent, block counts are always present when profiler is on        |
| Branch coverage              | absent at protocol level                                           |
| Source                       | exposed via `Debugger.getScriptSource` only                        |
| Source maps                  | inline in `source` for every script that went through a transpiler |
| Source-text path identity    | dump entry's `url`. Inline map's `sources[0]` is decorative        |
| Breakable-positions API      | separate, AST-driven, returns transpiled-body coordinates          |
| Cross-isolate scriptId       | not stable                                                         |
| Cross-process aggregation    | per-isolate streams. Consumer aggregates at the URL level          |
| Cross-runtime parity (vs V8) | not applicable, different engine and different model               |

JSC's coverage protocol is finer-grained than V8's at the block level and narrower at the symbolic level. Where V8 emits function-aware ranges and selective sub-ranges, JSC emits flat-but-nested basic blocks with no function metadata. Where V8 supports a fire-and-forget env-var dump, JSC requires a live Inspector session. Both are deterministic for their own engine. Neither makes claims about the other.
