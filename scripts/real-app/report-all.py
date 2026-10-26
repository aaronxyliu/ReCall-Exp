import csv,hashlib,json,pathlib,datetime,collections,re
ROOT=pathlib.Path.cwd();P=ROOT/'results/real-app/vue-admin-template-all-libraries'
read=lambda f:json.loads((P/f).read_text())
def write(f,x):
 dest=P/f;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(json.dumps(x,indent=2)+'\n')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def pct(n,d):return 100*n/d if d else None
d=read('detector-input.json');gt=read('ground-truth.json');cfg=read('study-config.json');prov=read('input-provenance.json');truth={x['bundleId']:x for x in gt['records']};refs={f['id']:{**f,'library':s['library'],'packageInstance':s['packageInstance']} for s in d['sources'] for f in s['functions']};bfs={f['id']:f for b in d['bundles'] for f in b['functions']};runs=[]
assert len(refs)==sum(len(s['functions']) for s in d['sources']);assert len(truth)==len(bfs)
for b in d['bundles']:
 f=P/'recovery'/str(b['build']+'.json');r=json.loads(f.read_text()) if f.exists() else {'status':'awaiting-checkpoint','build':b['build'],'promotions':[],'pairs':[],'queries':[]};runs.append(r)
promotions=[p for r in runs for p in r['promotions']];pairs=[p for r in runs for p in r['pairs']];queries=[q for r in runs for q in r['queries']];promos={p['bundleId']:p for p in promotions}
assert len(promos)==len(promotions)
for r in runs:assert len({p['sourceId'] for p in r['promotions']})==len(r['promotions'])
def label(p):
 t=truth[p['bundleId']];return 'wrong' if t['nonTarget'] else 'unassessed' if not t['sourceId'] else 'correct' if t['sourceId']==p['sourceId'] else 'wrong'
rows=[]
for lib in cfg['libraries']:
 sf=[f for f in refs.values() if f['library']==lib];ts=[t for t in truth.values() if t['sourceId'] and refs[t['sourceId']]['library']==lib];pred=[p for p in promotions if refs[p['sourceId']]['library']==lib];count=collections.Counter(label(p) for p in pred);unique={t['sourceId'] for t in ts};correct=[t for t in ts if promos.get(t['bundleId'],{}).get('sourceId')==t['sourceId']]
 rows.append({'library':lib,'declaredVersion':prov['libraryVersions'][lib],'sourceFiles':sum(s['library']==lib for s in d['sources']),'referenceFunctions':len(sf),'supportedBundleTargets':len(ts),'uniqueSupportedSourceFunctions':len(unique),'sourceFunctionsWithoutSupportedCounterpart':len(sf)-len(unique),'correct':len(correct),'wrongPredictions':count['wrong'],'unassessedPredictions':count['unassessed'],'recoveryPercent':pct(len(correct),len(ts)),'assessedIdentityPrecisionPercent':pct(count['correct'],count['correct']+count['wrong']),'anchors':dict(collections.Counter(label(p) for p in pred if p['kind']=='pog-anchor'))})
instances=[]
for instance in sorted({f['packageInstance'] for f in refs.values()}):
 sf=[f for f in refs.values() if f['packageInstance']==instance];ids={f['id'] for f in sf};ts=[t for t in truth.values() if t['sourceId'] in ids];correct=sum(promos.get(t['bundleId'],{}).get('sourceId')==t['sourceId'] for t in ts)
 instances.append({'packageInstance':instance,'library':sf[0]['library'],'referenceFunctions':len(sf),'supportedTargets':len(ts),'correct':correct,'recoveryPercent':pct(correct,len(ts))})
write('package-instance-summary.json',instances)
byquery=collections.defaultdict(list);bypair=collections.defaultdict(list);bytruth=collections.defaultdict(list)
for q in queries:byquery[q['bundleId']].append(q)
for q in pairs:bypair[(q['bundleId'],q['sourceId'])].append(q)
for t in truth.values():
 if t['sourceId']:bytruth[t['sourceId']].append(t)
missing=[]
for t in truth.values():
 if not t['sourceId'] or promos.get(t['bundleId'],{}).get('sourceId')==t['sourceId']:continue
 qs=byquery[t['bundleId']];ps=bypair[(t['bundleId'],t['sourceId'])]
 if t['bundleId'] in promos:reason='wrong_identity_promoted'
 elif not qs:reason='never_queried_no_matched_neighbor_or_size_limit'
 elif not any(any(c['sourceId']==t['sourceId'] for c in q['candidates']) for q in qs):reason='correct_identity_never_in_candidate_pool'
 elif not any(t['sourceId'] in q.get('topCandidates',q['topThree']) for q in qs):reason='correct_identity_never_in_top_five'
 elif not ps:reason='correct_identity_ranked_but_first_positive_stopped_validation'
 elif any(p['verdict']=='accept' for p in ps):reason='correct_accepted_but_promotion_conflict'
 else:reason='correct_identity_checked_but_never_accepted'
 missing.append({'build':t['build'],'bundleId':t['bundleId'],'sourceId':t['sourceId'],'library':refs[t['sourceId']]['library'],'reason':reason})
