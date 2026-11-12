# Retain conflicting accepted matches

User-requested policy: `recovery.conflictPolicy=retain`, with AST-first checking and no library gate. Default API behavior remains `discard` for reproducibility; this experiment explicitly selects retain.

- Check each candidate in rank order: AST first, then Qwen if AST fails. Stop at the first acceptance.
- Keep distinct accepted pairs even when a source matches several targets in a chunk or a target matches several sources. Duplicate pair events do not create duplicate results.
- Skip accepted targets, including anchors. Preserve accepted source conflicts across different targets. Reuse previously validated pair verdicts.
- Ground truth is read only by the scorer. A GT pair is recovered once if its true source is anywhere in the target's retained set.

## Metrics

`recoveryRate` counts covered GT pairs once. `anyMatchTargetPrecision` counts an assessed bundled target as true positive if any retained source is a GT identity. `recoveryPrecision` remains pair-level: each extra wrong source identity is a false pair. Targets absent from the oracle remain unassessed. AST/Qwen decision and committed-pair precision remain separate.

`multipleMatches` records bundled functions with multiple sources, distinct source functions with multiple targets, and source/chunk groups with multiple targets. It includes the identities of each alternative set. The within-chunk count separates allocation conflicts from normal duplication across chunks. Live `recovered` counts distinct bundled functions; `acceptedPairs` counts retained relationships.

## Run

```sh
python3 scripts/rq1/run.py --endpoint http://127.0.0.1:11435 \
  --ast-first --ungated --retain-conflicts \
  --priority-subject webpack/freeCodeCamp--freeCodeCamp \
  --output results/rq1-autodl-ast-multimatch-26
```

The preceding AST/ungated run stopped following an AutoDL connection failure, not successful cohort completion. Its checkpoints and caches remain unchanged. The new run reuses its exact-request FreeCodeCamp model cache only; cache keys include endpoint, model digest and complete payload. No prior recovered relationships or GT-informed proposals are imported. Timing measures this execution with a warm imported cache, not a fresh cold run; cache import provenance is in the output root.

The runner waits when the model endpoint is unavailable and retries transport-failed subjects using their checkpoints/caches. Model transport exceptions abort a subject attempt rather than being treated as negative judgments. All results use the frozen canonical GT; FreeCodeCamp's v2 preview can be scored separately.

Regression coverage: retained same-source/different-target proposals, first-acceptance stopping and skipping matched targets, unique-pair storage, budget resume, termination at fixed point, and any-correct evaluation with extra wrong-pair penalties. No GT labels enter candidate generation or validation.
