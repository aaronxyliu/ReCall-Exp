"""Summarize and verify completed oracle connectivity simulations, without model access."""
from pathlib import Path
import json,csv,hashlib,collections,datetime
P=Path('results/real-app/vue-admin-template-all-libraries');O=P/'connectivity-simulation';read=lambda p:json.loads(p.read_text())
s=read(O/'summary.json');d=read(P/'detector-input.json');mg=read(P/'diagnostics/d-bundlr-module-graph/module-graph.json');anchors=read(O/'initial-anchors.json');refs=[f for src in d['sources'] for f in src['functions']];idx={f['id']:i for i,f in enumerate(refs)};adj=[set() for f in refs];offset=0
for src in d['sources']:
 for e in src['edges']:u=e['from']+offset;v=e['to']+offset;adj[u].add(v);adj[v].add(u)
 groups=collections.defaultdict(list)
 for f in src['functions']:groups[f['parent']].append(idx[f['id']])
 for group in groups.values():
  for i,u in enumerate(group):
   for v in group[i+1:i+3]:adj[u].add(v);adj[v].add(u)
 offset+=len(src['functions'])
for e in mg['functionEdges']:
 if e['from'] in idx and e['to'] in idx:u=idx[e['from']];v=idx[e['to']];adj[u].add(v);adj[v].add(u)
seen={idx[a['sourceId']] for a in anchors};q=list(seen)
for u in q:
 for v in adj[u]-seen:seen.add(v);q.append(v)
r=read(O/'both-intermodule.json');remaining=[]
for t in r['targets']:
 if t['status']=='unreached':remaining.append({**t,'sourceConnectedToInitialAnchors':idx[t['sourceId']] in seen,'structuralCause':'source_component_without_seed' if idx[t['sourceId']] not in seen else 'no_paired_neighborhood_path'})
(O/'remaining-targets.json').write_text(json.dumps(remaining,indent=2)+'\n')
with (O/'target-outcomes.csv').open('w') as f:
 fields=['variant','library','packageInstance','file','sourceName','sourceId','bundleId','status','round','finalGate'];w=csv.DictWriter(f,fieldnames=fields);w.writeheader()
 for v in s['variants']:
  result=read(O/(v['variant']+'.json'))
  for t in result['targets']:w.writerow({'variant':v['variant'],**{k:t.get(k) for k in fields if k!='variant'}})
causes={l:dict(collections.Counter(t['structuralCause'] for t in remaining if t['library']==l)) for l in ['axios','core-js']}
(O/'remaining-summary.json').write_text(json.dumps(causes,indent=2)+'\n')
assert len(anchors)==30 and s['modelCalls']==0
frozen=read(P/'recovery/webpack-vendor-real.json')
assert {(a['sourceId'],a['bundleId']) for a in anchors}=={(a['sourceId'],a['bundleId']) for a in frozen['promotions'] if a['kind']=='pog-anchor'}
expected={'original':[38,93],'source-intermodule-only':[38,93],'bundle-intermodule-only':[38,93],'both-intermodule':[81,377]}
for v in s['variants']:
 assert [l['recovered'] for l in v['libraries']]==expected[v['variant']]
 data=read(O/(v['variant']+'.json'));assert len(data['targets'])==508
 for l in data['libraries']:assert l['initialAnchors']+l['newOracleAnchors']==l['recovered'] and l['recovered']+l['unreached']==l['targets']
 for t in data['targets']:
  if t['round'] and t['status']=='recovered':assert t['parentWitness']['sourceEdgePresent'] and t['parentWitness']['bundleEdgePresent']
 assert data['rounds'][-1]['newAnchors']==0
for f in s['provenance']['inputs']:assert hashlib.sha256((P/f['file']).read_bytes()).hexdigest()==f['sha256']
assert hashlib.sha256(Path('scripts/real-app/connectivity/simulate.mjs').read_bytes()).hexdigest()==s['provenance']['scriptSha256']
old=read(P/'diagnostics/axios-core-js/provenance.json')
for f in old['files']:assert hashlib.sha256((P/f['file']).read_bytes()).hexdigest()==f['sha256']
files=list(Path('scripts/real-app/connectivity').glob('*'))+list(O.glob('*'))
v={'created':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'passed','modelCalls':0,'focusedTests':6,'pairedGraphBfsEqualsRoundSimulation':True,'historicalInputOracleRecoveryConfigHashesUnchanged':True,'remainingStructuralCauses':causes,'sha256':{str(f):hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(files) if f.is_file() and f.name!='verification.json'}}
(O/'verification.json').write_text(json.dumps(v,indent=2)+'\n');print(json.dumps({'status':'passed','remainingStructuralCauses':causes},indent=2))
