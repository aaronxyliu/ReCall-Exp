"""Independently check saved inputs, vectors, ranks, sample, and summary; no inference."""
import hashlib,json,math
from pathlib import Path
from collections import Counter
P=Path('results/jquery-4.0.0/embedding-direction-v1');B=Path('results/jquery-4.0.0/minified-no-tree-shaking-mapping-v8')
def read(p):return json.loads(p.read_text())
def sha(x):return hashlib.sha256(x).hexdigest()
checks=0
def check(ok):
 global checks
 assert ok
 checks+=1
sample=read(P/'sample.json');rows=read(P/'rankings.json');summary=read(P/'summary.json');inputs=read(P/'inputs.json');manifest=read(P/'model-manifest.json')
for f,h in sample['inputHashes'].items():check(sha((B/f).read_bytes())==h)
d=read(B/'detector-input.json');refs={f['id']:f for s in d['sources'] for f in s['functions']};indexes={f['id']:i for i,f in enumerate(f for s in d['sources'] for f in s['functions'])};bundles={(b['build'],f['id']):f for b in d['bundles'] for f in b['functions']};gt={(g['build'],g['bundleId']):g for g in read(B/'ground-truth.json')['records']}
for build in sample['eligibleCounts']:
 seen=set();eligible=[]
 for q in read(B/('recovery/'+build+'.json'))['queries']:
  if q['bundleId'] in seen:continue
  seen.add(q['bundleId']);g=gt.get((build,q['bundleId']),{})
  if g.get('status')=='supported' and len(q['candidates'])>3 and g.get('sourceId') in {c['sourceId'] for c in q['candidates']}:eligible.append((sha(('embedding-direction-v1|'+build+'|'+q['bundleId']).encode()),q['id']))
 check(len(eligible)==sample['eligibleCounts'][build]);check([x['queryId'] for x in sample['sample'] if x['build']==build]==[q for h,q in sorted(eligible)[:50]])
vectors={};calls=list((P/'requests').glob('*.json'))
for file in calls:
 r=read(file);check(r['request']['model']==manifest['model']);check(r['request']['truncate'] is False);check(len(r['request']['input'])<=12)
 check(r['inputIds']==[sha(t.encode()) for t in r['request']['input']]);check(len(r['inputIds'])==len(r['response']['embeddings']))
 for k,v in zip(r['inputIds'],r['response']['embeddings']):
  check(len(v)==1024 and all(math.isfinite(x) for x in v));check(sum(x*x for x in v)>0);check(k not in vectors);vectors[k]=v
check(len(vectors)==len(inputs)==summary['embedding']['uniqueInputs']);check(len(rows)==150);check(Counter(r['build'] for r in rows)=={b:50 for b in sample['eligibleCounts']})
for t in inputs:check(sha(t['text'].encode())==t['id'])
def cosine(a,b):return sum(x*y for x,y in zip(a,b))/math.sqrt(sum(x*x for x in a)*sum(y*y for y in b))
bprefix='Instruct: Retrieve the original JavaScript source function corresponding to this bundled function, preserving its behavior despite minification and identifier renaming.\nQuery:'
sprefix='Instruct: Retrieve the bundled JavaScript function corresponding to this source function, preserving its behavior despite minification and identifier renaming.\nQuery:'
for r,s in zip(rows,sample['sample']):
 check(all(r[k]==v for k,v in s.items()));check(gt[r['build'],r['bundleId']]['sourceId']==r['sourceId'])
 bc=bundles[r['build'],r['bundleId']]['code']
 for condition in ['A','B','C']:
  bv=vectors[sha(((bprefix if condition=='A' else '')+bc).encode())]
  scores=[(sid,cosine(bv,vectors[sha(((sprefix if condition=='B' else '')+refs[sid]['code']).encode())])) for sid in r['candidates']]
  scores.sort(key=lambda x:(-x[1],indexes[x[0]]));out=r['conditions'][condition]
  check([sid for sid,_ in scores]==[x['sourceId'] for x in out['ranked']]);check(all(abs(score-x['score'])<1e-12 for (sid,score),x in zip(scores,out['ranked'])));check(out['rank']==next(i+1 for i,(sid,_) in enumerate(scores) if sid==r['sourceId']))
for c in ['A','B','C']:
 m=summary['pooled'][c];ranks=[r['conditions'][c]['rank'] for r in rows];check(m['top1']==sum(x==1 for x in ranks));check(m['top3']==sum(x<=3 for x in ranks));check(abs(m['mrr']-sum(1/x for x in ranks)/150)<1e-12)
md='# Cases whose top-three status changed: reversed versus current direction\n\nAll seven cases are shown. Codes below are evaluation evidence, not additional embedding input. Ranking changes do not prove equivalence or explain the embedding model internally.\n'
for r in rows:
 if (r['conditions']['A']['rank']<=3)==(r['conditions']['B']['rank']<=3):continue
 f=refs[r['sourceId']];bf=bundles[r['build'],r['bundleId']]
 md+='\n## '+r['queryId']+' — '+f['name']+'\n\nCorrect-source ranks: '+', '.join(c+'='+str(r['conditions'][c]['rank']) for c in ['A','B','C'])+'. Candidate count: '+str(len(r['candidates']))+'.\n\nSource:\n\n```javascript\n'+f['code']+'\n```\n\nBundled:\n\n```javascript\n'+bf['code']+'\n```\n\n'
 for c in ['A','B']:
  md+=c+' top three: '+', '.join(refs[x['sourceId']]['name']+' ('+format(x['score'],'.4f')+')' for x in r['conditions'][c]['ranked'][:3])+'.\n\n'
md+='## Observations\n\nSix gains and one loss. Every gained example has a short bundled body: a captured-variable assignment or a forwarding call. In three gains (state assignment, show, remove), code-only inputs also reach the top three. Reversed instructions additionally bring hide, _data, and matches into the top three. These observations suggest input formatting matters especially for short bodies, but do not establish a causal explanation of the learned vectors.\n\nThe loss is testContext: the reversed condition ranks other DOM-related helpers ahead of the exact counterpart. The preserved getElementsByTagName property and broad DOM similarity do not ensure the correct source is ranked first.\n\nExternal helper/store identities in hide, show, _data, remove, and matches are established by the held-out correspondence labels, not by standalone function equivalence proofs. No conclusion about validator accuracy follows.\n'
(P/'DISAGREEMENTS.md').write_text(md)
result={'status':'passed','checks':checks,'cases':150,'modelCallsDuringVerification':0,'requests':len(calls),'dimensions':1024}
(P/'verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
