# Current protocol

The active experiment is documented in [V8_PROTOCOL.md](V8_PROTOCOL.md). The v8 run changes validation to complete variable mapping plus verdict, thinking off, while retaining the three minified/tree-shaking-off builds and other recovery rules.

The material below records historical configurations.

# jQuery 4.0.0 preliminary function-recovery experiment

## Active build restriction

The preliminary experiment now fixes minification ON and tree shaking OFF for all three bundlers. Only esbuild-min-keep, rollup-min-keep, and webpack-min-keep are evaluated. The earlier matrix was stopped by explicit user instruction and is retained as historical evidence. The separate active directory is `results/jquery-4.0.0/minified-no-tree-shaking/`; `study-config.json` fixes its scope. Unchanged, previously checked build artifacts and source maps are reused. The v5 binary validator, input limits, graph rules, and disabled thinking are unchanged. Descriptions of the twelve-profile matrix below document the earlier design.

## Active revision: v5 binary default-true validator

At the user's explicit request, the active prompt identifies the inputs as one source function and one bundled function candidate and asks whether they are semantically equivalent. It outputs JSON `false` only when supplied evidence obviously and definitely establishes different observable behavior; otherwise it outputs JSON `true`. Missing context alone is not grounds for `false`. The schema permits only booleans, and no uncertain verdict. Thinking remains disabled. Malformed outputs and API errors remain operational failures and do not become accepted matches.

This is configuration **jquery-pilot-v5-binary-default-true**. Results are separate in `results/jquery-4.0.0/v5-binary-validator/`; previous v4 outputs and a code snapshot are preserved. Shared request caches are safe because complete prompt/schema/model digests key each request. No v4 validation verdict is reused as a v5 judgment. Embeddings and unchanged build/oracle inputs can be reused. The top-three independent checks, unique-acceptance rule, and one-to-one promotion policy are unchanged. Multiple true candidates can therefore prevent promotion. Source-map precision must be measured anew; default-true is not an equivalence guarantee. The descriptions below of abstaining validation and its calibration refer to the earlier v4 experiment.

