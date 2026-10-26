# Active experiment: mapping and verdict, thinking off

Configuration: `jquery-pilot-v8-short-mapping-verdict-only`.

Status: **complete**, with all three builds at fixed point and mechanical verification passed. See the [recovery and remaining-function comparison](../../results/jquery-4.0.0/minified-no-tree-shaking-mapping-v8/COMPARISON.md). Correct recovery: esbuild 468/545, Rollup 474/544, webpack 490/540. Every saved validation request has thinking disabled; no response contains returned thinking text.

Run `node scripts/jquery/experiment.mjs` from the workspace root. Active output: `results/jquery-4.0.0/minified-no-tree-shaking-mapping-v8/`. Historical results remain at `results/jquery-4.0.0/minified-no-tree-shaking/`. To run an older output-specific analysis, set `EXPERIMENT_OUTPUT` explicitly to its historical directory.

The three prebuilt profiles are esbuild-min-keep, rollup-min-keep and webpack-min-keep: minification on, tree shaking off. Inputs, maps, inventories and model digests match the previous experiment. The detector never reads source maps. POG eligibility remains >=10 own-body property operations, exact unique fingerprints initialize anchors, neighborhoods remain one hop, embedding ranking selects three candidates, and promotion requires exactly one accepted candidate and no simultaneous source-identity conflict.

## Validator

Model: qwen3.5:4b. Thinking off; temperature 0; seed 42; context 16,384; output limit 384. Each user message has only `reference_source` and `bundled_function`. `scripts/jquery/variable-mapping-policy.mjs` supplies the tested short prompt, source-variable extraction and required-key schema. Required keys include source parameters, locals, named functions and referenced external variables, including nested bodies. Shadowed names receive scope qualifiers. No candidate correspondence is supplied to the model.

```json
{"variable_mapping":{"source_name":"bundled_name"},"equivalent":true}
```

There is no explanation field. Null mapping values are permitted when no counterpart is identified. A result must include exactly the required source keys and a Boolean verdict; invalid output or an API error does not become an acceptance. Complete mappings mean schema completeness, not independently verified mapping correctness. The default-true policy is unchanged: reject only for a definite behavioral difference; renaming or absent external-binding information alone does not justify rejection.

Full requests, mappings, verdicts, tokens, generation exits and timings are saved in model-cache/validations/. Identical requests reuse judgments by complete request and both model digests. The new cache imports 111 distinct requests from the completed 114-pair mapping-without-explanations diagnostic; import provenance is saved. Those are cached judgments, not new trials. Embeddings are reused because inputs, query instruction and embedding digest are unchanged. Historical context-rich validation records are not imported.

## Results and unrecovered-function reasons

After fixed point, `report.mjs` evaluates source-map-supported identities, separating correct, wrong and unassessed promotions. Report correct recovery as correct supported jQuery identities / supported jQuery definitions per build. Pair-level accepted identities and final promoted identities have separate precision denominators. Source-map lineage does not prove unrestricted semantic equivalence; retain the documented FN103 browser edge case.

`analyze-recovery-bottlenecks.py` assigns each supported function not correctly recovered to one exclusive observed pipeline category: wrong promotion; never queried due to length, missing matched neighbor or unavailable candidates; correct acceptance blocked by ambiguity or identity conflict; correct top-three candidate rejected (or only operational failures); candidate ranked below top three; or correct source absent from the candidate pool. Full per-function queries, ranks, verdicts and code are saved. These categories describe observed barriers, not additive gains obtainable by hypothetical repairs.

The run executes recovery, reporting, anchor evaluation, mechanical verification and offline bottleneck analysis. `execution-status.json` and `experiment-run.log` record progress. Invalid/length-limited responses remain explicit instead of being silently retried as successful matches.
