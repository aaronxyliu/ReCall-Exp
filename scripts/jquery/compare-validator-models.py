"""Compare completed full-pipeline 4B/27B runs and shared saved pair judgments; no inference."""
import json,hashlib,statistics
from pathlib import Path
from collections import Counter
P=Path('results/jquery-4.0.0/experiment-5-validator-4b')
B=Path('results/jquery-4.0.0/experiment-4-minified-ranking-top5')
def read(p): return json.loads(p.read_text())
def save(p,x):p.write_text(json.dumps(x,indent=2)+'\n')
assert read(P/'execution-status.json')['status']=='complete'
assert read(P/'verification.json')['status']=='passed'
a=read(B/'experiment-4-summary.json');b=read(P/'experiment-5-summary.json')
for item in read(P/'input-provenance.json')['inputs']:
 assert hashlib.sha256((P/item['file']).read_bytes()).hexdigest()==hashlib.sha256((B/item['file']).read_bytes()).hexdigest()
assert (P/'implementation/notes/jquery/validator-system-prompt.txt').read_bytes()==(B/'implementation/notes/jquery/validator-system-prompt.txt').read_bytes()
ma=read(B/'model-manifest.json');mb=read(P/'model-manifest.json')
sa=dict(ma['settings']);sb=dict(mb['settings']);sa.pop('validator');sb.pop('validator');assert sa==sb
assert ma['digests']['qwen3-embedding:0.6b']==mb['digests']['qwen3-embedding:0.6b']
for file in ['recover.mjs','models.mjs','minify-source-function.mjs','promotion-policy.mjs','common.mjs']:
 assert (P/'implementation/scripts/jquery'/file).read_bytes()==(B/'implementation/scripts/jquery'/file).read_bytes(),file
truth={g['bundleId']:g for g in read(P/'ground-truth.json')['records']}
def label(bid,sid):
 g=truth[bid]
 return 'wrong' if g.get('nonTarget') else 'unassessed' if not g.get('sourceId') else 'correct' if g['sourceId']==sid else 'wrong'
def inventory(root):
 verdicts={};promos={};records={};accepted=Counter()
 for f in (root/'recovery').glob('*.json'):
  r=read(f)
  for p in r['pairs']:
   key=(p['bundleId'],p['sourceId']); verdicts.setdefault(key,set()).add(p['verdict'])
  for p in r['promotions']:promos[p['bundleId']]=p['sourceId']
 for f in (root/'model-cache/validations').glob('*.json'):
  r=read(f);u=r['request']['messages'][1]['content'];records.setdefault(u,r)
 return verdicts,promos,records
va,pa,ra=inventory(B);vb,pb,rb=inventory(P)
assert all(len(v)==1 for v in va.values()) and all(len(v)==1 for v in vb.values())
def pair_confusion(root):
 c=Counter()
 for f in (root/'recovery').glob('*.json'):
  for pair in read(f)['pairs']:
   lab=label(pair['bundleId'],pair['sourceId']);c[lab+' '+pair['verdict']]+=1
 assessed_accept=c['correct accept']+c['wrong accept']
 return {'checks':dict(c),'assessedAcceptedPairPrecisionPercent':100*c['correct accept']/assessed_accept if assessed_accept else None}
conf27=pair_confusion(B);conf4=pair_confusion(P)
common=set(va)&set(vb);counts=Counter();labelcounts=Counter();dis=[]
for key in sorted(common):
 av=next(iter(va[key]));bv=next(iter(vb[key]));lab=label(*key);counts[av+' -> '+bv]+=1;labelcounts[lab+' | '+av+' -> '+bv]+=1
 if av!=bv:dis.append({'bundleId':key[0],'sourceId':key[1],'identityLabel':lab,'verdict27b':av,'verdict4b':bv})
transitions=Counter()
for bid,g in truth.items():
 if g.get('status')!='supported' or not g.get('sourceId') or g['build'] not in read(P/'study-config.json')['buildIds']:continue
 def final(ps):return 'unmatched' if bid not in ps else 'correct' if ps[bid]==g['sourceId'] else 'wrong'
 transitions[final(pa)+' -> '+final(pb)]+=1
commonraw=set(ra)&set(rb)
# Same literal user JSON and system prompt; no assumptions about hidden model state.
lat=[]
for key in commonraw:
 x,y=ra[key],rb[key]
 assert x['request']['messages']==y['request']['messages']
 if x.get('wallMs') and y.get('wallMs'):lat.append((x['wallMs'],y['wallMs']))
