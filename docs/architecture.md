# Architecture

Reference notes on how **@pokujs/coverage** is organized internally. Drawn from the structural decisions that shape the codebase rather than from any specific file.

- The goal is to describe responsibilities, boundaries, and conventions that survive routine refactors.

---

## 1. Patterns by responsibility

Different responsibilities are governed by different patterns, each scoped to the problem it actually solves. The mapping below names every pattern in play. The sections that follow take each one in turn.

| Responsibility                               | Pattern                                      | Scope                                                                                              |
| -------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Isolating coverage logic from external hosts | Hexagonal (Ports and Adapters)               | The outer boundary only. Adapter to port to core                                                   |
| Coverage capture per engine                  | Strategy                                     | One implementation per runtime. Same lifecycle contract                                            |
| Raw data to Istanbul                         | Pipes and Filters                            | Linear pipeline of pure stages. No back-edges                                                      |
| Engine awareness inside the pipeline         | Single boundary stage                        | Exactly one stage knows the originating engine. Everything else does not                           |
| Materializing reports                        | Lazy on-demand evaluation                    | Reporters pull through a memoizing context, never preemptively                                     |
| Cross-cutting LCOV production                | Strategy (engine-aware)                      | One LCOV producer per runtime. Single engine-aware module in the reporter layer                    |
| Module assignment and placement              | Source-of-truth + promote-on-second-consumer | One home per concept. Cross-consumer helpers move to a shared layer when a second consumer appears |
| Module signature                             | Object-as-namespace                          | Every module exports one named const, named after the domain                                       |
| Type declarations                            | Domain-per-file directory                    | One file per domain. No barrels. No inline types elsewhere                                         |

The remainder of this document covers each pattern in the order above, plus the conventions that fall out of them.

---

## 2. The outer boundary (Hexagonal)

Three distinct external hosts can trigger a coverage run. Each has its own assumptions about hooks, lifecycle, and the shape of the data it expects back. Without a fixed boundary between them and the coverage logic, every new host would risk reaching into engine-specific code, and every refactor of an internal stage would risk breaking a host. The boundary is what keeps both costs flat as hosts and stages evolve independently.

```
   user code              user code              user CLI
        │                     │                      │
        ▼                     ▼                      ▼
  ┌──────────┐         ┌──────────────┐       ┌──────────┐
  │  Plugin  │         │  Provider    │       │  CLI     │
  │ adapter  │         │  adapter     │       │ adapter  │
  └────┬─────┘         └──────┬───────┘       └────┬─────┘
       │                      │                    │
       └──────────┬───────────┴────────────────────┘
                  │  (only path inward)
                  ▼
            ┌───────────┐
            │   PORT    │   named, narrow surface
            └─────┬─────┘
                  │  (re-exports from the core)
                  ▼
   ┌────────────────────────────────────────┐
   │              CORE                      │
   │  runtimes, pipeline, reporters, …      │
   └────────────────────────────────────────┘
```

The structural rule is binary. **Adapters import from the port. The port re-exports from the core. The core never imports from adapters or from the port.**

The port stays narrow on purpose. The wider it gets, the more of the core becomes a frozen surface that cannot move without coordinating with every adapter. Keeping the port to the minimum hooks an adapter needs preserves the freedom to refactor everything behind it. The public package surface, the one an end user installs and imports, is narrower still, because most of the port is operational machinery for adapters and not API for users.

### 2.1 Adapter shapes

The three adapters pictured above are not interchangeable. Each one exists because the test runner it serves cooperates with external coverage in a different way, and the adapter shape is determined by how much of the lifecycle the runner is willing to expose.

|                               | **plugin** (Poku)                     | **CLI** (Node, Deno, AVA, Mocha, …)    | **provider** (Vitest)                                                 |
| ----------------------------- | ------------------------------------- | -------------------------------------- | --------------------------------------------------------------------- |
| setup                         | per-run hook                          | once, in parent                        | once, in parent                                                       |
| runner                        | per test file (plugin callback)       | one wrapping spawn of the user command | delegated to runner workers                                           |
| on-test-process               | per test file (plugin callback)       | ─                                      | per worker, via the provider API                                      |
| teardown                      | per-run hook                          | once, in parent                        | once, in parent                                                       |
| how raw data reaches the core | written by engine, read from temp dir | written by engine, read from temp dir  | delivered through the provider API, re-injected as if from a temp dir |

The **plugin** shape exists because the runner exposes coverage as a first-class plugin concept. The four hooks map one-to-one onto the runner's own callbacks, and the adapter is thin.

