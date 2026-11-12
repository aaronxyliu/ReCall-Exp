# Local RQ1 on the final qualified dataset

Run from the workspace root with Node 24+, Python 3, installed ReCall dependencies, and the local Ollama-compatible endpoint serving qwen3-embedding:0.6b and qwen3.5:27b:

```sh
export RECALL_REFERENCES_ROOT='/absolute/path/to/packages-by-subject'
# Optional: a seeded exact-response cache; report timing as warm-cache.
export RECALL_MODEL_CACHE='/absolute/path/to/model-cache'
python3 -u 'ReCall Exp/scripts/rq1-local/run.py' 'ReCall Exp/results/NEW-RUN'
```

The output directory must be new. Subjects run sequentially in canonical index order. Each inference process receives only the dataset exporter's reviewed JavaScript and raw reference manifests. The exported known-reference configuration disables the library gate; all other settings use the current ReCall defaults, recorded in each run's resolved-config.json. In particular, AST search precedes ranking, topK is three, and the default conflict policy is discard. This is fixed-reference function recovery, not blind library identification.

The parent process invokes the dataset's scorer separately on persisted checkpoints and final recovery outputs. Every released oracle pair remains in the denominator, including missing inventory entries. Precision is correct pairs divided by predicted pairs within the partial oracle; predictions outside it are unassessed. Per-subject score.json retains missing-source/target counts and unassessed predictions. Checkpoint scores may lag inference by about two minutes; progress.json and PROGRESS.md refresh every 30 seconds. progress-history.jsonl preserves aggregate observations. An initial zero means no scored checkpoint yet, not measured failure.

Elapsed time includes export, preparation, inference, and scoring. Estimated completion is unavailable before the first completed repository, then uses the mean elapsed time of completed repositories multiplied by the unfinished count. This is a low-confidence estimate because repository sizes and model workloads differ. All displayed dates use Asia/Shanghai (UTC+08:00).

Only fixed-point workers count as completed. Failures and budget/round limits remain explicit and do not count as completion. Failed subjects do not stop the rest of the queue. Each run retains implementation digest, effective configuration, model digests, inventories, checkpoints, and worker logs. The parent records tool/dataset commits and dataset-index hash. The runner does not overwrite earlier experiments or automatically retry failures. ReCall's normal resume API can continue compatible per-subject checkpoints after a failure has been diagnosed.

The current index contains 35 subjects and 58,128 pairs (2026-11-10). The stopped November 9 run used an older 38-subject index and captured source snapshots; it is historical evidence. New runs require independently obtained packages matching collection provenance, grouped by subject. `prepare-references.mjs OUTPUT` obtains those packages using the source-only qualification records and checks recorded npm archive hashes/integrity or the pinned repository commit.

`RECALL_MODEL_CACHE` selects a shared response cache without importing checkpoints or accepted matches. Exact lookup retains endpoint, model digest, complete request, prompt, and generation options. Changes to embedding batch composition can prevent cache hits. Use a fresh output directory after implementation, inputs, or recovery settings change.

When package preparation runs concurrently, set `RECALL_REFERENCE_RECEIPTS` to its receipts.json. Each subject waits for all selected library receipts before exporting inputs, with a one-hour limit; a timeout is recorded as failure and the queue continues.

## Fresh experiment with all ReCall defaults

```sh
export RECALL_REFERENCES_ROOT='/absolute/path/to/reference-preparation-output/subjects'
python3 -u 'ReCall Exp/scripts/rq1-local/run-defaults.py' 'ReCall Exp/results/NEW-DEFAULT-RUN'
```

This driver prepares references sequentially by subject, uses `run-default-one.mjs` with `config: {}`, and imports no historical model responses or recovery state. It ignores shared-cache settings. ReCall creates its normal fresh per-subject cache. The library gate and automatic bundler detection use their defaults. Scoring remains a separate process; failures remain explicit and the queue attempts every released subject.
