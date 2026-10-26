"""Compare the completed 274-pair prompt replays, without model calls."""
import json,copy
from pathlib import Path
B=Path('results/jquery-4.0.0/experiment-3-first-positive-27b/recovery-bottlenecks/false-negatives')
P=B/'external-mapping-tf-replay-27b';Q=B/'closure-tf-replay-27b'
def read(p):return json.loads(p.read_text())
new=read(P/'results.json');old=read(Q/'results.json');assert new['summary']['status']==old['summary']['status']=='complete'
a={r['id']:r for r in old['records']};rows=new['records'];assert len(rows)==len(a)==274
for r in rows:
 previous=a[r['id']];x=copy.deepcopy(r['request']);y=copy.deepcopy(previous['request']);x['messages'][0]['content']=y['messages'][0]['content']='SYSTEM_PROMPT';assert x==y
 assert r['bundleId']==previous['bundleId'] and r['sourceId']==previous['sourceId']
 assert r['request']['think'] is False
 assert r.get('response',{}).get('message',{}).get('thinking','')==''
 if r['verdict'] in ['accept','reject']:assert r['response']['message']['content'] in ['T','F']
assert read(P/'model-manifest.json')['tag']['digest']==read(Q/'model-manifest.json')['tag']['digest']
gains=[r['id'] for r in rows if a[r['id']]['decision'] is False and r['decision'] is True]
losses=[r['id'] for r in rows if a[r['id']]['decision'] is True and r['decision'] is False]
result={'compared':274,'onlySystemPromptChanged':True,'previousAccepted':old['summary']['accepted'],'newAccepted':new['summary']['accepted'],'previouslyRejectedNowAccepted':gains,'previouslyAcceptedNowRejected':losses,'netAdditionalAccepted':len(gains)-len(losses),'acceptanceDeltaPercentagePoints':100*(new['summary']['accepted']-old['summary']['accepted'])/274,'oldRequestWallSeconds':old['summary']['requestWallMs']/1000,'newRequestWallSeconds':new['summary']['requestWallMs']/1000,'rawOutputValues':sorted({r.get('response',{}).get('message',{}).get('content','') for r in rows}),'scope':'Selected ground-truth pairs; acceptance, not false-positive rate or overall recovery. Model digest, all pair texts, field names, and request options identical.'}
(P/'comparison-with-closure-tf.json').write_text(json.dumps(result,indent=2)+'\n')
p=P/'REPORT.md';s=p.read_text();marker='\n## Comparison with the previous closure-rule prompt\n';s=s.split(marker)[0];s+=marker+'\n| Prompt | Accepted / 274 | Still rejected | Request wall time |\n|---|---:|---:|---:|\n'
for label,d in [('Previous closure rule',old),('Explicit external-variable mapping',new)]:
 t=d['summary'];s+='| '+label+' | '+str(t['accepted'])+' ('+format(100*t['accepted']/274,'.2f')+'%) | '+str(t['rejected'])+' | '+format(t['requestWallMs']/1000,'.2f')+' s |\n'
s+='\nPreviously rejected → accepted: '+str(len(gains))+'. Previously accepted → rejected: '+str(len(losses))+'. Acceptance change: '+format(result['acceptanceDeltaPercentagePoints'],'.2f')+' percentage points. Verified identical model digest and request bodies after excluding the system prompt. Both runs use source_function and bundled_function. This is a prompt comparison on selected ground-truth counterparts, not an overall recovery run.\n';p.write_text(s);print(json.dumps({k:v for k,v in result.items() if k not in ['previouslyRejectedNowAccepted','previouslyAcceptedNowRejected']},indent=2))
