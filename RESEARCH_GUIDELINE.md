# Recovering Bundled Web-Library Functions with POG Anchors and Neural Neighborhood Matching

Date: 19 October 2026  
Status: research guideline and proposed experimental protocol; the new recovery pipeline has not been evaluated.  
Workspace: `/Users/aaronxyliu/GitHub/FAPI Study`

Pilot implementation: the [jQuery 4.0.0 protocol](experiments/jquery/PROTOCOL.md) and [live result report](results/jquery-4.0.0/REPORT.md) record the first experiment. Its speed-focused main configuration uses independent, non-thinking pair judgments and separate thinking-enabled diagnostics. This is an explicit pilot variant of the thinking-model proposal below; consult its recorded status and limits before interpreting results.

## 1. Research direction and intended contribution

The research target is the effect of JavaScript bundling and optimization on library functions, and the recovery of their source identities from delivered JavaScript. Start with web libraries that offer manageable function populations and relatively simple behavior. Frameworks can become a later generalization study.

The core idea is to combine distinctive property-operation graphs (POGs) with neural matching of nearby functions. POGs provide initial high-confidence correspondences. A small model ranks candidate counterparts for neighboring functions. A thinking model examines the top three candidate pairs. Accepted matches become additional starting points, and recovery continues until no new matches can be accepted.

The intended contribution is an efficient, conservative method for extending function identification beyond the large functions recognizable by POGs alone. This is a hypothesis to test, rather than an established recovery result.

Here, **recovery means identifying the reference source function and locating its compiled counterpart**. It does not mean reconstructing the original source text, variable names, comments, or formatting. Framework API taxonomy and application dataflow categories are no longer the primary scope. Recovery targets need not be documented APIs, exported functions, or dataflow-related functions.

## 2. Scope, inputs, outputs, and terminology

### 2.1 Experimental objects

Focus on library functions for which a clear source-to-bundle correspondence can be established for evaluation. Reference source should be the JavaScript implementation entering the bundler. When studying TypeScript or another source language later, record transpilation separately instead of mixing its effects with bundling.

Use the complete declared function inventory of each selected library/build scope where feasible, including small internal helpers. Documentation can explain usage and help construct fixtures, but documentation membership is not the inclusion oracle for this study. Include functions with zero POG features.

Keep the following outcomes separate:

| Outcome | Treatment |
|---|---|
| Source-linked function with a distinct compiled boundary | Primary function-identification population |
| Multiple compiled copies of a source function | Preserve each occurrence and the one-to-many correspondence |
| Inlined, merged, or split source contribution | Record separately; region recovery is a possible extension |
| Confirmed removal by optimization | Presence outcome; do not require a nonexistent function match |
| Newly generated helper or unclear provenance | Outside the source-linked evaluation population |
| Correspondence unavailable or ambiguous | Retain as unresolved coverage, without guessing its origin |

Do not infer that an unmatched function was newly generated. Do not estimate a framework/library-generated versus source-derived percentage from unmatched cases.

### 2.2 Deployment inputs and outputs

The detector receives delivered JavaScript plus a versioned reference-library corpus and its precomputed features. It may derive ASTs, POGs, call/reference relationships, and other static evidence from these inputs. The initial pilot may use a known library/version; later experiments should widen the candidate library/version space explicitly.

Deployment must not depend on source maps, original application source, inserted markers, or ground-truth function IDs. Reference-library source is available by design. Source maps and controlled builds may support offline evaluation labels, but their identity information must not enter the detector's candidate filtering or model prompts.

Each output should identify the bundle file/hash and function span, reference package/version/file/hash and function span, decision status, evidence, and provenance of the decision. Permit multiple bundle occurrences of one source identity and explicit ambiguity between equivalent reference implementations.

### 2.3 Terms that must remain distinct

| Term | Definition |
|---|---|
| Anchor-eligible function | Function with at least 10 POG features under the pinned extractor convention |
| POG anchor match | An accepted source–bundle correspondence established through the POG matching procedure |
| Recovered seed | An accepted correspondence obtained during expansion; it need not have 10 POG features |
| Frontier | Accepted correspondences whose neighborhoods still need processing |
| Candidate pair | A bundled function and a possible reference-source counterpart |
| Similarity | Evidence useful for ranking candidates; it is not an equivalence guarantee |
| Semantic equivalence | Matching observable behavior under an explicit environment and binding correspondence |
| Source identity | Which particular reference implementation contributed to the bundle |

