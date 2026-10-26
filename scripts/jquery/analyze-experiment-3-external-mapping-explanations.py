"""Summarize model-reported rejection reasons; explanations are claims, not proofs."""
import json,re
from pathlib import Path
from collections import Counter
P=Path('results/jquery-4.0.0/experiment-3-first-positive-27b/recovery-bottlenecks/false-negatives/external-mapping-tf-replay-27b/explanation-replay')
def read(f):return json.loads((P/f).read_text())
d=read('results.json');rows=d['records'];counts=Counter(r['verdict'] for r in rows)
rules=[('external_binding_or_missing_context',r'without evidence|without a mapping|no evidence|not map|alias|\b(external|out.of.scope|closure|captur\w*|surrounding|enclosing|undefined (?:variable|identifier)|unknown (?:variable|identifier|function)|cannot (?:verify|determine|establish)|not (?:provided|defined)|global)\b'),('parameter_or_argument_mapping',r'\b(argument|parameter|arity|position|swapp\w*)\b'),('return_value_or_control_flow',r'\b(return\w*|short.circuit|conditional|branch\w*|loop|control.flow|truth\w*|fals\w*|boolean|undefined|null)\b'),('property_call_or_side_effect',r'\b(propert\w*|method|call\w*|side.effect|mutat\w*|assign\w*|delet\w*)\b'),('this_or_coercion',r'\bthis\b|coerc\w*|strict|loose|typeof|type check'),('exception_or_evaluation_order',r'exception|throw|evaluation order|execut\w* order')]
classified=[]
for r in rows:
 if r['verdict']!='reject':continue
 text=r.get('explanation') or '';labels=[label for label,pattern in rules if re.search(pattern,text,re.I)];classified.append({'id':r['id'],'build':r['build'],'sourceName':r['sourceName'],'labels':labels or ['other_or_unspecific'],'hasExternalBindings':r['externalLibraryBindings'],'sourceFree':r['sourceFree'],'bundleFree':r['bundleFree'],'explanation':text})
frequencies=Counter(label for r in classified for label in r['labels']);primary=Counter(r['labels'][0] for r in classified)
verification=[]
def check(label,ok):verification.append({'check':label,'passed':bool(ok)})
source=Path('results/jquery-4.0.0/experiment-3-first-positive-27b');all_expected=json.loads((source/'recovery-bottlenecks/false-negatives/summary.json').read_text())['rows'];previous=json.loads((source/'recovery-bottlenecks/false-negatives/external-mapping-tf-replay-27b/results.json').read_text());wanted={r['build']+'|'+r['bundleId'] for r in previous['records'] if r['verdict']=='reject'};expected=[r for r in all_expected if r['build']+'|'+r['bundleId'] in wanted];manifest=json.loads((source/'model-manifest.json').read_text())
check('all selected cases completed',len(rows)==42);check('model digest unchanged',read('model-manifest.json')['tag']['digest']==manifest['digests']['qwen3.5:27b'])
for r,e in zip(rows,expected):
 u=json.loads(r['request']['messages'][1]['content']);check(r['id']+' exact two full code fields',u=={'source_function':e['correctSourceCode'],'bundled_function':e['bundleCode']});check(r['id']+' thinking off and correct model',r['request']['think'] is False and r['request']['model']=='qwen3.5:27b');check(r['id']+' no thinking output',not r.get('response',{}).get('message',{}).get('thinking'));check(r['id']+' markdown and raw artifact exist',(P/('cases/'+r['id']+'.md')).exists() and (P/('requests/'+r['id']+'.json')).exists())
result={'counts':dict(counts),'completed':len(rows),'modelReportedReasonTagsOverlapping':dict(frequencies),'primaryKeywordTagExclusive':dict(primary),'rejectedWithExternalDependencies':sum(r['hasExternalBindings'] for r in classified),'rejectedWithoutExternalDependencies':sum(not r['hasExternalBindings'] for r in classified),'rejections':classified,'policy':'Keyword tags organize model explanations and can overlap. Primary tag follows fixed rule priority, not a demonstrated root cause. Explanations require source-level adjudication before claiming genuine behavioral differences. Error-selected ground-truth sample; cannot measure false-positive rate.'}
(P/'reason-analysis.json').write_text(json.dumps(result,indent=2)+'\n');(P/'verification.json').write_text(json.dumps({'passed':all(x['passed'] for x in verification),'checks':len(verification),'failures':[x for x in verification if not x['passed']]},indent=2)+'\n')
md='# Model-reported reasons for rejecting ground-truth pairs\n\nCompleted '+str(len(rows))+'/42. Newly accepted: '+str(counts['accept'])+'; still rejected: '+str(counts['reject'])+'; invalid: '+str(counts['invalid'])+'; API errors: '+str(counts['error'])+'. Original experiment predictions remain unchanged.\n\nAdding an explanation request changes the output contract and can change decisions even with thinking off and temperature zero. Any newly accepted cases are prompt-sensitive reversals, not new recovery results.\n\n## Explanation tags (overlapping)\n\n| Model explanation mentions | Rejections |\n|---|---:|\n'
for k,v in frequencies.most_common():md+='| '+k+' | '+str(v)+' |\n'
md+='\nThese are automatic keyword tags, not verified causes. In particular a model may falsely claim swapped arguments, changed return behavior, or missing dependencies. Full code and responses must support an assertion before it is treated as a genuine semantic difference. No thinking trace is requested or returned.\n\n## Each remaining rejection\n\n| Case | Source | Explanation |\n|---|---|---|\n'
for r in classified:md+='| ['+r['id']+'](cases/'+r['id']+'.md) | '+r['sourceName']+' | '+r['explanation'].replace('|','\\|').replace('\n',' ')+' |\n'
md+='\nSaved source/free-variable metadata accompanies each request. External dependency presence is not proof that the dependency caused rejection. [Exact reason-analysis data](reason-analysis.json) and [mechanical verification](verification.json).\n';(P/'ANALYSIS.md').write_text(md);print(json.dumps({k:v for k,v in result.items() if k!='rejections'},indent=2))

index=P/"README.md"
if index.exists():index.write_text(index.read_text().replace("/274. Accepted", "/42. Accepted"))

checked=P/"CHECKED_FINDINGS.md"
if checked.exists():
 report=P/"ANALYSIS.md"
 report.write_text(report.read_text()+"\n## Checked explanation claims\n\n[Source-level checks and concrete counterexamples](CHECKED_FINDINGS.md). The checked examples distinguish missing binding evidence from mistaken comma-expression, type-check, and argument-mapping claims.\n")