ea=read(B/'model-cache/embeddings.json');eb=read(P/'model-cache/embeddings.json');ek=set(ea)&set(eb)
maxdiff=max((max(abs(x-y) for x,y in zip(ea[k],eb[k])) for k in ek),default=0)
follow=read(P/'wrong-identity-followup.json')
res={'models':{'baseline':ma['settings']['validator'],'rerun':mb['settings']['validator']},'verification':'Passed frozen inputs, exact system prompt, settings except validator and same embedding digest checks.','baseline':a,'rerun':b,'recoveryChangePercentagePoints':b['correctRecoveryPercent']-a['correctRecoveryPercent'],'correctChange':b['correct']-a['correct'],'wrongChange':b['wrong']-a['wrong'],'totalWallSpeedup':a['overallElapsedSeconds']/b['overallElapsedSeconds'],'pairCheckConfusion':{'27b':conf27,'4b':conf4},'commonBundleSourcePairs':len(common),'sharedPairVerdictTransitions':dict(counts),'sharedPairTransitionsByOracle':dict(labelcounts),'sharedPairDisagreements':dis,'finalTargetTransitions':dict(transitions),'commonExactUserRequests':len(commonraw),'commonExactRequestWallMs':{'pairsWithTiming':len(lat),'median27b':statistics.median(x for x,y in lat) if lat else None,'median4b':statistics.median(y for x,y in lat) if lat else None,'sum27b':sum(x for x,y in lat),'sum4b':sum(y for x,y in lat)},'embeddingComparison':{'baselineKeys':len(ea),'rerunKeys':len(eb),'commonKeys':len(ek),'maxAbsoluteComponentDifference':maxdiff},'wrongIdentityScope':{'allWrong':b['wrong'],'supportedTargetWrong':b['unrecoveredBreakdown']['wrong_source_promoted'],'knownNonTargetWrong':b['wrong']-b['unrecoveredBreakdown']['wrong_source_promoted']},'allocationCascadeCases':follow['allocationCascades'],'interpretation':'Full-pipeline recovery is primary. Shared pairs are a selected intersection, not an unbiased test set. Different decisions change later neighborhoods, rankings, conflicts and request counts. Wall times include single-run load/cache/system conditions; parameter size alone is not isolated. Identity disagreements do not by themselves prove semantic inequivalence.'}
save(P/'validator-model-comparison.json',res)
md='# Validator comparison: 4B versus 27B\n\nOnly the validator model changes. Both full runs use the same three bundles, 0.6B ranking model/instruction, minified source embeddings, three-code input, exact system prompt, thinking off, top-five first-positive validation, and round-level one-to-one conflicts. Both start with fresh model caches.\n\n| Metric | 27B (experiment 4) | 4B (experiment 5) |\n|---|---:|---:|\n'
for title,key,fmt in [('Correct / 1629','correct','d'),('Recovery (%)','correctRecoveryPercent','.2f'),('Wrong identities','wrong','d'),('Unassessed promotions','unassessedPromotions','d'),('Assessed identity precision (%)','assessedIdentityPrecisionPercent','.2f'),('Total elapsed seconds','overallElapsedSeconds','.2f'),('Fresh validator requests','validationRequests','d'),('Summed validator request seconds','validationRequestWallSeconds','.2f'),('Invalid responses','invalidResponses','d'),('API errors','apiErrors','d')]:md+=f'| {title} | {a[key]:{fmt}} | {b[key]:{fmt}} |\n'
md+=f"| Assessed accepted-pair precision (%) | {conf27['assessedAcceptedPairPrecisionPercent']:.2f} | {conf4['assessedAcceptedPairPrecisionPercent']:.2f} |\n"
md+=f"\nRecovery change: {res['recoveryChangePercentagePoints']:+.2f} percentage points; {res['correctChange']:+d} correct functions; {res['wrongChange']:+d} wrong identities. Observed overall speedup: {res['totalWallSpeedup']:.2f}x.\n\n## Per-build results\n\n| Build | 27B correct / targets | 4B correct / targets | Wrong 27B / 4B |\n|---|---:|---:|---:|\n"
old={x['build']:x for x in read(B/'summary.json')['builds']}
for x in read(P/'summary.json')['builds']:
 y=old[x['build']];md+=f"| {x['build']} | {y['final']['correct']}/{y['supportedJqueryDefinitions']} | {x['final']['correct']}/{x['supportedJqueryDefinitions']} | {y['final']['wrong']} / {x['final']['wrong']} |\n"
