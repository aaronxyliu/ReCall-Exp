"""Replay consecutive pilot requests against remote Ollama, retaining paired timings.
This is a deployment comparison (MLX vs CUDA/GGUF), not an isolated GPU benchmark.
"""
import argparse,json,time,statistics,http.client,urllib.parse
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--endpoint',required=True);p.add_argument('--case',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--count',type=int,default=30);a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
url=urllib.parse.urlsplit(a.endpoint)
connection=(http.client.HTTPSConnection if url.scheme=='https' else http.client.HTTPConnection)(url.hostname,url.port,timeout=300)
def request(route,body=None):
 # Reuse HTTP/1.1 connections as ReCall's Node fetch client does.
 data=json.dumps(body).encode() if body is not None else None
 start=time.perf_counter()
 connection.request('POST' if body is not None else 'GET',url.path.rstrip('/')+'/api/'+route,body=data,headers={'Content-Type':'application/json'})
 response=connection.getresponse();raw=response.read()
 if response.status>=400:raise RuntimeError(f'HTTP {response.status}: {raw[:400]!r}')
 result=json.loads(raw)
 return result,(time.perf_counter()-start)*1000

local_preflight=json.loads((a.case/'run/preflight.json').read_text())
local_models=next(c['detail'] for c in local_preflight['checks'] if c['name']=='models' and c['status']=='passed')
report={'localModelDigests':local_models,'endpoint':a.endpoint,'pilotCase':str(a.case),'remoteVersion':request('version')[0],'remoteModels':request('tags')[0],'warmup':[],'samples':[],'policy':'Same requests and order; separate serving backends/quantizations. Prefix-cache behavior and network overhead are part of the deployment comparison.'}
def save(): (a.output/'paired-benchmark.json').write_text(json.dumps(report,indent=2)+'\n')
timing=[json.loads(line) for line in (a.case/'model-timing.jsonl').read_text().splitlines()]
for api,kind,warmup,count in [('embed','embedding',2,10),('chat','validation',5,a.count)]:
 cache={}
 for f in (a.case/'run/model-cache'/api).glob('*.json'):
  item=json.loads(f.read_text());r=item['response'];cache[(r.get('total_duration'),r.get('prompt_eval_count'),r.get('eval_count'))]=item
 paired=[]
 for t in timing:
  if t['kind']!=kind:continue
  item=cache.get((t.get('serverDurationNs'),t.get('promptTokens'),t.get('outputTokens')))
  if item:paired.append((t,item))
 if len(paired)<warmup+count:raise RuntimeError('Insufficient paired pilot measurements')
 for i,(t,item) in enumerate(paired[:warmup+count]):
  r,wall=request(api,item['request']);old=item['response'];cold=i<warmup
  sample={'kind':kind,'index':i,'requestKey':item['key'],'localWallMs':t['ms'],'remoteWallMs':wall,'localServerMs':old['total_duration']/1e6,'remoteServerMs':r['total_duration']/1e6,'localLoadMs':old.get('load_duration',0)/1e6,'remoteLoadMs':r.get('load_duration',0)/1e6,'localPromptTokens':old.get('prompt_eval_count'),'remotePromptTokens':r.get('prompt_eval_count'),'localCachedPromptTokens':old.get('prompt_eval_cached_count'),'remoteCachedPromptTokens':r.get('prompt_eval_cached_count'),'localOutputTokens':old.get('eval_count'),'remoteOutputTokens':r.get('eval_count')}
  if api=='chat':
   sample['localDecision']=old['message']['content'].strip();sample['remoteDecision']=r['message']['content'].strip();sample['decisionAgrees']=sample['localDecision']==sample['remoteDecision']
  else:sample['dimensions']=len(r['embeddings'][0])
  report['warmup' if cold else 'samples'].append(sample);save();print(json.dumps({k:sample[k] for k in ['kind','index','localWallMs','remoteWallMs']}),flush=True)
report['summary']={}
for kind in ['embedding','validation']:
 rows=[r for r in report['samples'] if r['kind']==kind]
 report['summary'][kind]={'requests':len(rows),'localTotalWallSeconds':sum(r['localWallMs'] for r in rows)/1000,'remoteTotalWallSeconds':sum(r['remoteWallMs'] for r in rows)/1000,'localMedianWallMs':statistics.median(r['localWallMs'] for r in rows),'remoteMedianWallMs':statistics.median(r['remoteWallMs'] for r in rows),'aggregateEndToEndSpeedup':sum(r['localWallMs'] for r in rows)/sum(r['remoteWallMs'] for r in rows),'aggregateServerSpeedup':sum(r['localServerMs'] for r in rows)/sum(r['remoteServerMs'] for r in rows)}
 if kind=='validation':report['summary'][kind]['decisionAgreement']=sum(r['decisionAgrees'] for r in rows)/len(rows)
report['loadedModels']=request('ps')[0];report['status']='complete';save();print(json.dumps(report['summary'],indent=2))
