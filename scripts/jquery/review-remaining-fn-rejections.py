"""Write code-reviewed findings for the nine remaining rejections; no inference."""
import json
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[2]
P=ROOT/'results/jquery-4.0.0/minified-no-tree-shaking/recovery-bottlenecks/false-negatives/short-variable-mapping-replay'
records=[r for r in json.loads((P/'results.json').read_text())['records'] if r['decision'] is False]
notes={
'FN008':{'reason':'Confuses variable renaming with identity changes and calls !0 false.','review':'The supplied mapping already correctly identifies source i -> t (loop counter), self -> o (collection), and jQuery -> i. !0 is true. A hypothetical external-identity mismatch is not demonstrated.','checks':9,'status':'Explanation contradicted by code; ordinary controlled inputs agree.'},
'FN011':{'reason':'Reads assignment n=a backwards and calls n a literal.','review':'n=a assigns the value of a to n. The structural correspondence is state -> n and stateString -> a; the model instead maps state -> a and stateString -> null. Neither n nor a is a literal.','checks':4,'status':'Incorrect assignment mapping; aligned-state tests agree.'},
'FN038':{'reason':'Confuses the collection i with the source loop variable i and invents a missing call argument.','review':'The bundle loop counter is t, and i is the collection: source self[i] becomes bundled i[t]. The call T.contains(i[t],this) has both arguments in the same positions as source jQuery.contains(self[i],this). The explanation contradicts its own otherwise correct variable mapping.','checks':9,'status':'Incorrect scope and argument interpretation; controlled tests agree.'},
'FN061':{'reason':'Claims the short-circuit hook condition fails when hooks lack set.','review':'The expression (hooks && "set" in hooks && hooks.set(...) !== undefined) || (this.value = val) executes the fallback if hooks are absent, set is absent, or set returns undefined, matching the source condition. The mapping also incorrectly gives Array -> "null" and the nested value parameter -> t.','checks':98,'status':'Control-flow misunderstanding and secondary mapping errors; tested hook branches agree.'},
'FN082':{'reason':'Again treats bundled i as the loop counter rather than the collection.','review':'The model mapping says source i -> t and self -> i. Therefore i[t] is the correct mapped collection access. The explanation ignores its own mapping.','checks':9,'status':'Self-inconsistent mapping interpretation; controlled tests agree.'},
'FN087':{'reason':'Introduces an extra negation that is absent from the bundle.','review':'The actual condition is "false" !== e, not !("false" !== e). For input "false", the leading comparison is false and the && condition is false, so the entire return expression is Boolean false. The function-name mapping getData -> e also confuses an eliminated name with a parameter; JSON -> null overlooks JSON.parse in the bundle.','checks':13,'status':'Operator misreading; actual functions agree on tested scalar and JSON inputs.'},
'FN103':{'reason':'Claims the bundle returns hooks.set(...) rather than following the source fallback behavior.','review':'The hook call is inside the each callback, whose return value is discarded; the outer setter returns this.each(...) in both versions. Controlled hook tests refute the stated reason. Independently, a real browser counterexample exists in the getter normalization: source x == null ? "" : x versus bundled x ?? "" differs when x is document.all.','checks':112,'status':'Model explanation incorrect, but an independent browser edge case demonstrates inequivalence under unrestricted inputs.'},
'FN104':{'reason':'Claims the nodeType guard is missing and fallback assignment is inverted.','review':'The entire bundle body is guarded by 1===this.nodeType && (...), so non-elements skip it. The hook condition falls through to this.value=i exactly when the source does; the || right-hand side is not executed after successful defined hook handling.','checks':98,'status':'Short-circuit and guard misreading; tested branches agree.'},
'FN110':{'reason':'Claims comma/short-circuit syntax skips MIME override or request headers, and criticizes skipping cross-domain X-Requested-With.','review':'The comma-separated initializer executes the guarded MIME override and header insertion before enumerating headers. Both versions intentionally omit X-Requested-With for cross-domain requests. Tests cover MIME absent/present, override method absent/present, empty/existing/other headers, and load/error/abort callbacks.','checks':96,'status':'Control-flow misreading; controlled XHR traces agree.'},
}
assert {r['id'] for r in records}==set(notes)
checks=json.loads((P/'remaining-rejection-checks.json').read_text())['results']
assert sum(r['checks'] for r in checks)==448
edge=json.loads((P/'fn103-browser-edge.json').read_text())['results']
w=next(r for r in edge if r['build']=='webpack-min-keep');assert w['matchesSavedFN103Body'] and not w['resultsStrictlyEqual']
md='''# Review of the nine remaining rejected pairs

All nine saved explanations were checked against their actual function bodies and mappings. No model inference was run. The 448 controlled invocation checks agree under explicitly aligned external bindings and mocked helpers; they are not a proof for all possible JavaScript/browser inputs. A separate real-browser test exposes a `document.all` edge case in FN103.

**Finding:** none of the nine model explanations establishes the claimed difference. Eight have no counterexample in the performed checks. FN103 does have an independently demonstrated difference, but for a reason the model did not identify. Consequently these are nine rejected source-linked pairs, not nine proven semantic false negatives under an unrestricted browser-input domain.

| Case | Model's main mistake | Checks agreeing | Assessment |
|---|---|---:|---|
'''
for r in records:
 n=notes[r['id']];md+=f'| [{r["id"]}](cases/{r["id"]}.md) | {n["reason"]} | {n["checks"]} | {n["status"]} |\n'
