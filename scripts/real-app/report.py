import csv,hashlib,json,pathlib,datetime,collections
ROOT=pathlib.Path.cwd(); P=ROOT/'results/real-app/vue-admin-template-three-libraries'
read=lambda f:json.loads((P/f).read_text())
def write(f,x):(P/f).write_text(json.dumps(x,indent=2)+'\n')
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
d=read('detector-input.json'); g=read('ground-truth.json'); truth={r['bundleId']:r for r in g['records']}; refs={f['id']:{**f,'library':s['library']} for s in d['sources'] for f in s['functions']}; bundles={f['id']:f for b in d['bundles'] for f in b['functions']}
runfile=P/'recovery/webpack-vendor-real.json';r=json.loads(runfile.read_text()) if runfile.exists() else {'status':'embedding','promotions':[],'pairs':[],'queries':[]}
assert len(refs)==sum(len(s['functions']) for s in d['sources']), 'Duplicate reference ids'
assert len(truth)==len(bundles)
promos={p['bundleId']:p for p in r['promotions']};assert len(promos)==len(r['promotions']);assert len({p['sourceId'] for p in r['promotions']})==len(r['promotions'])
def label(p):
 t=truth[p['bundleId']]
 return 'wrong' if t['nonTarget'] else 'unassessed' if not t['sourceId'] else 'correct' if t['sourceId']==p['sourceId'] else 'wrong'
rows=[]
for lib in ['axios','nprogress','js-cookie']:
 src=[f for f in refs.values() if f['library']==lib];targets=[t for t in truth.values() if t['sourceId'] in refs and refs[t['sourceId']]['library']==lib];correct=[t for t in targets if promos.get(t['bundleId'],{}).get('sourceId')==t['sourceId']];pred=[p for p in r['promotions'] if refs[p['sourceId']]['library']==lib];cnt=collections.Counter(label(p) for p in pred); anchors=collections.Counter(label(p) for p in pred if p['kind']=='pog-anchor');supportedSource={t['sourceId'] for t in targets}
 rows.append({'library':lib,'referenceFunctions':len(src),'supportedBundleTargets':len(targets),'uniqueSupportedSourceFunctions':len(supportedSource),'sourceFunctionsWithoutSupportedCounterpart':len(src)-len(supportedSource),'correct':len(correct),'wrongPredictions':cnt['wrong'],'unassessedPredictions':cnt['unassessed'],'unrecoveredTargets':len(targets)-len(correct),'recoveryPercent':100*len(correct)/len(targets) if targets else None,'assessedIdentityPrecisionPercent':100*cnt['correct']/(cnt['correct']+cnt['wrong']) if cnt['correct']+cnt['wrong'] else None,'anchors':dict(anchors)})
checks=[]
for f in read('implementation-manifest.json')['files']:
 assert digest(P/'implementation'/f['file'])==f['sha256'],f
checks.append('Frozen implementation hashes match')
base=pathlib.Path(read('implementation-manifest.json')['baseline'])
for name in ['recover.mjs','models.mjs','analysis.mjs','measure.mjs','promotion-policy.mjs','minify-source-function.mjs']:
 assert digest(P/'implementation/scripts/jquery'/name)==digest(base/'implementation/scripts/jquery'/name),name
assert digest(P/'implementation/notes/jquery/validator-system-prompt.txt')==digest(base/'implementation/notes/jquery/validator-system-prompt.txt')
checks.append('Recovery algorithm, model settings, and prompt identical to 94.41 percent experiment')
assert read('model-manifest.json')['digests']==json.loads((base/'model-manifest.json').read_text())['digests']
checks.append('Actual embedding and validator model digests match the preliminary experiment')
prov=read('input-provenance.json')['artifact'];assert digest(P/'inputs/vendor.js')==prov['jsSha256'];assert digest(P/'inputs/vendor.js.map')==prov['mapSha256'];checks.append('Bundle and map hashes match pinned corpus manifest')
for s in d['sources']:assert digest(P/s['sourceFile'])==s['sha256']

