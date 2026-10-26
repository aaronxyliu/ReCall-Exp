# Library-function recovery manuscript

The recovery method takes supplied JavaScript files and candidate reference libraries. File acquisition, including automatic discovery of unrequested chunks, is outside the method. POG anchors and independently constructed relationship graphs guide neighborhood ranking, heuristic model validation, and iterative promotion. Reference identification/retrieval is input preparation; the completed model experiments supply known references.

## Active structure

- `sections/introduction.tex`: motivation, prior-work gap, central insight, three contributions, and a bounded summary of completed evidence.
- `sections/background.tex`: bundling terminology, function-recovery challenges, and evidence-qualified discussion of DEBUN and D-Bundlr. The POG size-eligibility rate remains `[TBD%]` pending the experiment, including its numerator, denominator, and cohort.
- `sections/approach.tex`: six-part recovery method, full workflow, and an explicitly illustrative running example; general definitions and prior-work limitations are centralized in Background.
- `sections/approach-details.tex`: detailed bundler adapters and solver bounds, preserved from the preceding Approach.
- `sections/datasets.tex`: completed model fixture and graph cohorts, identity labels/denominators, and planned local verification inputs. Primary recovery uses fixed, versioned references; the practical-use dataset remains undefined.
- `sections/experiment.tex`: roadmap-aligned RQs, completed/planned evidence table, and seven numbered planned experiments.
- `sections/rq1.tex`: Performance; completed jQuery recovery, precision, and failures, followed by experiments 1 (bundlers), 2 (libraries/frameworks), and 3 (validated transformations and their relationship with library recovery rate).
- `sections/rq2.tex`: Ablation; completed expansion and oracle connectivity evidence, followed by experiments 4 (neighborhood ranking versus embedding every function) and 5 (module graph building).
- `sections/rq3.tex`: Tradeoff; completed procedure/runtime and 27B/4B evidence, followed by experiments 6 (POG feature-count robustness) and 7 (validation model selection).
- `sections/rq4.tex`: Practical Use; research question, dataset, and protocol to be filled; no completed practical-use result.
- `sections/results.tex`: includes the four RQs in order.
- Appendices: exact settings, all 135 per-library graph cases, pilot protocol, and wrong-identity audit.

RQ1--RQ3 open with focused questions, report completed evidence first, and then present the numbered planned experiments and editable native-LaTeX overview figures. RQ4 remains an explicit placeholder. Planned full-method runs can be shared by the performance evaluation, both ablations, and selected-setting test costs; configuration selection uses repository-disjoint development subjects. The global-embedding comparison is an internal baseline. Completed graph simulations do not substitute for model-driven ablation results.

## Existing evidence

The jQuery 4.0.0 pilot uses three minified builds with tree shaking disabled. The 27B run recovers 1538/1629 supported occurrences (94.41%), with 14 wrong identities, 45 unassessed promotions, and 99.10% assessed precision. The 4B rerun recovers 1300/1629 (79.80%), with 62 wrong identities, 38 unassessed promotions, and 95.45% assessed precision. Observed elapsed times are 81.84 and 13.00 minutes. These are pilot/development runs, not unseen-repository model evaluation.

Model-free graph simulations use oracle-confirmed seeds and perfect candidate selection. Current development subjects improve from 64.83% to 97.49% within chunks (97.83% cross-chunk); unchanged-analyzer holdout subjects improve from 78.16% to 91.74% (92.22% cross-chunk). The earlier esbuild implementation and its results remain separate. No simulation rate is presented as model recovery accuracy.

## Build and provenance

Compile from this directory:

```sh
tectonic --keep-logs --outdir build main.tex
```

The PDF is `build/main.pdf`. `data/roadmap-alignment-check.json` records the latest PDF/source hashes, verification that completed evidence and data tables are unchanged, and visual review. Earlier checks remain as historical records. The template provenance remains in `TEMPLATE_SOURCE.md`.

