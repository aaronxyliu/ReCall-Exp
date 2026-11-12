# Running the 26-repository experiment on AutoDL

The `rq1-autodl-ast-multimatch-26` run is migrated with its existing checkpoints,
completed evaluations, prepared inputs, and exact-request model caches. All 26 repositories have their
selected-library inputs prepared offline; preparation costs are saved in
`migration-preparation.json`. Source maps remain in the local dataset because the
remote recovery/scoring stages need only the prepared references, captured JS,
and frozen mapping records. The local
copy remains a frozen backup. Published runtime assets and ground-truth records
are downloaded directly from GitHub commit
`969e800678ad786af96053504d89b15fb1c4f0ae` and checked against their SHA-256
hashes. No new files are published to GitHub. Derived inventories, module maps,
and graphs are rebuilt remotely from the same inputs; all original checkpoints,
model caches, and completed evaluations are preserved. The original analysis
artifacts remain available locally, with their hashes listed under
`omittedRegenerableFiles` in the remote migration manifest. The original implementation, AST-first setting,
ungated libraries, top-five candidates, and retain-conflicts policy are unchanged.

## Resume compatibility

- Use Node.js **v24.15.0**, matching the original run.
- Keep the workspace at `/Users/aaronxyliu/GitHub/ReCall Research` on the Linux host.
  This deliberate compatibility path preserves the absolute paths in manifests,
  configurations, and checkpoints. Do not rewrite their hashes to force a resume.
- Keep `http://127.0.0.1:11435` as the model endpoint. On AutoDL,
  `scripts/rq1/autodl/model-relay.py` forwards loopback TCP to Ollama on port 11434.
  This preserves request-cache identities without requiring an SSH tunnel.
- Verify the model digests against the migration record. A model replacement
  must not reuse responses under the old model identity.
- `migration-manifest.json` records the SHA-256 of each transferred state file.
  Process locks are omitted only after stopping the local driver and worker.
- An interrupted, unfinished round replays from its last checkpoint. Successful
  inference responses remain cached; completed repository evaluations are skipped.

## Operate

Connect to the instance, then attach with `tmux attach -t recall-rq1`.
Detach using **Ctrl-b, then d**. Closing SSH does not stop tmux or the experiment.
The AutoDL instance itself must stay running.

The `driver` window runs `scripts/rq1/autodl/run-cohort.sh`; the `model-relay`
window maintains the local endpoint. Ollama is started independently by
`/root/autodl-tmp/recall-inference/start.sh`.

Results are under:
`/Users/aaronxyliu/GitHub/ReCall Research/ReCall Exp/results/rq1-autodl-ast-multimatch-26/`.

- `REPORT.md` and `report.json`: refreshed every 30 seconds.
- `remote-dispatcher.log`: cohort scheduling and failures.
- `remote-heartbeat.txt`: report-loop liveness; this alone is not proof of inference progress.
- `<bundler>/<repository>/live.json`: active stage and validation counter.
- `<bundler>/<repository>/run/checkpoint.json`: durable recovery state.
- `migration-manifest.json`: frozen transfer provenance.

Compare changing `live.json` counters and model-timing entries before and after
an actual SSH disconnect to verify independent execution. Timing across migration
is warm-cache and spans two CPU hosts; retain the raw event/model-timing logs and
report this explicitly rather than presenting it as one cold uninterrupted run.

## Verified migration (2026-11-07)

The remote driver started at 20:49 China Standard Time in tmux session
`recall-rq1`. All 26 repositories are queued; the previously completed evaluation
is preserved. FreeCodeCamp resumed from its checkpoint after rebuilding the
omitted analysis artifacts without changing the implementation or input digests.

Verification covered 7,257 saved-state/input files, all 1,852 model-cache entries,
all 495 captured JavaScript assets, matching model digests, and six passing
regression tests on Linux. GitHub supplied 369 runtime assets; the remaining 126
were transferred directly after GitHub connections timed out. All files were
checked against the same frozen hashes. No source maps, repository clones,
manuscript, or earlier run directories were uploaded.

All local AutoDL SSH connections were closed for the disconnect test. The same
remote dispatcher PID remained alive; between the observations at 20:50:34 and
20:52:22, FreeCodeCamp's validation counter increased from 642 to 744 and actual
model requests from 32 to 111. The receipt is saved locally as
`results/rq1-autodl-ast-multimatch-26/autodl-migration-verification.json` and remotely
as `disconnect-verification.json` in that run directory.

```sh
ssh -p 19775 root@connect.nmb1.seetacloud.com
# On AutoDL:
tmux attach -t recall-rq1
```

The `progress` window tails the dispatcher and FreeCodeCamp logs. The remote
`REPORT.md` is authoritative and refreshes every 30 seconds. Local reports are
frozen snapshots until explicitly synchronized. Your Mac can disconnect or shut
down; the AutoDL instance must remain running.

