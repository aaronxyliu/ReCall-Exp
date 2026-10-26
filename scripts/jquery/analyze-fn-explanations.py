"""Manual code-reviewed coding of all saved v7 rejection explanations; no inference."""
import json
from pathlib import Path
from collections import Counter
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[2]
P=ROOT/'results/jquery-4.0.0/minified-no-tree-shaking/recovery-bottlenecks/false-negatives/nonthinking-explanations'
records=json.loads((P/'results.json').read_text())['records']
# Primary themes are mutually exclusive summaries of stated reasons, not hidden causes.
notes={
1:('binding_scope','The loop index is r, while i is a captured receiver. The explanation incorrectly identifies i as a loop variable and assumes the receiver is wrong.'),
2:('operators_control_flow','< is not a strict-equality operator; the source uses !==, not !=. Both functions short-circuit to the same empty string on the proposed empty-string input.'),
3:('binding_scope','The i/jQuery identity is unavailable from these snippets. The additional claim that string concatenation is missing is contradicted by the literal prefix + e in the bundle.'),
6:('operators_control_flow','The bundle explicitly applies typeof before < "u"; the explanation describes comparing the method itself. This is a minifier typeof idiom.'),
7:('binding_scope','Lt/documentElement correspondence is unproven in the two bodies. A possible mismatch is not definite evidence of a difference under the prompt policy.'),
8:('binding_scope','Different captured/local variable spellings are treated as a reason to reject without establishing a conflicting binding.'),
9:('argument_mapping','The bundle uses the computed array expression t[r] and the call i.contains(this,t[r]); it does not replace array indexing with an i property access.'),
11:('binding_scope','The bundle assigns n=a, not a=... as claimed. Treating renamed state variables as absence of state management is unsupported.'),
14:('binding_scope','Potential O/dataUser and e/key differences are external binding uncertainty, not an identified behavioral contradiction.'),
15:('operators_control_flow','Qt(u,e) and its defined-value check are present. The model overlooks the second retrieval in the short-circuit expression.'),
19:('binding_scope','The explanation explicitly rejects because helper and argument correspondences cannot be confirmed; this conflicts with the default-true missing-context policy.'),
22:('argument_mapping','The outer t is props; inner n,r,o are speed,easing,callback. animate(t,n,r,o) preserves the argument order.'),
24:('binding_scope','Both functions use externally defined timeout/receiver bindings. The model assumes renamed y/o are globals or undefined while calling source timeout local.'),
27:('binding_scope','The explanation acknowledges likely minification but rejects a hypothetical i/jQuery and mn/rCRLF mismatch. The source uses a string literal, not the alleged concatenation.'),
28:('argument_mapping','The branch o=r,r=void 0 preserves the shifted callback in o; success:o is not a stale callback. Captured t/method remains an unknown binding.'),
29:('binding_scope','Source parameter i corresponds to bundled o; bundled i is the jQuery receiver. The explanation mixes the two binding roles and assumes the receiver is nonexistent.'),
33:('binding_scope','The source slice and bundled i are both free references. The code does not establish that bundled i is undefined.'),
36:('operators_control_flow','!= is loose inequality, not strict equality. The bundle includes 9===n.nodeType and negates the source early-return condition.'),
37:('operators_control_flow','The reference also uses strict string comparisons. The explanation invents loose comparisons and misreads the null-attribute branch.'),
38:('binding_scope','Source i is also not locally declared in this function; it is captured. Bundled t is the loop variable and i the collection receiver.'),
41:('binding_scope','An assignment to renamed captured variables is incorrectly described as lacking the original state assignment.'),
44:('binding_scope','Variable spelling and potential binding mismatch are the stated reason, without a definite conflicting identity.'),
45:('operators_control_flow','The initial elem guard and both data retrieval checks are present in the bundled short-circuit/conditional expression.'),
48:('operators_control_flow','The explanation explicitly calls !1 true. In JavaScript !1 is false.'),
50:('binding_scope','A call to renamed It is treated as absence of leverageNative without establishing they are different functions.'),
54:('helper_optimization','The body changes the unused first argument of setPositiveNumber to 0 and renames the helper. Inspecting the actual helper shows its first parameter _elem is unused.'),
55:('operators_control_flow','"none" is the comparison operand, not the returned value. The true branch contains an immediately invoked swap implementation.'),
57:('helper_optimization','The claimed difference depends on helper identity and a changed argument; the actual setPositiveNumber helper does not use its first parameter.'),
58:('binding_scope','r and prop are renamed captured loop variables; spelling alone does not establish different iteration behavior.'),
59:('argument_mapping','In the inner function e is speed; t captures props. animate(t,e,n,r) preserves props,speed,easing,callback.'),
60:('operators_control_flow','The bundled callback explicitly checks 1===this.nodeType. Claiming that this guard is missing is contradicted by the supplied body; T/jQuery remains external.'),
61:('operators_control_flow','The branch condition is this.nodeType, not truthiness of i. The supposedly omitted e.call(this,n,T(this).val()) is explicitly present.'),
64:('binding_scope','The seekingTransport flag is represented by captured o in both conditions. Treating the renamed flag as absent is unsupported; the conditional return needs path analysis.'),
65:('binding_scope','The captured method t is declared outside the snippet, and i is a local parameter. The explanation assumes t is undefined from absence of a local declaration.'),
66:('argument_mapping','The inner i is the complete callback, invoked with status and type, matching the source. Both abort versions skip a null callback; the model invents an asymmetry.'),
72:('operators_control_flow','The return is a negated compound Boolean expression implementing the early returns and final constructor check; a different expression form is not an established output difference.'),
81:('operators_control_flow','"!="===t returns a Boolean, not the string "!=". !t covers absence of an operator; it is not an operator named !.'),
82:('binding_scope','Source i is captured as well. Bundled t is the loop counter and i is self; the model confuses those roles and invents an immediate ReferenceError.'),
83:('binding_scope','The state assignment remains an assignment between captured variables r and s; spelling is treated as a behavioral distinction.'),
86:('argument_mapping','v is the first argument to resolveWith, corresponding to document$1, not its second argument. The second argument is [w].'),
87:('operators_control_flow','For e === "false", "true"===e is false and "false"!==e is false, so the whole expression returns Boolean false, not the string.'),
88:('binding_scope','Explicitly cites unconfirmed ot/dataUser and e/key correspondence. This is missing binding evidence rather than a determined difference.'),
89:('operators_control_flow','The conditional expression returns void 0 when neither retrieval is defined. The explanation does not establish a different result.'),
90:('operators_control_flow','Again calls !1 true; the bundled expression is false, matching the source.'),
96:('operators_control_flow','The setter returns rn(0,n,s), not a bare return s or null. The bundle also contains the inlined swap implementation.'),
97:('operators_control_flow','The literal "none" is only a comparison operand; the selected branch invokes the inline swap implementation.'),
98:('binding_scope','The model assumes captured arguments and helper an are undefined; lack of definitions in the snippet is not a proof of undefined runtime values.'),
99:('helper_optimization','The explanation says setPositiveNumber requires the DOM element, but its actual first parameter _elem is unused. Replacing that parameter argument with 0 preserves its use behavior under the audited helper correspondence.'),
102:('argument_mapping','The outer t is props, the inner e is speed; animate(t,e,n,r) preserves the argument mapping.'),
103:('operators_control_flow','The source also returns this.each(...) in its setter branch. The bundled hook check and undefined-result fallback are present.'),
104:('operators_control_flow','The condition is this.nodeType, and Array.isArray(i) is present. Both claimed omissions are contradicted by the code.'),
107:('binding_scope','The model recognizes the equivalent null check but treats renamed external w/Nn as absent globals. It also misdescribes the intact encodeURIComponent(n??"") call as a nonstandard shorthand.'),
108:('binding_scope','The source seekingTransport is also externally defined; demanding a local initialization only in the bundle is asymmetric. The source callback can also return undefined on the cited path.'),
109:('binding_scope','The bundled i is a parameter and t is a captured method. Assuming both are undefined confuses lexical scope with an incomplete excerpt.'),
110:('operators_control_flow','The source also skips overrideMimeType if the method is absent and intentionally skips X-Requested-With for cross-domain requests. The comma expression retains both guarded operations.'),
}
labels={'binding_scope':'Renamed-variable identity or scope assumptions','operators_control_flow':'Misread operators, branches, or allegedly missing code','argument_mapping':'Incorrect argument or nested-parameter mapping','helper_optimization':'Helper correspondence and unused-argument optimization'}
false=[r for r in records if r['decision'] is False]
assert {int(r['id'][2:]) for r in false}==set(notes)
annotations=[]
for r in false:
 category,note=notes[int(r['id'][2:])];annotations.append({'id':r['id'],'category':category,'categoryLabel':labels[category],'modelExplanation':r['explanation'],'codeReview':note})