md+='\n## Final identity transitions (same supported targets)\n\n| 27B → 4B | Count |\n|---|---:|\n'
for k,v in sorted(transitions.items()):md+=f'| {k} | {v} |\n'
md+=f'\n## Paired judgments\n\nThere are {len(common)} shared bundle/source identity pairs and {len(commonraw)} shared exact user-message requests. Each shared identity pair has one consistent saved verdict per model.\n\n| 27B → 4B verdict | Count |\n|---|---:|\n'
for k,v in sorted(counts.items()):md+=f'| {k} | {v} |\n'
if lat:md+=f'\nFor shared exact requests with timing, median request wall time is {statistics.median(x for x,y in lat)/1000:.3f}s (27B) versus {statistics.median(y for x,y in lat)/1000:.3f}s (4B). Request timing includes service overhead; the shared subset is selected by both trajectories.\n'
md+=f"\nFresh embedding comparison: {len(ek)} shared cache keys; maximum absolute vector-component difference {maxdiff:.3g}. Allocation cascades in the 4B run: {len(follow['allocationCascades'])}.\n\n## Interpretation and evidence\n\n"+res['interpretation']+'\n\n[Full failure breakdown](recovery-bottlenecks/REPORT.md), [wrong-identity review](CHECKED-MISIDENTIFICATION-REVIEW.md), [individual wrong pairs](misidentifications/), [full paired comparison JSON](validator-model-comparison.json), [mechanical verification](verification.json), [frozen inputs/settings](input-provenance.json). No additional inference is used in these analyses.\n'
md+='\n## Why recovery decreases\n\nThe 4B run rejects no evaluated ground-truth pair (1660 correct-pair checks were accepted), but accepts 1060 incorrect-pair checks. These are repeated, adaptively selected checks, not independent samples. Among 1569 shared bundle/source identity pairs, 208 incorrect pairs rejected by 27B are accepted by 4B; 21 correct pairs rejected by 27B are accepted by 4B. No shared pair changes from accept to reject. Thus, the observed regression is dominated by over-acceptance, not false negatives.\n\nWith first-positive stopping, an incorrect acceptance can prevent checking the correct lower-ranked candidate. End-of-round one-to-one conflicts can also reject a correct proposal when another bundle proposes the same source. An accepted wrong assignment removes that source from later candidate pools. These outcomes are directly recorded; a T/F response does not explain the model internal cause.\n\n| Exclusive outcome among supported targets not correctly recovered | 27B | 4B |\n|---|---:|---:|\n'
for k in sorted(set(a['unrecoveredBreakdown'])|set(b['unrecoveredBreakdown'])):md+=f"| {k} | {a['unrecoveredBreakdown'].get(k,0)} | {b['unrecoveredBreakdown'].get(k,0)} |\n"
md+='\nThe 4B failure table sums to 329 = 1629 - 1300. Its 58 wrong-source promotions concern supported jQuery targets. Four additional wrong promotions identify application functions as jQuery, giving 62 wrong identities in total; they count against assessed precision but are outside the 1629-target recovery denominator. Unassessed promotions are reported separately.\n\n## Concrete incorrect acceptances\n\n- [W01](misidentifications/W01.md): the predicted source `createInputPseudo` returns a callback; the actual source `unescapeSelector` returns a replaced string. The bundled body is `function Y(e){return e.replace(In,_n)}`. This is a visible root behavior mismatch, beyond missing closure declarations.\n- [W12](misidentifications/W12.md): `Identity(v) { return v; }` is accepted for `function(n,r){t[r]=!0}`, whose actual source writes `object[flag] = true` and returns implicitly. The current prompt excludes side effects, but the differing return is also visible. The T/F record does not reveal which distinction was overlooked.\n- [W16](misidentifications/W16.md) and [W17](misidentifications/W17.md): application DOM-building/event callbacks are assigned library selector-predicate identities. The same application-origin errors repeat in Rollup as W31/W32.\n- [W21](misidentifications/W21.md): the enclosing `then` method is assigned to its nested `mightThrow` function. Shared nested code does not establish root function identity.\n\nAll 62 wrong predictions have independent own-body source-map witnesses agreeing with the stored labels. All code pairs, exact inputs and T/F outputs are saved. The preliminary structural classifier leaves 52 cases for individual review and one same-structure binding case unresolved; these are not claimed as fully adjudicated semantic failures.\n\nUnder this fixed prompt/pipeline, retain 27B when recovery and identity precision are the priority. The 4B deployment is approximately 6.29 times faster overall in these runs, but is substantially too permissive as a replacement validator. A different 4B prompt would require a new controlled experiment rather than retroactively changing this comparison.\n'
(P/'VALIDATOR-MODEL-COMPARISON.md').write_text(md)
print(json.dumps({k:v for k,v in res.items() if k not in ['baseline','rerun','sharedPairDisagreements']},indent=2))