The **CLI** shape exists for runners that have no plugin concept for coverage at all. The adapter wraps the user's entire test command as a subprocess, and the env-var or flag the engine needs is inherited by the child.

The **provider** shape exists because the runner has coverage as a first-class concept but mediates access to the raw engine data through its own provider API. The adapter implements that interface, captures the data the runner hands over, and re-injects it into the pipeline as if it had been written to a temp directory.

---

## 3. The lifecycle contract

Every adapter, regardless of which host it serves, drives the core through the same four-phase contract over time.

```
time ───────────────────────────────────────────────────────────►

setup           runner       on-test-process    runner       …    teardown
  │               │                 │              │                 │
  ▼               ▼                 ▼              ▼                 ▼
arrange       transform         attach to      transform         materialize
 capture        spawn             child          spawn             reports +
 mechanism     command           process         command           thresholds
                  │  │              │
                  │  └──────────────┘
                  │  per test file (loop)
```

Setup declares that a coverage run is starting and lets the core arrange whatever the runtime needs (a temp directory, an environment variable, a flag, an inspector session). Runner announces a test file and requests whatever transformation the runtime needs to spawn it. On-test-process announces that a child process has started for a given test file and lets the runtime attach whatever it needs. Teardown declares that the run is ending, materializes the configured reporters, and enforces thresholds.

The contract is runtime-agnostic at the call site. Adapters dispatch on the runtime they were told they are running under, not on a runtime they detected themselves. Detection logic, where it is needed at all, lives in exactly one place per adapter and stays out of the core.

---

## 4. Runtime strategies

The three engines do not share a capture mechanism (see [v8.md](v8.md), [jsc.md](jsc.md)). One writes dumps to a directory selected by an environment variable, another does the same with a different envelope, and a third exposes coverage only through a live inspector session. Forcing one of these into the shape of another would either bury orchestration the engine actually needs or impose ceremony on engines that need none of it. Strategy is the pattern that keeps each engine's capture honest while still presenting one contract upward.

```
                  setup       runner          on-test-process    teardown
                ─────────────────────────────────────────────────────────
   env-var/V8 │  arrange       ─                  ─               common
              │  env var
              │
   env-var/V8 │  arrange       ─                  ─               common
   (other)    │  env var
              │
   inspector/ │  arrange    inject runtime     attach inspector   flush +
   JSC        │  temp dir   flags              session            common
```

The asymmetry is the whole point. A runtime that requires no flags emits no flags. A runtime that requires no session emits no session. The shared contract accommodates the most demanding engine without inflating the surface for the simplest ones, and the dispatcher carries no engine knowledge of its own beyond the table lookup.

The pattern recurs wherever the project meets a similar shape of variation. Envelope normalization has one strategy per envelope, because the wire formats genuinely differ. LCOV production has one strategy per runtime, because the path from raw data to LCOV is the only place inside the reporter layer where engine differences cannot be erased. Each occurrence is local to its layer, and downstream stages always see the unified shape the strategy produced.

---

## 5. The data pipeline (Pipes and Filters)

The transformation from raw engine output to a coverage map is long, contains several distinct concerns, and has to support two engine families with different intermediate shapes. Modeling it as a graph or as mutually-aware modules would propagate every engine quirk through every concern, and would block the kind of stage-level reasoning that makes pipeline bugs auditable. A linear pipeline of stages with stable inputs and outputs keeps every concern testable in isolation and makes the boundary between engine-aware and engine-agnostic code physically obvious.

```
   raw dumps                                                  reports
       │                                                         ▲
       ▼                                                         │
  ┌─────────┐    ┌─────────────┐    ┌─────────────┐    ┌──────────────┐
  │envelope │───▶│ aggregation │───▶│  Istanbul   │───▶│   reporter   │
  │normalize│    │             │    │construction │    │   consumes   │
  └─────────┘    └─────────────┘    └─────────────┘    └──────────────┘
       ▲                                  ▲
   engine-aware                    branch enrichment
   (the only one)                  (V8 only, no-op for JSC)
```

Each stage has a single responsibility and a stable input and output shape. Envelope normalization strips the wire format the engine wrote and emits one entry per script in a uniform shape. Aggregation walks the normalized entries, source-map projects when applicable, and folds them into a per-file structure that records line hits, function positions, and branch information. Istanbul construction converts the aggregation into the Istanbul coverage map every reporter consumes. Branch enrichment merges AST-derived branch discovery back into the coverage map for runtimes whose engine reports usable branch granularity, and is a no-op for runtimes whose engine does not.