write('unrecovered-targets.json',missing);write('source-functions-without-supported-counterpart.json',[f for f in refs.values() if f['id'] not in bytruth])
wrong=[];unassessed=[]
for p in promotions:
 outcome=label(p)
 if outcome=='correct':continue
 b=bfs[p['bundleId']];entry={'prediction':p,'source':refs[p['sourceId']],'bundle':b,'oracle':truth[p['bundleId']],'correctSource':refs.get(truth[p['bundleId']]['sourceId']),'pairChecks':bypair[(p['bundleId'],p['sourceId'])]}
 if outcome=='wrong':wrong.append(entry)
 else:
  inner=[t for t in bytruth[p['sourceId']] if t['build']==truth[p['bundleId']]['build'] and b['span'][0]<bfs[t['bundleId']]['span'][0] and bfs[t['bundleId']]['span'][1]<b['span'][1]]
  empty=lambda c:re.fullmatch(r'function\s*(?:[A-Za-z_$][\w$]*)?\s*\([^)]*\)\s*\{(?:\s|/\*[\s\S]*?\*/)*\}',c) is not None
  review='encloses-distinct-supported-counterpart' if inner else 'empty-body-origin-unresolved' if empty(b['code']) and empty(entry['source']['code']) else 'requires-review'
  entry.update({'structuralReview':review,'supportedInnerCounterparts':inner});unassessed.append(entry)
for i,c in enumerate(wrong,1):write('wrong-identities/W%04d.json'%i,c)
write('unassessed-predictions.json',{'policy':'Primary oracle labels unchanged. Enclosing a distinct supported counterpart is evidence of a wrapper mismatch; equal empty bodies do not establish origin. No audit results enter matching.','cases':unassessed})
checks=[];base=pathlib.Path(read('implementation-manifest.json')['baseline'])
for f in read('implementation-manifest.json')['files']:assert sha(P/'implementation'/f['file'])==f['sha256'],f
for name in ['recover.mjs','models.mjs','analysis.mjs','measure.mjs','promotion-policy.mjs','minify-source-function.mjs']:assert sha(P/'implementation/scripts/jquery'/name)==sha(base/'implementation/scripts/jquery'/name)
assert sha(P/'implementation/notes/jquery/validator-system-prompt.txt')==sha(base/'implementation/notes/jquery/validator-system-prompt.txt');checks.append('Matching, ranking, promotion, and model implementation plus prompt equal preliminary experiment 4; persistence-only change recorded separately')
change=read('persistence-change.json')
assert sha(P/'checkpoint-persistence-before/common.mjs')==change['originalSha256']==sha(base/'implementation/scripts/jquery/common.mjs')
assert sha(P/'implementation/scripts/jquery/common.mjs')==change['updatedSha256']
checks.append('Only the persistence helper differs from the preliminary implementation; original and updated hashes preserved')
for x in prov['artifacts']:
 assert sha(P/x['bundle'])==x['artifact']['jsSha256'];assert sha(P/x['map'])==x['artifact']['mapSha256']
checks.append('Both complete production chunks and maps match pinned corpus hashes')
for s in d['sources']:
 assert sha(P/s['sourceFile'])==s['sha256']
 for f in s['functions']:assert f['parent']==s['key']+':'+str(f['localParent'] if f['localParent'] is not None else 'root')
for f in prov['repositoryEvidence']:assert sha(P/f['file'])==f['sha256']
checks.append('Reference source identities preserve package paths and file-local parent groups')
for f in prov['importedCache']['validations']:assert sha(P/'model-cache/validations'/f['file'])==f['sha256']
checks.append('Imported exact-request validation caches retain original hashes')
metaFile=P/'model-manifest.json'
if metaFile.exists():assert read('model-manifest.json')['digests']==json.loads((base/'model-manifest.json').read_text())['digests'];checks.append('Actual model digests equal preliminary experiment 4')
raws=[json.loads(f.read_text()) for f in (P/'model-cache/validations').glob('*.json')]
for c in raws:
 body=c['request'];assert body['model']=='qwen3.5:27b' and body['think'] is False and body['options']=={'temperature':0,'num_ctx':16384,'num_predict':384,'seed':42};assert c.get('response',{}).get('message',{}).get('thinking','') in ['',None]
 assert body['messages'][0]['content']==(P/'implementation/notes/jquery/validator-system-prompt.txt').read_text();assert set(json.loads(body['messages'][1]['content']))=={'source_function','minified_source_function','bundled_function'}
