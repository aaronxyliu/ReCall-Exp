"""Generate manuscript connectivity tables from completed saved experiments only."""
from pathlib import Path
import json,csv,hashlib,collections
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'manuscript/data';OUT.mkdir(exist_ok=True)
read=lambda p:json.loads(p.read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
dev=ROOT/'results/real-app/bundle-graph-v2';held=ROOT/'results/real-app/bundle-graph-v2-holdout';esm=ROOT/'results/real-app/esbuild-propagation/all-esbuild-v1'
evidence=set()
def checked(p):evidence.add(p);return read(p)
da=checked(dev/'aggregate.json');ha=checked(held/'aggregate.json');ea=checked(esm/'summary.json')
assert (da['totals']['targets'],da['totals']['v2-per-chunk'])==(161329,157282)
assert (ha['totals']['targets'],ha['totals']['improved-per-chunk'])==(28780,26402)
assert ea['sameChunk']['targets']==7497
assert da['modelCalls']==ea['modelCalls']==0
freeze=checked(held/'analyzer-freeze.json')
for p,h in freeze['files'].items():assert sha(ROOT/p)==h;evidence.add(ROOT/p)
evidence.update([held/'selection.json',held/'manual-audit.json',held/'sensitivity-case.json',ROOT/'manuscript/data/bundler-sources/usage-ranking.json',ROOT/'manuscript/data/bundler-sources/stateofjs2025-build-tools-page-data.json'])
evidence.add(ROOT/'manuscript/data/bundler-sources/turbopack-runtime-v16.2.6.ts')
for directory in [dev,held]:
 for p in (directory/'subjects').glob('*/summary.json'):checked(p)
checked(dev/'verification.json');checked(held/'verification.json');checked(esm/'verification.json')
for p in (held/'subjects').glob('*/risk-screen.json'):checked(p)
for p in (held/'subjects').glob('*/audit-sensitivity.json'):checked(p)
fnum=lambda n:f'{n:,}'
pct=lambda n,d:f'{100*n/d:.2f}' if d else '--'
name=lambda s:r'\nolinkurl{'+s+'}'
def save(n,s):(OUT/n).write_text(s+'\n')
def main_table(filename,caption,label,rows):
 text=[r'\begin{table}[t]',r'\caption{'+caption+'}',r'\label{'+label+'}',r'\centering\small',r'\setlength{\tabcolsep}{4pt}',r'\begin{tabular}{@{}p{.34\linewidth}lrrrr@{}}',r'\toprule',r'Subject & Family & $D$ & Base & Within & Cross\\',r'\midrule']
 for repo,family,n,b,w,c in rows:text.append(name(repo.split('/')[-1])+' & '+family+' & '+fnum(n)+' & '+pct(b,n)+' & '+pct(w,n)+' & '+pct(c,n)+r'\\')
 n=sum(r[2] for r in rows);b=sum(r[3] for r in rows);w=sum(r[4] for r in rows);c=sum(r[5] for r in rows)
 text.extend([r'\midrule',r'Total & & '+fnum(n)+' & '+pct(b,n)+' & '+pct(w,n)+' & '+pct(c,n)+r'\\',r'\bottomrule',r'\end{tabular}',r'\end{table}'])
 save(filename,'\n'.join(text))
families={'rspack':'Rspack','rolldown':'Rolldown','turbopack':'Turbo','parcel':'Parcel','esbuild':'esbuild'}
main_table('simulation-development.tex','Development subjects: supported-pair connectivity (\%). Base uses the original local graph; Within uses the current graph with per-chunk promotion; Cross additionally permits cross-chunk promotion. All variants retain the same $D$ targets and seeds.','tab:simulation-development',[(r['repo'],families[r['bundler']],r['targets'],r['baseline'],r['v2-per-chunk'],r['v2-cross-chunk']) for r in da['repos']])
main_table('simulation-holdout.tex','Previously untested repositories with the analyzer unchanged: supported-pair connectivity (\%). Turbo denotes Turbopack. The Parcel subject has only 14 supported pairs.','tab:simulation-holdout',[(r['repo'],families[r['bundler']],r['targets'],r['baseline'],r['improved-per-chunk'],r['improved-cross-chunk']) for r in ha['subjects']])
cross={r['repo']:r for r in ea['repositoryCrossChunk']}
main_table('simulation-esbuild.tex','Earlier esbuild graph experiment, retained as a separate implementation revision: supported-pair connectivity (\%). It is not pooled with the current-analyzer cohorts.','tab:simulation-esbuild',[(r['repo'],'esbuild',r['targets'],r['baselineRecovered'],r['improvedRecovered'],cross[r['repo']]['crossChunkRecovered']) for r in ea['repositoryPerChunk']])
# The shared source-only ablation is the current run's actual count, not v1's count.
stage=collections.Counter()
for p in (dev/'subjects').glob('*/summary.json'):
 for v in checked(p)['variants']:stage[v['variant']]+=v['recovered']
save('simulation-stages.tex','\n'.join([r'\begin{table}[t]',r'\caption{Staged graph comparisons. Values are recovered supported pairs; source-only changes the source graph while retaining the local bundled graph.}',r'\label{tab:simulation-stages}',r'\centering\small',r'\begin{tabular}{lrr}',r'\toprule',r'Stage & Development ($D=161{,}329$) & Holdout ($D=28{,}780$)\\',r'\midrule',r'Local graphs & '+fnum(stage['baseline-control'])+' & '+fnum(ha['totals']['baseline'])+r'\\',r'Source graph only & '+fnum(stage['source-only'])+' & '+fnum(ha['totals']['source-only'])+r'\\',r'Both graphs, within chunk & '+fnum(stage['improved-per-chunk'])+' & '+fnum(ha['totals']['improved-per-chunk'])+r'\\',r'Both graphs, cross chunk & '+fnum(stage['improved-cross-chunk'])+' & '+fnum(ha['totals']['improved-cross-chunk'])+r'\\',r'\bottomrule',r'\end{tabular}',r'\end{table}']))
# Complete per-library appendices, including zero-supported cases.
cohorts=[]
with open(dev/'per-library.csv') as f:
 evidence.add(dev/'per-library.csv');rs=list(csv.DictReader(f))
cohorts.append(('Development',rs,{'n':'targets','base':'baseline','within':'v2-improved-per-chunk','cross':'v2-improved-cross-chunk'}))
with open(held/'per-library.csv') as f:
 evidence.add(held/'per-library.csv');rs=list(csv.DictReader(f))
cohorts.append(('New-repository holdout',rs,{'n':'targets','base':'baseline','within':'improved-per-chunk','cross':'improved-cross-chunk'}))
with open(esm/'per-library-per-chunk.csv') as f:er=list(csv.DictReader(f));evidence.add(esm/'per-library-per-chunk.csv')
with open(esm/'per-library-cross-chunk.csv') as f:ec=list(csv.DictReader(f));evidence.add(esm/'per-library-cross-chunk.csv')
ec_by={(r['repo'],r['library']):r for r in ec}
for r in er:r['crossRecovered']=ec_by[r['repo'],r['library']]['improvedCrossChunkRecovered']
cohorts.append(('Earlier esbuild revision',er,{'n':'supportedTargets','base':'baselineRecovered','within':'improvedPerChunkRecovered','cross':'crossRecovered'}))
assert [len(rs) for _,rs,_ in cohorts]==[69,41,25]
appendix=[]
for cohort,rs,k in cohorts:
 label={'Development':'development','New-repository holdout':'holdout','Earlier esbuild revision':'esbuild'}[cohort]
 appendix.extend([r'\subsection{'+cohort+'}',r'\begingroup\footnotesize',r'\setlength{\tabcolsep}{4pt}',r'\begin{longtable}{@{}p{.37\linewidth}rrrr@{}}',r'\caption{'+cohort+r': all selected libraries. Cells give recovered counts and percentages; $D$ is the supported-pair denominator. Cross-chunk promotion is a separate variant.}\label{tab:all-libraries-'+label+r'}\\',r'\toprule',r'Library & $D$ & Base $R$ (\%) & Within $R$ (\%) & Cross $R$ (\%)\\',r'\midrule',r'\endfirsthead',r'\toprule',r'Library & $D$ & Base $R$ (\%) & Within $R$ (\%) & Cross $R$ (\%)\\',r'\midrule',r'\endhead',r'\midrule\multicolumn{5}{r}{Continued on next page}\\',r'\endfoot',r'\bottomrule',r'\endlastfoot'])
 last=None
 for r in rs:
  if r['repo']!=last:
   appendix.append(r'\multicolumn{5}{@{}l}{\textit{'+name(r['repo'])+r'}}\\*');last=r['repo']
  n=int(r[k['n']]);cells=[name(r['library']),fnum(n)]+[(fnum(int(r[k[v]]))+' ('+pct(int(r[k[v]]),n)+')') if n else '--' for v in ['base','within','cross']]
  appendix.append(' & '.join(cells)+r'\\')
 appendix.extend([r'\end{longtable}',r'\endgroup',''])
save('simulation-per-library.tex','\n'.join(appendix))
ranking=read(ROOT/'manuscript/data/bundler-sources/usage-ranking.json')
rr=[r for r in ranking['entries'] if r['dedicatedBundlerSelected']]
save('bundler-usage.tex','\n'.join([r'\begin{table}[t]',r'\caption{Dedicated bundler entries ordered by published State of JavaScript 2025 usage ratios~\cite{stateofjs2025}. Percentages retain the survey API\textquotesingle s rounded ratios. Usage means having used a tool, not current production market share.}',r'\label{tab:bundler-usage}',r'\centering\small',r'\begin{tabular}{lr@{\qquad}lr}',r'\toprule',r'Bundler & Usage (\%) & Bundler & Usage (\%)\\',r'\midrule']+[name(rr[i]['tool'])+' & '+f"{rr[i]['publishedUsageRatio']*100:.0f}"+' & '+(name(rr[i+4]['tool'])+' & '+f"{rr[i+4]['publishedUsageRatio']*100:.0f}" if i+4<len(rr) else ' & ')+r'\\' for i in range(4)]+[r'\bottomrule',r'\end{tabular}',r'\end{table}']))
write_evidence={'policy':'Saved completed results only. No experiment, model inference, or analyzer mutation. Earlier esbuild revision, current development cohort, and unchanged-analyzer holdout remain separate.','cohorts':{'development':da['totals'],'holdout':ha['totals'],'earlierEsbuild':ea['sameChunk']},'currentDevelopmentStages':dict(stage),'sources':{str(p.relative_to(ROOT)):sha(p) for p in sorted(evidence)},'generatorSha256':sha(Path(__file__))}
(OUT/'bundler-simulation-evidence.json').write_text(json.dumps(write_evidence,indent=2)+'\n')
print(json.dumps({'developmentStages':dict(stage),'holdout':ha['totals'],'evidenceFiles':len(evidence)}))