The discussion uses “POG feature count >=10.” The previous scripts operationalize size as own-body property-operation occurrences, excluding nested bodies. Before the pilot, pin this convention and record occurrence counts, distinct features, and graph node/edge counts separately. They are not interchangeable. If the intended feature definition changes, recompute eligibility and do not reuse older percentages.

Having at least 10 features makes a function eligible; it does not itself establish fingerprint stability, uniqueness, or a correct match. Anchors need not be dataflow-related. The earlier roughly 10% observation concerns a selected framework population and must not be treated as the anchor rate of the new library corpus.

## 3. Hypotheses and evidence boundaries

The proposed method depends on five testable hypotheses:

1. POG matching provides precise initial correspondences for sufficiently distinctive functions.
2. Enough non-anchor functions have useful static relationships with accepted matches to make expansion worthwhile.
3. A small model retains the correct counterpart in its top three candidates often enough.
4. A thinking model can accept correct pairs with sufficiently few false acceptances on these difficult candidates.
5. Iterative promotion increases recovery coverage without unacceptable error propagation or runtime.

The user's earlier POG evidence motivates the first hypothesis. It still needs validation under the selected library, extractor, and build conditions. Small function size alone does not guarantee easy semantic reasoning: coercion, closures, getters, exceptions, `this`, mutation, and evaluation order can matter.

Thinking-model judgments are evidence, not formal proofs. Semantic equivalence also does not uniquely establish source identity: several packages or versions may contain identical helpers. Existing equivalence benchmarks motivate careful evaluation but do not measure our model's precision on bundled JavaScript. [EquiBench](https://aclanthology.org/2025.emnlp-main.1718/) reports limitations in LLM reasoning about program semantics.

## 4. Proposed recovery procedure

### 4.1 Prepare reusable reference information

Enumerate source functions and extract pinned POGs, normalized AST features, embeddings, and static relationships. Record package versions, file hashes, spans, nesting, and dependencies. Precompute reference embeddings once. Cache bundle extraction and pair judgments within a run.

### 4.2 Establish initial POG anchors

Compare eligible source and bundled functions with the POG matcher. Check collisions, indistinguishable candidates, and supported syntax. Only accepted correspondences enter the initial frontier. Keep eligible-but-unmatched and ambiguous cases visible.

### 4.3 Construct compact neighborhoods

For an accepted pair `(source_anchor, bundle_anchor)`, explore bounded neighborhoods on both sides and propose counterpart pairs for unmatched bundled functions. Compare these relationship sources separately:

- Lexically resolved direct callers and callees.
- Function references passed as callbacks or stored in relevant bindings.
- Shared captured bindings and supported receiver/property relationships.
- AST containment and lexical context as additional candidate evidence.

AST adjacency is not automatically a semantic relationship. An unresolved call is not an absent edge. Retain edge kinds, resolution status, and witnesses. Avoid connecting arbitrary siblings through a common utility function.

Start with bounded one-hop neighborhoods and evaluate two-hop expansion as a configurable alternative. Limit nodes and context size and log truncation. On the bundle side, unknown functions may be candidates: do not use evaluation source maps to remove every node not already known to be library code. Prune using deployable evidence and compare the resulting noise and coverage.

### 4.4 Rank candidate counterparts with a small model

For each unmatched bundled function, rank plausible source functions from the relevant reference neighborhood. Record the full candidate set, scores, and top-three list. Use existing match relationships as context or constraints where justified; allow recorded differences caused by transformations or incomplete graph resolution.

If the neighborhood has only a few candidates, scoring them directly may be sufficient. A global reference search is an optional fallback and must have its own runtime and coverage accounting.

### 4.5 Validate up to three pairs with mappings and thinking off

The active configuration is `jquery-pilot-v8-short-mapping-verdict-only`. Each user message contains only `reference_source` and `bundled_function`. The system prompt asks the model to map every source variable, then compare behavior. Required mapping keys are extracted from source syntax only; no bundled counterparts or oracle labels are supplied. Nested variables and captures are included, and shadowed names are qualified by scope.