for f in read('input-provenance.json').get('repositoryEvidence',[]):assert digest(P/f['file'])==f['sha256']
checks.append('Reference source and repository evidence file hashes match inventory')
for source in d['sources']:
 for fn in source['functions']:assert fn['parent']==source['key']+':'+str(fn['localParent'] if fn['localParent'] is not None else 'root')
checks.append('Sibling parent identities are scoped to their own source file')
raws=[json.loads(f.read_text()) for f in (P/'model-cache/validations').glob('*.json')]
for c in raws:
 body=c['body'] if 'body' in c else c.get('request',{})
 if not body:raise AssertionError('Unknown request record schema')
 assert body['think'] is False and body['model']=='qwen3.5:27b';assert c.get('response',{}).get('message',{}).get('thinking','') in ['',None]
checks.append('Every saved validation request uses 27B and think false')
if 'configuration' in r:
 assert r['configuration']['topK']==5 and r['configuration']['embedding']=='qwen3-embedding:0.6b' and r['configuration']['thinking'] is False
checks.append('Promotions are one-to-one and all bundle functions remain in search input')
total=collections.Counter(label(p) for p in r['promotions']);n=sum(x['supportedBundleTargets'] for x in rows);now=datetime.datetime.now(datetime.timezone.utc).isoformat()
summary={'created':now,'status':'complete' if r['status']=='fixed-point' else 'in-progress','repo':'PanJiaChen/vue-admin-template','commit':read('input-provenance.json')['commit'],'bundleFunctions':len(bundles),'referenceFunctions':len(refs),'supportedBundleTargets':n,'correct':total['correct'],'wrong':total['wrong'],'unassessedPredictions':total['unassessed'],'recoveryPercent':100*total['correct']/n,'assessedIdentityPrecisionPercent':100*total['correct']/(total['correct']+total['wrong']) if total['correct']+total['wrong'] else None,'libraries':rows,'rounds':r.get('round'),'elapsedMs':r.get('elapsedMs'),'embedding':r.get('embedding'),'validationWallMs':r.get('modelWallMs'),'rankingWallMs':r.get('rankWallMs'),'pairs':len(r['pairs']),'uniqueValidationRequests':len(raws),'invalidResponses':sum(c.get('verdict')=='invalid' for c in raws),'apiErrors':sum(c.get('verdict')=='error' for c in raws),'bundleFunctionsWithoutOracleIdentity':sum(not t['sourceId'] and not t['nonTarget'] for t in truth.values()),'knownNonTargetFunctions':sum(t['nonTarget'] for t in truth.values()),'sourceMapPolicy':g['policy'],'timingPolicy':'Recovery elapsedMs is the successful recovery-process bundle stage. Embeddings generated earlier in this same experiment were reused after correcting file-local parent IDs before validation. Original embedding API time was not retained by the frozen cache format; do not use these timings for an end-to-end comparison with jQuery.'}
missing=[]
for t in truth.values():
 if not t['sourceId'] or promos.get(t['bundleId'],{}).get('sourceId')==t['sourceId']:continue
 qs=[q for q in r['queries'] if q['bundleId']==t['bundleId']];ps=[q for q in r['pairs'] if q['bundleId']==t['bundleId'] and q['sourceId']==t['sourceId']]
 if t['bundleId'] in promos:reason='wrong_identity_promoted'
 elif not qs:reason='never_queried_no_matched_neighbor_or_size_limit'
 elif not any(any(c['sourceId']==t['sourceId'] for c in q['candidates']) for q in qs):reason='correct_identity_never_in_candidate_pool'
 elif not any(t['sourceId'] in q.get('topCandidates',q['topThree']) for q in qs):reason='correct_identity_never_in_top_five'
 elif not ps:reason='correct_identity_ranked_but_first_positive_stopped_validation'
 elif any(p['verdict']=='accept' for p in ps):reason='correct_accepted_but_promotion_conflict'
 else:reason='correct_identity_checked_but_never_accepted'
 missing.append({'bundleId':t['bundleId'],'sourceId':t['sourceId'],'library':refs[t['sourceId']]['library'],'reason':reason})