md+='''
## Important exception: FN103

The model says the bundled function returns the hook setter's result; that is incorrect. Both outer setter branches return the collection from `this.each(...)`.

However, the getter contains a separate rewrite:

```javascript
// Source
return ret == null ? "" : ret;

// Bundled
return ret ?? "";
```

In Chrome, `document.all == null` is true even though `document.all` is neither null nor undefined for nullish coalescing. With a real div having an expando property `value = document.all`, the exact source getter returns the empty string; the actual webpack getter returns document.all. The fixture's bundled getter text exactly matches the saved FN103 body. This input is unusual and differs from ordinary string-valued form fields, but it demonstrates that source-map correspondence alone does not establish unrestricted behavioral equivalence. The model did not mention it.

The same supplementary test finds the difference in the esbuild fixture and no difference in the Rollup fixture. These are extra browser observations, not additional members of the nine-case FN sample. The original source-map labels and the earlier 105/114 acceptance count remain unchanged; that count measures acceptance of source-linked pairs, not independently proved semantic accuracy.

## Per-case review

'''
for r in records:
 n=notes[r['id']];md+=f'### {r["id"]}\n\n**Model explanation:** {r["explanation"]}\n\n**Code review:** {n["review"]}\n\n'
md+='''## Implication

Variable mappings help, but a complete mapping object can still contain incorrect correspondences, and the model can ignore a correct mapping when writing its explanation. Several remaining failures are elementary assignment, scope, and Boolean/control-flow errors. Missing external bindings alone do not account for these explanations.

[Controlled checks](remaining-rejection-checks.json), [browser edge-case evidence](fn103-browser-edge.json), [all raw model results](results.json). Reproduce with `node scripts/jquery/check-remaining-fn-rejections.mjs`, `node scripts/jquery/check-fn103-browser-edge.mjs`, then `python3 scripts/jquery/review-remaining-fn-rejections.py`.
'''
(P/'REMAINING_REJECTIONS.md').write_text(md)
(P/'remaining-rejection-review.json').write_text(json.dumps({'created':datetime.now(timezone.utc).isoformat(),'scope':'Review of saved explanations and bounded tests; no inference; source-map labels unchanged','cases':notes,'controlledChecks':448,'independentBrowserCounterexample':'FN103'},indent=2)+'\n')
print('Saved nine-case review with 448 controlled checks and independent FN103 browser evidence.')