The source and PDF preceding the Approach revision are preserved under `archive/2026-10-24-before-approach-revision/` with checksums; the earlier four-RQ archive is also retained. The Approach revision changes exposition and scope framing, not analyzer code or recorded experimental results. No experiments or inference calls were run. `data/approach-revision-check.json` records its validation; `data/manuscript-check.json` remains the preceding revision record.

From the workspace root, `python3 scripts/real-app/write-bundler-manuscript.py` regenerates only graph tables and their evidence ledger from completed outputs. Do not run older jQuery manuscript generators against this organization: they write earlier manuscript snapshots. Inspect their archived behavior before reuse.

The source and PDF preceding Background are preserved under `archive/2026-10-24-before-background/` with checksums. `data/background-evidence.json` records the primary sources and the pinned D-Bundlr verifier audit. No historical percentage is substituted for the pending POG eligibility experiment. The Background edit preserves the Approach's algorithms, figures, tables, and experiment results; only exposition and cross-references change.

The source and PDF preceding the Introduction revision are preserved under `archive/2026-10-24-before-introduction-revision/` with checksums. The revised Introduction separates motivation, the central insight, and contributions, leaving terminology and procedural detail to Background and Approach. It retains the distinction between the jQuery model pilot and oracle-assisted graph reachability; no new experimental claim or result is added.

The source and PDF preceding the Abstract revision are preserved under `archive/2026-10-24-before-abstract-revision/` with checksums. The concise Abstract emphasizes the function-recovery gap, iterative matching, and bundler-aware context. It retains one model result and one graph result with their separate evaluation scopes; detailed configurations and secondary comparisons remain in the paper.

The joint Abstract/Introduction/Background/Approach review is recorded in `data/cross-section-review-check.json`; the preceding manuscript is preserved under `archive/2026-10-24-before-cross-section-review/`. The review standardizes reference-side terminology and graph reachability, defines a POG anchor as an initial matched pair, and separates size eligibility from accepted anchors. Background owns general definitions and prior-work limitations; Approach owns the input contract, eligibility and acceptance rules, and stage-specific example explanations. Standalone summaries and essential evidence qualifications remain in Abstract and Introduction. No method rule or recorded result changes.

The Dataset Preparation and Evaluation revision is preserved against `archive/2026-10-24-before-evaluation-revision/`. Following the user's explicit decision, primary RQ1 evaluation uses supplied code and fixed versioned references; automatic identification/retrieval remains input preparation. Completed numerical results and generated tables are retained. Planned model ablations are distinct from completed oracle-assisted graph reachability. The first Limitations paragraph is aligned with this scope.

The deliberate-obfuscation limitation leaves systematic evaluation and support for obfuscated functions to future work. It cites historical prevalence evidence without claiming a current prevalence rate, and explains why property concealment, structural transformations, and hidden function bodies can limit recovery. The preceding affected sources and PDF are preserved under `archive/2026-10-24-before-obfuscation-limitation/`; `data/obfuscation-limitation-check.json` records compilation and PDF text verification. No recovery experiment or model inference was run.

RQ1 now includes a planned function-boundary experiment: screen source-map relations for split, combine (including inlining), and possible removal candidates; manually validate every flagged case; and report confirmed transformations, alternative explanations, and unresolved cases before drawing frequency and recovery-scope conclusions. Candidate relations are not transformation labels, and missing mappings alone do not establish removal. The protocol is synchronized with Dataset Preparation and the evaluation-status table. The preceding affected sources and PDF are preserved under `archive/2026-10-24-before-boundary-protocol/`; `data/boundary-protocol-check.json` records verification. No corpus-wide screen, manual transformation validation, recovery experiment, or model inference was run for this manuscript edit.

The roadmap alignment uses the seven experiment numbers in the repository README. Completed RQ1--RQ3 evidence and generated tables are retained; the earlier RQ4 sink-analysis proposal is preserved in `archive/2026-10-24-before-roadmap-alignment/` while the active RQ4 protocol is left to be filled. Dataset Preparation, the evaluation overview, RQ descriptions, planned protocols, figures, status statements, and introduction/limitations scope statements are synchronized. No experiments, application rebuilds, or model calls were performed.
