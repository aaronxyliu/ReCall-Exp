"""Predeclared deterministic added-edge and new-promotion witness sample.
Sampling consumes evaluation outputs; it never changes extraction or propagation.
"""
import pathlib,json,hashlib,collections
ROOT=pathlib.Path(__file__).resolve().parents[3]
BASE=ROOT/'results/real-app/bundle-graph-v2-holdout'
read=lambda p:json.loads(p.read_text())
sha=lambda x:hashlib.sha256(json.dumps(x,sort_keys=True,separators=(',',':')).encode()).hexdigest()
for subject in read(BASE/'selection.json')['subjects']:
 d=BASE/'subjects'/subject['slug']
 if not (d/'summary.json').exists() or (d/'audit-sample.json').exists():continue
 inv=read(d/'detector-input.json');fn={};unit={}
 for side,key in [('source','sourceShards'),('bundle','bundleShards')]:
  for p in inv[key]:
   row=read(d/p);u=row['key'] if side=='source' else row['build'];filename=d/(row['sourceFile'] if side=='source' else row['file'])
   unit[u]={'path':str(filename),'code':filename.read_text()}
   for f in row['functions']:fn[f['id']]={**{k:f.get(k) for k in ['id','name','span','file']},'unit':u,'path':str(filename),'code':f['code']}
 added=read(d/'added-edges.json');traces=read(d/'target-traces.json');chosen={};groups={}
 def add(side,e,reason):
  key=side+'|'+sha(e)
  if key not in chosen:chosen[key]={'side':side,'edge':e,'reasons':[]}
  chosen[key]['reasons'].append(reason)
 for side in ['source','bundle']:
  bins=collections.defaultdict(list)
  for e in added[side]:bins[e['kind']].append(e)
  for k in bins:bins[k].sort(key=sha)
  pool=[]
  while len(pool)<6 and any(bins.values()):
   for k in sorted(bins):
    if bins[k] and len(pool)<6:pool.append(bins[k].pop(0))
  for e in pool:add(side,e,'stratified-added-edge')
  groups[side]=dict(collections.Counter(e['kind'] for e in added[side]))
 old={t['bundleId'] for t in traces if t['variant']=='baseline' and t['recovered']}
 gains=[t for t in traces if t['variant']=='improved-per-chunk' and t['recovered'] and t['bundleId'] not in old and t['parentBundleId']]
 gains.sort(key=sha)
 for t in gains[:3]:
  for side,a,b in [('source',t['sourceId'],t['parentSourceId']),('bundle',t['bundleId'],t['parentBundleId'])]:
   es=[e for e in added[side] if {e['from'],e['to']}=={a,b}]
   if es:add(side,sorted(es,key=sha)[0],{'promotionTarget':t['bundleId'],'round':t['round']})
 # Enrich exact files/spans and short snippets for independent reading.
 samples=[]
 for i,v in enumerate(chosen.values()):
  e=v['edge'];a=fn[e['from']];b=fn[e['to']];u=unit.get(e['fromUnit']);lo,hi=e['span']
  def desc(f):return{**{k:f[k] for k in ['id','name','span','unit','path']},'codeStart':f['code'][:1400]}
  v.update({'id':subject['slug']+':'+str(i),'from':desc(a),'to':desc(b),'site':None if not u else u['code'][max(0,lo-180):hi+180],
   'siteNote':'callee-callback span belongs to caller, which may differ from fromUnit; verify endpoint code rather than assume this excerpt is the call site.' if e['kind']=='callee-callback' else None,
   'verdict':None,'evidence':None})
  samples.append(v)
 (d/'audit-sample.json').write_text(json.dumps({'repo':subject['repo'],'population':groups,'samples':samples},indent=2)+'\n')
 print(subject['slug'],len(samples),groups)