The response has exactly `variable_mapping` (one compact source-to-bundled object, with nullable string values) and `equivalent` (Boolean). It contains no explanation. Thinking is disabled, with a 384-token output limit, context 16,384, temperature 0 and seed 42. A complete mapping and Boolean are required for a valid response; completeness does not establish mapping correctness. The default remains true unless a definite behavioral difference is identified. Unknown external bindings or identifier renaming alone do not justify false.

Each of the top-three pairs is checked independently; exactly one positive and no source-identity conflict are needed for promotion. No change is made to the POG threshold, ranking, graphs or iteration. Results are isolated in `results/jquery-4.0.0/minified-no-tree-shaking-mapping-v8/`. Historical experiments and diagnostics remain preserved. Exact cached diagnostic requests and embeddings may be reused with provenance; old context-rich decisions do not satisfy the new request key.

Model scores and self-reported confidence are not calibrated probabilities of correctness. Do not force a match merely because the model is asked to choose among three candidates.

### 4.6 Promote conservatively and iterate

Apply a declared acceptance policy combining the model judgment with available relationship evidence and contradiction checks. Differential tests, when executable under aligned environments, may reject incorrect pairs; passing tests does not establish universal equivalence. Compare the model-only policy against this combined policy experimentally.

If exactly one candidate is sufficiently supported and no unresolved ambiguity blocks identity assignment, accept the correspondence as a recovered seed. If more than one candidate remains plausible, preserve an ambiguous set rather than choosing the highest score. Check all top-three candidates unless an explicit uniqueness rule justifies earlier acceptance; uniqueness within the shortlist alone is not proof of global uniqueness.

If none passes, accept no new seed for this bundled function under the current evidence and budget. This is **unresolved**, not proof that no counterpart exists. Continue processing other frontier items. Revisit the function only when relevant evidence changes, such as a newly identified neighbor or an expanded search budget.

```text
accepted = accepted POG anchor correspondences
frontier = accepted

while frontier is nonempty:
    take an accepted correspondence
    construct bounded source and bundle neighborhoods
    for each unmatched bundled function:
        collect plausible source counterparts
        rank candidates with the small model
        evaluate up to three pairs with the thinking model
        apply ambiguity, consistency, and acceptance checks
        if an acceptable new correspondence is found:
            record its evidence and parent correspondences
            add it to accepted and frontier
        otherwise:
            record rejected, uncertain, or missing-candidate status

return accepted correspondences and unresolved cases
```

Memoize processed states using function IDs, candidate/evidence versions, model configuration, and prompt version. Store parent–child provenance so a rejected seed and its dependents can be reviewed or invalidated. Avoid circular confirmation between tentative matches. Stop at a fixed point or a recorded resource budget. A fixed point means no further matches under this procedure, not complete recovery of all source functions.

## 5. Model roles and latency strategy

