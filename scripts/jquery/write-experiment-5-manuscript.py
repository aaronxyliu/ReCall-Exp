"""Generate manuscript tables from completed controlled 4B/27B comparison. No inference."""
from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parents[2];M=R/'manuscript';P=R/'results/jquery-4.0.0/experiment-5-validator-4b';B=R/'results/jquery-4.0.0/experiment-4-minified-ranking-top5'
def read(p):return json.loads(p.read_text())
c=read(P/'validator-model-comparison.json');a=c['baseline'];b=c['rerun']
assert read(P/'execution-status.json')['status']=='complete'
v=read(P/'verification.json');assert v['status']=='passed'
assert c['embeddingComparison']['maxAbsoluteComponentDifference']==0
assert (P/'implementation/notes/jquery/validator-system-prompt.txt').read_bytes()==(M/'data/validator-system-prompt.txt').read_bytes()
assert sum(b['unrecoveredBreakdown'].values())==329 and b['correct']==1300 and b['wrong']==62
for item in read(P/'input-provenance.json')['inputs']:
 assert (P/item['file']).read_bytes()==(B/item['file']).read_bytes()
def table(cap,label,fmt,head,rows):
 return '\\begin{table}[htbp]\n\\caption{'+cap+'}\n\\label{'+label+'}\n\\centering\\small\n\\begin{tabular}{'+fmt+'}\n\\toprule\n'+head+'\\\\\n\\midrule\n'+''.join(' & '.join(map(str,row))+'\\\\\n' for row in rows)+'\\bottomrule\n\\end{tabular}\n\\end{table}\n'
rows=[['Correct identities / supported targets','1538/1629','1300/1629'],['Recovery','94.41\\%','79.80\\%'],['Wrong identities',14,62],['Unassessed promotions',45,38],['Final assessed precision','99.10\\%','95.45\\%'],['Accepted-pair assessed precision','94.65\\%','61.03\\%'],['Overall time (minutes)',f"{a['overallElapsedSeconds']/60:.2f}",f"{b['overallElapsedSeconds']/60:.2f}"],['Fresh validator requests',2286,1517],['Pair checks, including cache hits',2962,3143],['Invalid responses / API errors','0/0','0/0']]
(M/'data/exp5-model-comparison.tex').write_text(table('Controlled validator comparison. Experiment 5 replaces only the 27B validator with the 4B deployment; both use the same prompt and matching rules.','tab:exp5-model-comparison','p{0.53\\linewidth}rr','Measurement & 27B (Exp. 4) & 4B (Exp. 5)',rows))
s=read(P/'summary.json');old={x['build']:x for x in read(B/'summary.json')['builds']};names={'esbuild-min-keep':'esbuild','rollup-min-keep':'Rollup','webpack-min-keep':'webpack'};rows=[]
for x in s['builds']:
 y=old[x['build']];rows.append([names[x['build']],x['supportedJqueryDefinitions'],f"{y['final']['correct']} ({y['correctRecovery']:.2f}\\%)",f"{x['final']['correct']} ({x['correctRecovery']:.2f}\\%)",f"{y['final']['wrong']} / {x['final']['wrong']}"])
(M/'data/exp5-build-comparison.tex').write_text(table('Recovery by bundler with unchanged inputs. Wrong counts include known non-library functions incorrectly identified as jQuery.','tab:exp5-build-comparison','lrrrr','Bundler & Targets & 27B correct & 4B correct & Wrong 27B / 4B',rows))
labels={'correct_top5_not_validated_after_earlier_accept':'Correct pair skipped after earlier acceptance','correct_accepted_but_identity_conflict':'Correct acceptance blocked by identity conflict','wrong_source_promoted':'Wrong source promoted','correct_candidate_never_top5':'Correct candidate outside top five','never_queried_no_matched_neighbor':'No matched neighbor','correct_top5_but_never_accepted':'Correct top-five pair rejected','correct_source_never_candidate':'Correct source never a candidate','never_queried_input_length':'Input-size restriction','never_queried_no_available_source_candidate':'No available source candidate'}
keys=sorted(set(a['unrecoveredBreakdown'])|set(b['unrecoveredBreakdown']),key=lambda k:-b['unrecoveredBreakdown'].get(k,0));rows=[[labels[k],a['unrecoveredBreakdown'].get(k,0),b['unrecoveredBreakdown'].get(k,0)] for k in keys];rows.append(['Total',91,329])
(M/'data/exp5-barriers.tex').write_text(table('Exclusive outcomes for supported targets not correctly recovered. Four additional 4B errors concern application functions and are outside this denominator.','tab:exp5-barriers','p{0.63\\linewidth}rr','Observed outcome & 27B & 4B',rows))
manifest={'experiment':5,'verification':{'checks':v['checks'],'status':v['status']},'inputs':[]}
for file in ['experiment-5-summary.json','validator-model-comparison.json','verification.json','execution-status.json','model-manifest.json','input-provenance.json','checked-misidentification-review.json','wrong-identity-followup.json','wrong-identity-audit/cases.json']:
 f=P/file;manifest['inputs'].append({'path':str(f.relative_to(R)),'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
(M/'data/experiment-5-evidence.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Generated three controlled-comparison tables and evidence manifest; no inference.')