for r in runs:
 if 'configuration' in r:assert r['configuration']['embedding']=='qwen3-embedding:0.6b' and r['configuration']['topK']==5 and r['configuration']['thinking'] is False and r['configuration']['promotionPolicy']=='first-positive'
checks.append('All saved validation requests use unchanged 27B settings, prompt, and think false; ranking uses 0.6B and top five')
for t in truth.values():
 if t['sourceId']:assert t['sourceId'] in refs and t['mappedOwnPoints']>=2 and t['purity']>=.8
assert not any(f['extractionStatus']!='ok' for f in refs.values());assert not any(f['extractionStatus']!='ok' for f in bfs.values());checks.append('No source or bundle extraction failures; unique promotions per build; oracle thresholds satisfied')
count=collections.Counter(label(p) for p in promotions);targets=sum(x['supportedBundleTargets'] for x in rows);status='complete' if all(r['status']=='fixed-point' for r in runs) else 'in-progress';now=datetime.datetime.now(datetime.timezone.utc).isoformat();usedKeys={p['cacheKey'] for p in pairs};importedKeys={pathlib.Path(x['file']).stem for x in prov['importedCache']['validations']}
summary={'created':now,'status':status,'repo':prov['repo'],'commit':prov['commit'],'referenceFunctions':len(refs),'sourceFiles':len(d['sources']),'packageInstances':len(instances),'bundleFunctions':len(bfs),'supportedBundleTargets':targets,'correct':count['correct'],'wrong':count['wrong'],'unassessedPredictions':count['unassessed'],'recoveryPercent':pct(count['correct'],targets),'assessedIdentityPrecisionPercent':pct(count['correct'],count['correct']+count['wrong']),'libraries':rows,'builds':[{'build':r['build'],'status':r['status'],'round':r.get('round'),'promotions':len(r['promotions']),'anchors':r.get('anchors'),'pairs':len(r['pairs']),'modelCalls':r.get('modelCalls'),'cacheHits':r.get('cacheHits'),'elapsedMs':r.get('elapsedMs')} for r in runs],'unrecoveredBreakdown':dict(collections.Counter(x['reason'] for x in missing)),'pairEvaluations':len(pairs),'uniqueUsedValidationRequests':len(usedKeys),'importedUsedValidationRequests':len(usedKeys&importedKeys),'newUsedValidationRequests':len(usedKeys-importedKeys),'invalidUsedResponses':sum(c['key'] in usedKeys and c.get('verdict')=='invalid' for c in raws),'errorUsedResponses':sum(c['key'] in usedKeys and c.get('verdict')=='error' for c in raws),'unassessedStructuralReview':dict(collections.Counter(x['structuralReview'] for x in unassessed)),'policy':'Exact source-map identity agreement on supported bundle occurrences; duplicate source instances distinguished by package path. Unassessed kept separate. Saved published build-input JS is the reference, not upstream modules absent from the browser build.','cachePolicy':cfg['cachePolicy'],'timingPolicy':'Run continued after a persistence-only optimization. Per-process elapsedMs and modelCalls/cacheHits belong to the final replay process. Unique used request counts and raw request timestamps cover the whole experiment; cache replay is not fresh inference time.','persistenceOnlyChange':change}
manual=read('manual-review-notes.json') if (P/'manual-review-notes.json').exists() else {'cases':[]}
for x in manual['cases']:
 assert x['bundleId'] in promos and promos[x['bundleId']]['sourceId']==x['sourceId'] and label(promos[x['bundleId']])=='unassessed'
summary['supplementalManuallyEstablishedWrongIdentities']=sum(x['verdict']=='wrong-identity' for x in manual['cases'])
if (P/'persistence-replay-verification.json').exists():
 assert read('persistence-replay-verification.json')['passed'];checks.append('Replay reproduces the complete saved prefix of matching decisions')