Separate candidate retrieval from pair judgment. Retrieval finds plausible matches cheaply; the thinking model handles the expensive comparison. This division follows the retrieve-and-rerank pattern, although equivalence requires stricter acceptance than ordinary retrieval relevance. [Sentence Transformers documentation](https://sbert.net/examples/sentence_transformer/applications/retrieve_rerank/README.html)

The following are candidates discussed, not a validated ranking for our task:

| Model | Approximate size | Proposed use |
|---|---:|---|
| [C2LLM-0.5B](https://huggingface.co/codefuse-ai/C2LLM-0.5B) | 0.5B | Small code-retrieval candidate |
| [Jina Code Embeddings 0.5B](https://huggingface.co/jinaai/jina-code-embeddings-0.5b) | 0.5B | Small code-to-code retrieval candidate |
| [Jina Code Embeddings 1.5B](https://huggingface.co/jinaai/jina-code-embeddings-1.5b) | 1.54B | Larger retrieval comparison |
| [Qwen3-Embedding-4B](https://huggingface.co/Qwen/Qwen3-Embedding-4B) | 4B | Larger embedding comparison |
| [Qwen3.5-4B](https://huggingface.co/Qwen/Qwen3.5-4B) | 4B language component; full checkpoint listed around 5B | Thinking-model pair judgment candidate |
| [GraphCodeBERT](https://huggingface.co/microsoft/graphcodebert-base) | About 0.125B backbone | Lightweight representation/classifier baseline; needs task-specific scoring or a trained head |

Pin exact model revisions, total parameter counts, precision, tokenizer, prompt, runtime, and decoding configuration before evaluation. Model-name suffixes are not exact parameter counts, and active MoE parameter counts are not total model size. No universal best model for source-to-bundled JavaScript equivalence has been established in this study.

Prioritize these latency measures:

1. Precompute reference features and cache repeated pairs; keep models loaded and warmed.
2. Restrict expensive judgments to the top three candidates from compact neighborhoods.
3. Retain necessary semantic context while omitting unrelated code and long prose.
4. Use supported hardware acceleration and measure precision/quantization options on the actual device.
5. Return short structured verdicts. Measure thinking-token cost; hiding reasoning text does not remove its computation.
6. Compare thinking enabled with a non-thinking ablation. Do not silently replace the primary thinking-model workflow for speed.
7. Use batching for throughput experiments, but account for queueing delay when evaluating individual response latency.

Smaller models generally require less computation under comparable conditions, but parameter count alone does not determine response time. Input length, generated reasoning length, memory transfers, runtime kernels, batching, and hardware also matter. Quantization reduces weight memory but is not guaranteed to accelerate every device/runtime. [Hugging Face inference optimization guide](https://huggingface.co/docs/transformers/llm_tutorial_optimization)

For one query, record ranking time plus the actual sum of thinking-model comparison times, acceptance checks, and queueing. Up to three comparisons is a budget, not a claim of constant runtime. Report cold initialization separately from warm inference. No hardware-specific speed or minimum-device claim is established yet.

## 6. Research questions

| RQ | Question | Main evidence |
|---|---|---|
| RQ1: Anchor quality | How precise, stable, and discriminative are POG anchors across libraries and build transformations? | Eligibility, anchor precision, collision rate, same-version stability, extraction failures |
| RQ2: Neighborhood opportunity | Which compact static relationships expose recoverable non-anchor functions? | Neighborhood coverage, graph resolution, retained size, oracle-seed reachability |
| RQ3: Candidate ranking | How often does the small model retain the correct counterpart among its top three? | Neighborhood-conditional and end-to-end recall@1/3/5, ranking latency |
| RQ4: Pair acceptance | Can the thinking model identify counterparts with sufficiently few false acceptances? | Accepted-match precision, negative-pair FPR, abstention, ambiguity, verifier latency |
| RQ5: Iterative recovery | How much does seed expansion improve recovery, and how do errors propagate? | Recovery by round/depth, wrong promotions, seed descendants, fixed-point coverage, end-to-end latency |

The central comparison is coverage and runtime at a declared precision requirement. Choose the precision/error budget during the pilot and freeze it before held-out evaluation. Zero false positives is an aspiration; an observed zero count in a finite test is not a universal guarantee.

## 7. Experimental protocol

### 7.1 Corpus and controlled builds

Begin with a small, version-pinned selection of web libraries spanning concrete behavior such as collection utilities, string/encoding helpers, and parsing/serialization. This is a proposed sampling strategy; the final package list has not been selected. Include internal helpers and both property-heavy and property-light functions instead of selecting only easy positive cases.

Create matched builds that separately vary bundler, minification, tree shaking, and transpilation where applicable. Pin application entry points, package versions, runtime versions, commands, lockfiles, and environment. Include exercised functions and deliberately unused functions to distinguish function-boundary survival from removal.

Use the existing `/Users/aaronxyliu/GitHub/framework-sink-dataset` as an available framework-focused extension, rather than silently presenting it as a representative web-library corpus. Do not modify that external dataset. Keep any new library fixtures in the active workspace when implementation begins.

Establish evaluation correspondences with same-build source maps plus code/binding inspection where needed. Mapping overlap alone is positional support, not proof of semantic identity or inlining/splitting. Preserve unsupported and ambiguous labels. Include manually audited cases and record review status.

### 7.2 Stage A: Isolate ranking and verification with correct seeds

Use ground-truth seed correspondences solely to isolate the expansion components. Construct candidate neighborhoods with deployment-available analysis. Measure separately whether the counterpart enters the neighborhood, reaches the top three, and receives a correct verdict. Do not describe oracle-seed results as end-to-end POG recovery.

Include hard negatives: similar code with changed operators or guards, changed coercion or side effects, different dependency bindings, similar helpers from other packages/versions, and wrong neighbors. Include queries with no correct candidate in the neighborhood or shortlist. Keep crafted negative cases distinct from naturally occurring candidates and assess real-candidate prevalence.

### 7.3 Stage B: Enable actual POG anchors and iterative promotion

Replace oracle seeds with actual POG matches. Compare anchors only, one expansion, and repeated expansion. Record every promotion, rejection, ambiguity, parent seed, round, and evidence change. Measure whether wrong seeds produce incorrect descendants.

A deliberately corrupted-seed stress test may characterize sensitivity, but report it separately from natural anchor errors. Do not treat repeated agreement along a dependency chain as independent confirmation.

### 7.4 Baselines and ablations

Compare on identical target inventories and candidate budgets:

- POG anchors only.
- POG plus structural/non-neural matching.
- Small-model ranking without thinking-model judgment.
- Thinking-model judgment with simple structural ranking.
- Full small-model ranking plus thinking-model judgment.
- One expansion versus iteration; code-only versus code plus relationship evidence.
- Top-one, top-three, and top-five budgets; one-hop versus two-hop neighborhoods.
- Thinking enabled versus disabled, keeping other conditions explicit.

D-Bundlr can be a supported-scope baseline if its dependencies and model artifacts can be reproduced. Report package/function support separately from predictor quality; do not force an unsupported configuration into a misleading comparison.

### 7.5 Splits and leakage controls

Separate pilot/calibration and final evaluation builds. Group duplicate or near-duplicate source implementations across versions and applications to avoid leakage through repeated functions. Report same-library held-out-build generalization separately from held-out-library generalization. If any model is fine-tuned or distilled later, keep training, threshold selection, and evaluation data separate.

### 7.6 Metrics and denominators

| Metric | Denominator and interpretation |
|---|---|
| Anchor eligibility | All in-scope inventoried definitions; not recognition success |
| Anchor precision | All accepted POG anchor correspondences |
| Neighborhood coverage | Eligible non-anchor queries with known distinct counterparts; counterpart included by neighborhood construction |
| Conditional recall@3 | Queries whose correct counterpart is in the candidate set |
| End-to-end recall@3 | All eligible counterpart queries, including neighborhood misses |
| Accepted-match precision | Correct identity correspondences / all accepted identity correspondences |
| Negative-pair FPR | Incorrectly accepted inequivalent negative pairs / all evaluated inequivalent negative pairs |
| Identity ambiguity | Equivalent or indistinguishable candidates that prevent a unique identity assignment |
| Recovery recall | Correctly identified bundled occurrences / all established in-scope source-linked bundled occurrences |
| Recovery gain | Additional correct occurrences beyond anchors, with the same denominator |
| Abstention/unresolved rate | Unaccepted queries, broken down by missing candidates, uncertainty, ambiguity, unsupported analysis, and budget |
| Propagation error | Incorrect promoted seeds and their affected descendants, by round and depth |
| Latency and throughput | Median/p95 per-query and per-build time, total model calls/tokens, functions per second, and memory |

Report raw counts, missing data, per-library/build results, and aggregate weighting. Keep distinct source identities separate from bundled occurrences. Define equivalence-class credit separately if identity is intrinsically ambiguous. Generic binary classification accuracy is insufficient.

For rare errors, report uncertainty alongside the observed count. The approximate rule of three gives a 95% upper error-rate bound of `3/n` after zero errors in `n` independent observations; correlated functions/builds weaken this simple approximation. Do not claim guaranteed zero FP from a clean finite sample.

## 8. Relationship to D-Bundlr

[D-Bundlr's public repository](https://github.com/Anemone95/D-Bundlr) is useful related work and a possible baseline. Its GraphCodeBERT component predicts trained library/module/function identity labels. It is not a ready-made general pairwise equivalence judge. Its individual-function acceptance path also uses function-specific validation support.

The archived read-only audit examined commit `c28a5d62efeecc46cc146c3548c71b8071ba2e89`. It recorded 50 distinct active individual-function validation keys across 19 packages. This is support-vocabulary evidence, not an end-to-end recovery percentage. Whole-module recognition and individual-function identification must be evaluated separately.

No D-Bundlr predictor execution or trained-checkpoint loading was completed by that audit. The paper/repository discussion does not establish that its trained model can provide the low-FP equivalence decisions needed here. Its code transformation stage should not be confused with neural generation of original source code.

See the preserved [audit report](archive/2026-10-19-pre-library-recovery/results/d-bundlr-coverage-audit/REPORT.txt) and [audit data](archive/2026-10-19-pre-library-recovery/results/d-bundlr-coverage-audit/summary.json). The recorded external-checkout paths are historical provenance.

## 9. Prior evidence and limits on reuse

The earlier framework study is background evidence, not validation of this new library-recovery system:

- The [structure experiment](archive/2026-10-19-pre-library-recovery/results/structure-stability/summary.json) covered 59 selected source identities and 236 expected source-to-bundle comparisons in 24 controlled React/Vue builds; 232 comparisons had supported distinct correspondences. Mean normalized-AST similarity was about 89.3% and compact-AST similarity about 90.1%. Graph comparison used oracle identities, so its preservation results do not establish source-map-free matching accuracy.
- The [neighborhood estimate](archive/2026-10-19-pre-library-recovery/results/anchor-neighborhood-estimate/summary.json) recorded call/captured-state candidate coverage for 79/235 selected bundled non-anchor definitions. This is structural candidate coverage, not an adjudicated semantic relationship percentage. Its complement must not be described as functions having no semantic relationship to anchors.
- The archived [framework plan](archive/2026-10-19-pre-library-recovery/RESEARCH_PLAN.md) and [report](archive/2026-10-19-pre-library-recovery/results/REPORT.md) preserve their original populations, thresholds, and limitations. In particular, historical `>10` and current `>=10` measurements must not be mixed.

No small-model ranking, thinking-model equivalence, or iterative recovery result has yet been measured for the proposed library corpus. No latency target, universal model ranking, or complete-recovery claim is established.

## 10. Execution order, artifacts, and completion criteria

Proceed in this order:

1. Freeze feature definitions, recovery units, package-selection rules, and the primary distinct-boundary scope.
2. Build a small library pilot and establish audited correspondence labels and difficult negatives.
3. Validate POG anchor precision, collisions, and size sensitivity.
4. Measure neighborhood opportunity and small-model recall@3 with oracle seeds.
5. Measure thinking-model acceptance precision, ambiguity, and warm latency on the ranker's actual candidates.
6. Freeze models, prompts, budgets, and acceptance policy after calibration.
7. Run held-out iterative recovery with real POG anchors, baselines, and propagation tracking.
8. Write conclusions from the measured precision–coverage–runtime tradeoffs, retaining unresolved outcomes.

When implementation begins, create active `manifests/`, `scripts/`, `results/`, and `cases/` directories as needed. Each run should preserve configuration, package/build/model revisions, file hashes, ground-truth provenance, raw candidate rankings, verifier decisions, promotion dependencies, per-round metrics, timings, and representative success/failure cases. Do not overwrite archived results with new runs.

Portable JSON/JSONL files should remain sufficient for inspection. The previously authorized local MySQL server at `127.0.0.1:3306` may also store experiment records; use distinct run IDs and a separate study namespace. Supply credentials at runtime rather than storing them in this guideline or committed scripts. No database content was changed during this documentation/archive task.

The first milestone is an auditable pilot showing where correct counterparts are lost and whether selective thinking-model judgments are precise enough to promote. A useful outcome may be conservative partial recovery. Completing all reachable accepted matches is different from recovering every function.

## 11. Archive and writing continuity

All previous workspace research material was moved intact into [archive/2026-10-19-pre-library-recovery/](archive/2026-10-19-pre-library-recovery/). This guideline is the active direction; the archived plan and manuscript remain historical artifacts.

The archived [manuscript](archive/2026-10-19-pre-library-recovery/manuscript/main.tex) and its [template provenance](archive/2026-10-19-pre-library-recovery/manuscript/TEMPLATE_SOURCE.md) can support later paper preparation. Reuse formatting/template assets, but write the new paper around this scope and its new measurements; do not carry forward unrelated project prose or present archived framework results as library-recovery results.

The archive contains its original directory relationships and an [inventory with pre-move hashes](archive/2026-10-19-pre-library-recovery/ARCHIVE_MANIFEST.json), plus a [post-move verification record](archive/2026-10-19-pre-library-recovery/ARCHIVE_VERIFICATION.json). Original absolute paths in old logs remain historical. Review working-directory assumptions before rerunning archived scripts.
