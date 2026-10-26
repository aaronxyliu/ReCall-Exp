# Static bundle relationships for Rspack, Rolldown, Turbopack and Parcel

This is a code-only relationship extractor plus a separate oracle-assisted connectivity evaluation. It does not invoke models or execute bundles. The extractor receives JavaScript and file/function inventory metadata. Source maps and frozen match labels are used only in the experiment preparation/evaluation, outside extraction.

## Use on other builds

Create a JSON manifest with the JavaScript files belonging to one build and runtime environment:

```json
{"files":["dist/main.js","dist/chunk.js"]}
```

Run from this workspace, where the locked parser dependencies are installed:

```sh
node --expose-gc --max-old-space-size=8192 scripts/real-app/multi-bundler/analyze.mjs manifest.json relationships.json
```

Paths are relative to the manifest. Optional file objects have `path` and a unique `id`. Never combine unrelated builds or browser/server/worker runtime registries in one manifest. The output records function spans, function relationships, runtime module registrations, static module/chunk dependencies (including missing units), unresolved ESM requests, parse failures, ambiguity counts, overflow counts, convergence, input hashes and timing. Output must be a new file. Reading a `.map` is unnecessary.

The programmatic interface is `new Analyzer(options)`, `addUnit({id,path,code,functions?,aliasPaths?})`, then `solve()`. Without an inventory it generates IDs from unit ID and function span. With an inventory, output edges are restricted to those supplied function IDs. There is no library-name or oracle argument.

## Mechanism adapters

| Bundler | Recognized representation | Resolution |
|---|---|---|
| Rspack | `rspackChunk*`/`webpackChunk*` push with a module-factory object | Numeric/string module IDs; lexical factory parameter roles module/exports/require; require calls; `.d` export getters; `.n` default getter and `.a` access |
| Rolldown | Flattened lexical declarations and native ESM chunks; structural lazy CommonJS helpers | ESM imports/reexports; lazy factory exports/module parameter binding; object-wrapped and minified callback forms; export getter maps and default interop |
| Turbopack | `TURBOPACK.push` alternating IDs and factories, including merged IDs | Context/module/exports roles; `.r` CJS require, `.i` ESM namespace, `.s` getter/value export arrays with optional module ID and setters; `.v`/`.n` export values/namespaces; `.e`/`.m` fields |
| Parcel | A `parcelRequire*` namespace and `.register(id,factory)` | Outer lexical loader, module/exports factory roles; `module.exports`, export getter helper and default interop; flattened declarations handled by the same engine |

`moduleGraph` retains import/require dependencies alongside the function graph. Module nodes include explicit runtime registrations and Rolldown lazy CommonJS factories. Dependencies record the containing factory ID(s), source chunk, destination module/chunks, syntax span and whether the destination is supplied. A merged factory keeps multiple possible module owners rather than inventing an ID-specific attribution.

These are explicit adapter families, not a guarantee for every bundler version or output mode. Detection does not use minified local variable names. Registration containers retain runtime protocol names. Helper recognition examines AST operations and parameter roles; it is a conservative heuristic rather than a proof of helper equivalence. No filename-to-library inference occurs.

## Shared analysis

1. Parse a file and resolve lexical bindings with `eslint-scope`; index supplied function spans in a map.
2. Compile aliases, static object properties, getter returns, class members/instances/inheritance, direct IIFE aliases, native ESM links and runtime adapter operations into constraints. Release that file's AST before the next file.
3. Solve with slot-dependent worklist notifications. A changed value schedules dependent constraints. Import cycles therefore do not require a preset number of whole-program rounds.
4. Emit calls and function-value/argument/callback-reference relationships only for a singleton **modeled callable**. Known non-callable object values are ignored when selecting call targets; multiple modeled callables, native-builtin alternatives or an overflow value abstain. Reference edges are syntactic uses, not claims that callbacks execute.
5. Keep duplicate module IDs as multiple instances; their exported values are merged, so conflicting callables abstain rather than choosing an arbitrary registration.

