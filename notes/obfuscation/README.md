# JavaScript obfuscation: tool survey and ReCall robustness experiment

Research date: 2026-10-24 (Asia/Shanghai).

Status: **survey and proposed experiment**, with one completed synthetic POG mechanism probe. No third-party obfuscator benchmark, model evaluation, or commercial-service trial has been run. No robustness rate is established here.

## 1. Assessment

ReCall should not claim general obfuscation resistance from its bundled/minified-JavaScript results. Some transformations preserve its evidence; others directly attack property fingerprints, graph neighborhoods, function boundaries, and the context available to the validator. The critical question is both **how much recovery is lost** and **whether the remaining accepted identities stay correct**.

The current method is source-definition correspondence, not arbitrary deobfuscation or semantic-equivalence proving. A successfully executing protected application need not retain one static JavaScript function per source function. VM bytecode and runtime-generated bodies therefore require a distinct representation-boundary assessment.

Recommendation: use `javascript-obfuscator` and JS-Confuser for the reproducible core; add a commercial protector if available; keep minification controls and runtime/VM boundary tests separate. Select tools for documented transformation coverage and reproducibility, not a claimed market-share ranking. Public repositories and vendor documentation do not establish production prevalence.

## 2. Representative tools and their mechanisms

| Tool / family | Documented mechanisms | Experimental role |
|---|---|---|
| **javascript-obfuscator / obfuscator.io** | Identifier changes, string tables/encoding, property changes, dead-code insertion, control-flow flattening, and runtime defenses. The linked web frontend and build integrations are not independent engines. Its documentation distinguishes local OSS transformations from Pro API VM features. | Primary open-source engine; export exact options and pin the npm release and integrity. Treat the paid VM route separately. [Official repository](https://github.com/javascript-obfuscator/javascript-obfuscator) |
| **JS-Confuser** | Control-flow rewriting, string concealment, opaque predicates, dead code, dispatchers, variable masking, scope/function transformations, and runtime-generated functions. `flatten` and `controlFlowFlattening` are different options. | Independent open-source engine; valuable for call indirection and runtime-generated-body stress. [Options](https://js-confuser.com/docs/options), [implementation option schema](https://raw.githubusercontent.com/MichaelXF/js-confuser/master/src/options.ts), [RGF mechanism](https://github.com/MichaelXF/js-confuser/blob/master/docs/RGF.md) |
| **Jscrambler Code Integrity** | Polymorphic protected outputs, state-machine control flow, concealed strings, and self-defending/anti-tampering protections. | Commercial external-validity extension. Public documentation supports these mechanisms; this survey does not establish a VM feature for Jscrambler. Detailed documentation redirected to login, so confirm the licensed version and available exports before planning exact cells. [Control flow](https://jscrambler.com/getting-started/101-control-flow-flattening/), [vendor deployment example](https://media.jscrambler.com/resources/Jscrambler-Case-Study-Neobanking.pdf) |
| **PreEmptive JSDefender** | State-machine control flow, declaration renaming, function reordering, property indirection, string extraction, literal rewriting, and self-defending wrappers. | Useful independent commercial check, especially for sibling-order graph edges and property concealment. [Technical documentation](https://support.preemptive.com/hc/en-us/articles/31892867544465-Protection-Techniques) |
| **JavaScript Obfuscator at javascriptobfuscator.com (RichScripts)** | A separate commercial product with string/member transformations and code transposition; its documented VM option replaces selected bodies with bytecode plus an interpreter. The tooling matrix labels VM availability beta and plan/enrollment dependent. | Optional VM boundary case, subject to actual access. Do not confuse it with the similarly named OSS npm package. [Tooling matrix](https://javascriptobfuscator.com/docs/toolingmatrix.aspx), [VM documentation](https://javascriptobfuscator.com/docs/vmprotection.aspx) |
| **JSFuck** | Encodes programs using six characters, exploiting coercions and access to constructors to reconstruct executable code. | Small encoding stress fixtures, not a representative production-obfuscator cohort. [Author repository](https://github.com/aemkei/jsfuck) |
| **Terser** | Compression and identifier mangling; optional property mangling. | Essential minification control, not a substitute for dedicated obfuscation. Keep property mangling in its own condition. [Official options](https://terser.org/docs/options/) |

Vendor statements about being impossible to reverse or preserving all behavior are not accepted as experimental evidence. Tool versions, supported syntax, options, and commercial availability must be frozen at execution time. The links above were consulted for this survey; they are moving documentation, not immutable software pins.

## 3. Why mechanisms matter to ReCall

The following risks are implementation-based hypotheses unless marked as observed in the probe.

| Transformation family | How it changes the program | ReCall exposure / measurement |
|---|---|---|
| Local identifier renaming | Rebinds variable/function names while retaining operations. | Expected low POG impact if property names and operation structure survive. Verify anchors, not just parse success. |
| Literal bracket notation | Changes `obj.value` to `obj["value"]`. | Current POG code recognizes both static spellings. Distinguish this from decoded property names. |
| String tables and property concealment | Replaces a literal with a lookup or decoder call, e.g. `obj[decode(7)]`. | The POG backend represents nonliteral computed keys as `[]`; named evidence is lost and helper operations may be added. Anchors can disappear or become ambiguous. |
| Private-property renaming | Consistently changes object keys and their accesses. | Changes the named operations in POGs. This differs fundamentally from local-variable renaming. |
| Control-flow flattening | Moves operations into dispatcher-controlled blocks, often a loop/switch state machine. | Can change POG structure and code size; synthetic helpers can alter graph neighborhoods and embedding rank. Exact effects require measurement. |
| Opaque conditions / dead code | Adds misleading branches or unreachable operations. | May alter own-body properties and the candidate graph even if observed behavior is unchanged. Injected functions can also be mistaken for library functions. |
| Function reordering / dispatchers / wrappers | Changes syntactic proximity and indirect call paths, sometimes relocates bodies. | Tests sibling edges, call resolution, containment, first-positive selection, and wrong allocations. Use typed-edge diagnostics rather than edge count alone. |
| Anti-debug / integrity / environment locks | Adds runtime checks or constrains where execution succeeds. | Primarily threatens capture and behavior validation; inserted code may also affect static analysis. Test with the declared valid environment. |
| Runtime-generated code | Stores the body in data and evaluates/constructs it later. | Static parsing can succeed while the original body is absent from the function inventory. The current capture importer does not reconstruct `eval`/`blob` code. |
| VM virtualization | Replaces body logic with bytecode interpreted by a runtime. | The original function body may cease to be an ordinary JS AST function. Matching an interpreter handler is not recovering the original source definition. |

Current implementation evidence:

- [POG property handling](../../../ReCall/vendor/debun/fingerprint-collector/pog-generator.js): static identifier/string keys are retained; other computed keys use `[]`.
- [Own-body measurement](../../../ReCall/src/analysis/measure.mjs): nested bodies are excluded from a parent's POG.
- [Anchor selection](../../../ReCall/components/pog/index.mjs): matching requires eligible equal hashes and uniqueness in the reference pool and target chunk. Default eligibility is ten own-body property operations.
- [Recovery pipeline contract](../../../ReCall/components/pipeline/README.md): neighborhood retrieval precedes embedding top-k and validation; the first accepted candidate proposes a match. Wrong allocations can propagate and are not automatically rolled back.
- [Graph contract](../../../ReCall/components/graph/README.md): approximate call/reference, containment, and sibling relationships supply candidate neighborhoods.
- [Capture boundary](../../../ReCall/components/capture/README.md): supplied responses do not automatically include unrequested chunks or reconstructed dynamic code.
- [Current paper evaluation](../../manuscript/sections/experiment.tex): primary recovery uses fixed versioned references. Default CLI library gating must therefore be explicitly disabled for this controlled condition, using justified supplied references; evaluate identification/gating separately.

### Completed mechanism probe

Run: `node notes/obfuscation/pog-mechanism-probe.mjs` from `ReCall Exp`.

[Script](pog-mechanism-probe.mjs) and [recorded JSON](pog-mechanism-probe.json) retain the exact programs, hashes, ReCall commit, relevant implementation hashes, Node version, and diagnostics.

| Handwritten form of one synthetic function | Enumerated target functions | Same POG as original | Accepted POG anchors |
|---|---:|---|---:|
| Unchanged | 1 | Yes | 1 |
| Local renaming | 1 | Yes | 1 |
| Literal bracket property access | 1 | Yes | 1 |
| Table-indexed property access | 1 | No | 0 |
| Private-property renaming | 1 | No | 0 |
| Unreachable property operation | 1 | No | 0 |
| Body constructed with `new Function` | 0 | Not applicable | 0 |

All seven forms produced the same outputs for four numeric inputs. This is a narrow sanity check, not an equivalence proof or a tool benchmark. Anchor counts use the default feature threshold; they do not apply library identification's three-anchor gate. No graph expansion or LLM ran. Losing this anchor does not prove that a larger connected program could not recover the function from another anchor.

## 4. Research questions and experimental factors

**O-RQ1: Correctness and coverage.** Relative to each subject's matched minified baseline, what happens to assessed identity precision, supported-target recall, and unresolved output?

**O-RQ2: Failure location.** Does the loss come from unavailable bodies, extraction, seeds, graph reachability, ranking, validator rejection, or a wrong earlier allocation?

**O-RQ3: Operational robustness.** Does the tool terminate within declared CPU/memory/model budgets, preserve diagnostics, and produce consistent-quality results across randomized outputs?

**O-RQ4: Deployment boundary.** How do selective protection, whole-bundle protection, anti-debug behavior, and dynamic/VM code affect the supplied input and the recoverable representation?

### Corpus and split

1. **Mechanism development:** small fixtures for static/computed properties, closures, callbacks, cross-module calls, nested functions, identical wrappers with different bindings, async functions, classes, and dynamic imports. Add positive pairs and hard negative source identities. Verify that the intended transformation actually applied.
2. **Controlled library development:** start with the existing jQuery fixture plus three libraries chosen for different coding styles and enough exercised functionality. jQuery remains development data. Preserve tree shaking and optimization settings within each paired comparison; a no-tree-shaking fixture is not a production deployment sample.
3. **Held-out applications:** plan 8–12 repository builds spanning native webpack/Rspack, Rollup/Rolldown, esbuild, Parcel, and Turbopack where available. Freeze the method before selecting final test outputs. Select packages before recovery, with a declared policy, and preserve existing framework-runtime exclusions. Previously used repositories remain development subjects; disclose shared library/version overlap separately. Hold out library families too if claiming library generalization.

These are proposed sizes, not prepared or evaluated counts. Use the same reference catalog for every variant of a subject. Keep application/runtime/obfuscator helper functions in the target inventory as negative origins instead of filtering them using the oracle.

### Pairing and protection placement

For the main causal comparison, build once and preserve the exact minified output B. Produce O(B) with each obfuscation configuration. Compare ReCall(B) to ReCall(O(B)); do not independently rebuild source for every obfuscation seed.

Keep these placement conditions distinct:

- **Selected library modules:** protect the chosen library in a controlled pre-bundle or supported module-stage workflow; this isolates exposure of the intended targets. Record this separately because the bundler may optimize away obfuscation.
- **Whole post-build bundle:** protect application code, libraries, and loader/runtime together; this stresses bundler recognition and module resolution.
- **Application-only protection:** a deployment control; high recovery of untouched libraries is not evidence of recovery of obfuscated libraries.

Report actual transformed target functions and bytes. Preserve chunk associations, paths/URLs, entry relationships, and valid cross-file naming. A broken public export, inconsistent rename cache, stale integrity value, or invalid import path is a preparation failure. If a protector combines chunks, record this: ReCall allocates identities per target chunk, so changed chunk boundaries can create duplicate-allocation constraints independently of semantic difficulty.

### Transformation profiles

Use explicit option files rather than comparing tools' unrelated “high” presets. The conceptual profiles below need per-engine adapters and verified output witnesses:

| Profile | Intended change | Key control |
|---|---|---|
| B0 | Ordinary production/minified baseline | Same build and references for every paired variant |
| P1 | Local renaming only | Preserve properties, public bindings, and control structure |
| P2 | Data-string concealment | Preserve property keys so literal and property effects are separable |
| P3 | Property-key indirection/concealment | Record how many named accesses become nonliteral |
| P4 | Control-flow flattening | Record actual affected functions/blocks and required helper scaffolding |
| P5 | Dead-code insertion | Record added functions/operations; separate opaque predicates when independently configurable |
| P6 | Realistic combined protection | Explicitly pin the complete composition and transformation order |
| X1 | Private-property renaming | Verify public/external interfaces are preserved |
| X2 | Function reordering and dispatch/wrapping | Separate independent switches when available |
| X3 | Runtime defenses | Valid domain/date/environment; original bytes for integrity-sensitive runs |
| X4 | Runtime-generated bodies / packing | Count body visibility separately from parser success |
| X5 | VM protection | Record virtualized, skipped, and unsupported functions from independent evidence |

Not every tool exposes every isolated operation. Mark unavailable cells `not-supported`; do not silently substitute a mixture. An option requiring other transformations is a documented bundle of mechanisms, not a clean single-factor intervention. In addition to intensity settings, report realized transformed fraction, code expansion, and generated-helper counts; equal probabilities across products are not equal strength.

Use five output variants per randomized test cell after the pilot. Use explicit nonzero seeds where supported; elsewhere retain independent output artifacts and hashes, and state that regeneration is not seed-reproducible. Do not invent a seed option for every engine. Repeated identical output hashes are not independent obfuscation variants. Repeat inference on a small fixed-artifact subset separately to distinguish model/runtime variation from transformation randomness.

## 5. Behavior checks and the correspondence oracle

### Validate the transformed application first

Retain upstream tests and a deterministic browser interaction suite: initial rendering, relevant routes, dynamic imports, event handlers, important outputs, and application state changes. Track baseline failures as well as transformed failures. Pin browser/runtime, locale, clock where appropriate, and network fixtures.

Execution agreement on these tests is evidence of preserved tested behavior, not complete equivalence. Report generation, syntax, execution, and capture failures separately. Keep failed attempts in the experiment ledger; do not quietly discard them or call them matcher failures. Keep console suppression disabled when console output is an observation channel. Run defenses in their intended environment and distinguish a blocked instrumented browser from broken application logic.

### Construct independent identity labels

Maintain the lineage chain **reference source S → baseline bundle B → obfuscated output O**. Prefer maps for both transformations, composed and checked against the exact saved bytes. No map, embedded source, provenance tag, debug name, or oracle file is available to ReCall or its models.

Use the existing own-body rule as an initial labeling policy: nested bodies excluded, at least two retained mapped positions, at least 80% agreement, and a unique winning reference identity. Crucially, revalidate that rule for obfuscator maps: synthetic wrappers, relocated code, and duplicated provenance can produce misleading apparent support. Record mapping density and manually inspect stratified samples including every mechanism, boundary change, and wrong accepted match where feasible. A source map records positions; it does not certify semantic equivalence or one-to-one lineage.

Where maps are missing or insufficient, use obfuscator transformation provenance or an instrumented transform to build labels, and verify that the instrumented output bytes equal the evaluated bytes. If they differ, it is a separate diagnostic dataset, not the oracle for the stock-tool output. For small fixtures, hand-audited lineage can supplement maps. Never use the tested POGs, embedding rank, or validator's judgment as ground truth.

Keep these mutually distinguished statuses: supported one-to-one; duplicated; split; merged; inlined/erased; runtime-only; virtualized; generated-helper; unresolved provenance. Some duplicates still have a supported source identity, but the same-chunk one-source-allocation constraint may prevent recovering every occurrence. Record that constraint explicitly. Do not force split/merged/VM cases into ordinary one-to-one labels; inspect a surviving wrapper separately from its relocated body.

### Avoid the shrinking-denominator trap

Let D0 be the supported target occurrences in the fixed baseline B. For each variant, retain a baseline-occurrence ledger stating whether a validated target counterpart survives, changes representation, or remains unresolved. Report the size of this ledger in every table.

- **Conditional supported-target recall:** correct accepted pairs divided by supported library target occurrences in O. Report how many of those correspond to D0 and how many are duplicate occurrences.
- **Paired recovery:** compare B and O on the same D0 identities with independently validated counterparts in both. Report the paired-set size; do not relabel it whole-program recall.
- **Baseline target coverage:** number of D0 occurrences with at least one independently validated correctly recovered descendant in O, divided by D0. Count each baseline occurrence once. This is conservative verified coverage, not a claim that unknown descendants are proven misses.
- **Representation and oracle coverage:** proportions of D0 with an ordinary supported counterpart, changed representation, or unresolved provenance. A genuine complete one-to-one map lets this be read as recoverability; incomplete maps do not.

This prevents an apparent recall increase caused by difficult functions vanishing from the labeled target set.

## 6. Measurements and diagnostic experiments

For each variant save C correct, W wrong, and U unassessed accepted mappings. Count wrong assignments to independently labeled application/runtime/obfuscator functions in W. Report **assessed identity precision C/(C+W)** alongside U and total predictions; do not call it unconditional precision. If no assessed prediction exists, precision is undefined, not 100%. Recovering nothing must score zero supported-target recall when supported targets exist.

| Stage | Measurements |
|---|---|
| Input / inventory | Planned/generated/behavior-valid/captured/parsed counts; target-body visibility; parse and POG failures; unresolved provenance |
| Initial seeds | Correct/wrong/unassessed anchors; eligible target count; baseline-anchor retention among validated counterparts; ambiguity; zero-anchor libraries/components |
| Candidate graph | Bundler recognition/module-resolution diagnostics; supported targets reachable under oracle-assisted selection; typed-edge changes; candidate-pool size |
| Ranking | Correct identity present before ranking; rank/top-k inclusion; embedding errors; function-size exclusions |
| Validation / allocation | True/false/invalid/error verdicts; first wrong acceptance before the true candidate; conflicts; wrong ownership; correct proposals blocked |
| Final recovery | C, W, U; precision and supported-target recall; paired loss; baseline coverage; untouched-target versus transformed-target strata |
| Resources | Wall time by stage, peak RSS, output growth, model calls/tokens, cache hit rate, timeouts, crashes, budget stops; runtime overhead of the protected application separately |

Use an ordered failure funnel to explain each supported miss without double-counting: unavailable input/inventory → no usable seed/path → absent from candidate pool → outside top-k → validation not accepted → allocation/conflict. Retain secondary contributing causes separately. A full code-only run with zero seeds still counts as an observed recovery failure for supported targets; it is not a successful result simply because the tool terminated.

Run these diagnostic conditions on a preselected subset:

1. **POG only:** isolates anchor correctness/coverage.
2. **Full ReCall:** real anchors, fixed references, current ranking and validator.
3. **Local versus module-aware graph:** same seeds and other settings; test loader/runtime disruption.
4. **Sibling proximity off:** isolates sensitivity to reordered functions and inserted helpers.
5. **Oracle candidate selection, real seeds:** current experiment API can bypass model ranking/validation while retaining graph expansion. This is reachability simulation, not measured model recovery or necessarily a tight mathematical upper bound under conflicts.
6. **Verified injected seeds:** where one-to-one counterparts exist, supply a fixed diagnostic seed policy to test whether anchor starvation dominates. These are oracle-assisted results and never part of the main robustness claim.
7. **Fixed pair panel:** directly judge known correct pairs and hard negatives, including binding-distinct near-duplicates and generated helpers. This tests validator resilience independently of whether a graph ever retrieved the pair; it does not estimate end-to-end precision under real candidate prevalence.

Keep the original tool frozen for the main result. A proposed string decoder, normalization pass, wider neighborhood, different prompt, or rollback rule is a new method variant requiring its own held-out evaluation. Do not implicitly grant the original method the benefits of oracle seeds or preprocessing.

## 7. Reproducibility, statistics, and practical rollout

Each run needs a manifest containing: repository commit; lockfile and reference versions; exact input/output hashes; bundler version/config; tool release/commit and integrity or service build identifier; full obfuscation configuration; transformation order and placement; seed/repetition; emitted/captured chunk set; tests/trace; oracle provenance and coverage; ReCall commit and dirty diff; model digests, prompt, generation options, context/character limits; machine/runtime versions; budget and timeout policies; cache state; final status.

Use fixed model settings and budgets across paired variants. Report logical validation counts separately from physical model requests and cache savings. Bloat-triggered character-limit exclusions are a robustness outcome; increasing the limit only for obfuscated code would change the experiment. Recoveries across seeds must be compared through provenance identities, not raw function offsets or IDs that change after rewriting.

Report per repository, library, bundler, mechanism, and intensity; macro averages and pooled counts serve different purposes. Use paired deltas and confidence intervals clustered at repository level, keeping correlated functions/seeds/builds together. With few repositories, emphasize per-subject ranges and uncertainty rather than a precise ecosystem estimate. Fix any acceptability margins on development data before testing, including maximum precision loss, minimum retained coverage, and resource budget; there is no universal scientifically justified 5% tolerance.

Suggested rollout:

1. Validate adapters and oracle feasibility on tiny fixtures. Freeze explicit profiles and record unsupported cells.
2. Run a **static pilot** on two development library builds × two OSS engines × six profiles × three variants: at most **72 obfuscated artifacts**, plus two unminified diagnostic controls and two matched minified baselines. This is a planned upper count; unsupported cells and failures remain visible. No model calls are needed for the static screen.
3. Run real model recovery on a predeclared stratified subset (for example, 12–24 pilot artifacts covering all available families), including severe/zero-anchor cases. Do not cherry-pick variants with surviving anchors.
4. Freeze configuration and budgets, then run the independent application cohort with five output variants per chosen randomized cell. Add one commercial product if access and an adequate oracle are available. Retain VM/packing as a separately reported boundary cohort.
5. Publish the manifest, configurations, labels and unresolved statuses, stage diagnostics, paired tables, and representative failures. Commercial binaries/source outputs may need an artifact-access plan; do not report unrun commercial cells as covered.

For captured websites, first measure static robustness with complete supplied build artifacts. Then run a separate browser-observed input condition with the same interaction plan. Missing unrequested chunks and anti-debug capture failures belong in that second condition. Otherwise obfuscation effects on matching would be confounded with changes in what was collected.

## 8. What the resulting evidence would support

- Stable precision and coverage for naming/literal profiles supports a bounded claim about those tested mechanisms and settings.
- Stable precision with lower coverage supports a claim of conservative degradation, provided unassessed predictions and zero-result cases are visible.
- Lost real seeds but good injected-seed reachability identifies an anchor bottleneck; it does not demonstrate robustness of the original pipeline.
- Good pair-panel accuracy but low end-to-end recovery implicates earlier stages; the LLM cannot rescue candidates it never sees.
- Wrong anchors or wrong model promotions that consume true identities expose a correctness problem, even if total accepted matches remain high.
- Missing static bodies under packing/VM protection identifies a representation boundary. Supporting them would require an additional unpacking, runtime acquisition, or devirtualization method and a different lineage oracle.

The defensible current statement is: **ReCall has bundled/minified-code evidence; broad obfuscation robustness is unverified. The implementation and synthetic probe identify specific threats worth measuring first.**

Related methodology: [JsDeObsBench](https://jsdeobf.github.io/ccs2025a-JsDeObsBench.pdf) studies JavaScript deobfuscation and execution reliability. It motivates transformation-specific evaluation, but producing readable code is a different endpoint from recovering a particular library source identity; its results cannot be transferred to ReCall.
