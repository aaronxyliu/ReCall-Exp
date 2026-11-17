from pathlib import Path
import os,json
os.environ.setdefault('MPLCONFIGDIR','/tmp/recall-mpl-cache')
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
root=Path(__file__).resolve().parents[1]/'results/library-distributions-2026-11-17'
rows=json.loads((root/'instances.json').read_text())
times=[r['validationSeconds']/60 for r in rows]
rates=[r['recovery']*100 for r in rows if r['recovery'] is not None]
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':11,'axes.spines.top':False,'axes.spines.right':False,'pdf.fonttype':42})
fig,axes=plt.subplots(1,2,figsize=(8,4.8))
for ax,values,title,ylabel in zip(axes,[times,rates],['(a) Qwen validation time','(b) Function recovery rate'],['Validation request time (minutes)','Correctly recovered ground-truth pairs (%)']):
 ax.boxplot([values],widths=.42,patch_artist=True,whis=1.5,boxprops={'facecolor':'#c8dce8','edgecolor':'#28658b'},medianprops={'color':'#a85528','linewidth':2},whiskerprops={'color':'#28658b'},capprops={'color':'#28658b'},flierprops={'marker':'o','markersize':4,'markerfacecolor':'none','markeredgecolor':'#28658b','alpha':.7})
 ax.set_xticks([1],[f'Library instances (n = {len(values)})']);ax.set_ylabel(ylabel);ax.set_title(title);ax.grid(axis='y',alpha=.2);ax.set_axisbelow(True)
 ax.text(.97,.97,f'Median: {np.median(values):.2f}'+(' min' if values is times else '%'),ha='right',va='top',transform=ax.transAxes,fontsize=10)
axes[0].set_ylim(bottom=-1);axes[1].set_ylim(-3,105)
fig.text(.09,.035,'Boxes: 25th–75th percentiles; line: median; whiskers: 1.5 × IQR; circles: outliers.\nTime uses final-trace Qwen requests. Recovery excludes 89 instances with no ground-truth pairs.',fontsize=8)
fig.tight_layout(rect=(0,.11,1,1),w_pad=2)
for ext in ['png','pdf','svg']:fig.savefig(root/f'library-boxplots.{ext}',dpi=220)
(root/'boxplot-statistics.json').write_text(json.dumps({k:dict(n=len(v),quartiles=np.percentile(v,[25,50,75]).tolist(),minimum=min(v),maximum=max(v)) for k,v in [('validationMinutes',times),('recoveryPercent',rates)]},indent=2)+'\n')
