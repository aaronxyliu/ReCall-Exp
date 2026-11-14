# Validation Falses

This dataset records Qwen errors against the aligned ground truth for the final 35-repository RQ1 experiment.

- [FP](FP/) contains 373 distinct pairs that Qwen accepted and ground truth marked incorrect.
- [FN](FN/) contains 1,422 distinct pairs that Qwen rejected and ground truth marked correct. Of those, 1,421 appear in final recovery traces and one comes from a targeted recheck that the rebuilt exploration did not revisit.
- [Counts by repository](summary.json) include unassessed and invalid trace checks. FP and FN require both a binary verdict and ground truth.

Each repository JSON file contains the exact user-message string sent to Qwen, including the source function, minified source reference, and bundled function. It also includes the raw Qwen response and the rounds in which each judgment was used. System prompts are excluded. The pair ID joins a record to its explanation in `FN/explanations/<bundler>/<repository>.jsonl`.

The explanatory replay submits every FN pair independently with the revised prompt and an explanation output format. It records the new verdict, explanation, and raw response. These diagnostic verdicts do not change the final RQ1 recovery results.