## Cohort-wide revised evaluation

Current reports use `reciprocal-body-mapped-v2`: 82,836 ground-truth pairs across
26 repositories, including 654 for FreeCodeCamp. The original input index and
`evaluation.json` files remain frozen for provenance and checkpoint compatibility.
The independent `oracle-v2` tmux window runs `scripts/rq1/rescore-revision.mjs`,
writing `evaluation-v2.json` for completed runs and explicitly partial
`checkpoint-evaluation-v2.json` files for saved recovery checkpoints. It never
passes oracle labels to recovery, changes a candidate, or invokes a model.

`evaluation-revision.json` selects the revised scores in `REPORT.md`/`report.json`;
`revision-scoring-status.json` records scoring progress and any failures. Every
revised record is hash-checked, and its original-record hash and selected library
population must match the frozen recovery input provenance. The scorer restores
omitted inventories for previously completed subjects from their original input
manifests when necessary. Collector warnings and per-repository counts are in
`ReCall Dataset/bundling-dataset/GROUND-TRUTH-V2.md`.

## First-acceptance restart (2026-11-07)

The active run is `results/rq1-autodl-first-accept-26/`. It checks each ranked candidate with AST first and Qwen only on AST failure, stopping at the first acceptance. Already matched targets, including anchors, are skipped. Source reuse across different targets remains allowed. All 26 prepared input directories and raw model caches are shared with the previous run; incompatible checkpoints and decision traces are not imported. Timing is therefore warm-cache timing. The old run remains preserved. Live events separately expose AST checks/acceptances, fresh Qwen requests, and Qwen cache hits. The v2 scorer runs independently in tmux.

## Top-three variant (2026-11-07)

The 0.3 threshold was rejected by the user and is disabled. Top-three preparation uses `results/rq1-autodl-first-accept-top3-26/`, with `topK: 3`, `minSimilarity: -1`, AST then Qwen, stopping at first acceptance. All 88 tests pass. Remote isolated scripts are in `scripts/rq1-top3/`; launcher `bash scripts/rq1-top3/run-cohort.sh` started after explicit stop approval at approximately 22:42 China time. Top-five baseline worker and dispatcher stopped; checkpoint and raw caches preserved. Baseline stopped in round 8, with round-7 checkpoint: 917 accepted pairs, 530/654 correct, assessed precision 530/556. Stop receipt: `results/rq1-autodl-first-accept-26/top5-stop-receipt.json`. Prepared variant shares only input directories and raw model caches, not old recovery decisions.

## Incremental parsing and source-resolution upgrade (2026-11-08)

The active AutoDL output is `results/rq1-autodl-top3-fixed-26/`. The pre-fix `rq1-autodl-first-accept-top3-26` baseline is archived in place. LibreChat finished naturally before the switch; 21 completed baseline repositories contributed 13,334 accepted relationships, all verified present in the continuation checkpoints. These are accepted relationships, not all oracle-confirmed correct pairs. Nineteen raw-response cache directories are shared; two zero-anchor subjects had no prior inference cache.

The isolated remote runtime is `/Users/aaronxyliu/GitHub/ReCall Research/ReCall Fixed Runtime`. Its continuation scripts are `scripts/rq1-fixed/`. The fixes preserve supplied unit bytes, function IDs/spans, anchor features, model settings, top-three first acceptance, radius one, ungated libraries, and source reuse. No similarity threshold is applied (`minSimilarity: -1`). Normal resume checks remain strict; explicit migration verifies old/new identities, rebuilds static artifacts, preserves accepted matches, clears processed neighborhood states, and makes historical pair verdicts non-reusable. Exact raw model responses remain reusable. Original recovery traces are retained in `prior-recovery.json`; continuation queries carry phase labels.

LibreChat resumed at round 12 with its prior 1,368 accepted matches. Initial verification at 09:18 China time confirmed active recovery, raw-cache hits, fresh validations, and no scorer failures. This is a mixed-phase incremental run, not a fresh evaluation of the fixed algorithm. Previously accepted matches are not revalidated.

`timing.json` accumulates baseline, external static-upgrade, and new recovery costs. `prior-phase-timing.json`, `static-upgrade-timing.json`, and `phase-timing.json` separate those phases. Timing remains warm-cache timing. Remote `results/rq1-active-run.json` identifies the active root; local results are snapshots only. Verification is in `results/rq1-autodl-top3-fixed-26/upgrade-verification.json`.

## First AST hit with immediate promotion (2026-11-08)

