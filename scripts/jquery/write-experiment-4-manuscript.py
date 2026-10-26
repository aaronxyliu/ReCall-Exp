"""Generate manuscript tables from frozen completed results; never run inference."""
from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parents[2];P=ROOT/'results/jquery-4.0.0/experiment-4-minified-ranking-top5';BASE=ROOT/'results/jquery-4.0.0/experiment-3-first-positive-27b';M=ROOT/'manuscript'
def read(p):return json.loads(p.read_text())
s=read(P/'summary.json');e=read(P/'experiment-4-summary.json');old=read(BASE/'experiment-3-summary.json');bs=read(BASE/'summary.json');barriers=read(P/'recovery-bottlenecks/summary.json');review=read(P/'checked-misidentification-review.json');follow=read(P/'wrong-identity-followup.json');v=read(P/'verification.json')
assert s['status']=='complete' and v['status']=='passed' and not v['failures'];assert read(P/'execution-status.json')['status']=='complete'
assert sum(b['final']['correct'] for b in s['builds'])==1538 and sum(barriers['aggregate'].values())==1629-1538
provenance=read(P/'input-provenance.json')
for x in provenance['inputs']:
 assert hashlib.sha256((P/x['file']).read_bytes()).hexdigest()==x['sha256']==hashlib.sha256((BASE/x['file']).read_bytes()).hexdigest()
def table(caption,label,cols,head,rows):
 return '\\begin{table}[htbp]\n\\caption{'+caption+'}\n\\label{'+label+'}\n\\centering\\small\n\\begin{tabular}{'+cols+'}\n\\toprule\n'+head+'\\\\\n\\midrule\n'+''.join(' & '.join(map(str,r))+'\\\\\n' for r in rows)+'\\bottomrule\n\\end{tabular}\n\\end{table}\n'