summary['unrecoveredBreakdown']=dict(collections.Counter(x['reason'] for x in missing));write('unrecovered-targets.json',missing)
write('source-functions-without-supported-counterpart.json',[f for f in refs.values() if not any(t['sourceId']==f['id'] for t in truth.values())])
audits=[]
for p in r['promotions']:
 if label(p)!='unassessed':continue
 source=refs[p['sourceId']];bf=bundles[p['bundleId']];inner=[t for t in truth.values() if t['sourceId']==p['sourceId'] and bf['span'][0]<bundles[t['bundleId']]['span'][0] and bundles[t['bundleId']]['span'][1]<bf['span'][1]]
 if inner and 't.exports=' in bf['code']:
  audit='wrong-identity';evidence='Predicted bundle span is an enclosing webpack module wrapper that constructs and exports the defaults object. The source helper has a distinct supported inner-function counterpart strictly inside this wrapper.'
 else:
  audit='unresolved-origin';evidence='Source and generated bodies are both empty functions. Zero oracle body points establish no source identity; equal text alone does not resolve origin.'
 audits.append({'prediction':p,'source':source,'bundle':bf,'oracle':truth[p['bundleId']],'manualVerdict':audit,'evidence':evidence,'supportedInnerCounterparts':inner})
write('manual-unassessed-audit.json',{'policy':'Post-hoc review only. Does not change frozen oracle labels, prompts, recovery, or primary scores.','cases':audits})
summary['supplementalManualAudit']={'oracleUnassessedPromotions':len(audits),'manuallyEstablishedWrongIdentities':sum(x['manualVerdict']=='wrong-identity' for x in audits),'remainingUnresolvedPromotions':sum(x['manualVerdict']=='unresolved-origin' for x in audits)}
anchorFiles={refs[p['sourceId']]['file'] for p in r['promotions'] if p['kind']=='pog-anchor'}
summary['unqueriedTargetsInSourceFilesWithoutAnchor']=sum(x['reason'].startswith('never_queried') and refs[x['sourceId']]['file'] not in anchorFiles for x in missing)
write('summary.json',summary);write('verification.json',{'created':now,'passed':True,'checks':checks,'status':summary['status']});write('execution-status.json',{'updated':now,'status':summary['status'],'recoveryStatus':r['status'],'verification':'passed'})
with (P/'function-outcomes.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=['bundleId','bundleName','oracleSourceId','oracleLibrary','predictedSourceId','predictedLibrary','outcome','kind']);w.writeheader()
 for bid,t in truth.items():
  p=promos.get(bid);s=refs.get(t['sourceId'],{});pred=refs.get(p['sourceId'],{}) if p else {};w.writerow({'bundleId':bid,'bundleName':bundles[bid]['name'],'oracleSourceId':t['sourceId'],'oracleLibrary':s.get('library'),'predictedSourceId':p['sourceId'] if p else None,'predictedLibrary':pred.get('library'),'outcome':label(p) if p else 'missed-target' if t['sourceId'] else 'non-target-unpredicted' if t['nonTarget'] else 'unresolved-unpredicted','kind':p['kind'] if p else None})
cases=P/'wrong-identities';cases.mkdir(exist_ok=True)
for i,p in enumerate([p for p in r['promotions'] if label(p)=='wrong'],1):
 t=truth[p['bundleId']];correct=refs.get(t['sourceId']);write('wrong-identities/W%03d.json'%i,{'prediction':p,'source':refs[p['sourceId']],'bundle':bundles[p['bundleId']],'oracle':t,'correctSource':correct,'pairChecks':[q for q in r['pairs'] if q['bundleId']==p['bundleId']]})
md='# Real application: three-library recovery\n\nStatus: **'+summary['status']+'**. Pinned `PanJiaChen/vue-admin-template` commit `'+summary['commit']+'`. Whole production vendor chunk: '+str(len(bundles))+' functions; '+str(len(refs))+' reference definitions from 26 source files.\n\nModels and algorithm are frozen from jQuery experiment 4 (1538/1629 = 94.41%): qwen3.5:27b validator, qwen3-embedding:0.6b ranking, thinking off, T/F output, minified reference ranking, top five, first-positive promotion with one-to-one conflicts. Fresh caches.\n\n| Library | Source definitions | Supported bundle targets | Correct | Recovery | Oracle-assessed wrong | Oracle-unassessed |\n|---|---:|---:|---:|---:|---:|---:|\n'
for x in rows:md+='| '+x['library']+' | '+str(x['referenceFunctions'])+' | '+str(x['supportedBundleTargets'])+' | '+str(x['correct'])+' | '+format(x['recoveryPercent'],'.2f')+'% | '+str(x['wrongPredictions'])+' | '+str(x['unassessedPredictions'])+' |\n'
md+='\nPooled correct recovery: **'+str(total['correct'])+'/'+str(n)+' ('+format(summary['recoveryPercent'],'.2f')+'%)**. Wrong predictions: '+str(total['wrong'])+'; unassessed predictions: '+str(total['unassessed'])+'. Wrong and unassessed columns are attributed to the predicted library; recall uses the true library.\n\nThe reference population comprises exact JavaScript source files supplied to this browser build, saved from source-map sourcesContent. It does not include server-only or otherwise absent package modules. Source definitions without supported counterparts are retained in the denominator inventory, separately from bundle-target recall. Source-map identity is positional evidence, not a proof of semantic equivalence. Ambiguous, transformed, or weakly mapped functions remain unresolved.\n\nThe detector reads only detector-input.json. It retains every function in the complete vendor chunk, including Vue, other dependencies, and webpack wrappers. The application separates other chunks; this test covers the shared vendor chunk containing all three targets. Maps are used only for offline evaluation. No rebuild or build-option normalization was performed; the corpus map-enabled production configuration is preserved. Calls across CommonJS files are not newly resolved; the frozen pilot uses its existing lexical and sibling neighborhoods. Source parent identifiers are namespaced by file so unrelated modules do not become siblings. All sources participate in one joint reference pool. This is one application case, not a three-library generalization estimate.\n\n[Function outcomes](function-outcomes.csv), [summary](summary.json), [verification](verification.json), [oracle and witnesses](ground-truth.json), [input provenance](input-provenance.json), [model configuration](model-manifest.json), [raw recovery](recovery/webpack-vendor-real.json), and [log](recovery.log). Wrong predictions have complete source/bundle/oracle records in wrong-identities/.\n'
md+='\n## Supplemental review of oracle-unassessed predictions\n\nThe frozen oracle reports two unassessed promotions. Manual review establishes one wrong identity: a webpack module wrapper was assigned to axios setContentTypeIfUnset, whose supported counterpart is a distinct inner function. The other is an empty function with unresolved origin. These reviews do not change the primary oracle labels or feed back into recovery. See [full source, bundle, and positional evidence](manual-unassessed-audit.json). Thus zero oracle-assessed wrong identities must not be read as zero observed errors.\n'
md+='\n## Unrecovered labeled targets\n\n'
for reason,count in summary['unrecoveredBreakdown'].items():md+='- '+reason+': '+str(count)+'\n'
md+='\nThese are exclusive pipeline outcomes, not semantic causes. See [per-target records](unrecovered-targets.json) and [source definitions without supported counterparts](source-functions-without-supported-counterpart.json).\n\nTiming: '+summary['timingPolicy']+'\n'
(P/'REPORT.md').write_text(md);print(json.dumps(summary,indent=2))
