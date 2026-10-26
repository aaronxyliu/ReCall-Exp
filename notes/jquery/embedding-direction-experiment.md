# Small experiment: embedding retrieval direction

Status: completed on 2026-10-20. Results: `results/jquery-4.0.0/embedding-direction-v1/REPORT.md`. The overall recovery pipeline was not started.

## Question

Does placing the retrieval instruction on the source function rather than the bundled function improve source identification? This tests instruction placement, not whether the model actually performs bundling.

## Fixed inputs

Use the completed run in `results/jquery-4.0.0/minified-no-tree-shaking-mapping-v8`. Use its `detector-input.json`, `ground-truth.json`, and `recovery/*.json`. All builds use jQuery 4.0.0, minification on, and tree shaking off.

For each build, take the first recorded query for each bundled function, before applying eligibility filters. Keep a query if (1) its source-map ground truth is supported, (2) the correct source occurs in its full saved candidate set, and (3) there are more than three candidates. This isolates ranking and excludes trivial top-three successes. Eligible counts are esbuild 382, Rollup 381, and webpack 287.

Select 50 eligible queries per build by ascending SHA-256 of `embedding-direction-v1|<build>|<bundleId>`, for 150 total. Do not select on baseline rank, validation outcome, or recovery success. Save the selected query IDs, bundle IDs, candidate source IDs, and oracle source IDs in a sample manifest before inference. Record hashes of the input files. Keep labels in evaluation data only; never include them in model input.

## Three conditions

Use `qwen3-embedding:0.6b` for all three conditions, holding its digest, quantization, backend, batch size (12), truncation policy (off), and function code constant. Do not change the model size in this experiment.

A — Current direction. Source input is code only. Bundled input is:

```text
Instruct: Retrieve the original JavaScript source function corresponding to this bundled function, preserving its behavior despite minification and identifier renaming.
Query:<bundled code>
```

B — Reversed direction. Bundled input is code only. Source input is:

```text
Instruct: Retrieve the bundled JavaScript function corresponding to this source function, preserving its behavior despite minification and identifier renaming.
Query:<source code>
```

C — No instruction. Both inputs are code only.

For every condition, rank the same source candidates for each bundled function by descending cosine similarity. Break ties using the original source index, as in the recovery implementation. No validation calls, anchor promotion, graph expansion, or recovery reruns are needed. Do not supply external bindings or graph context to any condition.

## Execution

1. Freeze the sample manifest and model metadata.
2. Embed each distinct input text once. A and C share source-code vectors; B and C share bundled-code vectors. Use a separate experiment cache keyed by model digest and exact input text. Do not overwrite completed experiment outputs or change the active pipeline configuration.
3. Rank every selected query under A, B, and C. Store all candidate scores and ranks. Resolve the ground-truth rank only after ranking.
4. Report top-1 recall, top-3 recall, and mean reciprocal rank, pooled and per build. For each recall, use the number of correctly ranked queries divided by all 150 selected queries (50 per build). Report processing failures separately; do not silently drop failed cases or truncate code.
5. Report paired changes: correct-source rank improved, tied, or worsened; and top-three losses and gains relative to A. Inspect every B-versus-A top-three disagreement using the saved code.
6. Record embedding request wall time, tokens if available, unique text count, vector dimensions, and ranking time. Separate disk-cache hits, model loading, and inference. Compare cold application-cache costs from the distinct required inputs for each condition, counting shared inputs toward each condition's standalone cost. Run timing requests with the model resident and interleave formats; treat timings as descriptive because server caches and input lengths can differ. Similarity-score calculation time is not model embedding time.

## Interpretation

The primary endpoint is B minus A top-three recall, in percentage points. Top-one recall and reciprocal rank are secondary. Report paired uncertainty using a bootstrap grouped by ground-truth source ID, keeping repeated occurrences across builds together; 150 build occurrences are not necessarily 150 independent source functions. With this small sample, overlapping uncertainty is inconclusive rather than proof of equality.

B is promising if it produces a meaningful net gain in top-three hits without concentrating regressions in one build. Confirm a promising result on all eligible saved queries before changing the ranking default. If C matches the instructed conditions, prefer its simpler input after confirmation.

This is a conditional ranking experiment: it only covers saved neighborhoods containing the correct source and more than three candidates. The neighborhoods were produced by the earlier recovery run. Results cannot establish overall recovery rate, resolve missing candidates, prove semantic equivalence, or predict how new anchors would change later neighborhoods. This experiment also does not establish whether 4B is better than 0.6B.

## Result table

| Condition | Top-1 / 150 | Top-3 / 150 | MRR | Unique inputs | Embedding time |
|---|---:|---:|---:|---:|---:|
| A: instruction on bundle | 104 | 132 | 0.7918 | 551 | Shared requests; see report |
| B: instruction on source | 122 | 137 | 0.8664 | 551 | Shared requests; see report |
| C: code only | 115 | 136 | 0.8402 | 551 | Shared requests; see report |

Execution note: batches contained up to 12 inputs and interleaved the four text formats. All 1,102 unique strings were embedded in fresh application requests; shared strings were reused between conditions. Combined embedding request time was 27.77 seconds, excluding 1.08 seconds warm-up. Mixed-format request times cannot be separated into measured per-condition latency, so standalone per-condition cost was not estimated. This is a limitation of the timing comparison, not of the paired accuracy comparison.
