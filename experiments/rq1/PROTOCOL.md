# RQ1: default recovery on the 26-repository capture cohort

From `ReCall Exp`, run `python3 scripts/rq1/run.py --output results/rq1-default-26-2026-11-07`. The runner processes repositories in increasing ground-truth size, in separate Node processes, with a single model workload at a time. Completed evaluations are skipped; interrupted runs reuse ReCall checkpoints and exact-request model caches. No oracle-driven candidate selector is used.

## Frozen inputs and settings

The canonical input is the dataset's `bundling-dataset/one-to-one-evaluation.json`: 26 repositories and 78,884 pairs. Each run records its ground-truth digest, source commit, ReCall implementation digest, resolved defaults, model digests, and reference/capture manifests. Defaults include 10 own-body property operations, three library anchors, unique-per-chunk anchors, library gating enabled, radius one, top five, cross-chunk disabled, minified source embeddings, qwen3-embedding:0.6b, and qwen3.5:27b validation with thinking off, temperature zero, seed 42.

Reference preparation extracts **all available original source texts of the selected libraries** from captured maps, not just functions with accepted pairs. These are fixed captured-source snapshots, not complete installed npm distributions; version metadata explicitly says `captured-source-snapshot`. ReCall receives only the resulting text files and library labels, with neither maps nor function correspondences. The independent scorer reads the correspondence records after recovery. This is a known-reference recovery experiment; it does not measure reference acquisition or npm version identification. Map-derived reference coverage is an evaluation limitation.

Do not erase TypeScript/JSX or otherwise rewrite inputs to improve default parser coverage. Unsupported source syntax remains an inventory coverage loss; all original ground-truth pairs remain in the recovery denominator. The oracle's spans come from Babel, while ReCall enumerates JavaScript with its default parser. The scorer reconciles Babel method spans (including the key) with ESTree function-value spans only when the original endpoint is a parsed method, the candidate starts in that method header, and both end at the same offset. Ambiguous matches remain unresolved. Record these alignments and remaining inventory coverage losses separately.

## Metrics

- Recovery rate: correct accepted function correspondences / all ground-truth pairs. Report pooled, per-repository, and per-library-case values.
- Recovery precision: correct predictions / predictions whose bundled target has an accepted ground-truth identity. Predictions outside this one-to-one target set are **unassessed**, not automatically correct or wrong. Report their count and the assessed fraction of all predictions.
- Anchors: all promoted anchors; ground-truth-target anchors and their percentage of all GT pairs; correct anchors and anchor precision. Candidate anchors excluded by library gating do not count as promoted.
- Top-5: whether the GT identity is in the first ranked list's first five entries, over distinct queried GT targets. Also report ever-in-top-five and top-five reach over **all** GT pairs. Anchors/unqueried targets do not enter the conditional ranking denominator.
- Validator: source-identity TP/FP/TN/FN over candidate checks for targets with GT; decision accuracy `(TP+TN)/(TP+FP+TN+FN)`, acceptance precision `TP/(TP+FP)`, positive recall `TP/(TP+FN)`. Invalid/error outputs are counted separately. This is identity-label agreement, not manual semantic-equivalence accuracy; semantically equivalent alternative sources may differ from the oracle identity.
- Costs: preparation, inventories, library/anchor identification, bundler detection, module resolution, graph construction, recovery, and total wall time. Record actual embedding/validation HTTP durations and server token counts. Attribute validation time to candidate-source libraries; identical source texts shared by libraries split attribution equally. Embedding and graph costs are shared repository costs and must not be falsely represented as independent per-library execution times. Cache hits and retries are reported separately from cold model work.
- Coverage: selected/detected libraries, parse failures, source/bundle exact-span GT coverage, fixed-point/limit/failure status, conflicts, validation calls, and unassessed outputs.

## Progress and interpretation

`progress.json` tracks completed/failed/current repositories. Each repository has `live.json`, `events.jsonl`, `model-timing.jsonl`, `timing.json`, and `run/evaluation.json`. Raw outputs and model responses remain under the ignored results directory. Tracked summaries should be regenerated from these files, retaining provenance.

Early ETA is highly uncertain: zero-anchor runs make no model calls, and bundlejs alone contains 43,064 pairs. A pair-weighted ETA is a rough projection, not a commitment. Use measured validation throughput and stage activity to explain revisions. Never interpret early no-anchor runs as evidence that the remaining cohort will be fast.

Report repository/library averages and a sensitivity analysis excluding bundlejs alongside pooled counts. These executions are current default-setting results; do not overwrite historical jQuery or oracle-simulation results with them.
