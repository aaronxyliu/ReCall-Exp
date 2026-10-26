# Overall experiment 3

Output: `results/jquery-4.0.0/experiment-3-first-positive-27b`.
Runner: `node scripts/jquery/experiment-3.mjs`.
Progress: `EXPERIMENT_OUTPUT=results/jquery-4.0.0/experiment-3-first-positive-27b node scripts/jquery/progress-v8.mjs --compact`.

User-approved changes: revised source-side embedding instruction, qwen3-embedding:0.6b ranking, qwen3.5:27b validation, exact new T/F prompt with thinking off, and first-positive promotion among ranked top three. One-to-one source allocation and round-level conflicts are retained. No uncertain verdict. Ranking and validation inputs contain no source-map labels or neighbor correspondences. Bundled embedding inputs contain code only.

All three pinned jQuery 4.0.0 minified/no-tree-shaking builds and ground truth are copied unchanged from the completed v8 run. Experiment caches begin empty. Repeated identical requests within this run can be reused. Old overall and diagnostic outputs remain unchanged. Matching reads detector-input.json only; evaluation reads held-out ground-truth.json afterward.

Record exact supported-target recovery denominators, correct/wrong/unassessed promotions, per-build and pooled recovery, identity precision, validator decisions and valid-response rates, elapsed stage times, source embedding time counted once, bundle embedding times, ranking time, and unique validation request wall/load/prefill/decode times. Save provenance and implementation snapshots.

After fixed point, run mechanical verification, exclusive unrecovered-outcome classification, independent source-map inspection of wrong predictions, and readable wrong-match cases. Distinguish pipeline outcomes from semantic causes: unknown external bindings, identical/equivalent source bodies, nested function boundary mistakes, and visible behavioral differences need code evidence; T/F responses contain no model explanation. Unsupported identities remain unassessed.

This run changes ranking, validator, and promotion policy together relative to the completed v8 baseline. Its difference is not a causal ablation of any one component. Build occurrences are correlated and this preliminary experiment is not a zero-false-positive guarantee.
