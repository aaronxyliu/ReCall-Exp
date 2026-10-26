"""Post-hoc code evidence for wrong identities. No inference or label changes."""
import json,os
from pathlib import Path
from collections import Counter
P=Path(os.environ.get('EXPERIMENT_OUTPUT','results/jquery-4.0.0/experiment-4-minified-ranking-top5'))
BASE=Path(json.loads((P/'study-config.json').read_text())['baseline'])
def classify(c):
 a=c['predicted'];b=c.get('expected');x=a['code'];y=b['code'] if b else ''
 if not b:return 'non_target_origin','The selected definition is labelled as non-jQuery origin; this is an origin error rather than a competing jQuery identity.'
 if {a['name'],b['name']}=={'camelCase','unescapeSelector'}:return 'external_binding_confusion','Both wrappers call string.replace, but their source regexes and replacement callbacks differ (rdashAlpha/fcamelCase versus runescape/funescape). Renaming those bindings is not sufficient evidence that the helpers perform the same transformation.'
 if any(('dataUser.'+method in x and 'dataPriv.'+method in y) or ('dataPriv.'+method in x and 'dataUser.'+method in y) for method in ['access','remove']):return 'external_binding_confusion','The wrappers use the same access/removal method but target different public/private jQuery data-store objects. Their enclosing store bindings distinguish the identities.'
 if ('rinputs.test' in x and 'rheader.test' in y) or ('rheader.test' in x and 'rinputs.test' in y):return 'external_binding_confusion','Both wrappers test elem.nodeName, but the source regex bindings recognize input elements versus heading elements. These bindings distinguish the identities.'
 if 'dataUser.set' in x and 'dataUser.set' in y and x!=y:return 'different_call_arguments','The source wrappers call dataUser.set with different argument counts: one passes owner/key, the other owner/key/value. The enclosing key/value roles must also be checked; syntactic similarity alone does not establish the same setter operation.'
 if a.get('parent')==b.get('index') or b.get('parent')==a.get('index'):return 'nested_function_boundary','The selected source is an enclosing or nested function of the correct source. The two boundaries have different parameter/closure roles; matching their shared inner code does not identify the root function.'
 if ('return jQuery;' in x and 'computeTableStyleTests();' in y) or ('return jQuery;' in y and 'computeTableStyleTests();' in x):return 'call_and_return_structure_mismatch','One source returns the jQuery object; the other invokes computeTableStyleTests and returns a captured support-test value. The visible call and actual returned bindings differ. The prompt excludes side-effect checks, but this T/F-only output does not establish why the model accepted the pair.'
 if x==y:return 'identical_body_identity_ambiguity','The source snippets have identical bodies but distinct source identities. A body-only comparison cannot uniquely establish which source occurrence produced the bundled definition.'
 if a.get('astHash')==b.get('astHash'):return 'same_structure_bindings_need_review','Normalized ASTs agree but source identities differ. This is structural ambiguity; inspect enclosing bindings before asserting semantic equivalence or a semantic error.'
 return 'requires_individual_review','The identities disagree and the inspected structural categories do not establish the cause. This case remains unresolved pending individual code and binding review.'
rows=[];counts={};all_cases={}
for name,root in [('experiment3',BASE),('experiment4',P)]:
 cases=json.loads((root/'wrong-identity-audit/cases.json').read_text())['cases'];all_cases[name]=cases;counts[name]=Counter()
 for c in cases:
  cat,note=classify(c);counts[name][cat]+=1
  if name=='experiment4':rows.append({'id':c['id'],'build':c['build'],'category':cat,'evidence':note,'allMapPointsAgree':c['independentMapping']['allAgreeWithStoredIdentity']})
for r in rows:
 f=P/'misidentifications'/f"{r['id']}.md";text=f.read_text();marker='\n<!-- checked-code-review -->\n';f.write_text(text.split(marker)[0]+marker+'\n## Checked code evidence\n\n'+r['evidence']+'\n\nIndependent map witnesses agree with the stored identity: '+str(r['allMapPointsAgree'])+'. This is code-level evidence, not a model-generated explanation.\n')
report='# Checked misidentification evidence\n\nEvery wrong identity was compared with its source-map counterpart. These categories describe inspectable code differences or unresolved structural ambiguity; they do not reveal the model\'s internal reasoning. Source-distinct equivalent functions remain identity errors under the evaluation policy, not automatically semantic false positives.\n\n| Category | Experiment 3 | Experiment 4 |\n|---|---:|---:|\n'
for k in sorted(set(counts['experiment3'])|set(counts['experiment4'])):report+=f"| {k} | {counts['experiment3'][k]} | {counts['experiment4'][k]} |\n"
report+='\n## Case notes\n\n'
for r in rows:report+=f"- [{r['id']}](misidentifications/{r['id']}.md), {r['build']}, {r['category']}: {r['evidence']}\n"
report+='\n## Accepted candidate ranks\n\nRanks 4–5 show observed promotions unavailable within a top-three validation budget in the same saved query. They are not a causal estimate of the gain from changing K, because ranking, validation, and later neighborhoods also changed.\n\n| Accepted rank | Correct promoted | Wrong promoted | Unassessed promoted |\n|---|---:|---:|---:|\n'
truth={g['bundleId']:g for g in json.loads((P/'ground-truth.json').read_text())['records']};rankcounts={}
for f in (P/'recovery').glob('*.json'):
 r=json.loads(f.read_text());pairs={(p['queryId'],p['sourceId']):p for p in r['pairs']}
 for a in r['promotions']:
  if a['kind']=='pog-anchor':continue
  rank=pairs[(a['queryId'],a['sourceId'])]['rank'];g=truth[a['bundleId']];label='wrong' if g.get('nonTarget') else 'unassessed' if not g.get('sourceId') else 'correct' if g['sourceId']==a['sourceId'] else 'wrong';rankcounts.setdefault(rank,Counter())[label]+=1
for rank,c in sorted(rankcounts.items()):report+=f"| {rank} | {c['correct']} | {c['wrong']} | {c['unassessed']} |\n"
(P/'CHECKED-MISIDENTIFICATION-REVIEW.md').write_text(report)
(P/'checked-misidentification-review.json').write_text(json.dumps({'experiment3':dict(counts['experiment3']),'experiment4':dict(counts['experiment4']),'cases':rows,'acceptedRankCounts':{str(k):dict(v) for k,v in rankcounts.items()}},indent=2)+'\n')
for name in ['REPORT.md','COMPARISON-WITH-EXPERIMENT-3.md']:
 with (P/name).open('a') as f:f.write('\n[Checked misidentification review and accepted-rank breakdown](CHECKED-MISIDENTIFICATION-REVIEW.md).\n')
print(json.dumps({'categories':{k:dict(v) for k,v in counts.items()},'acceptedRanks':{str(k):dict(v) for k,v in rankcounts.items()},'casesNeedingFurtherReview':[r['id'] for r in rows if r['category'] in ['requires_individual_review','same_structure_bindings_need_review']]},indent=2))
