# TODO: remaining function-validation cases

Recorded: 20 October 2026. **All nine cases remain open for later work.** This document records follow-ups only; creating it does not resume inference or recovery.

## Saved experiment state

The shorter variable-mapping prompt, with thinking off, accepted **105/114 source-linked pairs (92.11%)** and rejected the nine cases below. This is acceptance on selected ground-truth source correspondences, not full-population accuracy or a false-positive estimate. Full mappings, prompts, decisions, and explanations are saved in the linked case files.

Controlled invocation checks agreed on **448 scenarios** under explicitly aligned external bindings and mocked helpers. They are not universal equivalence proofs. A separate Chrome test found a real `document.all` counterexample for FN103 that the model did not identify. Do not classify all nine as proven semantic false negatives.

## Case checklist

- [ ] **[FN008](results/jquery-4.0.0/minified-no-tree-shaking/recovery-bottlenecks/false-negatives/short-variable-mapping-replay/cases/FN008.md): Variable identity and Boolean interpretation.** The model calls `!0` false and treats renaming as evidence of a difference. Its variable mapping is otherwise correct. **Follow-up:** Review the Boolean error and require the explanation to agree with the recorded mapping.

- [ ] **[FN011](results/jquery-4.0.0/minified-no-tree-shaking/recovery-bottlenecks/false-negatives/short-variable-mapping-replay/cases/FN011.md): Assignment direction.** The model misreads `n = a`. The structural correspondence is `state → n`, `stateString → a`; neither identifier is a literal. **Follow-up:** Review assignment mapping and its consistency with the verdict.

- [ ] **[FN038](results/jquery-4.0.0/minified-no-tree-shaking/recovery-bottlenecks/false-negatives/short-variable-mapping-replay/cases/FN038.md): Collection versus loop counter.** Source `self[i]` becomes bundled `i[t]`; the model confuses collection `i` with counter `t` and invents a missing call argument. **Follow-up:** Check argument positions and use the recorded mapping consistently.

- [ ] **[FN061](results/jquery-4.0.0/minified-no-tree-shaking/recovery-bottlenecks/false-negatives/short-variable-mapping-replay/cases/FN061.md): Hook fallback and nested variables.** The short-circuit expression preserves fallback assignment when hooks or `set` are missing. The output also misidentifies `Array` and a nested parameter. **Follow-up:** Review branch interpretation and correct the variable mapping independently of the verdict.

- [ ] **[FN082](results/jquery-4.0.0/minified-no-tree-shaking/recovery-bottlenecks/false-negatives/short-variable-mapping-replay/cases/FN082.md): Collection versus loop counter.** The explanation contradicts its own mapping: source `i → t`, `self → i`, so bundled `i[t]` is the corresponding access. **Follow-up:** Review this together with FN038; check consistency between mappings and explanation.

- [ ] **[FN087](results/jquery-4.0.0/minified-no-tree-shaking/recovery-bottlenecks/false-negatives/short-variable-mapping-replay/cases/FN087.md): Invented negation.** The model inserts a negation absent from the bundled code. Input `"false"` returns Boolean false in both versions. It also maps an eliminated function name to a parameter. **Follow-up:** Review operator parsing, function-name mappings, and the `JSON` mapping.

- [ ] **[FN103](results/jquery-4.0.0/minified-no-tree-shaking/recovery-bottlenecks/false-negatives/short-variable-mapping-replay/cases/FN103.md): Hook return claim and real browser edge case.** The model incorrectly claims the setter returns the hook result. Independently, the getter rewrite `ret == null ? "" : ret` → `ret ?? ""` differs for `document.all` in Chrome. **Follow-up:** Decide the intended input/environment scope and how to report this real difference separately from the incorrect model explanation. Preserve source-origin labels separately from semantic labels.

- [ ] **[FN104](results/jquery-4.0.0/minified-no-tree-shaking/recovery-bottlenecks/false-negatives/short-variable-mapping-replay/cases/FN104.md): Element guard and hook fallback.** The guard remains as `1 === this.nodeType && (...)`; the fallback assignment is not inverted. **Follow-up:** Review short-circuit control flow and distinguish skipped expressions from explicit returns.

- [ ] **[FN110](results/jquery-4.0.0/minified-no-tree-shaking/recovery-bottlenecks/false-negatives/short-variable-mapping-replay/cases/FN110.md): Comma expressions and XHR branches.** MIME override and header insertion still execute in the loop initializer. Both versions intentionally skip `X-Requested-With` for cross-domain requests. **Follow-up:** Review initializer evaluation order and the XHR branch traces.

## Follow-up boundaries

- [ ] Define the semantic-equivalence input/environment scope for FN103 before revising semantic labels or reporting a semantic error rate.
- [ ] Keep variable-mapping correctness, semantic judgment, and exact source identity separate in evaluation. A complete mapping object is not necessarily correct.
- [ ] If the prompt or validator is changed, preserve these results and evaluate both positive and negative pairs before claiming improved overall performance. No further run has been started by this TODO task.

## Evidence and reproduction

- [Detailed review of all nine cases](results/jquery-4.0.0/minified-no-tree-shaking/recovery-bottlenecks/false-negatives/short-variable-mapping-replay/REMAINING_REJECTIONS.md)
- [All 114 case outputs](results/jquery-4.0.0/minified-no-tree-shaking/recovery-bottlenecks/false-negatives/short-variable-mapping-replay/REPORT.md)
- [Validation-rate comparison](results/jquery-4.0.0/minified-no-tree-shaking/recovery-bottlenecks/false-negatives/short-variable-mapping-replay/ANALYSIS.md)
- [Controlled invocation checks](results/jquery-4.0.0/minified-no-tree-shaking/recovery-bottlenecks/false-negatives/short-variable-mapping-replay/remaining-rejection-checks.json)
- [Actual-browser FN103 counterexample](results/jquery-4.0.0/minified-no-tree-shaking/recovery-bottlenecks/false-negatives/short-variable-mapping-replay/fn103-browser-edge.json)
- [Machine-readable case review](results/jquery-4.0.0/minified-no-tree-shaking/recovery-bottlenecks/false-negatives/short-variable-mapping-replay/remaining-rejection-review.json)

Offline checks can be reproduced from the repository root:

```sh
node scripts/jquery/check-remaining-fn-rejections.mjs
node scripts/jquery/check-fn103-browser-edge.mjs
python3 scripts/jquery/review-remaining-fn-rejections.py
```

These commands execute saved-code tests and regenerate the review; they do not invoke the validation model. The browser check requires local Chrome.
