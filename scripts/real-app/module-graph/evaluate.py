"""Offline oracle assessment. Never feeds oracle labels back into graph construction."""
from pathlib import Path
import json,collections,hashlib
P=Path('results/real-app/vue-admin-template-all-libraries');O=P/'diagnostics/d-bundlr-module-graph'
read=lambda p:json.loads(p.read_text())
g=read(O/'module-graph.json');pr=read(O/'proposals.json');d=read(P/'detector-input.json');truth=read(P/'ground-truth.json')['records'];traces=read(P/'diagnostics/axios-core-js/target-traces.json');mods={m['id']:m for m in g['modules']};sf={f['id']:s for s in d['sources'] for f in s['functions']};labels={t['bundleId']:t for t in truth if t['build']=='webpack-vendor-real'}
assessed=[]
for p in pr['functionSlotProposals']:
 t=labels.get(p['bundleId']);verdict='unassessed' if not t or not t.get('sourceId') else 'correct' if t['sourceId']==p['sourceId'] else 'wrong'
 if t and t.get('nonTarget'):verdict='wrong'
 assessed.append({**p,'offlineAssessment':verdict,'library':sf[p['sourceId']]['library'],'previouslyNeverQueried':any(x['bundleId']==p['bundleId'] and x['sourceId']==p['sourceId'] and x['outcome']=='never_queried' for x in traces)})
module_audit=[]
for p in pr['modulePairs']:
 s=mods[p['sourceModule']];b=mods[p['bundleModule']];ts=[labels[f] for f in b['functionIds'] if f in labels and labels[f].get('sourceId')];agree=sum(sf[t['sourceId']]['file']==s['file'] for t in ts)
 module_audit.append({**p,'sourceFile':s['file'],'supportedBundleFunctions':len(ts),'sameSourceFile':agree,'otherSourceFile':len(ts)-agree})
# Compare connected-component coverage of source functions using identical baseline anchors.
fs=[f for s in d['sources'] for f in s['functions']];idx={f['id']:i for i,f in enumerate(fs)};adj=[set() for f in fs];offset=0
for s in d['sources']:
 for e in s['edges']:u=e['from']+offset;v=e['to']+offset;adj[u].add(v);adj[v].add(u)
 groups=collections.defaultdict(list)
 for f in s['functions']:groups[f['parent']].append(idx[f['id']])
 for group in groups.values():
  for i,u in enumerate(group):
   for v in group[i+1:i+3]:adj[u].add(v);adj[v].add(u)
 offset+=len(s['functions'])
seeds={idx[p['sourceId']] for p in pr['anchors']}
def reachable(a):
 seen=set(seeds);q=list(seeds)
 for u in q:
  for v in a[u]-seen:seen.add(v);q.append(v)
 return seen
before=reachable(adj)
for e in g['functionEdges']:
 if e['from'] in idx and e['to'] in idx:u=idx[e['from']];v=idx[e['to']];adj[u].add(v);adj[v].add(u)
after=reachable(adj)
rows=[]
for lib in ['axios','core-js']:
 ts=[t for t in traces if t['library']==lib]
 rows.append({'library':lib,'supportedTargets':len(ts),'sourceComponentCoverageBefore':sum(idx[t['sourceId']] in before for t in ts),'sourceComponentCoverageWithResolvedCalls':sum(idx[t['sourceId']] in after for t in ts),'neverQueriedSourceTargetsNewlyConnected':sum(t['outcome']=='never_queried' and idx[t['sourceId']] in after and idx[t['sourceId']] not in before for t in ts)})
# Module membership/import traversal is a different, coarser candidate graph.
ma={m:set() for m in mods}
for e in g['imports']:
 if e['to']:ma[e['from']].add(e['to']);ma[e['to']].add(e['from'])
fm={f:m['id'] for m in g['modules'] for f in m['functionIds']};seen={fm[p['sourceId']] for p in pr['anchors'] if p['sourceId'] in fm};q=list(seen)
for m in q:
 for v in ma[m]-seen:seen.add(v);q.append(v)
for r in rows:r['sourceModuleImportComponentCoverage']=sum(fm.get(t['sourceId']) in seen for t in traces if t['library']==r['library'])
counts=lambda xs:dict(collections.Counter(xs))
summary={'policy':'Offline assessment of a code-only graph and proposals. Connectivity is an upper bound on candidate reachability, not recovery or precision; no model calls. Source maps used only here for assessment. Static analysis is partial, flow-insensitive, and not a soundness proof.','solver':g['solver'],'sourceModules':sum(m['kind']=='source' for m in mods.values()),'bundleModules':sum(m['kind']=='bundle' for m in mods.values()),'resolvedImportSitesBySide':counts(mods[e['from']]['kind'] for e in g['imports'] if e['to']),'unresolvedImports':[e for e in g['imports'] if not e['to']],'singletonCrossModuleCallSitesBySide':counts(mods[e['fromModule']]['kind'] for e in g['functionEdges']),'ambiguousCrossModuleFunctionTargetsBySide':counts(mods[e['fromModule']]['kind'] for e in g['ambiguousCalls']),'modulePairProposals':len(pr['modulePairs']),'modulePairOracleAudit':{'noConflictingSupportedFunctions':sum(x['supportedBundleFunctions']>0 and x['otherSourceFile']==0 for x in module_audit),'withConflicts':sum(x['otherSourceFile']>0 for x in module_audit),'withoutSupportedFunctions':sum(x['supportedBundleFunctions']==0 for x in module_audit)},'exportSlotProposalAssessments':counts(x['offlineAssessment'] for x in assessed),'uniqueExportSlotPairAssessments':counts(v for _,v in {(x['sourceId']+'|'+x['bundleId'],x['offlineAssessment']) for x in assessed}),'correctPreviouslyNeverQueriedExportSlotPairs':len({(x['sourceId'],x['bundleId']) for x in assessed if x['offlineAssessment']=='correct' and x['previouslyNeverQueried']}),'libraries':rows}
for name,obj in [('summary.json',summary),('assessed-proposals.json',assessed),('assessed-module-pairs.json',module_audit)]: (O/name).write_text(json.dumps(obj,indent=2)+'\n')
print(json.dumps(summary,indent=2))
# Illustrative paired source/bundle call edges; oracle used to select examples only after extraction.
inv=collections.defaultdict(set)
for t in truth:
 if t.get('sourceId'):inv[t['sourceId']].add(t['bundleId'])
be={(e['from'],e['to']):e for e in g['functionEdges'] if mods[e['fromModule']]['kind']=='bundle'};examples=[]
for e in g['functionEdges']:
 if mods[e['fromModule']]['kind']!='source' or 'utils.' not in e['calleeText']:continue
 for f in sorted(inv[e['from']]):
  for to in sorted(inv[e['to']]):
   if (f,to) in be:examples.append({'sourceEdge':e,'bundleEdge':be[f,to],'sourceCallerFile':mods[e['fromModule']]['file'],'sourceCalleeFile':mods[e['toModule']]['file']})
(O/'edge-witnesses.json').write_text(json.dumps(examples[:10],indent=2)+'\n')