The latest stable release listed by the [official jQuery download page](https://jquery.com/download/) and [release announcement](https://blog.jquery.com/2026/01/17/jquery-4-0-0/) is 4.0.0, checked on 19 October 2026. The installed package version, lockfile integrity, distribution hash, and tool versions are recorded locally. A separate npm latest-tag query could not execute because automatic approval review was at capacity; the release selection uses the official site.

## Build and target population

One crafted browser application imports the complete jQuery ESM distribution through its package export. It exercises DOM creation, selectors, traversal, delegated events, forms, data storage, deep extension, mapping, callbacks, deferreds, serialization, and CSS. Its use cases are a behavior smoke test, not a claim of complete runtime coverage.

The build matrix is esbuild/Rollup/webpack × minification off/on × keep/shake profiles, with external source maps and embedded original source content. Rollup minification uses Terser. Webpack uses its pinned default minimizer. Turning tree shaking off does not disable every minifier's dead-code optimization. Webpack's shake profile also enables module concatenation (`concatenateModules`) alongside `usedExports` and `sideEffects`; its contrast is not an isolated tree-shaking effect. Verify that all tools select the same jQuery ESM file.

The fixture deliberately exposes the complete library as `window.fixtureJQuery` for inspection. This makes the library object escape and limits opportunities to remove unused API methods. The experiment measures recovery under these concrete build profiles; it is not a general test of maximal jQuery tree-shaking potential.

The reference stage is `node_modules/jquery/dist-module/jquery.module.js`, the JavaScript input to the bundler. Count static function definitions (including nested functions and callbacks), not runtime closure instances or documented API entries. Report every bundle's complete function count, positively source-linked jQuery count, and unresolved count separately.

## Anchor and expansion policy

Anchor eligibility is >=10 own-body property-operation occurrences (member reads/writes and object property initializations), excluding nested function bodies. Record actual POG graph-operation counts separately. Eligibility is not a correspondence. Initial anchor correspondences require an exact POG fingerprint with a unique eligible source candidate and a unique eligible bundle occurrence; no map labels are consulted.

The first implementation constructs a graph of lexically resolved calls, callback/function-argument references, containment, and a same-parent AST-order window of two functions. The last relationship is weak syntactic proximity, not a claim of semantic connection. Both detector graphs retain unknown functions. A one-hop neighborhood around an existing match generates candidate reference counterparts. No source-map library-membership filter is used.

The source corpus is the known jQuery version in this closed-world pilot. Rank available candidates by cosine similarity of `qwen3-embedding:0.6b` vectors. Precompute/cache reference vectors and bundled-function query vectors; use Qwen's instruction on queries only. Check up to three ranked pairs using `qwen3.5:4b`, with a JSON accept/reject/uncertain verdict. Log malformed outputs, token-limit exits, timeouts, token counts, latency, and full raw responses.

Calibration exposed operational issues: verbose reasons increased generation time, and the model sometimes treated supplied captured bindings as undefined globals or rejected function-expression excerpts for not being standalone programs. Version v1 clarified capture metadata and requested <=20-word reasons. Version v2 removed explanations. Version v3 tried joint top-three assessment to reduce repeated prompt processing, but produced clear semantic false positives and substantially worse accuracy on overlapping calibration pairs. It was rejected as the main configuration.

The frozen main configuration, **`jquery-pilot-v4-independent-verdicts`**, returns to **one independent model request per pair**, evaluating all top-three candidates. It uses the same scalar prompt and 32-token non-thinking output budget as v2, with a constrained JSON string: `accept`, `reject`, or `uncertain`. Complete requests/responses and code-pair identities remain auditable. Identical v2 inputs may reuse cached outputs; these are not new independent trials. Calibration records under `calibration-thinking/` and `calibration-nonthinking-v0/` through `-v3/` remain separate. This is an exploratory pilot with configuration selection on calibration cases, not a held-out prompt-selection evaluation.

Two completed thinking-enabled diagnostics are historical and separate from main recovery: a 10-batch joint-input diagnostic, and one independent pair from each diagnostic batch. Both deliberately included errors observed in the rejected v3 configuration and are not unbiased population precision estimates. Their per-request thinking budget was 1,536 tokens; token-limit exits without a verdict count as invalid validations. They finished before the active main run, avoiding concurrent inference during latency measurements. No further thinking diagnostics run in the active workflow.

Primary settings and the validation thinking-mode choice are recorded in each run. The main pilot uses **thinking disabled**, following the user's recent speed preference: initial thinking-enabled checks took roughly 15–20 seconds per simple pair. Those calibration records are preserved separately under `calibration-thinking/`; they are not pooled with the main results. This main run does not test the original thinking-enabled low-FP hypothesis. At most 18,000 characters per function are admitted to model input; larger functions remain explicitly unsupported rather than silently truncated. Capture initializer excerpts and a limited number of established neighbor correspondences supplement function bodies. Excerpts are not assertions about runtime values.

The user subsequently explicitly instructed that thinking be disabled for both ranking and validation. Ranking is an embedding request without a reasoning-generation stage; validation is locked to `think: false`. No further thinking diagnostics run in the active workflow. Earlier diagnostic outputs remain historical evidence only. The ongoing main recovery process was already using this configuration and was not restarted.

Evaluate all top-three pairs and promote only exactly one accepted candidate. The pilot enforces one-to-one source identity assignment within a build; report this limitation for duplicated definitions. Resolve simultaneous conflicts conservatively by promoting neither. Iteration uses completed-round seeds, logs dependency parents, and revisits changed candidate/evidence states. Existing matches are not corrected with oracle information. Record fixed-point versus budget-limited termination.

## Offline oracle and evaluation

The detector opens only `detector-input.json`; the evaluator separately opens `ground-truth.json`. The final oracle uses generated own-body **interior** points, excluding function headers and the opening/closing body boundaries, and assigns each retained point to its innermost source function. A supported label requires >=2 mapped points, >=80% agreement, and a strict unique winner. Other cases remain unresolved. Canonicalize consumer source URLs to avoid webpack path-normalization mismatches.

Oracle calibration found that header/boundary mappings, particularly in webpack's minified output, can point to enclosing assignments instead of the function's implementation. The earlier header-inclusive labels are preserved as `ground-truth-header-inclusive-v0.json`. The independent `oracle.mjs` pass corrects this evaluation issue without changing detector inputs or model decisions. Excluding boundary points also leaves some tiny/empty functions without two informative points; those remain unresolved. Report this label-coverage limitation rather than assuming those functions were removed.

Source-map voting supplies positional identity evidence, not proof of semantic equivalence. Preserve mapped-point counts and sampled witnesses for audit. Count correct/wrong predictions where a source identity is supported, and count predicted jQuery identities on positively map-linked application/runtime functions as wrong. The latter uses >=2 interior points and >=80% origin purity. Oracle-unresolved accepted outputs are unassessed, not silently correct. Identity accuracy is stricter than behavior equivalence: an equivalent duplicated helper can still have a different source identity.

Report:

- Source and compiled function populations and >=10 eligibility.
- Accepted POG anchors and source-map agreement.
- Neighborhood availability and recall@3 conditional on candidate inclusion, plus overall recall@3 for attempted source-linked queries.
- Pair acceptance rate (`accept` / evaluated pairs), pair JSON validity rate, and accepted-pair source-identity agreement.
- Correct/wrong accepted recovery matches, unassessed outputs, conditional precision, and correct recovery divided by all supported jQuery bundle definitions.
- Anchors-only versus final recovery and additions per round; false promotions and their descendants.
- Cold/warm API latency, actual calls versus cache reuse, token counts, ranking and embedding time, and full run duration.

Repeated builds are correlated and cache hits are not independent model trials. Preserve per-build and deduplicated-pair statistics. Calibration probes, fixture smoke checks, and source-map labeling must not be presented as held-out generalization or zero-FP proof.