Active remote output: `results/rq1-autodl-ast-first-hit-top3-26/`, using the isolated
`ReCall AST First Hit Runtime`. The baseline remains
`results/rq1-autodl-top3-fixed-26/`: 23 completed repositories plus saved partial
checkpoints, preserving 22,341 checkpointed accepted pairs across 25 subjects.
Only the new AST-order continuation is replayed; reference inventories, graphs,
initial POG anchors, model settings and exact response caches are preserved.

For each unmatched target, scan eligible neighborhood sources in inventory order.
On the first AST match, stop scanning, promote it immediately, and make it available
as an anchor to later targets in the same pass. No embedding tie-breaker or semantic
validation runs for that target. Only if every AST comparison fails do embeddings
rank candidates and the ordinary top-three semantic path run. No similarity cutoff.
Initial POG anchors remain separate from AST-discovered expansion anchors in reports.

The superseded `rq1-autodl-ast-before-top3-26` phase used embedding tie-breaking among
multiple AST matches. Its output and driver sources are archived; its accepted
expansion choices are not used as seeds for the corrected first-hit measurement.
Its exact model-response caches are still shared through the original cache paths.

Launch: `bash scripts/rq1-ast-before/run-first-hit.sh`. Independent revised-oracle
scoring uses `scripts/rq1-ast-before/watch-score.mjs`; `before-after.json` compares
completed continuation passes with the same baseline repositories. AST-only query
selection is recorded separately from embedding top-three observations. The
graph-syntax adapters were initially excluded from this controlled comparison;
the subsequent deployment is recorded below.

The checkpoint writer/hash now serializes in bounded chunks; large reads stream.
A 540,021,614-byte round trip exceeding Node's single-string limit passed with
identical checksums. In-round checkpoints retain pending proposals approximately
every two minutes. First-hit logic, same-pass propagation, cache compatibility and
checkpoint resume passed 114 local regressions and 8 targeted Linux tests.

## Whole-file graph syntax continuation (2026-11-08)

Active remote output: `results/rq1-autodl-graph-syntax-first-hit-26/`, in tmux
`recall-graph-syntax`, using the isolated `ReCall Graph Syntax Runtime`.
At 16:22 China time the previous first-hit dispatcher was paused, its drawdb
worker checkpointed and stopped, and the previous scorer stopped. The baseline
is `rq1-autodl-ast-first-hit-top3-26` (23 completed repositories plus drawdb's
saved partial state); subjects without first-hit checkpoints fall back to the
original `rq1-autodl-top3-fixed-26` prepared inputs and saved state.

The new runtime rebuilds module maps and relationship graphs with whole-file
TypeScript and Svelte script adapters. Supplied function inventories, initial
anchors, accepted identities, model settings and exact-response caches are
preserved. Checkpointed validated positive proposals are committed during
migration; unmatched targets are reconsidered against the new graphs. The first
AST hit still promotes immediately without embedding or Qwen. Otherwise use
embedding top-three and semantic validation, with no similarity threshold.
No repository-specific recovery logic is introduced.

Launch: `bash scripts/rq1-graph-syntax/run-cohort.sh`. Independent scoring uses
`scripts/rq1-graph-syntax/watch-score.mjs`; `before-after.json` compares completed
passes against completed first-hit baseline scores. `graph-comparison.json`
records graph changes and diagnostics per subject, and `continuation.json`
records preserved accepted counts and old/new graph digests. This is a warm-cache
incremental experiment, not a fresh end-to-end run; earlier accepted identities
are not revalidated.

The first three continuation passes completed with no new correct pairs:
angular-calendar 23/37, immich 449/760, ngx-charts 590/1,114. Their reported source
context parse errors fell from 2, 43 and 95 respectively to zero. Source edge
counts were 225→225, 3,107→3,108 and 2,427→2,427. Parsing success does not imply
complete relationship recovery: unresolved imports remain, and Svelte templates
are explicitly not modeled. All 116 local regressions and 19 targeted Linux
deployment tests passed. Local result files remain timestamped snapshots.

## Active cohort exclusions (2026-11-08)

At the user's request, ng-bootstrap, ngx-datatable and bundlejs were removed
from both active dataset indexes. The cohort now has 23 repositories and 39,374
revised GT pairs. `ReCall Dataset/bundling-dataset/experiment-exclusions.json`
records the exclusions; the former indexes are retained under `cohort-history/`.
Historical subject artifacts are preserved but are outside the active database,
queue and aggregate reports. The `-26` directory suffix remains a historical
run identifier, not the active subject count.

The graph-syntax dispatcher checks active index membership before each dispatch,
and reports filter against the same index. The previous dispatcher was paused
without signaling the active drawdb worker (PID 55632). The `cohort-driver` tmux
window runs a one-time successor that waits for that worker to exit, retires
the paused dispatcher and resumes the updated 23-subject scheduler. Completed
evaluations are reused. The `cohort-scoring` window scores the new cohort.
At switch verification, 21/23 subjects were complete, drawdb was active and
vue-element-admin was queued. The completed-cohort aggregate was
18,235/28,361 (64.30%); the population change is not an algorithm improvement.