---

## 6. The envelope boundary

Envelopes are where every supported runtime drifts from every other one. They change between runtime versions, between TypeScript loaders, and between minor releases of the engines themselves. Every other concern in the pipeline (offset arithmetic, source-map projection, branch inference, Istanbul construction) operates on the same primitives regardless of which envelope produced them. Concentrating envelope knowledge in one stage keeps the cost of supporting a new runtime variant proportional to the variant's actual difference, not to the pipeline's depth.

```
  raw dump (engine A envelope)        raw dump (engine B envelope)
            │                                       │
            ▼                                       ▼
      ┌────────────┐                        ┌────────────┐
      │ normalizer │                        │ normalizer │
      │     A      │                        │     B      │
      └─────┬──────┘                        └─────┬──────┘
            │                                     │
            └──────────────┬──────────────────────┘
                           │
                           ▼
                  uniform entry shape
                           │
                           ▼
              everything downstream
              (no engine awareness)
```

**Exactly one stage knows which engine produced a raw dump.** Everything downstream consumes the uniform shape that stage produced and never branches on the engine. The rule applies equally to the engine path that does not pass through the V8 normalizer. JSC has its own normalization stage, with the same downstream invariant.

---

## 7. Lazy on-demand evaluation

The pipeline is expensive. Walking every script's offsets, projecting through source maps, and rebuilding an Istanbul coverage map costs real time, and a run can complete without ever needing the result (no reporters configured, no thresholds set, only raw dumps requested). Eager materialization would impose that cost on every run regardless of what the consumer asked for. Pulling the result through a memoizing context inverts the decision. The core declares what is producible, and consumers decide when to spend the cost. The memoization is what keeps the cost flat when several consumers each ask for the same coverage map.

```
   teardown
      │
      ├─ build reporter context
      │     { produce coverage map: lazy, memoized }
      │
      ├─ for each reporter:
      │     reporter.report(context)
      │         │
      │         └─▶ context.produce coverage map()
      │                  │
      │                  ├─ if cached: return
      │                  └─ else: run pipeline, cache, return
      │
      └─ thresholds.run(context)   ← also a consumer
```

---

## 8. Module shape: the object-approach

Every module exports **one named const, named after the module's domain, with operations attached as properties**. A module that filters LCOV exposes `lcov.filter`. A module that creates state exposes `state.create`. A module that converts V8 dumps to Istanbul exposes `converters.v8ToIstanbul.convert`.

This is a convention of module signature, orthogonal to every architectural pattern in this document. A project can be hexagonal without it, and following it does not make a project hexagonal. The two dimensions are independent.

The convention is the answer to three concrete frictions:

- **Adding an operation should be local.** A module that starts with one operation often grows a second. If that first operation was exported as a bare function, adding the second forces either a rename at every call site (to introduce a namespace) or a parallel export with a different shape (which fragments the surface). Exporting a const from day one avoids both. The namespace is already there, and the second operation slides in without touching consumers.
- **Call sites should make their origin obvious.** Every call site reads as `domain.operation(...)`. The module the operation came from is visible at the point of use, without scrolling to the import block or relying on an IDE. When an operation moves between modules, every call site changes namespace prefix, which surfaces the move at code-review time instead of hiding it in an import diff.
- **Sibling imports should not need a barrel.** Files inside the same directory often need to import each other. Routing those imports through the directory's index file creates module-evaluation cycles that named consts inside dedicated files do not. The convention lets siblings import each other directly without setting cycle traps.

The rule for **what a module's domain is** is structural, not consumer-driven. A module is named for what it produces or transforms, not for who calls it. A converter is named for the format pair it translates between. A filter is named for the format it accepts and emits. Same-format transformations live in the format's own domain. Cross-format transformations live in a converter domain. A module never carries the name of its caller in its own name.

The rule for **where a module lives** is parallel. Generic helpers, organized by their nature (strings, paths, terminals, source maps), live in a generic-utility area. Cross-consumer helpers, when at least two siblings need them, live in a shared layer at the same level as the consumers. A helper that sibling A needs and sibling B does not need stays in A. The moment B needs it, it moves to a shared layer in the same commit. **Sibling-to-sibling imports are never the answer.** They are the symptom of a missing shared module, and the fix is the shared module, not the import.

