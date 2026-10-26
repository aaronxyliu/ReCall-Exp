import pathlib,json,collections,hashlib,datetime
ROOT=pathlib.Path.cwd();P=ROOT/'results/real-app/vue-admin-template-all-libraries';O=P/'diagnostics/axios-core-js'
read=lambda p:json.loads(p.read_text())
def write(f,x):(O/f).write_text(json.dumps(x,indent=2)+'\n')
d=read(P/'detector-input.json');r=read(P/'recovery/webpack-vendor-real.json');rs=read(O/'target-traces.json');summary=read(O/'summary.json');refs=[f for s in d['sources'] for f in s['functions']];si={f['id']:i for i,f in enumerate(refs)};sourceof={f['id']:s for s in d['sources'] for f in s['functions']};b=next(x for x in d['bundles'] if x['build']==r['build']);bi={f['id']:i for i,f in enumerate(b['functions'])};truth={x['bundleId']:x for x in read(P/'ground-truth.json')['records'] if x['build']==r['build']}
def graph(fs,edges):
 a=[set() for f in fs]
 for e in edges:a[e['from']].add(e['to']);a[e['to']].add(e['from'])
 groups=collections.defaultdict(list)
 for i,f in enumerate(fs):groups[f['parent'] if f['parent'] is not None else 'root'].append(i)
 for group in groups.values():
  for i,u in enumerate(group):
   for v in group[i+1:i+3]:a[u].add(v);a[v].add(u)
 return a
edges=[];offset=0
for s in d['sources']:
 edges.extend({**e,'from':e['from']+offset,'to':e['to']+offset} for e in s['edges']);offset+=len(s['functions'])
sg=graph(refs,edges);bg=graph(b['functions'],b['edges']);accepted={bi[p['bundleId']]:si[p['sourceId']] for p in r['promotions']};used=set(accepted.values());source_owner={p['sourceId']:p for p in r['promotions']}
def around(i,g,radius):
 seen={i};front={i}
 for hop in range(radius):
  front={v for u in front for v in g[u]}-seen;seen.update(front)
 return seen-{i}
rad=[]
for radius in [1,2,3]:
 rows=[]
 for x in rs:
  if x['outcome']!='never_queried':continue
  bn=around(bi[x['bundleId']],bg,radius);parents=bn&accepted.keys();candidates={s for p in parents for s in around(accepted[p],sg,radius) if s not in used and len(refs[s]['code'])<=18000}
  rows.append({'library':x['library'],'bundleId':x['bundleId'],'sourceId':x['sourceId'],'acceptedNeighbors':len(parents),'candidateCount':len(candidates),'correctCandidateAvailable':si[x['sourceId']] in candidates})
 rad.append({'radius':radius,'policy':'Static final-seed candidate availability only; no ranking, validation, or promotion rerun.','libraries':[{'library':lib,'neverQueriedTargets':sum(x['library']==lib for x in rows),'wouldHaveSomeCandidates':sum(x['library']==lib and x['candidateCount']>0 for x in rows),'wouldContainCorrectCandidate':sum(x['library']==lib and x['correctCandidateAvailable'] for x in rows)} for lib in ['axios','core-js']],'targets':rows})
write('radius-sensitivity.json',rad);summary['radiusSensitivity']=[{k:v for k,v in x.items() if k!='targets'} for x in rad]
for lib in summary['libraries']:
 l=lib['library'];lib['sourceComponentCoverageCeilingTargets']=lib['targets']-lib['targetsInUnseededSourceComponents'];lib['sourceComponentCoverageCeilingPercent']=100*lib['sourceComponentCoverageCeilingTargets']/lib['targets'];lib['correctAmongSourceComponentCoveredTargetsPercent']=100*lib['correct']/lib['sourceComponentCoverageCeilingTargets']
 ts={x['bundleId']:x['sourceId'] for x in rs if x['library']==l};checks=[p for p in r['pairs'] if ts.get(p['bundleId'])==p['sourceId']];bytarget=collections.defaultdict(list)
 for p in checks:bytarget[p['bundleId']].append(p['verdict'])
 lib['truePairsActuallyChecked']={'uniqueTargets':len(bytarget),'everAccepted':sum('accept' in vs for vs in bytarget.values()),'neverAccepted':sum('accept' not in vs for vs in bytarget.values()),'pairAttemptsIncludingCacheReplays':len(checks),'caveat':'Conditional on the reached/selected true pairs, not an estimate for the unqueried population.'}
