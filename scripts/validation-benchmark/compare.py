"""Paired, sequential validation latency benchmark; credential stays in memory."""
import pathlib,json,time,urllib.request,urllib.error,getpass,statistics,hashlib,random,datetime,sys
BASE=pathlib.Path(__file__).resolve().parents[3];ROOT=BASE/'ReCall Exp/results/validation-api-comparison-2026-11-10';ROOT.mkdir(exist_ok=False)
ONLINE='https://cn-beijing.maas.qianwenaiapi.com/api/v1/services/aigc/multimodal-generation/generation';LOCAL='http://127.0.0.1:11434/api/chat'
key=getpass.getpass('API key (not saved): ')
read=lambda p:json.loads(p.read_text())
selected=[]
for subject in ['esbuild/primefaces--primeng','esbuild/swimlane--ngx-datatable']:
 folder=BASE/'ReCall Exp/results/rq1-local-typescript-3-2026-11-10'/subject/'run/model-cache/chat';items=[]
 for p in folder.glob('*.json'):
  x=read(p);items.append({'subject':subject,'cacheFile':str(p.relative_to(BASE)),'request':x['request'],'historicalVerdict':x['response']['message']['content'].strip(),'characters':sum(len(m['content']) for m in x['request']['messages'])})
 items.sort(key=lambda x:(x['characters'],x['cacheFile']))
 for j in range(12):selected.append(items[int((j+.5)*len(items)/12)])
for i,x in enumerate(selected):x['id']=i;x['requestSHA256']=hashlib.sha256(json.dumps(x['request'],sort_keys=True).encode()).hexdigest()
(ROOT/'samples.json').write_text(json.dumps(selected,indent=2))
manifest={'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'samples':24,'repeats':2,'concurrency':1,'localModel':'qwen3.5:27b','onlineModel':'qwen3.8-flash','onlineEndpoint':ONLINE,'thinking':False,'temperature':0,'maxOutputTokens':384,'seed':42,'sampling':'12 request-length quantiles per subject from saved model-validation requests, deterministic ordering; not balanced by verdict','timing':'Client wall time through complete JSON response; no ReCall response-cache reads. Server prefix caching may apply; repeats are reported separately. One warmup per model excluded. Alternating provider order, seeded shuffled samples.','limitations':'Different models/backends/tokenizers; agreement is not accuracy. Sequential request latency, not concurrent throughput or end-to-end recovery.'};(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2))
def call(provider,sample,repeat,warmup=False):
 req=sample['request'];headers={'Content-Type':'application/json'}
 if provider=='online':
  headers['Authorization']='Bearer '+key
  body={'model':'qwen3.8-flash','input':{'messages':[{'role':m['role'],'content':[{'text':m['content']}]} for m in req['messages']]},'parameters':{'enable_thinking':False,'temperature':0,'max_tokens':384,'seed':42,'result_format':'message'}};url=ONLINE
 else:body=req;url=LOCAL
 t=time.perf_counter();status=None;data={}
 try:
  request=urllib.request.Request(url,json.dumps(body).encode(),headers,method='POST')
  with urllib.request.urlopen(request,timeout=120) as response:status=response.status;data=json.load(response)
  if provider=='local':text=data.get('message',{}).get('content','').strip()
  else:
   content=data.get('output',{}).get('choices',[{}])[0].get('message',{}).get('content','');text=(''.join(c.get('text','') for c in content) if isinstance(content,list) else content).strip()
  error=None if text in ['T','F'] else 'Invalid verdict'
 except urllib.error.HTTPError as e:
  status=e.code;text='';error='HTTP '+str(e.code)
  try:
   x=json.loads(e.read());error+=' '+str(x.get('code',''))+' '+str(x.get('message',''))
  except Exception:pass
 except Exception as e:text='';error=type(e).__name__
 result={'sample':sample['id'],'subject':sample['subject'],'characters':sample['characters'],'provider':provider,'repeat':repeat,'warmup':warmup,'elapsedSeconds':time.perf_counter()-t,'httpStatus':status,'verdict':text,'error':error,'usage':data.get('usage'),'localTiming':{k:data.get(k) for k in ['total_duration','load_duration','prompt_eval_count','prompt_eval_cached_count','prompt_eval_duration','eval_count','eval_duration']} if provider=='local' else None,'requestId':data.get('request_id'),'finishReason':data.get('done_reason') if provider=='local' else data.get('output',{}).get('choices',[{}])[0].get('finish_reason')}
 # Never persist credentials, request headers, or unfiltered server errors.
 if key in json.dumps(result):raise RuntimeError('Refusing to persist credential')
 with (ROOT/'responses.jsonl').open('a') as f:f.write(json.dumps(result)+'\n')
 print(json.dumps({k:result[k] for k in ['sample','provider','repeat','warmup','elapsedSeconds','verdict','error']}),flush=True)
 return result
results=[]
for provider in ['online','local']:
 r=call(provider,selected[0],0,True)
 if r['error']:sys.exit('Warmup failed; stopping benchmark')
for repeat in [1,2]:
 batch=list(selected);random.Random(42+repeat).shuffle(batch)
 for n,sample in enumerate(batch):
  for provider in (['online','local'] if (n+repeat)%2 else ['local','online']):
   results.append(call(provider,sample,repeat))
   if results[-1]['httpStatus'] in [401,403,429]:sys.exit('API authorization/quota/rate limit; benchmark stopped')
 summary={'completedCalls':len(results),'plannedCalls':96}
 (ROOT/'progress.json').write_text(json.dumps(summary))
def stats(xs):
 vals=sorted(x['elapsedSeconds'] for x in xs if not x['error']);return {'calls':len(xs),'valid':len(vals),'errors':sum(bool(x['error']) for x in xs),'meanSeconds':statistics.mean(vals) if vals else None,'medianSeconds':statistics.median(vals) if vals else None,'p95Seconds':vals[min(len(vals)-1,__import__('math').ceil(.95*len(vals))-1)] if vals else None,'totalSeconds':sum(vals)}
summary={'byProvider':{p:stats([x for x in results if x['provider']==p]) for p in ['online','local']},'byRepeat':{str(r):{p:stats([x for x in results if x['provider']==p and x['repeat']==r]) for p in ['online','local']} for r in [1,2]}}
pairs=[]
for r in [1,2]:
 for s in selected:
  rs={x['provider']:x for x in results if x['sample']==s['id'] and x['repeat']==r}
  if all(not x['error'] for x in rs.values()):pairs.append({'sample':s['id'],'repeat':r,'agree':rs['local']['verdict']==rs['online']['verdict'],'localSeconds':rs['local']['elapsedSeconds'],'onlineSeconds':rs['online']['elapsedSeconds']})
summary['paired']={'count':len(pairs),'agreementCount':sum(x['agree'] for x in pairs),'onlineFasterCount':sum(x['onlineSeconds']<x['localSeconds'] for x in pairs),'meanSpeedupLocalOverOnline':summary['byProvider']['local']['meanSeconds']/summary['byProvider']['online']['meanSeconds']};summary['pairs']=pairs
(ROOT/'summary.json').write_text(json.dumps(summary,indent=2));manifest['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2));print(json.dumps(summary['byProvider']),flush=True)