The same rule governs single-file vs. directory. A file that has accumulated multiple responsibilities (discovery, parsing, serialization, orchestration) is promoted to a directory. The directory's index file becomes the orchestrator and the public entry. Each responsibility moves to its own file. The decision criterion is responsibility count, not line count.

---

## 9. Types

Types organized by consumer drift the moment two consumers grow a shared concept and neither owns the canonical declaration. Organizing by **domain** instead, with one file per domain, gives every shape exactly one home. A type that describes a coverage option lives with other coverage options. A type that describes the V8 wire protocol lives with other V8 protocol types. The home is fixed, and consumers reach it directly.

The rule against ad-hoc type declarations elsewhere in the codebase is total. There is no exception for non-exported types, no exception for file-local types, no exception for helper types. The reasoning is consolidation. A type that exists in two places is a refactor liability, and the only durable cure for it is to give it one home. The discipline of always declaring types in the type directory means the project never accumulates the kind of duplication that shows up only when someone tries to change a shape.

The convention also rules out aggregator files. Every consumer imports the type it needs directly from the domain file that owns it.

The choice of `type` over `interface` is uniform. The avoidance of `any` and of double-cast escape hatches is uniform. Direct casts are tolerated only at real boundaries where data crosses from an untyped source into the typed world. Inside the typed world, casts that bridge two types the project owns are bugs, because they hide the disagreement that should be resolved at the type level.

---

## 10. Configuration

A user configures a run through two channels, inline plugin options and a config file, with several competing config-file dialects inherited from neighboring tools. Letting each dialect reach the core in its own shape would push dialect-awareness into every consumer of options. Funnelling everything through a single normalization step keeps every downstream module on the same shape and confines the dialect-specific quirks to the entry layer.

```
   plugin options ───┐
                     ├──▶  unified options shape  ──▶  core
   config file ──────┘
```

The mapping from each input dialect to the unified shape is one-way and lossy where dialects disagree. The user-facing options shape is the source of truth for everything downstream, and the channel of origin is forgotten the moment normalization completes.

Precedence is fixed. **Plugin options beat config files.** The auto-discovery order for config files is stable across runtimes, because the goal is to behave the same way under every engine.

The CLI surface is deliberately narrow and does not participate in option override. Two flags exist, each with a single purpose. **`--coverage`** is a gate that toggles whether the plugin runs at all, used only when the plugin was opted into a flag-gated mode. **`--coverageConfig=<path>`** selects which config file to load, equivalent to setting the config-path option inline. Neither flag carries values for other options. There is no `--reporter`, no `--exclude`, no per-option flag of any kind. The decision keeps the CLI surface trivial to document and forces every meaningful configuration to live in one of the two real channels.

---

## 11. Reporters

A reporter that calls another reporter inherits its bugs, its options, and its release cadence. Treating each reporter as a self-contained consumer of the unified Istanbul coverage map keeps the surface for adding a new format constant. The price is occasional duplication, paid back the first time a piece of duplication is needed in a third place and lifted to a shared layer within the reporter directory.

Two reporters are engine-specific by design, the raw V8 dump reporter and the raw JSC dump reporter. A user who asked for one but ran under the other receives the runtime-appropriate sibling, swapped at registration time, because the alternative would be to fail a run for a request the user almost certainly meant. This is the only place in the project where an engine name appears in a reporter selection.

LCOV occupies a special position. Several reporters and the threshold-checking step all need LCOV text, and the path from raw data to LCOV is the one place the reporter layer cannot pretend the engine away. Concentrating that path into a single LCOV production facility keeps every other reporter on the unified Istanbul shape and contains the engine awareness to a single module.

```
   user options.reporter           runtime
          │                            │
          ▼                            ▼
   ┌──────────────────────────────────────┐
   │  reporter normalization              │
   │  - swap raw-V8 ↔ raw-JSC by runtime  │
   │  - validate against the registry     │
   └──────────────┬───────────────────────┘
                  │
                  ▼
          dispatch reporters
                  │
   ┌──────────────┼─────────────────┐
   ▼              ▼                 ▼
 engine-      coverage-map      LCOV-based
 specific     consumers         consumers
 (raw V8,     (json, html,         │
  raw JSC)    cobertura, …)        ▼
                          ┌─────────────────────┐
                          │  LCOV facility      │
                          │  engine-aware:      │
                          │  one producer per   │
                          │  runtime            │
                          └─────────────────────┘
                                      │
                                      ▼
                          (also consumed by
                           threshold checking)
```

---

## 12. Tests, fixtures, snapshots

