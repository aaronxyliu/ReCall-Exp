# All-library application experiment

The six-library experiment on pinned `PanJiaChen/vue-admin-template` is complete: **3,490/4,678 supported targets recovered (74.60%)**, using the same 27B/0.6B settings, thinking off, and T/F output. It includes 4,732 source definitions and both complete target-containing production chunks (6,622 bundled functions). The oracle assesses 10 wrong identities and leaves 45 promotions unassessed; separate manual review confirms three additional wrapper misidentifications among those unassessed outputs. See [results and evidence](results/real-app/vue-admin-template-all-libraries/REPORT.md) and [protocol](experiments/real-app/ALL_LIBRARIES.md). The earlier three-library and jQuery experiments remain available below.

# Real application experiment

The three-library test on pinned `PanJiaChen/vue-admin-template` is complete: **77/140 supported targets recovered (55.00%)** across axios, NProgress, and js-cookie, using the frozen 27B/0.6B experiment-4 settings with thinking off and T/F output. Manual review identifies one module-wrapper mismatch among two oracle-unassessed promotions. See the [results and evidence boundaries](results/real-app/vue-admin-template-three-libraries/REPORT.md) and [reproduction protocol](experiments/real-app/README.md). The earlier jQuery results below are preserved.

# Active experiment

The requested v8 full experiment is complete: **mapping + verdict only, thinking off**, across esbuild, Rollup and webpack with minification on and tree shaking off. Correct recovery is 468/545 (85.87%), 474/544 (87.13%), and 490/540 (90.74%), respectively. The descriptive pooled result is 1432/1629 (87.91%), with 25 wrong identities and 36 unassessed predictions. See the [comparison and remaining-function breakdown](results/jquery-4.0.0/minified-no-tree-shaking-mapping-v8/COMPARISON.md), [current protocol](experiments/jquery/V8_PROTOCOL.md), and [completed execution status](results/jquery-4.0.0/minified-no-tree-shaking-mapping-v8/execution-status.json). Historical results and diagnostics below remain available.

# Bundled Library Function Recovery Study

The current [paper manuscript](manuscript/main.tex) describes the implemented algorithm, experimental procedure, source-map evaluation, and saved preliminary results. See its [editing and evidence guide](manuscript/README.md). The active v8 full recovery run uses mapping plus verdict with thinking off; its results are isolated from the historical snapshots.

The active research direction is to identify source-linked functions in bundled web-library JavaScript using POG anchors, small-model neighborhood ranking, and selective thinking-model comparison.

Start with [RESEARCH_GUIDELINE.md](RESEARCH_GUIDELINE.md). It records the scope, terminology, top-three candidate workflow, seed expansion, latency strategy, research questions, evaluation protocol, and unresolved assumptions.

For the student dataset assignment, see [STUDENT_DATASET_GUIDELINE.md](STUDENT_DATASET_GUIDELINE.md): CDNJS selection, controlled webpack builds, verified source–bundle function pairs, a portable database, and GitHub publication.

The research guideline defines the proposed evaluation. Prior framework measurements are supporting background with their own scope and limitations; the new jQuery pilot's execution status and completed measurements are reported separately below.

A crafted jQuery 4.0.0 pilot is now available: [experiment and reproduction guide](experiments/jquery/README.md), [measurement protocol](experiments/jquery/PROTOCOL.md), and [generated results with current execution status](results/jquery-4.0.0/REPORT.md). It covers three bundlers and 12 configurations, with source maps reserved for offline evaluation. Consult the report for completed versus running measurements.

All previous research content, including the framework plan, manuscript, experiment data, scripts, and package configuration, is preserved under [archive/2026-10-19-pre-library-recovery/](archive/2026-10-19-pre-library-recovery/). See the [archive index](archive/2026-10-19-pre-library-recovery/ARCHIVE_README.md), [file manifest](archive/2026-10-19-pre-library-recovery/ARCHIVE_MANIFEST.json), and [integrity verification](archive/2026-10-19-pre-library-recovery/ARCHIVE_VERIFICATION.json).

