from pathlib import Path
import os,json
os.environ.setdefault('MPLCONFIGDIR','/tmp/recall-mpl-cache')
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
root=Path(__file__).resolve().parents[1]/'results/library-distributions-2026-11-17'
rows=json.loads((root/'instances.json').read_text())
raw_total=sum(r['validationSeconds'] for r in rows)
target=14*3600+37*60+53
factor=target/raw_total
times=[r['validationSeconds']*factor/60 for r in rows]
assert abs(sum(times)*60-target)<1e-7
(root/'time-scaling.json').write_text(json.dumps(dict(rawTotalSeconds=raw_total,targetTotalSeconds=target,factor=factor,policy='Allocate total process time proportionally to final-trace Qwen request duration; zero-request instances remain zero.',instances=[dict(subject=r['subject'],library=r['library'],rawValidationSeconds=r['validationSeconds'],estimatedProcessSeconds=r['validationSeconds']*factor) for r in rows]),indent=2)+'\n')
print(dict(rawTotalSeconds=raw_total, factor=factor, scaledTotalSeconds=sum(times)*60))
rates=[r['recovery']*100 for r in rows if r['recovery'] is not None]
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':11,'axes.spines.top':False,'axes.spines.right':False,'pdf.fonttype':42})
fig,axes=plt.subplots(1,2,figsize=(8,4.8))
for ax,values,title,ylabel in zip(axes,[times,rates],['(a) Estimated process time','(b) Function recovery rate'],['Estimated process time (minutes)','Correctly recovered ground-truth pairs (%)']):
 rng=np.random.default_rng(42)
 ax.scatter(1+rng.uniform(-.25,.25,len(values)),values,s=22,alpha=.55,color='#28658b',edgecolors='white',linewidths=.35)
 ax.set_xlim(.55,1.45)
 ax.set_xticks([1],[f'Library instances (n = {len(values)})']);ax.set_ylabel(ylabel);ax.set_title(title);ax.grid(axis='y',alpha=.2);ax.set_axisbelow(True)
 ax.set_title(title+'\n'+f'Median: {np.median(values):.2f}'+(' min' if values is times else '%'),fontsize=11)
axes[0].set_ylim(bottom=-1);axes[1].set_ylim(-3,105)
fig.text(.09,.035,'Each dot is one repository–library instance; horizontal jitter separates overlapping values.\nTimes are scaled proportionally to total 14:37:53. Recovery excludes 89 zero-ground-truth instances.',fontsize=8)
fig.tight_layout(rect=(0,.11,1,1),w_pad=2)
for ext in ['png','pdf','svg']:fig.savefig(root/f'library-dotplots.{ext}',dpi=220)
(root/'dotplot-statistics.json').write_text(json.dumps({k:dict(n=len(v),quartiles=np.percentile(v,[25,50,75]).tolist(),minimum=min(v),maximum=max(v)) for k,v in [('estimatedProcessMinutes',times),('recoveryPercent',rates)]},indent=2)+'\n')
