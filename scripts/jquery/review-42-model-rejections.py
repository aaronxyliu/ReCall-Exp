"""Source-level adjudication of explanation claims. Does not change predictions."""
import json
from pathlib import Path
from collections import Counter
P=Path('results/jquery-4.0.0/experiment-3-first-positive-27b/recovery-bottlenecks/false-negatives/external-mapping-tf-replay-27b/explanation-replay')
def read(p):return json.loads((P/p).read_text())
# Manually checked against full source/bundled snippets, not keyword-derived causes.
assessments={
'FN014':('minification_control_flow','The comma expression evaluates the guard, normalizes lang, then returns the callback. A||error calls error only when A is false. It does not return the test result or invert the error path. Targeted valid/invalid-language checks agree.'),
'FN044':('external_binding_mapping','The plausible mapping is i=jQuery and q=getAll. No changed cleanData arguments or textContent writes are identified. Different helper names and absent alias evidence are not a demonstrated semantic difference.'),
'FN050':('captured_argument_mapping','props is captured in the source, not local or a formal parameter. t maps to props; n/r/o map to speed/easing/callback. Both calls pass the captured props first and preserve all parameter positions. Targeted argument checks agree.'),
'FN058':('minification_control_flow','For the checked ordinary values, val != null ? val : fallback and val ?? fallback both preserve 0, false, and empty strings, taking the fallback for null/undefined. Targeted checks agree; i=jQuery and ie=stripAndCollapse remain plausible helper mappings.'),
'FN065':('external_binding_mapping','method and t are both captured bindings, used in the same type property. i maps to jQuery. An undeclared-in-snippet source variable is not a scope mismatch when both sides are extracted functions.'),
'FN069':('external_binding_mapping','The callback uses a captured jQuery/i namespace, while its index parameter is source i/bundled n. Its call to wrapAll and callback this-binding remain aligned. A differently named helper alone is not contrary evidence.'),
'FN079':('minification_control_flow','!top ? val : pageXOffset is identical to top ? pageXOffset : val. The condition and both arms were reversed together. Both horizontal and vertical scroll arguments agree in targeted checks.'),
'FN100':('minification_control_flow','test||error is equivalent to if(!test)error. The source/bundle return a callback after a comma sequence. The guess that U is merely a logger has no supporting code evidence; the source helper selectorError delegates to the throwing jQuery.error.'),
'FN103':('minification_control_flow','The final comma-expression operand is !0===e.selected, so the return value is the selection Boolean even when E is false. The preceding short-circuit getter is a side effect. Targeted result/getter checks agree.'),
'FN108':('minification_control_flow','unique&&has(arg)||push(arg) pushes when !(unique&&has), i.e. !unique||!has. It does not push only when both flags are true. All four flag combinations agree in targeted checks.'),
'FN118':('minification_control_flow','The long Boolean expression returns false for the string false, true only for true, and otherwise evaluates the nested null/numeric/JSON branches. It is not simply a Boolean not-false test. Targeted conversion cases agree; st/rbrace is a captured regex mapping.'),
'FN132':('minification_control_flow','The negative node-type conjunction is followed by ||assignment. It runs the write exactly when nodeType is 1, 11, or 9, matching the positive source OR. The explanation ignores the final || and reverses the write condition.'),
'FN136':('optimization_requires_callee_context','The first call argument really changes from elem to 0. The actual setPositiveNumber helper never reads its first parameter _elem or arguments, so this optimization does not change that helper result. This supporting helper definition is absent from the model input; it is not a mere identifier rename.'),
'FN141':('minification_control_flow','Only showHide is under if(!hidden) in the source. dataPriv.remove and the style loop are unconditional on both sides; the comma sequence is evaluated as the for-in right-hand expression. Tt([e]) is the renamed source showHide([elem]), not an extra call. Targeted logs agree.'),
'FN145':('captured_argument_mapping','As in FN050, props/t is captured on both sides, while speed/easing/callback occupy positions 1/2/3 in the root function. The animate call preserves captured props as its first argument. No argument shift is demonstrated.'),
'FN152':('minification_control_flow','An explicit bare return and reaching the end of the function both return undefined. The leading && skips all work for non-element nodes just as the source early guard does. Missing closure declarations are additional uncertainty, not contrary evidence.'),
'FN168':('minification_control_flow','The comma expression returns responseContainer[0], not the result of T.error. The OR calls the error helper only when the container is falsy, exactly as the source if(!responseContainer) does.'),
'FN177':('minification_control_flow','The negated guard and the two conditional arms are reversed together: !top?val:pageXOffset equals top?pageXOffset:val. The argument choice is unchanged, as checked for FN079.'),
'FN178':('minification_control_flow','The void 0 occurs in the comparison void 0===i, whose true/false branches still call T.css or T.style. It is not a final else return of undefined. The captured e/name mapping is also plausible, not disproved.'),
'FN188':('external_binding_mapping','a is used exactly like the captured source indexOf: a.call(arr,elem,i). Root parameters map positionally and the null guard agrees. Missing evidence of the captured helper identity alone does not establish a different method.'),

'FN199':('minification_control_flow','As in FN014/FN100, the positive test is followed by ||error inside a comma sequence. It calls the renamed error helper when the test fails and then returns the callback. The error call was not omitted and validation is not inverted.'),
'FN202':('minification_control_flow','The comma separates the optional getter access from the final selected Boolean. When j is false the comma right operand still evaluates and is returned. This is the same checked transformation as FN103.'),
'FN205':('minification_control_flow','The filter-failed expression is the left operand of ||, so a failed filter skips the push; otherwise both implementations append the element and then its index if mapping is enabled. The source map.push is itself inside the accepted-filter block, contrary to the explanation. Targeted filtering/index-write checks agree.'),

'FN209':('minification_control_flow','The OR push is evaluated only when unique&&has is falsy, i.e. !unique||!has. Both callbacks therefore reject duplicates when uniqueness is enabled. The explanation overlooks short-circuiting, as in FN108.'),
'FN219':('minification_control_flow','JavaScript || and && return operand values, not necessarily Booleans. For a nonnumeric non-JSON string such as hello, the nested right operand returns the original string; it does not become true. This is the same checked getData transformation as FN118.'),

'FN230':('minification_control_flow','The source returns false in its non-IE else branch. The bundle tests !isIE and immediately returns false in exactly that case, then otherwise removes the listener. The missing syntactic else does not remove behavior. Targeted event/return checks agree.'),

'FN233':('minification_control_flow','As in FN132, the negative node-type conjunction is followed by ||write, so the assignment runs for types 1, 11, and 9. It does not write only to excluded nodes. The explanation ignores the final short-circuit OR.'),
'FN236':('optimization_requires_callee_context','The nested setter really passes 0 instead of elem to the helper. Actual source setPositiveNumber and bundled rn do not read their first parameter. The compiler can replace this unused argument without changing the helper result; the model input lacks the helper definitions.'),
'FN237':('optimization_requires_callee_context','Both the source setPositiveNumber and the lexically resolved bundled rn have an unused first parameter. rn(0,value,subtract) therefore preserves this helper result. Establishing that fact requires the actual callee bodies, not function-name similarity alone.'),

'FN242':('minification_control_flow','Only the showHide call is conditional in the source; removal and the style loop follow outside that if block. The bundled for-in comma sequence preserves this order and wt([e]) corresponds to showHide([elem]), as checked in FN141.'),
'FN245':('captured_argument_mapping','The source props is an external captured variable and maps to bundled t. The three root parameters still map speed/easing/callback positionally. Calling animate with captured props first is preserved, not a shifted signature.'),

'FN251':('minification_control_flow','An explicit bare return and falling off the end both return undefined; the leading && guard skips work for non-elements just as the source does. Compression alone does not demonstrate changed evaluation order, and the explanation gives no concrete differing operation.'),
'FN254':('minification_control_flow','The source recurses into an object only when !traditional && type===object; otherwise it serializes it as a scalar. The bundled complementary guard traditional||type!==object takes exactly that scalar branch. Twenty targeted scalar/object/nested-array checks agree.'),

'FN266':('minification_control_flow','As in FN168, the final comma-expression value is container[0]. If the shared error helper throws, both versions stop; if it returns, both continue to container[0]. The explanation incorrectly assumes the source can continue after an exception while the bundle cannot.'),
'FN270':('minification_control_flow','Negating top while swapping both ternary arms preserves the scroll x-coordinate. !top?val:pageXOffset equals top?pageXOffset:val, and the y-coordinate also matches. This is the same checked scroll transformation as FN079/FN177.'),

}
records=read('results.json')['records'];reviews=[]
for r in records:
 if r['verdict']!='reject':continue
 item=assessments.get(r['id']);reviews.append({'id':r['id'],'build':r['build'],'sourceName':r['sourceName'],'category':item[0] if item else 'pending_review','finding':item[1] if item else 'Full source-level review pending.','modelExplanation':r['explanation']})
