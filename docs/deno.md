# Deno V8 Coverage Surface

Reference notes on how Deno's raw V8 coverage data is shaped and how it differs from Node.js's. Drawn from a side-by-side comparison of the dumps each runtime produced for the same Poku test suite running against mirrored JavaScript and TypeScript playgrounds.

The intent is human-readable reference material for anyone who needs to understand, audit, or extend coverage logic without re-running the comparison from scratch.

---

## 1. Envelope shape

Node.js packages all V8 coverage data into a single document per process:

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
    /* present only when TypeScript is in play */
  },
}
```

Deno emits one document per loaded script, with no outer wrapper:

```jsonc
{
  "scriptId": "...",
  "url": "...",
  "functions": [
    /* ... */
  ],
}
```

The functional payload is identical between the two: same `functions[]`, same `ranges[]`, same `count`, same `isBlockCoverage`. The difference is purely organizational. Node groups. Deno fragments.

---

## 2. File emission cadence

| Suite   | Process count | Files emitted | Per-process file count | Naming convention                   |
| ------- | ------------- | ------------- | ---------------------- | ----------------------------------- |
| Node JS | 5             | 5             | 1                      | `coverage-<pid>-<timestamp>-0.json` |
| Node TS | 5             | 10            | **2**                  | same, with `-0` and `-1` suffixes   |
| Deno JS | 5             | ~250          | ~50                    | `<uuid>.json`                       |
| Deno TS | 5             | ~250          | ~50                    | `<uuid>.json`                       |

A few observations follow:

- Node TS emits two files per process because the TypeScript ESM loader runs in a subprocess that V8 instruments separately. The `-1` file holds only loader internals. User code lives in the `-0` file.
- Deno's per-process file count is roughly the count of distinct scripts each process loads, dominated by `node_modules/` dependencies, not by user code.
- Deno's UUID filename carries no semantic information. Two files for the same script URL look identical from the outside.

---

## 3. URL surface

What gets recorded is fundamentally different:

| Category                           | Node JS    | Node TS                            | Deno (JS or TS) |
| ---------------------------------- | ---------- | ---------------------------------- | --------------- |
| `file://` user code                | yes        | yes                                | yes             |
| `file://` `node_modules/*`         | yes        | yes (plus tsx / esbuild internals) | yes             |
| `node:*` built-in modules          | yes (~130) | yes (~170)                         | **no**          |
| `ext:` / `deno:` runtime internals | n/a        | n/a                                | **no**          |

**Deno excludes runtime internals from its raw V8 dump entirely.** Whatever the dump contains was loaded from disk via a `file://` URL. This is a deliberate filtering choice on Deno's side, not an accident of the V8 protocol.

The size consequence is dramatic. A typical Node JS process dumps ~440 KB. A typical Deno script-load dumps ~1.3 KB. Multiplied by 50 scripts per process, Deno's total is still about six times smaller than Node's for the same workload.

---

## 4. The JavaScript surprise

For pure JavaScript, **the V8 coverage primitives are byte-identical between Node and Deno**.

Confirmed by direct `diff` over the `functions[]` arrays of all 10 user files of a mirrored playground (5 source modules and 5 test modules):

- Same set of `functionName` entries, in the same order.
- Same `startOffset` / `endOffset` for every range.
- Same `count` for every range.
- Same `isBlockCoverage` flag.

The only differences are in the envelope (Section 1) and the URL surface (Section 3). Below the envelope, both runtimes feed the exact same V8 instrumentation and produce the exact same per-script payload.

This is significant: **for JavaScript, no semantic conversion is needed** to translate between the two formats. Only structural reorganization. Any tool that understands one format already understands the other, given an envelope adapter.

---

## 5. The TypeScript divergence

This is where the runtimes part ways. The differences are not cosmetic. They affect what the coverage data means.

### 5.1 Transpilation behavior

Node TS, by default, uses `tsx` (which uses esbuild). Esbuild performs an **expansive transpilation**:

- Type annotations are removed.
- Modules are wrapped, often into a 3-line minified body.
- A `__name` helper is injected to preserve `Function.name` after mangling.

A representative example:

| Source file       | Bytes on disk (`.ts`) | Wrapper end offset (Node TS) | Wrapper end offset (Deno TS) |
| ----------------- | --------------------- | ---------------------------- | ---------------------------- |
| `math.ts`         | 363                   | 1569                         | 264                          |
| `logic.ts`        | (varies)              | 5815                         | 1441                         |
| `logic.test.ts`   | (varies)              | 10424                        | 3166                         |
| `strings.test.ts` | (varies)              | 1193                         | 287                          |

The Node TS body is consistently three to six times the size of the original `.ts`. Deno TS transpiles strip-only: type annotations are removed, but byte positions of the surviving code are largely preserved. The reported V8 offsets are essentially over the original `.ts` minus the type annotations.

### 5.2 The `__name` ghost

Node TS dumps include a function entry named `__name` in every `src/*.ts` file (not in tests). It is the esbuild helper, with `count` equal to the number of named exported functions in the module. It is invisible in source code: it lives only in the transpiled body.

Deno TS produces no such ghost. Its function set matches the source 1:1.

### 5.3 Source map exposure

Node TS embeds source maps inline in the dump under a top-level `source-map-cache` key:

```jsonc
{
  "result": [
    /* ... */
  ],
  "source-map-cache": {
    "file:///.../math.ts": {
      "data": {
        /* V3 source map, including sourcesContent */
      },
      "lineLengths": [429, 0, 1138],
      "url": null,
    },
    /* one entry per user .ts script */
  },
}
```

Properties of this cache:

- It is keyed by the same `.ts` URL that appears in `result[].url`.
- `data.sourcesContent` carries the literal `.ts` text, embedded.
- `lineLengths` describes the **transpiled** body, line by line. It is required to translate V8's byte offsets into `(line, column)` pairs in the JS that ran, which the source map's `mappings` then projects onto `(line, column)` in the original `.ts`.
- `data.file` and the cache entry's `url` are `null` in practice. The reliable identifier is the cache map's outer key.

Deno TS exposes none of this in the raw dump. Source map reconstruction, when needed, is handled internally by `deno coverage`. Raw consumers see only `.ts` offsets and must trust them as-is.

### 5.4 Module wrapper count: a Deno quirk

For every TypeScript module Deno loads, the top-level wrapper function (the one with `functionName: ""` covering the whole module body) reports `count: 2`. Universally. Across every `.ts` file observed.

For JavaScript, both Node and Deno report `count: 1` for the wrapper. So this is not a TypeScript-specific behavior of V8 itself. It is something Deno's module loader does on the TypeScript path specifically. Plausible explanations include a cold-load + warm-execute cycle, or a compilation pass that touches the wrapper before execution.

It is not normalizable without losing information. Tools that aggregate hit counts at the line level absorb the discrepancy naturally. Tools that surface the raw wrapper count must decide whether to clamp it to 1 or expose the 2.

### 5.5 Where both runtimes still agree

Despite the divergence, both runtimes report `.ts` URLs in `result[].url` for TypeScript scripts. The difference is what those offsets mean:

- Node TS: offsets are over the transpiled JS body. The source map (Section 5.3) is required to project them onto the `.ts`.
- Deno TS: offsets are over the `.ts` directly, modulo stripped type annotations.

A consumer that reads offsets without applying the map will produce correct results on Deno TS and broken results on Node TS, even though both URLs point to the same `.ts` path on disk.

---

## 6. Duplication semantics

Because Deno emits one document per script-load, and the same script is loaded by every test process, the same URL appears in many UUID files. The pattern is predictable:

- **User files**: each appears in exactly one file (the process that runs it).
- **Most `node_modules/` dependencies**: each appears in N files, where N is the process count, with consistent `count` across copies.
- **Entry-point files of the test runner**: can appear `2N` times with **divergent counts** between copies (for example, `[1, 2]`). This reflects the same module being loaded from different entry contexts: a runner CLI process versus a per-test worker.

Aggregation must merge these correctly, summing counts per range across all copies. Failure to merge produces undercounts. Canonicalizing to one copy at random produces overcounts on some files and undercounts on others. The rule for consumers is straightforward: treat URL as the deduplication key, sum counts, and never elect a single file as canonical.

---

## 7. What Deno does not include

A short list, useful when designing tools that consume the dumps:

- **No `source-map-cache`** at any level. Deno's TS pipeline keeps the source map relationship internal to `deno coverage`. External tools cannot reuse it without re-emitting from disk.
- **No raw `scriptSource`**. Neither runtime embeds the JavaScript text V8 saw. Both expect the consumer to read source from the URL.
- **No `node:` modules in the dump**. Whatever runtime built-ins Deno exposes are not surfaced as covered scripts.
- **No `ext:` or `deno:` runtime internals**. The boundary between user code and Deno's runtime is sharp.
- **No envelope metadata**. There is no top-level `timestamp` or process identifier. The UUID filename is the only per-emission identity.

---

## 8. Operational implications

A few takeaways that follow from the observations above, framed as practical guidance:

- **For JavaScript, Node and Deno can be treated as the same source.** Below the envelope, the data is identical. Any tool that handles Node JS V8 dumps will produce identical results on Deno JS dumps, once the envelope is normalized.

- **For TypeScript, the operational axis is not "which runtime" but "is there a source map?"** Node TS via `tsx`, `ts-node`, Babel, or SWC ships a source map and offsets are over a transpiled body. Deno TS and Node's `--experimental-strip-types` ship no source map and offsets are over the original. A tool designed around this discriminator handles all current TS pipelines uniformly, including future ones.

- **Deno dumps require deduplication. Node dumps require splitting.** Node's per-process documents already contain the full set of scripts the process touched. Deno's UUID files must be aggregated by URL before analysis. The two are mirror-image organizational problems.

- **Filtering `__name` out of TS reports requires source-map-aware logic.** It is a transpilation artifact, not user code. It does not exist in the original `.ts`. Source map remap typically projects its range to a position that has no original-source equivalent. A well-built remap step drops it. A naive consumer that displays raw V8 functions will leak it into reports.

- **The reliable identifier inside `source-map-cache` is the outer map key.** Both `data.file` and the per-entry `url` are `null` in practice. Trusting them produces consistent failures on Node TS dumps.

---

## 9. Summary

| Axis                             | Node.js                              | Deno                         |
| -------------------------------- | ------------------------------------ | ---------------------------- |
| Envelope                         | `result[]` per process               | one flat doc per script-load |
| File count per run               | small (1 to 2 per process)           | large (one per script-load)  |
| URL space                        | `file://` plus `node:*` plus loaders | `file://` only               |
| Internal runtime modules in dump | yes                                  | no                           |
| Source-map-cache for TS          | inline                               | not exposed                  |
| TS offset target                 | transpiled JS body                   | original `.ts`               |
| TS function ghosts               | `__name` from esbuild                | none                         |
| TS module wrapper count          | 1                                    | 2 (universal)                |
| JS data parity                   | byte-identical with Deno             | byte-identical with Node     |
| Aggregation expectation          | per-process                          | per-URL                      |

The foundational V8 instrumentation is the same on both runtimes. Everything that differs is organizational, runtime-policy, or transpiler-specific. None of the differences require runtime-specific data semantics. They require runtime-specific framing logic at the entry boundary, with a uniform pipeline behind it.