elif status=='complete':raise AssertionError('Persistence replay verification required')
assert sum(summary['unrecoveredBreakdown'].values())==targets-count['correct'];write('summary.json',summary);write('verification.json',{'created':now,'passed':True,'status':status,'checks':checks})
with (P/'function-outcomes.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=['build','bundleId','bundleName','oracleSourceId','oracleLibrary','predictedSourceId','predictedLibrary','outcome','kind']);w.writeheader()
 for bid,t in truth.items():
  p=promos.get(bid);w.writerow({'build':t['build'],'bundleId':bid,'bundleName':bfs[bid]['name'],'oracleSourceId':t['sourceId'],'oracleLibrary':refs.get(t['sourceId'],{}).get('library'),'predictedSourceId':p['sourceId'] if p else None,'predictedLibrary':refs[p['sourceId']]['library'] if p else None,'outcome':label(p) if p else 'missed-target' if t['sourceId'] else 'non-target-unpredicted' if t['nonTarget'] else 'unresolved-unpredicted','kind':p['kind'] if p else None})
md='# All directly declared JavaScript libraries: production application recovery\n\nStatus: **'+status+'**. `'+prov['repo']+'`, commit `'+prov['commit']+'`. '+str(len(refs))+' source functions from '+str(len(d['sources']))+' source files; '+str(len(bfs))+' bundled functions in both target-containing production chunks.\n\nUnchanged jQuery experiment-4 matching implementation, prompt, and model digests: qwen3.5:27b validation, qwen3-embedding:0.6b ranking; thinking off, T/F output, temperature 0, seed 42, context 16384, output budget 384, top five, first-positive promotion. Prior exact-request caches reused and recorded; candidate generation and promotion run afresh for this expanded joint pool.\n\n| Library | Source functions | Supported targets | Correct | Recovery | Oracle-assessed wrong | Oracle-unassessed |\n|---|---:|---:|---:|---:|---:|---:|\n'
for x in rows:md+='| '+x['library']+' | '+str(x['referenceFunctions'])+' | '+str(x['supportedBundleTargets'])+' | '+str(x['correct'])+' | '+(format(x['recoveryPercent'],'.2f')+'%' if x['recoveryPercent'] is not None else '—')+' | '+str(x['wrongPredictions'])+' | '+str(x['unassessedPredictions'])+' |\n'
md+='\nOverall: **'+str(count['correct'])+'/'+str(targets)+' ('+format(summary['recoveryPercent'],'.2f')+'%)** correct identities. Oracle-assessed wrong: '+str(count['wrong'])+'; unassessed promotions: '+str(count['unassessed'])+'. Wrong and unassessed columns use the predicted library; recall uses the true library. Aggregate results are dominated by Element UI.\n\nAll six directly declared JavaScript libraries are targets. Vue, Vue Router, Vuex, CSS, development tools, and other transitive package names are outside the target set; their code remains in the search inputs. Nested core-js package instances are included with distinct source-path identities. References are the exact published JavaScript build inputs present in sourcesContent; Element UI includes its precompiled distribution, with callbacks, wrappers, and bundled helpers counted as source definitions. This is not an inventory of documented APIs or upstream Vue single-file-component methods. Absent package modules are outside the build-linked population.\n\nThe full vendor and Element UI chunks are retained. No source-map identity labels enter matching. The original production build settings are preserved. File-local source parents are namespaced; no new module resolver is added. Promotion is one-to-one within each chunk, as in the preliminary algorithm; one source identity may legitimately appear in multiple chunks. Different source instances or repeated content can make POG anchors non-unique. Primary labels require >=2 own-body interior points, >=80% purity, and a unique winner. Source-map support is positional evidence, not formal semantic equivalence.\n\n## Missed targets\n\n'
for k,v in summary['unrecoveredBreakdown'].items():md+='- '+k+': '+str(v)+'\n'
md+='\nThese are exclusive pipeline outcomes; they do not establish semantic causes.\n\n## Unassessed output review\n\n'
for k,v in summary['unassessedStructuralReview'].items():md+='- '+k+': '+str(v)+'\n'
md+='\n## Snapshot persistence optimization\n\nThe original runner rewrote a 333 MB recovery checkpoint after almost every pair and query. A persistence-only change writes running snapshots atomically at most once per 30 seconds; fixed-point snapshots and per-request judgment caches still persist immediately. Matching code, ranking, query order, promotion, inputs, prompts, and model settings are unchanged. The saved pre-change checkpoint and implementation are retained. [Change provenance](persistence-change.json) and [decision-prefix replay verification](persistence-replay-verification.json) document the continuation. Per-process timings after continuation are not full fresh-inference timings.\n'
md+='\nExplicit post-hoc review has established '+str(summary['supplementalManuallyEstablishedWrongIdentities'])+' additional wrong identities among oracle-unassessed predictions. [Reviewed evidence](manual-review-notes.json) is retained separately.\n'
md+='\nStructural review is separate from primary scores and never feeds back into recovery. No claim of zero errors follows from unresolved oracle labels.\n\n[Summary](summary.json), [package-instance counts](package-instance-summary.json), [function outcomes](function-outcomes.csv), [unrecovered targets](unrecovered-targets.json), [unassessed source/bundle evidence](unassessed-predictions.json), [ground truth](ground-truth.json), [provenance](input-provenance.json), [verification](verification.json), [configuration](study-config.json), [execution status](execution-status.json), and [run log](run.log). Oracle-assessed errors are saved in wrong-identities/.\n'
(P/'REPORT.md').write_text(md)
print(json.dumps({k:v for k,v in summary.items() if k not in ['policy','cachePolicy']},indent=2))