counts=Counter(r['category'] for r in reviews)
result={'completedResponses':len(records),'selectedCases':42,'verdicts':dict(Counter(r['verdict'] for r in records)),'reviewedRejections':sum(r['category']!='pending_review' for r in reviews),'categories':dict(counts),'reviews':reviews,'scope':'Primary categories describe checked failures in the stated rationale, not access to hidden model reasoning. Where a rationale has multiple claims, the principal checked issue is used; category counts are exclusive. Ground-truth counterpart status does not prove unrestricted equivalence.'}
(P/'checked-reasons.json').write_text(json.dumps(result,indent=2)+'\n')
md='# Checked analysis of the 42 remaining pairs\n\nResponses completed: '+str(len(records))+'/42. Verdicts: '+str(result['verdicts'])+'.\n\n## Exclusive categories among remaining valid rejections\n\n| Checked issue | Count |\n|---|---:|\n'
for k,v in counts.most_common():md+='| '+k+' | '+str(v)+' |\n'
md+='\nCategories concern the model\'s stated reasons. Missing context alone does not demonstrate inequivalence, and targeted checks do not prove unrestricted equivalence. Original overall predictions remain unchanged.\n\n## Case-by-case review\n'
for r in reviews:
 md+='\n### ['+r['id']+'](cases/'+r['id']+'.md): '+r['sourceName']+'\n\nCategory: '+r['category']+'.\n\nModel claim: '+r['modelExplanation']+'\n\nChecked finding: '+r['finding']+'\n'
 file=P/('cases/'+r['id']+'.md');marker='\n<!-- checked-review -->\n';text=file.read_text().split(marker)[0];file.write_text(text+marker+'## Checked explanation\n\n'+r['finding']+'\n')
md+='\n[Targeted executable checks and helper evidence](checked-claims.json). [Raw model responses and case index](README.md). No model calls were made by this analysis.\n';(P/'CHECKED_ANALYSIS.md').write_text(md)
print(json.dumps({k:v for k,v in result.items() if k!='reviews'},indent=2))