counts=Counter(a['category'] for a in annotations)
summary={'created':datetime.now(timezone.utc).isoformat(),'total':len(records),'accepted':sum(r['decision'] is True for r in records),'rejected':len(false),'invalid':sum(r['verdict']=='invalid' for r in records),'errors':sum(r['verdict']=='error' for r in records),'thinkingCharacters':sum(len(r['response'].get('message',{}).get('thinking','')) for r in records),'explanationThemes':dict(counts),'themePolicy':'Manual code review of all 55 stated rejection explanations. One primary theme per rejection; explanations can contain secondary mistakes. Themes describe supplied explanations, not proven hidden causal mechanisms.','byBuild':{},'byExternalBindings':{}}
for b in sorted({r['build'] for r in records}):
 xs=[r for r in records if r['build']==b];summary['byBuild'][b]={'total':len(xs),'accepted':sum(r['decision'] is True for r in xs),'rejected':sum(r['decision'] is False for r in xs)}
for flag in [True,False]:
 xs=[r for r in records if r['externalLibraryBindings']==flag];summary['byExternalBindings'][str(flag)]={'total':len(xs),'accepted':sum(r['decision'] is True for r in xs),'rejected':sum(r['decision'] is False for r in xs)}
(P/'review-annotations.json').write_text(json.dumps({'policy':summary['themePolicy'],'annotations':annotations},indent=2)+'\n')
(P/'analysis-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
md='# Analysis of the 114 ground-truth validation replays\n\nAll 114 selected historical FN pairs were replayed with thinking disabled. Only the ground-truth reference function and bundled function appear in each user message. The prompt retains its default-true decision policy but now requires a one- or two-sentence explanation for false. Final response schema: `{ "equivalent": boolean, "explanation": string }`; true uses an empty explanation. Temperature 0, seed 42, context 16,384, output limit 384. Frozen request settings and model digest are in sample.json.\n\n'
md+='## Results\n\n**59/114 accepted (51.8%); 55/114 rejected (48.2%).** All responses are valid, all 55 rejections have nonempty explanations, and no thinking content was returned. No wrong candidate pairs were evaluated and no recovery iteration was resumed.\n\n| Build | Pairs | Accepted | Rejected |\n|---|---:|---:|---:|\n'
for b,v in summary['byBuild'].items():md+=f'| {b} | {v["total"]} | {v["accepted"]} | {v["rejected"]} |\n'
md+='\n## Stated reasons, checked against code\n\n'+summary['themePolicy']+'\n\n| Primary theme | Rejections |\n|---|---:|\n'
for cat,n in counts.most_common():md+=f'| {labels[cat]} | {n} |\n'
md+='''
### External variable and scope assumptions

Some explanations explicitly reject because a captured helper/receiver mapping is unknown; others assume a name is undefined because its declaration is outside the snippet. These conflict with the prompt's instruction that missing context is not definite evidence of a difference. FN007 compares documentElement with Lt; FN019 rejects getWidthOrHeight versus hn solely because it cannot confirm the mapping. FN109 even calls i undefined despite i being a formal parameter. Distinguish genuine uncertainty about bindings from incorrect scope claims.

### Operators and control flow

FN048 and FN090 explicitly state that !1 is true; JavaScript evaluates !1 to false. FN002 mislabels < as strict equality and claims an empty-string counterexample, although both functions return the same empty string. FN087 claims the string "false" remains a string; substituting that input into the bundled short-circuit expression yields Boolean false. FN104 claims Array.isArray is absent when it is visibly present. These are code-reading mistakes, not merely unavailable outer-scope information.

### Nested parameters and arguments

FN022/FN059/FN102 misinterpret `this.animate(t,e,n,r)`: t captures props from the outer function; e,n,r are the inner speed,easing,callback parameters. They do not swap speed and props. FN086 confuses the first and second arguments of resolveWith. These errors concern binding roles and argument flow, even though some surrounding dependencies are external.

### Helper optimizations

FN054/FN057/FN099 object to a call such as rn(0,n,s) instead of setPositiveNumber(elem,value,subtract). The actual source helper's first parameter is named _elem and is unused. Under the audited helper correspondence, replacing that argument with 0 does not change the helper's use of its inputs. This evidence comes from the surrounding source and is not in the two-function prompt. A small helper context is genuinely useful here; an explanation alone does not prove the local argument difference changes observable behavior.

## Does the problem come from outer-scope variables?

Of 106 pairs containing external library bindings, 52 are now accepted and 54 rejected. Of eight without such dependencies, seven are accepted and one (testContext) is rejected. Thus external dependencies are associated with most remaining rejections, but presence is not a causal attribution: several explanations invent local differences in functions that also happen to use external bindings. The primary-theme table distinguishes explicit scope/identity objections from other stated mistakes.

## What changed, and what remains unmeasured

This run combines function-only input with an explanation-producing output contract and a larger output budget. Relative to the original v5 experiment, context removal and the output change are not isolated. The 59 accepted cases are corrected decisions on this selected sample, not 59 demonstrated additional recoveries: candidate ambiguity, reservations, and graph expansion were not rerun. No negative pairs were included, so precision and false-positive changes are unknown. Explanations are generated justifications for the new decisions, not proof of the hidden reasons for earlier non-thinking outputs.

Practical next steps are normalization of common minifier idioms, explicit checking of nested parameter mappings, and refusing to treat missing declarations as proof of an undefined binding. Binding-sensitive helper cases should remain a separate limitation when the prompt must contain only the two functions.

## Review of every rejection

'''
for a in annotations:
 md+=f'### [{a["id"]}](cases/{a["id"]}.md): {a["categoryLabel"]}\n\n**Model explanation:** {a["modelExplanation"]}\n\n**Code review:** {a["codeReview"]}\n\n'
md+='[All 114 cases](README.md), [raw requests and responses](results.json), [manual coding](review-annotations.json), [targeted checks of claims](checked-claims.json).\n'
(P/'ANALYSIS.md').write_text(md)
print(json.dumps(summary,indent=2))