# Every considered reference component is exactly file-local; threshold changes are structural diagnostics.
comp={x['sourceId']:x['sourceComponent'] for x in rs}
for row in summary['thresholdSensitivity']:
 full=next(x for x in read(O/'threshold-sensitivity.json') if x['threshold']==row['threshold'])
 for l in row['libraries']:
  comps={comp[p['sourceId']] for p in full['pairs'] if p['library']==l['library'] and p['sourceId'] in comp}
  l['supportedTargetsInSeededSourceComponents']=sum(x['library']==l['library'] and x['sourceComponent'] in comps for x in rs)
 row['scope']='All six reference libraries versus the full vendor chunk; oracle-scored prospective seeds only.'
# Module-import components include files without functions; keep package instances separate.
imports=read(O/'relative-imports.json');files={s['file']:s for s in d['sources'] if s['library'] in ['axios','core-js']};adj={f:set() for f in files}
for x in imports:
 if x['to'] in files:adj[x['from']].add(x['to']);adj[x['to']].add(x['from'])
seen=set();mcs=[]
for f in adj:
 if f in seen:continue
 q=[f];seen.add(f)
 for u in q:
  for v in adj[u]-seen:seen.add(v);q.append(v)
 mcs.append({'library':files[f]['library'],'packageInstances':sorted({files[v]['packageInstance'] for v in q}),'sourceFiles':len(q)})
summary['relativeImportAnalysis']['moduleComponents']=mcs
# Concrete source + generated-code cases, selected by known experimental outcomes for explanation only.
examples=[]
for x in rs:
 if (x['library']=='axios' and x['file'].endswith('/utils.js') and x['sourceName'] in ['forEach','isArray']) or (x['library']=='core-js' and x['file'].endswith('/library/modules/_iter-define.js') and x['sourceName'] in ['keys','values','entries']) or x['sourceIdentityDisplaced'] or (x['outcome']=='never_queried' and x['sourceComponentHasAnchor']):
  sf=refs[si[x['sourceId']]];bf=b['functions'][bi[x['bundleId']]];entry={'trace':x,'source':sf,'bundle':bf,'queries':[q for q in r['queries'] if q['bundleId']==x['bundleId']],'pairs':[p for p in r['pairs'] if p['bundleId']==x['bundleId']],'oracle':truth[x['bundleId']]}
  if x['sourceIdentityDisplaced']:entry['sourceAssignedToBundle']=b['functions'][bi[source_owner[x['sourceId']]['bundleId']]]
  examples.append(entry)
write('examples.json',examples)
# Per-target CSV retains nonexclusive structural causes beside the exclusive observed outcome.
import csv
fields=['library','packageInstance','file','sourceName','sourceId','bundleId','sourceOperations','bundleOperations','outcome','sourceComponentHasAnchor','neverQueriedGate','queryCount','correctPairChecks','sourceIdentityDisplaced']
with (O/'target-traces.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows({k:x.get(k) for k in fields} for x in rs)
# Read-only population comparison with the monolithic pilot.
pilot=read(ROOT/'results/jquery-4.0.0/experiment-4-minified-ranking-top5/detector-input.json');fs=[f for s in pilot['sources'] for f in s['functions']];es=[];offset=0
for s in pilot['sources']:es.extend({**e,'from':e['from']+offset,'to':e['to']+offset} for e in s['edges']);offset+=len(s['functions'])
g=graph(fs,es);seen=set();n=0
for i in range(len(fs)):
 if i in seen:continue
 n+=1;q=[i];seen.add(i)
 for u in q:
  for v in g[u]-seen:seen.add(v);q.append(v)
summary['jqueryComparison']={'sourceFiles':len(pilot['sources']),'sourceFunctions':len(fs),'sourceGraphComponents':n,'meaning':'A seeded single-file component supports within-file expansion; this does not test source import/export propagation.'}
write('summary.json',summary)
# Provenance includes hashes of completed inputs; historical recovery/oracle files remain unmodified.
inputs=['detector-input.json','ground-truth.json','recovery/webpack-vendor-real.json','study-config.json']
write('provenance.json',{'created':datetime.datetime.now(datetime.timezone.utc).isoformat(),'modelCalls':0,'recoveryInputsModified':False,'files':[{'file':f,'sha256':hashlib.sha256((P/f).read_bytes()).hexdigest()} for f in inputs],'scripts':[{'file':str(f.relative_to(ROOT)),'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in [ROOT/'scripts/real-app/diagnostics/axios-core-js.mjs',ROOT/'scripts/real-app/diagnostics/enrich-axios-core-js.py',ROOT/'scripts/real-app/diagnostics/module-export-witness.mjs']]})
print(json.dumps({'libraries':summary['libraries'],'radius':summary['radiusSensitivity'],'moduleComponents':mcs,'pilot':summary['jqueryComparison']},indent=2))