Objects are represented by allocation-site property slots. A default limit of 64 values per slot widens to `TOP`; calls through a `TOP` slot abstain. A 50-million event budget fails explicitly rather than publishing an unfinished solution. This bounds runaway cases, but does not establish linear complexity or full JavaScript soundness. Whole-build constraints and value sets still consume memory; only AST retention is bounded by one file. See measured corpus timings/RSS in the report.

Known native Object/Reflect methods retain opaque native callable alternatives. A conditional polyfill assignment therefore cannot turn all calls to that builtin into definite calls to the polyfill. This is covered by a regression test.

Unresolved cases include general ordinary argument/return flow, dynamic property names and computed module IDs, arbitrary getters/proxies, runtime-selected chunks, asynchronous module semantics, most `.bind`/`.apply` transformations, external packages without supplied entry resolution, and unknown helpers. Relative module resolution covers exact paths plus `.js`, `.mjs`, `.cjs`, and `/index.js`. Browser/server/worker separation must be supplied through the input manifest. Missing non-target chunks and runtime helper files remain missing in the frozen comparison.

## Reproduce the frozen comparison

```sh
node --test scripts/real-app/multi-bundler/*.test.mjs
python3 scripts/real-app/multi-bundler/run-extraction.py
# After each subject's source and bundle extraction:
node --max-old-space-size=8192 scripts/real-app/multi-bundler/evaluate.mjs REPO_SLUG
python3 scripts/real-app/multi-bundler/report.py
```

The runner reads `baselines/bundling-connectivity-v1-2026-10-22` and writes `results/real-app/multi-bundler-v1`. It refuses to overwrite completed extraction/evaluation files. Preserve completed outputs and choose a new versioned directory before intentionally rerunning modified code. `run-extraction.py` skips existing extraction outputs; evaluation checks their analyzer hash and frozen inventory hash.

Extraction reads only the frozen parseable source files and prepared target-containing chunks, one inventory shard at a time. It does not add emitted files outside that population. The evaluator verifies exact oracle, target, seed and original recovered-pair hashes; reproduces baseline recovered pairs exactly; checks each promotion's paired edge witness; and reports per-chunk and cross-chunk variants separately.

The frontier simulator has the same synchronous rounds as the original simulator under the frozen per-chunk uniqueness policy. Tests compare them on 100 deterministic random graph pairs. Ambiguous source identities within a chunk remain in the denominator but cannot promote or bridge. Across chunks, source identity can recur, but a seed is never copied merely because its source identity recurs. The source-only ablation distinguishes source graph improvements from the additional bundle graph contribution.

Runtime module factories are recognized to resolve imports/exports. They are not matched to source initialization functions. There are no module membership cliques or module-level seed injection. The output is an undirected neighborhood augmentation over the existing graph during evaluation; extracted relationships themselves retain direction and kind.

The reported recovery is an oracle-assisted connectivity ceiling over supported function pairs. It is not measured model recovery, whole-library recall, or call-graph precision.

## Primary references

- [Rspack runtime module methods](https://www.rspack.org/api/runtime-api/module-methods): module IDs and CommonJS loading.
- [Rolldown runtime implementation](https://github.com/rolldown/rolldown/blob/main/crates/rolldown/src/runtime/runtime-base.js): helper families. Current upstream source is explanatory; tested formats are bounded by the frozen emitted files.
- [Turbopack runtime at Next 16.2.6](https://github.com/vercel/next.js/blob/v16.2.6/turbopack/crates/turbopack-ecmascript-runtime/js/src/shared/runtime/runtime-utils.ts): context API, namespace interop and export binding arrays. Next 15.5.4 getter forms were also checked directly in the saved emitted corpus.
- [Parcel scope hoisting](https://parceljs.org/features/scope-hoisting/) and [runtime helpers](https://github.com/parcel-bundler/parcel/blob/v2/packages/packagers/js/src/helpers.js): flattened modules, registration fallback and export helpers.
