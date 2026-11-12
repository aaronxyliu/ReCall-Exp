"""Recompute a compact live report from immutable evaluations and current telemetry."""
import json,time,argparse,statistics
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('root',type=Path);a=p.parse_args();root=a.root
state=json.loads((root/'progress.json').read_text());rows=[]
revision=json.loads((root/'evaluation-revision.json').read_text()) if (root/'evaluation-revision.json').exists() else None
evaluation_name='evaluation-v2.json' if revision else 'evaluation.json'
for f in sorted(root.glob('*/*/run/'+evaluation_name)):
 r=json.loads(f.read_text())
 if revision and r.get('oracleRevision',{}).get('indexSHA256')!=revision['indexSHA256']:continue
 t=json.loads((f.parents[1]/'timing.json').read_text());rows.append(dict(subject='/'.join(f.parts[-4:-2]),**r,timing=t))
ratio=lambda n,d:n/d if d else None
counts={k:sum(r[k] for r in rows) for k in ['groundTruthPairs','correct','recovered','wrong','allPromotions','unassessedPromotions','anchors','correctAnchors','rankedTargets','top5FirstHit','allValidationChecks']}
v={k:sum(r['validation'][k] for r in rows) for k in ['tp','fp','tn','fn','invalidOrError','decisions']}
ast={k:sum(r.get('astValidation',{}).get(k,0) for r in rows) for k in ['tp','fp','tn','fn','invalidOrError','decisions']}
ast['acceptancePrecision']=ratio(ast['tp'],ast['tp']+ast['fp'])
macro=[r['recoveryRate'] for r in rows if r['recoveryRate'] is not None]
libmacro=[l['recoveryRate'] for r in rows for l in r['byLibrary'] if l['recoveryRate'] is not None]
metrics=dict(repositoryMacroRecovery=statistics.mean(macro) if macro else None,libraryCaseMacroRecovery=statistics.mean(libmacro) if libmacro else None,recoveryRate=ratio(counts['correct'],counts['groundTruthPairs']),recoveryPrecision=ratio(counts['correct'],counts['recovered']),anchorRate=ratio(counts['anchors'],counts['groundTruthPairs']),top5FirstRate=ratio(counts['top5FirstHit'],counts['rankedTargets']),validationAccuracy=ratio(v['tp']+v['tn'],v['decisions']),validationAcceptancePrecision=ratio(v['tp'],v['tp']+v['fp']))
without=[r for r in rows if r['subject']!='esbuild/okikio--bundlejs']
metrics['recoveryExcludingBundlejs']=ratio(sum(r['correct'] for r in without),sum(r['groundTruthPairs'] for r in without))
live=None
if state['running']:
 f=root/state['running']/'live.json'
 if f.exists():
  try:live=json.loads(f.read_text())
  except json.JSONDecodeError:pass
multiplicity={key:sum(r.get('multipleMatches',{}).get(key,0) for r in rows) for key in ['bundledFunctionsWithMultipleSources','sourceFunctionsWithMultipleTargets','sourceChunkGroupsWithMultipleTargets']}
report=dict(groundTruthRevision=revision,multipleMatches=multiplicity,updatedAt=time.time(),state=state,completedCounts=counts,completedMetrics=metrics,validation=v,astValidation=ast,current=live,repositories=rows)
(root/'report.json').write_text(json.dumps(report,indent=2))
lines=['# RQ1 live results','',('Ground truth: '+revision['pairDefinition']+'; cohort pairs: '+str(revision['cohortGroundTruthPairs'])+'. Original-oracle scores remain in evaluation.json.') if revision else 'Ground truth: frozen original oracle (v1).','',f"Completed: {len(rows)}/{state['total']}; failed: {len(state['failed'])}. Running: {state['running'] or 'none'}.",'','Metrics below cover completed repositories only.','', '| Repository | GT pairs | Correct | Recovery | Pair precision | Any-match precision | Multi-source targets | Anchors | Time (s) |','|---|---:|---:|---:|---:|---:|---:|---:|---:|']
pct=lambda x:'—' if x is None else f'{100*x:.2f}%'
for r in rows:lines.append(f"| {r['subject']} | {r['groundTruthPairs']} | {r['correct']} | {pct(r['recoveryRate'])} | {pct(r['recoveryPrecision'])} | {pct(r.get('anyMatchTargetPrecision'))} | {r.get('multipleMatches',{}).get('bundledFunctionsWithMultipleSources',0)} | {r['anchors']} | {r['timing']['totalWallMs']/1000:.1f} |")
lines += ['',f"Bundled functions with multiple accepted sources: {multiplicity['bundledFunctionsWithMultipleSources']}; source/chunk groups with multiple accepted targets: {multiplicity['sourceChunkGroupsWithMultipleTargets']}."]
lines += ['',f"AST acceptance precision (assessed checks): {pct(ast['acceptancePrecision'])}; Qwen acceptance precision: {pct(metrics['validationAcceptancePrecision'])}.",'AST nonmatches fall through to Qwen and are not counted as negative validation decisions. These check-level metrics include repeated/cached decisions; per-repository acceptanceChannels reports committed-match precision separately.']
(root/'REPORT.md').write_text('\n'.join(lines)+'\n')
libraries=[]
for r in rows:
 for lib in r['byLibrary']:
  cost=r['timing'].get('byLibrary',{}).get(lib['library'],{})
  libraries.append(dict(subject=r['subject'],**lib,candidateLibraryValidationMs=cost.get('validationMs',0),candidateLibraryValidationCalls=cost.get('validationCalls',0),sharedRepositoryStagesMs=r['timing']['stages'],sharedRepositoryEmbeddingMs=r['timing']['embeddingMs']))
(root/'library-results.json').write_text(json.dumps(libraries,indent=2))

print(json.dumps({k:report[k] for k in ['completedCounts','completedMetrics','validation']},indent=2))
if live:print('CURRENT',json.dumps({k:live.get(k) for k in ['repo','stage','round','validationCalls','recovered','elapsedMs']}))
