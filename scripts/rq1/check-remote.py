"""Smoke-test remote Ollama using unchanged requests from the paused pilot.

This does not resume recovery or reuse these responses in a benchmark cache.
"""
import argparse,json,time,http.client,urllib.parse
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--endpoint',required=True);p.add_argument('--pilot',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
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

report={'endpoint':a.endpoint,'version':request('version')[0],'models':request('tags')[0],'checks':[]}
def save(): (a.output/'remote-check.json').write_text(json.dumps(report,indent=2)+'\n')
body={'model':'qwen3-embedding:0.6b','input':['function add(a,b){return a+b;}'],'truncate':False,'keep_alive':'60m'}
r,ms=request('embed',body);assert len(r['embeddings'])==1 and len(r['embeddings'][0])>0
report['checks'].append({'kind':'embedding','wallMs':ms,'dimensions':len(r['embeddings'][0])});save();print(report['checks'][-1],flush=True)
files=list(a.pilot.glob('*/*/run/model-cache/chat/*.json'))
requests=[json.loads(f.read_text())['request'] for f in files]
requests.sort(key=lambda r:len(json.dumps(r)))
if not requests:raise RuntimeError('No saved pilot requests')
for label,index in [('short',0),('median',len(requests)//2),('long',len(requests)-1)]:
 body=requests[index];r,ms=request('chat',body)
 record={'kind':'validation','size':label,'requestCharacters':len(json.dumps(body)),'wallMs':ms,'decision':r.get('message',{}).get('content','').strip(),**{k:r.get(k) for k in ['total_duration','load_duration','prompt_eval_count','prompt_eval_duration','eval_count','eval_duration']}}
 report['checks'].append(record);save();print(record,flush=True)
 if record['decision'] not in ['T','F']:raise RuntimeError('Validator did not return strict T/F')
# Alternate back to embeddings, then validation, to detect model swapping on 24 GB.
r,ms=request('embed',{'model':'qwen3-embedding:0.6b','input':['function sub(a,b){return a-b;}'],'truncate':False,'keep_alive':'60m'})
report['checks'].append({'kind':'embedding-after-validation','wallMs':ms,'dimensions':len(r['embeddings'][0])})
r,ms=request('chat',requests[0])
report['checks'].append({'kind':'validation-after-embedding','wallMs':ms,'decision':r['message']['content'].strip(),'load_duration':r.get('load_duration')})
assert r['message']['content'].strip() in ['T','F']
report['loadedModels']=request('ps')[0];report['status']='passed';save()
