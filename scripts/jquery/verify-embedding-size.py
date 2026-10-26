"""Independent offline checks for embedding-size comparison."""
import json,hashlib,math
from pathlib import Path
P=Path('results/jquery-4.0.0/embedding-source-instruction-size-v1');B=Path('results/jquery-4.0.0/minified-no-tree-shaking-mapping-v8')
def read(p):return json.loads(p.read_text())
def sha(x):return hashlib.sha256(x).hexdigest()
checks=0
def check(ok):
 global checks
 assert ok
 checks+=1
config=read(P/'config.json');sample=read(P/'sample.json');summary=read(P/'summary.json');inputs=read(P/'inputs.json');metadata=read(P/'model-manifest.json')
check(sample==read(Path('results/jquery-4.0.0/embedding-direction-v1/sample.json')))
for f,h in sample['inputHashes'].items():check(sha((B/f).read_bytes())==h)
d=read(B/'detector-input.json');refs={f['id']:f for s in d['sources'] for f in s['functions']};index={f['id']:i for i,f in enumerate(f for s in d['sources'] for f in s['functions'])};bundles={(b['build'],f['id']):f for b in d['bundles'] for f in b['functions']}
expected_instruction='Represent this JavaScript source function for matching against its bundled counterpart, allowing for minification and variable renaming.'
check(config['instruction']==expected_instruction);check(len(inputs)==551)
for t in inputs:check(sha(t['text'].encode())==t['id'])
allrows={}
for model in config['modelNames']:
 label=model.split(':')[1]
 for trial in [1,2]:
  folder=P/label/('pass-'+str(trial));result=read(folder/'summary.json');rows=read(folder/'rankings.json');timings=read(folder/'timings.json');vectors={}
  files=sorted((folder/'requests').glob('*.json'));check(len(files)==46)
  for file in files:
   r=read(file);check(r['request']['model']==model);check(r['request']['truncate'] is False);check(len(r['request']['input'])<=12);check(r['inputIds']==[sha(x.encode()) for x in r['request']['input']]);check(len(r['response']['embeddings'])==len(r['inputIds']))
   for k,v in zip(r['inputIds'],r['response']['embeddings']):
    check(k not in vectors);check(all(math.isfinite(x) for x in v));check(sum(x*x for x in v)>0);vectors[k]=v
  check(set(vectors)=={t['id'] for t in inputs});check(sorted(set(map(len,vectors.values())))==result['dimensions'])
  def cosine(a,b):return sum(x*y for x,y in zip(a,b))/math.sqrt(sum(x*x for x in a)*sum(y*y for y in b))
  for r,q in zip(rows,sample['sample']):
   check(all(r[k]==v for k,v in q.items()));bc=bundles[r['build'],r['bundleId']]['code'];bv=vectors[sha(bc.encode())]
   scores=[(sid,cosine(bv,vectors[sha(('Instruct: '+expected_instruction+'\nQuery:'+refs[sid]['code']).encode())])) for sid in r['candidates']];scores.sort(key=lambda x:(-x[1],index[x[0]]))
   check([sid for sid,score in scores]==[x['sourceId'] for x in r['ranked']]);check(all(abs(score-x['score'])<1e-12 for (_,score),x in zip(scores,r['ranked'])));check(r['rank']==next(i+1 for i,(sid,_) in enumerate(scores) if sid==r['sourceId']))
  check(len(rows)==150);m=result['metrics'];check(m['top1']==sum(r['rank']==1 for r in rows));check(m['top3']==sum(r['rank']<=3 for r in rows));check(abs(m['mrr']-sum(1/r['rank'] for r in rows)/150)<1e-12);check(abs(result['timing']['wallMs']-sum(t['wallMs'] for t in timings))<1e-7)
  allrows[label,trial]=rows
 for metric in ['top1','top3','mrr']:check(summary['models'][model]['metrics'][metric]==read(P/label/'pass-1/summary.json')['metrics'][metric])
 check(summary['models'][model]['rankChangesAcrossPasses']==sum(a['rank']!=b['rank'] for a,b in zip(allrows[label,1],allrows[label,2])))
result={'status':'passed','checks':checks,'casesPerPass':150,'passes':4,'inferenceDuringVerification':0}
(P/'verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