names={'esbuild-min-keep':'esbuild','rollup-min-keep':'Rollup','webpack-min-keep':'webpack'};builds=s['builds']
(M/'data').mkdir(exist_ok=True)
rows=[[names[b['build']],b['supportedJqueryDefinitions'],b['anchors']['correct'],b['final']['correct'],f"{b['correctRecovery']:.2f}\\%",b['final']['wrong'],b['final']['unassessed']] for b in builds]
rows.append(['Pooled',1629,238,1538,'94.41\\%',14,45])
(M/'data/exp4-recovery.tex').write_text(table('Experiment 4: correct source-identity recovery. POG counts are initial correct matches; unassessed promotions are excluded from assessed precision. The pooled row repeats source functions across builds.','tab:exp4-recovery','lrrrrrr','Bundler & Targets & POG & Correct & Recovery & Wrong & Unassessed',rows))
(M/'data/exp4-validation.tex').write_text(table('Experiment 4: validation checks and assessed identity precision. Checks include repeated exact-request cache hits.','tab:exp4-validation','lrrrrr','Bundler & Checks & Accepted & Pair precision & Final precision & Top-5 recall',[[names[b['build']],b['modelPairs'],b['acceptedModelPairs']['total'],f"{b['acceptedPairIdentityPrecision']:.2f}\\%",f"{b['conditionalPrecision']:.2f}\\%",f"{b['topKRecall']:.2f}\\%"] for b in builds]))
labels={'correct_topK_but_never_accepted':'Correct top-$K$ pair rejected','correct_topK_not_validated_after_earlier_accept':'Correct pair skipped after earlier acceptance','wrong_source_promoted':'Wrong source promoted','correct_candidate_never_topK':'Correct candidate outside top $K$','correct_accepted_but_identity_conflict':'Correct acceptance blocked by identity conflict','never_queried_no_matched_neighbor':'No matched neighbor','never_queried_input_length':'Input-size restriction','correct_source_never_candidate':'Correct source never a candidate','correct_topK_only_invalid_or_error':'Correct pair only invalid/error'}
def canon(k):return k.replace('top3','topK').replace('top5','topK')
a={canon(k):val for k,val in old['unrecoveredBreakdown'].items()};z={canon(k):val for k,val in e['unrecoveredBreakdown'].items()};keys=sorted(set(a)|set(z),key=lambda k:-z.get(k,0))
rr=[[labels[k],a.get(k,0),z.get(k,0)] for k in keys];rr.append(['Total',sum(a.values()),sum(z.values())])
(M/'data/exp4-barriers.tex').write_text(table('Exclusive observed outcomes for supported targets not correctly recovered. $K=3$ in experiment 3 and $K=5$ in experiment 4. Wrong promotions are already included in the totals.','tab:exp4-barriers','p{0.64\\linewidth}rr','Observed outcome & Exp. 3 & Exp. 4',rr))
(M/'data/exp4-runtime.tex').write_text(table('Experiment 4 per-build execution. Rounds include the final round without additions. Time includes bundle embedding, validation and checkpoint overhead, but excludes the shared source embedding stage.','tab:exp4-runtime','lrrrr','Bundler & Rounds & Fresh calls & Cache hits & Minutes',[[names[b['build']],b['round'],b['modelCalls'],b['cacheHits'],f"{b['elapsedMs']/60000:.2f}"] for b in builds]))
comp=[['Correct identities / supported targets','1165/1629','1538/1629'],['Correct recovery','71.52\\%','94.41\\%'],['Wrong identities',5,14],['Unassessed promotions',36,45],['Assessed identity precision','99.57\\%','99.10\\%'],['Overall run time (minutes)',f"{old['overallElapsedSeconds']/60:.2f}",f"{e['overallElapsedSeconds']/60:.2f}"],['Distinct validation requests',2837,2286],['Validation request time (seconds)',f"{old['validationRequestWallSeconds']:.2f}",f"{e['validationRequestWallSeconds']:.2f}"],['Invalid responses / API errors','0/5','0/0']]
(M/'data/exp4-comparison.tex').write_text(table('Completed overall experiments on identical bundle and oracle inputs. Several method changes are combined; this is not a component ablation. Both runs start with fresh experiment caches.','tab:exp4-comparison','p{0.52\\linewidth}rr','Measurement & Experiment 3 & Experiment 4',comp))
mislabels={'external_binding_confusion':'External binding identity','different_call_arguments':'Different call arguments','call_and_return_structure_mismatch':'Call/return mismatch','nested_function_boundary':'Outer/nested function boundary'}
ids={k:[r['id'] for r in review['cases'] if r['category']==k] for k in mislabels}
(M/'data/exp4-wrong.tex').write_text(table('Reviewed code-level evidence for the 14 wrong identities. Categories describe inspected differences, not model-generated explanations.','tab:exp4-wrong','p{0.34\\linewidth}rp{0.43\\linewidth}','Primary issue & Count & Case IDs',[[mislabels[k],len(ids[k]),', '.join(ids[k])] for k in mislabels]))
manifest={'experiment4':str(P.relative_to(ROOT)),'experiment3':str(BASE.relative_to(ROOT)),'verification':{'checks':v['checks'],'status':v['status']},'inputs':[]}
for root,names0 in [(P,['summary.json','experiment-4-summary.json','recovery-bottlenecks/summary.json','checked-misidentification-review.json','wrong-identity-followup.json','model-manifest.json','verification.json']),(BASE,['summary.json','experiment-3-summary.json'])]:
 for name in names0:manifest['inputs'].append({'path':str((root/name).relative_to(ROOT)),'sha256':hashlib.sha256((root/name).read_bytes()).hexdigest()})
manifest['counts']={'targets':1629,'correct':1538,'wrong':14,'unassessed':45,'notCorrect':91,'pairChecks':2962,'freshCalls':2286,'cacheHits':676,'correctModelPromotions':1300,'initialCorrectPogMatches':238}
(M/'data/experiment-4-evidence.json').write_text(json.dumps(manifest,indent=2)+'\n')
# Verbatim prompt bytes from the completed run, not a later live revision.
prompt=(P/'implementation/notes/jquery/validator-system-prompt.txt').read_bytes();(M/'data/validator-system-prompt.txt').write_bytes(prompt)
assert prompt.decode()==read(next((P/'model-cache/validations').glob('*.json')))['request']['messages'][0]['content']
# Replace nonbreaking alignment spaces for the typeset view only; keep exact bytes above.
printed=prompt.decode().replace('\u00a0',' ').replace('↔','<=>').replace('→','->').replace('—','--').replace('–','-')
(M/'data/validator-system-prompt-listing.txt').write_text(printed)
embedding='Instruct: Represent this minified JavaScript function for semantic similarity comparison with other minified JavaScript functions. Focus on behavior, allowing for identifier renaming and equivalent syntactic rewrites.\nQuery:<minified source function code>'
(M/'data/embedding-input.txt').write_text(embedding)
print('Generated six experiment-4 tables, exact prompts, and hash-backed evidence; no inference.')