## Wide-AST scorer repair (2026-11-08)

Drawdb checkpoint scoring failed in `evaluate.mjs` method-span alignment:
`stack.push(...v)` exceeded the JavaScript call argument limit on a wide AST
array. Iteratively pushing children in the same order fixes the traversal.
Ordinary method alignment and a 150,000-statement program both pass locally and
on Linux. The saved drawdb checkpoint scored successfully at 18:29 China time:
4,331/5,486 correct (78.95%), with 654 incorrect assessed matches; this is partial.

The recovery worker was not interrupted. The `fixed-scoring` tmux window replaces
the old periodic scorer. The successor dispatcher uses `rescore-one.mjs` when
completed recovery exists without an evaluation, so a scoring failure does not
repeat recovery or model requests. The active worker had imported the old scorer
before deployment; this path handles its eventual final scoring if needed.
Remote `scorer-stack-fix.json` records the deployment verification.

Drawdb finished recovery naturally during repair. Its completed recovery was
rescored without rerunning models: the final result is also 4,331/5,486 (78.95%).
The `repaired-scoring` window now runs the fixed scorer and reconciles completed
evaluations with dispatcher progress, clearing prior scoring-only failures.
Vue-element-admin continues recovery. The new `rescore-one.mjs` fallback remains
available for future completed recoveries lacking evaluation output.

## Return from AutoDL to this Mac (2026-11-08)

The complete remote workspace snapshot is under
`results/autodl-return-2026-11-08/`. It includes the compressed base archive,
the final delta after retiring historical monitors, SHA-256 manifests, and the
extracted `remote-workspace/`. No model weights are included. The final active
cohort has 23 completed repositories; the three excluded repositories remain
historical records only.

Result directories are restored at their original absolute paths under
`/Users/aaronxyliu/GitHub/ReCall Research/ReCall Exp/results/`, including all
earlier phases used by input, inventory and model-response-cache symlinks.
Previous local copies are retained in the snapshot's `local-before-import/`.
Existing local source repositories are preserved. Isolated AutoDL runtime
snapshots are restored beside `ReCall`; dependency links formerly pointing to
the remote `ReCall/node_modules` use the frozen `ReCall AutoDL Base Runtime`
instead. This preserves the remote code/dependency versions independently of
the current working source tree. The archive retains the original links.

`verification/import-verification.json` records file verification and restoration;
`verification/local-readiness.json` records Node/runtime compatibility, final evaluations and
GT hash checks. `verify-local.mjs` reproduces the latter check. Node v24.15.0 is
installed on this Mac. To inspect the restored frozen runtime:

```sh
cd '/Users/aaronxyliu/GitHub/ReCall Research/ReCall Exp'
export RECALL_RUNTIME_ROOT='/Users/aaronxyliu/GitHub/ReCall Research/ReCall Graph Syntax Runtime'
node results/autodl-return-2026-11-08/verify-local.mjs
node --test scripts/rq1-graph-syntax/evaluate.test.mjs
```

AutoDL used Ollama 0.40.6, the same local client version. Model metadata is
preserved in `provenance/model-tags.json`; current local metadata is in
`provenance/local-model-tags.json`. The embedding model matches, but the local
`qwen3.5:27b` digest differs from AutoDL's validator. Weights were deliberately
excluded at the user's request. A future local experiment must record this
model change and use a separate output directory. Existing cache keys include
the model digest; incompatible responses must not be relabeled or forced into
a resume. The original endpoint was `http://127.0.0.1:11435`; the supplied
`scripts/rq1/autodl/model-relay.py` can forward that port to local Ollama's
`127.0.0.1:11434` when running a subsequent experiment. No new experiment was
launched as part of the return transfer.

Return verification passed: 102,671 regular files (10,097,661,501 bytes), 902
symbolic links, 91,571 cached model-response files, all 23 final evaluations and
GT hashes, matching runtime implementation digest, and 21 targeted Mac tests.
No installed dependency/input links are broken. `verification/shutdown-readiness.json`
records that AutoDL is safe to shut down; the instance itself was not shut down.

The organized archive's `README.md` is the local entry point, with `RESULTS.md`
for final repository scores and `check-local.py` for offline verification
(`--full` rechecks every archived file). Runtime payloads now live under
`results/autodl-return-2026-11-08/runtimes/`; the original workspace-root runtime
paths are compatibility symlinks. All payloads are Git-ignored under `results/`.
Generated `ground-truth-v2/`, cohort-history payloads and the imported dataset
verification receipt are also ignored in the dataset repository. Git inspection
confirmed no transferred result/runtime/generated-GT payloads are tracked.