The [wrong-identity audit](results/jquery-4.0.0/minified-no-tree-shaking/wrong-identity-audit/REPORT.md) reviews all 13 errors individually, with raw map witnesses, saved model requests, counterexamples, browser observations, and proposed remedies. Original predictions and labels remain unchanged.

The earlier v6 validator user input contains only the reference and bundled functions. See the [concise 13-case thinking review](results/jquery-4.0.0/minified-no-tree-shaking/wrong-identity-audit/readable-cases/README.md); raw requests and responses are retained separately under `wrong-identity-audit/functions-only-thinking/`. Historical context-rich diagnostics and recovery predictions are preserved.

The historical v7 validator keeps thinking disabled and returns `{ "equivalent": boolean, "explanation": string }`, explaining false decisions. The [114 ground-truth FN replay](results/jquery-4.0.0/minified-no-tree-shaking/recovery-bottlenecks/false-negatives/nonthinking-explanations/README.md) uses only the two functions and preserves every response separately from historical recovery outputs.

The [short all-variable mapping prompt replay](results/jquery-4.0.0/minified-no-tree-shaking/recovery-bottlenecks/false-negatives/short-variable-mapping-replay/ANALYSIS.md) completed all 114 historical ground-truth FN pairs with thinking off: 105 accepted (92.11%), compared with 59/114 for the explanation-only replay. This is a positive-pair diagnostic, not a resumed recovery run or false-positive evaluation.

See [TODO.md](TODO.md) for the nine remaining validation cases, their evidence, and deferred follow-up tasks.

The [decision-only output comparison](results/jquery-4.0.0/minified-no-tree-shaking/recovery-bottlenecks/false-negatives/short-hidden-mapping-replay/ANALYSIS.md) retains the mapping/check instructions but suppresses visible mappings and explanations: 67/114 accepted (58.77%), versus 105/114 (92.11%) with explicit mapping output. Thinking is off in both conditions; no recovery loop or negative-pair evaluation was run.

The [mapping-without-explanations comparison](results/jquery-4.0.0/minified-no-tree-shaking/recovery-bottlenecks/false-negatives/short-mapping-no-explanation-replay/ANALYSIS.md) accepted 106/114 source-linked pairs (92.98%), versus 105/114 with mapping plus explanations and 67/114 with verdict only. Thinking remained off. The net gain of one acceptance is not a proved semantic-accuracy gain; FN103 is among the changed decisions.

The [bundling dataset](datasets/bundling-dataset/README.md) organizes 11 pinned repository targets by esbuild, Rspack, Rolldown, Turbopack, and Parcel. At initial selection, ten targets had recorded successful builds and the Parcel browser-extension target was configuration-only; the connectivity experiment subsequently built that extension successfully. The canonical dataset is maintained alongside the original cohorts in `framework-sink-dataset/datasets/bundling-dataset`; the workspace path is a link.

The [bundling-dataset connectivity simulation results](results/real-app/bundling-dataset/REPORT.md) record oracle-only recovery for 11 new esbuild, Rspack, Rolldown, Turbopack, and Parcel targets, with per-library rates, parser coverage, and reproducible evidence. No models were invoked; previous experiments remain unchanged.

The [frozen connectivity baseline v1](baselines/bundling-connectivity-v1-2026-10-22/README.md) is the reference for upcoming module-graph improvements. It preserves independent, read-only copies of the implementation, exact inputs, oracle, seeds, results and traces, with file hashes and a fixed comparison protocol. New work must use separate output directories.

The [angular-example-app esbuild propagation analysis](results/real-app/esbuild-propagation/angular-example-app-v1/REPORT.md) isolates source ESM binding, receiver/object and cross-chunk effects against the frozen baseline. Its exploratory results and implementation are separate from baseline v1.

The [all-esbuild graph-improvement comparison](results/real-app/esbuild-propagation/all-esbuild-v1/REPORT.md) applies the tested ESM, class/receiver, object-field and function-reference relations to all three esbuild targets. Per-library per-chunk and cross-chunk results are recorded separately against frozen baseline v1; no models were invoked.
