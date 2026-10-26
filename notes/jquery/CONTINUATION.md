# jQuery recovery experiment continuation

**LATEST:** All three minified/no-tree-shaking recovery profiles completed and verification passed (execution-status finished 2026-10-19T09:50:46Z). The wrong-identity audit reviewed 13 outputs: 10 semantic counterexamples and 3 same-call-behavior/different-origin cases. User now explicitly requested thinking ON only for this diagnostic. Live diagnostic session **92195** runs scripts/jquery/audit-thinking-replay.mjs and writes wrong-identity-audit/thinking-replay/. Main models.mjs remains thinking:false. Initial fetch-based attempt hit a roughly 300s header timeout on W13; the retry uses native HTTP with 600s deadline and preserves failed attempts. Settings: saved prompt/context unchanged, output budget8192, 13 wrong pairs + 2 budget controls + 13 correct-counterpart controls. Preserve output traces and inspect conclusions; model rationale is not a guaranteed explanation of the earlier non-thinking answer.

**ACTIVE SCOPE CHANGE (live session 65211):** The user stopped the former matrix and requested only minification ON and tree shaking OFF. Active output: results/jquery-4.0.0/minified-no-tree-shaking/. Only esbuild-min-keep, rollup-min-keep, and webpack-min-keep run or enter active reports. The original v5 matrix is historical and stopped-by-scope-change. study-config.json records the selection. Models and v5 binary prompt are unchanged; thinking stays false. Existing identical compiled artifacts, maps, partial checkpoint, and exact-request caches are reused. Older notes below are historical.


**RESUMED BY USER.** The user explicitly requested continuation. Active session: **30439**. The driver skips both completed readable esbuild profiles and replays the interrupted esbuild-min-keep round using exact-request caches before making new calls. Current logs and status are under results/jquery-4.0.0/v5-binary-validator/. Session 57573 is historical. The manuscript/PDF describes the earlier stopped snapshot until deliberately refreshed after new results.

## Latest user steering: v5 binary default-true

The user requested `false` only with obvious definite evidence of different semantics, otherwise `true`, with no uncertain. Active models.mjs now uses `jquery-pilot-v5-binary-default-true`, JSON boolean schema, thinking false. Original v4 driver session 54948 was interrupted deliberately; its two completed readable profiles and partial minified profile remain intact. v4 code is preserved in `results/jquery-4.0.0/v4-code-snapshot/`. The replacement driver defaults to `results/jquery-4.0.0/v5-binary-validator/`, with copied static inputs and shared request/embedding cache. Replacement live unified exec session: **57573**. Read this variant's execution-status.json and experiment-run.log for current progress. Original sections below describe v4 historical state. Do not mix v4 and v5 results. All top-three independent checks and exactly-one-accept promotion remain unchanged.

The user's active request is to finish the complete preliminary jQuery experiment, not merely prepare a plan. Continue until all 12 recovery profiles reach a fixed point and final artifacts are verified.

## Live processes

- Main command: `node scripts/jquery/experiment.mjs > results/jquery-4.0.0/experiment-run.log 2>&1`.
- Unified exec session: **54948**. Historical thinking diagnostics finished before recovery started. The driver now runs recovery, report, anchors, and verification; no further thinking diagnostics are scheduled.
- App server session **76771**, serving only built fixtures at <http://127.0.0.1:4387/>. Leave it available for user inspection.
- Monitor `results/jquery-4.0.0/execution-status.json`, `experiment-run.log`, and `recovery/*.json`. Use polling/waits <=60 seconds and give meaningful updates at least every minute. Do not spawn agents.

## Scope and frozen configuration

Latest stable per the official jQuery download page/release announcement is **4.0.0**, installed and lockfile-pinned. Source reference is the published JavaScript ESM distribution `node_modules/jquery/dist-module/jquery.module.js`, not upstream modular sources. All bundlers resolve the same source hash.

There are **558 static source definitions**: 80 with zero own-body property operations, 393 with 1–9, and **85 with >=10**. These are source-location instances, including callbacks. Main eligibility follows the guideline's own-body occurrence convention, excluding nested bodies. Raw POG graph occurrences >=10 give 102 definitions; distinct graph operation/property pairs >=10 give 51. Keep units separate.

Twelve builds: esbuild/Rollup/webpack × minification off/on × keep/shake profiles. All source maps include sourcesContent; all 12 crafted browser fixtures passed 12 behavior checks. Webpack's shake profile also enables module concatenation, so it is not a pure tree-shaking contrast. The fixture exposes the full jQuery object for inspection, reducing unused-API removal opportunities.

**Final main version: jquery-pilot-v4-independent-verdicts.** qwen3-embedding:0.6b ranks; qwen3.5:4b independently judges all top-three pairs. The user explicitly instructed that thinking be disabled for ranking and validation. Embedding ranking has no reasoning-generation stage; validation is locked to **think: false**, with no environment override. Temperature 0, seed 42, context 16384, output budget 32, JSON string accept/reject/uncertain. The ongoing recovery already used these settings and was not restarted.

Initial matches require unique exact POG hashes on both eligible sides: **76–85 matches** per build, no assessed oracle disagreements, two unassessed occurrences across readable esbuild profiles. Detector retains every bundle function, including application/runtime functions. Neighborhoods combine lexically resolved calls, function arguments, containment, and same-parent AST-order window 2, radius 1. This lexical evidence is not a semantic guarantee. Evaluate all three candidates and promote only one accepted candidate with no simultaneous source-identity conflict; one-to-one per build. New seeds enter the next round. No oracle corrections enter recovery.

