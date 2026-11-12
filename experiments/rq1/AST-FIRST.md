# AST-first validation without library gating

User-requested experimental configuration, 2026-11-07. The original baseline stopped after eight completed subjects; Excalidraw's checkpoint/caches remain saved in `results/rq1-autodl-4090-26`.

Run from ReCall Exp:

```sh
python3 scripts/rq1/run.py --endpoint http://127.0.0.1:11435 \
  --ast-first --ungated --priority-subject webpack/freeCodeCamp--freeCodeCamp \
  --output results/rq1-autodl-ast-ungated-26
```

All 26 repositories rerun under one configuration; FreeCodeCamp comes first to revisit its excluded libraries. `recovery.libraryGate=false` removes the three-anchor admission restriction. It does not fabricate seeds for libraries with no anchors. Detection diagnostics still report the threshold result; `libraryGate.enabled` and `effectiveAllowedLibraries` distinguish actual admission.

`models.astFirst=true` compares isolated minified ASTs before Qwen. Acorn and eslint-scope preserve lexical scope, literals, operators, noncomputed property names, and identifier reuse. Local and external identifiers are consistently renamed in separate namespaces. External bindings are deliberately NOT verified. Root names/formatting are ignored; dynamic scope or unsupported input is inconclusive. A mismatch falls through to the unchanged Qwen request. AST accepts still undergo allocation/conflict checks. This is a heuristic match, not a semantic-equivalence proof.

## Separate metrics

Checks record `validator: ast` or `validator: model`; committed matches retain that provenance. Model stats contain `astChecks`, `astAccepted`, and `astMs`, separately from executed HTTP requests/cache hits. AST nonmatches are not negative decisions.

Per-repository and per-library evaluation fields:

- `astValidation.acceptancePrecision`: correct / assessed AST accepts.
- `modelValidation.acceptancePrecision`: correct / assessed Qwen accepts.
- `modelValidation.accuracy`: correct accept/reject decisions / assessed Qwen decisions.
- `uniqueAstValidation` / `uniqueModelValidation`: deduplicate source-target check events.
- `acceptanceChannels.ast` / `.model`: committed-match precision after conflict resolution.
- `allAstAcceptances` / `allModelChecks`: include unassessed targets in activity counts, but not precision denominators.

`validation` now aliases model-only metrics; `combinedDecisions` is explicitly combined. The live report shows AST and Qwen acceptance precision separately. HTTP timings exclude AST accepts and cache hits. The five audited simple rejections pass the AST check; that is a regression check, not a precision estimate.

The canonical ground truth stays frozen; FreeCodeCamp v2 remains a separate post-hoc preview. No response caches are imported from the baseline. Results are a revised-policy experiment, not default-setting results.
