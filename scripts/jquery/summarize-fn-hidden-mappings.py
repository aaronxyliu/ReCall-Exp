"""Paired comparison of saved visible-mapping and decision-only runs; no inference."""
import json,statistics,math
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'results/jquery-4.0.0/minified-no-tree-shaking/recovery-bottlenecks/false-negatives'
P=BASE/'short-hidden-mapping-replay';V=BASE/'short-variable-mapping-replay'
status=json.loads((P/'status.json').read_text());assert status['status']=='complete'
a=json.loads((V/'results.json').read_text())['records'];b=json.loads((P/'results.json').read_text())['records'];assert len(a)==len(b)==114
for x,y in zip(a,b):
 assert x['id']==y['id'];assert x['request']['messages'][1]==y['request']['messages'][1]
 assert x['request']['options']==y['request']['options']
 for field in ['model','think','stream','keep_alive']:assert x['request'][field]==y['request'][field]
 assert x['request']['think'] is False
 assert not y['response']['message'].get('thinking')
 assert y['response']['done_reason']=='stop'
 assert isinstance(y['decision'],bool)
 assert (P/'cases'/f'{y["id"]}.md').exists()
lat=lambda rs:sorted(r['wallMs']/1000 for r in rs)
la,lb=lat(a),lat(b);yes=sum(r['decision'] is True for r in b)
summary={'created':datetime.now(timezone.utc).isoformat(),'pairs':114,'visibleAccepted':105,'visibleAcceptancePercent':100*105/114,'decisionOnlyAccepted':yes,'decisionOnlyRejected':114-yes,'decisionOnlyAcceptancePercent':100*yes/114,'changePercentagePoints':100*(yes-105)/114,'transitions':status['transitions'],'byBuild':status['byBuild'],'visibleMedianSeconds':statistics.median(la),'decisionOnlyMedianSeconds':statistics.median(lb),'visibleP95Seconds':la[math.ceil(.95*114)-1],'decisionOnlyP95Seconds':lb[math.ceil(.95*114)-1],'visibleOutputTokens':sum(r['response']['eval_count'] for r in a),'decisionOnlyOutputTokens':sum(r['response']['eval_count'] for r in b),'invalid':status['invalid'],'errors':status['errors'],'thinkingCharacters':status['thinkingCharacters'],'policy':'Matched 114 selected source-linked pairs, one saved run per output condition. Positive-pair acceptance, not semantic accuracy, false-positive performance, mapping accuracy, or end-to-end recovery. Source-map origin does not prove unrestricted equivalence; FN103 has a separately checked document.all counterexample.','changedCases':[{'id':y['id'],'build':y['build'],'sourceName':y['sourceName'],'visible':x['decision'],'decisionOnly':y['decision']} for x,y in zip(a,b) if x['decision']!=y['decision']]}
(P/'analysis-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
md='# Does omitting mapping and explanation output change acceptance?\n\n**Yes, in this matched experiment.**\n\n| Output contract | Accepted | Acceptance | Median latency | Output tokens |\n|---|---:|---:|---:|---:|\n'
md+=f'| Full mapping + verdict + rejection explanation | 105/114 | {100*105/114:.2f}% | {statistics.median(la):.3f} s | {summary["visibleOutputTokens"]} |\n'
md+=f'| Verdict only | {yes}/114 | {100*yes/114:.2f}% | {statistics.median(lb):.3f} s | {summary["decisionOnlyOutputTokens"]} |\n'
md+=f'\nChange: {summary["changePercentagePoints"]:.2f} percentage points. Invalid outputs: {summary["invalid"]}; API errors: {summary["errors"]}; returned thinking characters: {summary["thinkingCharacters"]}. Paired transitions: {summary["transitions"]}.\n\n'
md+='## Controls\n\nThe user messages, required source-key lists, initial mapping/behavior-check instructions, model digest, thinking off, temperature 0, seed 42, context 16,384, and 384-token output limit are unchanged. Only the instructions describing final output and the response schema change. This jointly removes the visible mapping and rejection explanation, so it does not isolate their individual effects or the effects of schema alone. No new negative pairs or recovery iterations were evaluated. Each case uses an independent chat request with no conversational history. Cached server prefill and warm runtime can affect latency, so timing is descriptive rather than a cold-start benchmark.\n\n'
md+='## Interpretation\n\nInstructing the model to map variables without emitting those mappings did not preserve the observed acceptance rate. This supports retaining explicit mapping output for this selected positive-pair sample. It does not establish that the model actually completed an internal mapping in the verdict-only condition, nor prove a general causal mechanism. Removing generated intermediate text is different from merely hiding generated thinking in the UI. Additional negative-pair evaluation is required to assess precision.\n\nFN022 changes from true with exposed mappings to false with the verdict-only output. No explanation is returned in this condition, so its reason cannot be inferred from the boolean alone.\n\n'
md+='## Per-build comparison\n\n| Build | Visible mappings accepted | Verdict only accepted | Total |\n|---|---:|---:|---:|\n'
for build,v in status['byBuild'].items():md+=f'| {build} | {v["visibleAccepted"]} | {v["accepted"]} | {v["total"]} |\n'
md+='\n## Changed decisions\n\n| Case | Build | Source | Visible | Verdict only |\n|---|---|---|---|---|\n'
for r in summary['changedCases']:md+=f'| [{r["id"]}](cases/{r["id"]}.md) | {r["build"]} | {r["sourceName"]} | {r["visible"]} | {r["decisionOnly"]} |\n'
md+='\n'+summary['policy']+'\n\n[All cases](REPORT.md), [exact requests/settings](sample.json), [full raw responses](results.json).\n';(P/'ANALYSIS.md').write_text(md)
print(json.dumps({k:v for k,v in summary.items() if k!='changedCases'},indent=2))