Adding a runtime should not multiply the test file count. Encoding the runtime in the filename does exactly that, and it also splits the per-case expectation across files that drift independently. Organizing tests **by reporter and by case** instead, with the runtime as an iteration axis inside the test body, keeps the file count proportional to the surface being tested and keeps the per-case expectation in one place. A new runtime adds an entry to the iteration list, not a column of new files.

Fixtures and snapshots follow the same per-case organization. A fixture for a case is a project skeleton that exercises that case. The flow is one-directional.

```
  ┌────────────────────┐
  │   resource area    │   immutable, never executed,
  │  (one per shape)   │   versioned source of truth
  └─────────┬──────────┘
            │  hydrate at setup time
            ▼
  ┌────────────────────┐
  │   fixture area     │   per (reporter, runtime, case)
  │ generated, runnable│   versions only the runner config
  └─────────┬──────────┘
            │  test run
            ▼
  ┌────────────────────┐
  │   snapshot area    │   per (reporter, runtime, platform, case)
  │  golden artifacts  │   one canonical structure across formats
  └────────────────────┘
```

Skeletons live in a resource area that is never executed. Copying them into a fixture area at setup time isolates the immutable resource from per-run mutation. Each fixture leaf versions only its own runner config, because that is the one piece that genuinely varies per case. Everything else is hydrated.

Snapshots are stored **per platform** because path separators, line endings, and locale-sensitive output produce real divergences across operating systems, and erasing those divergences in the test harness would also erase real bugs that only surface on one platform. Each platform owns its own snapshot copy on principle. A reporter whose output happens to be identical across platforms still has three identical copies, one per platform, and the deduplication is a build-time concern handled by tooling rather than a logical merge in the source tree.

Every JSON-shaped snapshot conforms to a single canonical structure. The unification is what allows a reader module to translate every native reporter format into the same shape and turn snapshot diffing into a structural comparison. Reporters fill only the fields they emit, and a simpler reporter is a natural subset of a richer one. Comparing across reporters becomes a question of which fields are present, not which strings happen to match.

Infrastructure directories that do not hold tests carry a doubled-underscore prefix and suffix. The signal is purely for human readers, since the test harness does not key off the convention, and it exists because the test discovery root and the surrounding scaffolding are visually indistinguishable without it.

---

## 13. Deliberate non-decisions

Two decisions are easier to recognize when stated as omissions:

- **No silent runtime guards in tests.** A missing engine binary fails the spawn naturally. The test harness does not paper over the absence with a skip, because the absence of an engine in CI is a configuration issue worth surfacing rather than swallowing.
- **No cleanup on top of broken state.** When a refactor goes wrong, the prescribed move is to step back and implement the right approach cleanly, not to patch progressively on top of a wrong start. The discipline applies to the codebase and equally to the documentation.

---

## 14. Summary

| Axis                         | Convention                                                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Outer boundary               | Hexagonal. Adapters import from the port. The port re-exports from the core. The core imports neither                                                        |
| Lifecycle contract           | Four hooks, runtime-agnostic at the call site, dispatched on the runtime the adapter was told it is running under                                            |
| Runtime variation            | Strategy per engine, same contract, no ceremony imposed on engines that need less                                                                            |
| Data flow                    | Pipes and Filters from raw dump to Istanbul coverage map. Linear, no back-edges                                                                              |
| Engine awareness in pipeline | Concentrated in one boundary stage per engine. Everything downstream operates on a uniform shape                                                             |
| Materialization              | Lazy on-demand. Reporters and thresholds pull through a memoizing context. No consumer means no computation                                                  |
| Module signature             | Object-as-namespace. One named const per module, operations as properties. Orthogonal to architectural patterns                                              |
| Module placement             | Generic helpers in a generic area. Cross-consumer helpers in a shared layer at the same level. Promote on the second consumer. Sibling imports are bugs      |
| Type organization            | Single domain-per-file directory. No declarations elsewhere. No barrels                                                                                      |
| Configuration                | One unified options shape. Multiple input formats converge. Plugin options beat config files. CLI surface is two narrow flags, neither carries option values |
| Reporter layer               | Reporters share through a shared layer or not at all. LCOV production is the single engine-aware module, used by other reporters and by threshold checks     |
| Test layout                  | Per reporter and per case. Runtime is an iteration axis inside the test, not a filename segment                                                              |
| Snapshot layout              | Per platform. Per case. Per reporter. Canonical JSON structure across formats                                                                                |