Models were already deployed locally. Embedding is Q8_0/ggml, validator is NVFP4/MLX per actual server metadata. Host: Apple M5, 32 GiB. Digests, requests, responses and timings are saved. No model training or new model downloads. No MySQL changes.

## Important calibration findings

Calibration folders `calibration-thinking/` and `calibration-nonthinking-v0/` through `-v3/` preserve every abandoned configuration. v1 scalar short-reason checks and v2 scalar verdict-only checks had no wrong accepted identities in their limited early-function samples. v3 jointly checked three candidates to save prompt processing, but was much less accurate. On 152 overlapping pairs, v1 accepted 40 correct/0 wrong, whereas joint v3 accepted 11 correct/12 wrong. Prompt/output differences confound a causal batching claim. v3 was rejected as main configuration.

`semantic-counterexample.json` and `scripts/jquery/counterexample.mjs` reproduce a real **v3 calibration** semantic FP: isWindow({}) is false but isPlainObject({}) is true. Do not attribute this automatically to the final scalar run.

Main v4 reuses exactly matching v2 cached requests (108 early checks); those are not fresh independent trials. Other identical inputs/builds also reuse caches. Body/digests are part of cache keys.

Thinking diagnostics are complete and separate:
- Joint: 10 fixed, error-enriched batches / 30 pairs at 1536 output tokens; 9 requests hit the budget (27 invalid pair verdicts). One completed batch accepted one correct pair and rejected two.
- Independent: one fixed pair from each selected batch, 10 total; **7 invalid token-limit exits, 2 uncertain, 1 reject, 0 accepted**. No useful acceptance-precision estimate. These are diagnostic strata, not unbiased population FPR samples.
- Some traces reached the correct internal conclusion but exhausted the budget before final JSON. Do not claim the model is incapable, or that no output is a correct rejection. Higher-budget controls were contemplated but **not run**.

## Oracle, tests, baseline

`recover.mjs` never opens maps or ground-truth.json. `oracle.mjs` is separate. Final oracle uses generated own-body interior points (exclude function header and block braces; retain full expression bodies), >=2 points, >=80% purity, unique winner. Positive app/runtime origin labels make jQuery predictions on those functions wrong. Unsupported identities remain unassessed. Initial header-inclusive labels are preserved separately. Source-map overlap is positional evidence, not formal semantic proof.

Five regression tests pass, including header contamination and expression-bodied-arrow handling. Source and bundle POG extractions all succeeded. `verify.mjs` checks hashes, model flags/context budgets, unique promotion constraints, and coverage status; `--complete` requires all 12 fixed points. It does not fail just because recovery has false positives: those are experimental outcomes.

Auxiliary exact normalized-AST baseline, **not used as recovery seeds**: readable esbuild 438 correct (~80.7% of supported targets); readable Rollup 499–500 (~90%); readable webpack 478 (~91.6%). Minified esbuild 183 (~33.6%), Rollup 163 (~30%), webpack 162 (30%). No assessed FP in this closed-version corpus. Unknown labels remain separate; no equivalence proof. See ast-baseline.json.

## Completion steps

1. Keep supervising session 54948. Do not restart the frozen algorithm or stop at partial results. If genuinely interrupted, rerun the driver; it replays candidate sequences using caches. Completed profiles are guarded by mode/version/input hash/model digests.
2. After all 12 fixed points, the driver generates reports/anchors and runs verify --complete. Check its exit and execution-status.json.
3. Run:
   - `node scripts/jquery/calibration.mjs`
   - `node scripts/jquery/ast-baseline.mjs`
   - `npm run report`
   - `node scripts/jquery/anchors.mjs`
   - `node scripts/jquery/verify.mjs --complete`
   - `node scripts/jquery/finalize.mjs`
4. Finalizer requires complete status and writes DETAILED_RESULTS.md, CASES.md, detailed JSON/CSV matches, conclusions.json, and a fresh code/hardware/model manifest.
5. Verify generated local Markdown links and syntax, inspect concrete TP/FP/uncertain examples, refresh the root README as complete. Optional replication zip should exclude node_modules, the old archive, and model weights, but retain raw requests and cache provenance.
6. `report.mjs` was extended with small-function recovery, source-inventory coverage, confusion/abstention metrics, per-round outcomes, unique API requests, and model seeds beyond AST. Check generated report wording: main is scalar, not joint; cached service times are original times, not new inference times.
7. A final response should give actual source/anchor counts, recovered range and precision, say main validation was non-thinking, summarize thinking-budget limits, and link the durable report and CSV. No zero-FP guarantee. Do not claim complete before all profiles finish.

## Workspace and provenance

New files: package.json/lock, scripts/jquery/, experiments/jquery/, vendor/debun/, results/jquery-4.0.0/. The old framework study remains intact in archive/2026-10-19-pre-library-recovery (461 original files hash-verified). Do not edit it. No git repository/commit work requested.

Npm metadata-query approval repeatedly failed due reviewer-model capacity, not safety; installation and model execution approvals later succeeded. Official release verification was sufficient; don't treat the task as blocked or bypass checks. The review-service issue is separate from local Ollama availability.

Memory was used for prior evidence-boundary guidance. If needed in final, append one memory block citing MEMORY.md:714-720 and rollout 01a0905d-9b8e-72c2-b0b7-9cb0b47d6678. No memory updates were authorized.
