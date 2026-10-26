"""Compare three frozen FN validation output contracts; no model calls."""
import json,statistics,math
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'results/jquery-4.0.0/minified-no-tree-shaking/recovery-bottlenecks/false-negatives'
P=BASE/'short-mapping-no-explanation-replay'
status=json.loads((P/'status.json').read_text());assert status['status']=='complete'
a=json.loads((BASE/'short-variable-mapping-replay/results.json').read_text())['records']
b=json.loads((BASE/'short-hidden-mapping-replay/results.json').read_text())['records']
c=json.loads((P/'results.json').read_text())['records'];assert len(a)==len(b)==len(c)==114
for x,y in zip(a,c):
 assert x['id']==y['id'];assert x['request']['messages'][1]==y['request']['messages'][1]
 assert x['request']['options']==y['request']['options']
 for k in ['model','think','stream','keep_alive']:assert x['request'][k]==y['request'][k]
 assert x['request']['format']['properties']['variable_mapping']==y['request']['format']['properties']['variable_mapping']
 assert x['request']['messages'][0]['content'].split('\n\nReturn only:\n')[0]==y['request']['messages'][0]['content'].split('\n\nReturn only:\n')[0]
 assert y['request']['think'] is False
 assert not y['response']['message'].get('thinking')
 assert y['response']['done_reason']=='stop'
 assert isinstance(y['decision'],bool)
 content=json.loads(y['response']['message']['content']);assert set(content)=={'variable_mapping','equivalent'}
 assert set(y['variableMapping'])==set(v['key'] for v in y['requiredVariables'])
 assert (P/'cases'/f'{y["id"]}.md').exists()
def stat(rs):
 lat=sorted(r['wallMs']/1000 for r in rs);accepted=sum(r['decision'] is True for r in rs)
 return {'total':len(rs),'accepted':accepted,'rejected':sum(r['decision'] is False for r in rs),'acceptancePercent':100*accepted/len(rs),'medianSeconds':statistics.median(lat),'p95Seconds':lat[math.ceil(.95*len(lat))-1],'outputTokens':sum(r['response']['eval_count'] for r in rs),'maximumOutputTokens':max(r['response']['eval_count'] for r in rs)}
sa,sb,sc=stat(a),stat(b),stat(c)
changed=[{'id':y['id'],'build':y['build'],'sourceName':y['sourceName'],'withExplanation':x['decision'],'withoutExplanation':y['decision'],'mappingChanged':x['variableMapping']!=y['variableMapping'],'oldMapping':x['variableMapping'],'newMapping':y['variableMapping']} for x,y in zip(a,c) if x['decision']!=y['decision']]
summary={'created':datetime.now(timezone.utc).isoformat(),'mappingAndExplanation':sa,'verdictOnly':sb,'mappingWithoutExplanation':sc,'differenceVsMappingAndExplanationPercentagePoints':sc['acceptancePercent']-sa['acceptancePercent'],'transitions':status['transitions'],'byBuild':status['byBuild'],'invalid':status['invalid'],'errors':status['errors'],'thinkingCharacters':status['thinkingCharacters'],'mappingChangedCases':sum(x['variableMapping']!=y['variableMapping'] for x,y in zip(a,c)),'changedDecisions':changed,'scope':'114 selected source-linked pairs; acceptance, not unrestricted semantic accuracy, mapping accuracy, precision or end-to-end recovery. No negative candidates. One run per condition; build occurrences are correlated.'}
(P/'analysis-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
md='# Keep mappings, remove explanations: results\n\n'+summary['scope']+'\n\n| Output | Accepted / 114 | Acceptance | Median latency | Total output tokens |\n|---|---:|---:|---:|---:|\n'
for label,s in [('Mapping + verdict + explanation',sa),('Mapping + verdict, no explanation',sc),('Verdict only',sb)]:md+=f'| {label} | {s["accepted"]}/114 | {s["acceptancePercent"]:.2f}% | {s["medianSeconds"]:.3f} s | {s["outputTokens"]} |\n'
md+=f'\nRemoving only explanation requirements changes acceptance by {summary["differenceVsMappingAndExplanationPercentagePoints"]:.2f} percentage points. Paired transitions: {status["transitions"]}. Invalid outputs: {status["invalid"]}; errors: {status["errors"]}; returned thinking characters: {status["thinkingCharacters"]}.\n\n'
md+='## Controls and interpretation limits\n\nCompared with the mapping-plus-explanation baseline, the function pairs, model digest, mapping instructions, source-key lists, complete required-key mapping schema, thinking off, temperature 0, seed 42, context 16,384 and 384-token output budget are identical. Only explanation-related output instructions and the explanation field in the final schema were removed. Thus this is more focused than removing both mappings and explanations, but it still compares output contracts rather than identifying the model\'s hidden reasoning mechanism. No explanations are available for newly rejected pairs.\n\nThe explanation field follows the verdict in the baseline output. Its generated text cannot be assumed to have served as intermediate text before that verdict; the requirement can still affect the model through the prompt and schema. Timings reflect saved warm-runtime requests and are not a cold-start benchmark. No model-generated mapping accuracy labels or negative candidates were evaluated. FN103 has a separately documented document.all browser counterexample, so source linkage is not a universal semantic-equivalence oracle.\n\n'
md+='## Per-build results\n\n| Build | With explanations accepted | Without explanations accepted | Total |\n|---|---:|---:|---:|\n'
for build,v in status['byBuild'].items():md+=f'| {build} | {v["baselineAccepted"]} | {v["accepted"]} | {v["total"]} |\n'
md+='\n## Changed decisions\n\n| Case | Build | Source | With explanation | Without explanation | Mapping changed? |\n|---|---|---|---|---|---|\n'
for x in changed:md+=f'| [{x["id"]}](cases/{x["id"]}.md) | {x["build"]} | {x["sourceName"]} | {x["withExplanation"]} | {x["withoutExplanation"]} | {x["mappingChanged"]} |\n'
md+='\nFN103 changes from false to true when explanations are omitted. Its separately established document.all counterexample remains valid, so the higher acceptance count must not be interpreted as higher independently proved semantic accuracy.\n\n[All 114 outputs](REPORT.md), [exact prompts/settings](sample.json), [raw records](results.json), [paired metrics and changed mappings](analysis-summary.json).\n';(P/'ANALYSIS.md').write_text(md)
print(json.dumps({k:v for k,v in summary.items() if k!='changedDecisions'},indent=2))
