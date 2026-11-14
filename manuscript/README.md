# Library-function recovery manuscript

The recovery method takes supplied JavaScript files and candidate reference libraries. File acquisition, including automatic discovery of unrequested chunks, is outside the method. POG anchors and independently constructed relationship graphs guide neighborhood ranking, heuristic model validation, and iterative promotion. Reference identification/retrieval is input preparation; the completed model experiments supply known references.

## Active structure

- `sections/introduction.tex`: motivation, prior-work gap, central insight, three contributions, and a bounded summary of completed evidence.
- `sections/background.tex`: bundling terminology, function-recovery challenges, and evidence-qualified discussion of DEBUN and D-Bundlr. The POG size-eligibility rate remains `[TBD%]` pending the experiment, including its numerator, denominator, and cohort.
- `sections/approach.tex`: four-part recovery method (overview, anchors, function relation graphs, and neighborhood-guided semantic recovery), full website-oriented workflow, and an explicitly illustrative running example; general definitions and prior-work limitations are centralized in Background.
- `sections/approach-details.tex`: graph construction algorithm, module-operation and adapter tables, solver bounds, and current recovery implementation settings.
- `sections/datasets.tex`: completed model fixture and graph cohorts, identity labels/denominators, and planned local verification inputs. Primary recovery uses fixed, versioned references; the practical-use dataset remains undefined.
- `sections/experiment.tex`: evaluation roadmap and the Data collection subsection before RQ1.
- `sections/data-collection.tex`: repository/tool/library selection, bounded browser capture, reciprocal function oracle, transformation patterns, and the 26-repository snapshot. `data/collection-evidence.json` records the recomputed counts and per-library pair totals.
- `sections/rq1.tex`: Performance; completed jQuery recovery, precision, and failures; a frozen preliminary multi-repository anchor-coverage analysis; followed by experiments 1 (bundlers), 2 (libraries/frameworks), and 3 (validated transformations and their relationship with library recovery rate).
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

The PDF is `build/main.pdf` and is ignored by Git. Keep manuscript sources, table inputs, evidence ledgers, citations, and template provenance tracked. Compilation products and one-off revision checks are intermediate output, not current experimental evidence.

`data/collection-evidence.json` contains the current collection counts; `data/background-evidence.json` records literature sources and the pinned verifier audit. Template provenance is in `TEMPLATE_SOURCE.md`.

From the repository root, `python3 scripts/real-app/write-bundler-manuscript.py` regenerates graph tables and their evidence ledger from completed outputs. Older jQuery manuscript generators write earlier manuscript layouts; inspect them before reuse.

Historical revision checks and migration snapshots were moved to the ignored local `../archive/2026-11-07-tracked-intermediates/` directory. Git history preserves their previously tracked versions. Do not use old PDF hashes or review reports as validation of the current manuscript.

The RQ1 anchor figure is generated by `scripts/plot-rq1-anchors.py` from `data/rq1-anchor-recovery-snapshot.json`. The 84 retained instances have at least 20 GT pairs and an initial anchor. The frozen snapshot describes an incremental run, not a completed uniform rerun of the full cohort.
