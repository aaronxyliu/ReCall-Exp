# ReCall Experiments and Paper

Paper title: **ReCall: Accurate and Scalable Function Recovery for Bundled JavaScript**.

This repository owns experiment drivers, protocols, saved outputs and model caches, frozen baselines, audits, and the manuscript. The sibling `../ReCall` owns reusable tool code; `../ReCall Dataset` owns dataset indexes, local source checkouts, and fixture inputs.

The [ReCall Dataset build progress table](../ReCall%20Dataset/README.md#frontend-repository-builds) tracks the 70 selected projects. Optional local checkouts belong under the dataset repository’s Git-ignored `../ReCall Dataset/builds/` directory.

## Single-repository ground truth

Use the [collection workflow](scripts/function-ground-truth/README.md) to turn an explicit production-library list and hosting README into captured JavaScript, source maps, and one-to-one function records. The entry point is `scripts/function-ground-truth/collect.mjs`; it has no dataset-wide sampling or Docker configuration.

## Paper

The editable source is `manuscript/main.tex`. Dataset preparation precedes the four RQs: performance, ablation, tradeoff, and practical use. The seven planned experiments are listed in the Roadmap below; the RQ4 practical-use protocol remains to be filled. Existing results and pending evaluations remain explicitly separated.

```sh
cd manuscript
tectonic --keep-logs --outdir build main.tex
```

The compiled output is `manuscript/build/main.pdf`. Consult `manuscript/README.md` before regenerating tables; historical generators can overwrite newer manuscript prose.

## Current 26-repository RQ1 run

The [RQ1 protocol](experiments/rq1/PROTOCOL.md) defines recovery, oracle scoring, timing, and live progress. The current 26-repository configuration uses Qwen 3.5 27B, AST-first validation, no library anchor gate, and [retained conflicting matches](experiments/rq1/MULTI-MATCH.md). Candidates are checked in rank order (AST, then Qwen), stopping at the first acceptance and skipping matched targets. Its output directory is `results/rq1-autodl-first-accept-26/`; earlier default/baseline runs remain separate. See the [AutoDL driver guide](experiments/rq1/AUTODL-DRIVER.md) for remote execution, preserved checkpoints/caches, and tmux operation. `scripts/rq1/report.py` generates the live summary on the execution host. Current scoring uses the [cohort-wide v2 oracle](../ReCall%20Dataset/bundling-dataset/GROUND-TRUTH-V2.md), including 654 FreeCodeCamp pairs and 82,836 pairs overall. The original input index stays frozen for checkpoint compatibility; `scripts/rq1/rescore-revision.mjs` independently updates evaluation labels without rerunning inference.

## Roadmap

The following experiments remain to be completed to answer the paper's RQs. Existing pilot results and oracle-assisted graph simulations provide preliminary evidence; they do not mark these full evaluations as complete. Record datasets, reference versions, build settings, and evaluation denominators for each experiment. Report recovery rate, assessed identity precision, wrong and unassessed mappings, and computational cost where applicable.

### RQ1: Performance

- [ ] **1. Different bundlers.** Evaluate ReCall on local repository builds produced by different bundlers and report results per bundler.
- [ ] **2. Different libraries and frameworks.** Evaluate ReCall across different local libraries and frameworks, recording exact versions and target scope, and report results per library/framework.
- [ ] **3. Function transformations and recovery rate.** Count split, combine (including inlining), and possible removal candidates using source-map relations. Manually validate the candidates, report confirmed transformations and unresolved cases, and examine their relationship with library recovery rate. Keep candidate counts distinct from validated transformation counts and state the denominators used for frequency and recovery.

### RQ2: Ablation

- [ ] **4. Neighborhood ranking.** Compare the neighborhood ranking algorithm with a baseline that directly embeds every function and ranks candidates across the full reference-function pool. Hold the embedding model, validator, acceptance rules, and evaluation inputs fixed, and compare recovery quality and computational cost.
- [ ] **5. Module graph building.** Compare recovery using local function relationships with recovery using the module-aware graph. Hold the initial anchors, ranking, validator, and other settings fixed to measure the graph's contribution to recovery and cost.

### RQ3: Tradeoff

- [ ] **6. POG feature-count robustness.** Vary the minimum number of own-body property-operation occurrences required for POG anchoring. Measure anchor coverage and precision, final recovery quality, and computational cost.
- [ ] **7. Validation model selection.** Compare validation models on validation correctness, including false acceptances and false rejections, and on latency and resource cost. Also measure the resulting end-to-end recovery quality under otherwise fixed settings.

### RQ4: Practical Use

To be filled.

## Reproduction boundaries

Run historical drivers from this repository root, not the three-project parent. Relative links at `scripts/`, `vendor/`, `notes/`, `datasets/`, and fixture/source locations preserve previous command layouts. The tool has its own dependencies and lockfile; the original experiment package and installed dependencies remain here.

Frozen result JSON, model responses, copied implementations, source maps, and baseline checksums are not rewritten. The former top-level absolute path is retained as a compatibility directory of links into this repository after the parent rename, because historical metadata and some third-party build artifacts contain that path. New work should use the new paths.

The `results/`, `baselines/`, and `archive/` trees remain on disk and are Git-ignored to avoid accidentally committing multi-gigabyte outputs, caches, and copied dependencies. They are not deleted or uploaded. Track selected new evidence deliberately under a reproducible artifact policy. Two source checkouts retain their original Git histories under the dataset project.

## Migration and preserved documentation

Historical migration snapshots and one-off manuscript revision checks are retained locally under the ignored `archive/2026-11-07-tracked-intermediates/` directory and in Git history. Track reusable scripts, protocols, and evidence; keep temporary checks, build products, and local run outputs ignored.

No models, application builds, or recovery experiments are run by this reorganization.
