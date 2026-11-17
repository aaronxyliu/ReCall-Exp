from pathlib import Path
import json,os,csv
os.environ.setdefault('MPLCONFIGDIR','/tmp/recall-mpl-cache')
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
p=ROOT/'results/library-distributions-2026-11-17'
rows=json.loads((p/'instances.json').read_text())
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False,'pdf.fonttype':42})
valid=[r for r in rows if r['recovery'] is not None]
x=np.sort([r['recovery']*100 for r in valid]);y=np.arange(1,len(x)+1)/len(x)*100
fig,ax=plt.subplots(figsize=(6.4,4.5));ax.step(x,y,where='post',color='#28658b',lw=2);ax.set(xlim=(-1,101),ylim=(0,102),xlabel='Correctly recovered ground-truth pairs (%)',ylabel='Cumulative share of library instances (%)')
ax.grid(alpha=.2);ax.set_title(f'Recovery-rate distribution (n = {len(valid)})');median=np.median(x);ax.axvline(median,ls='--',lw=1,color='#9b4b26',label=f'Median: {median:.1f}%');ax.legend(frameon=False,loc='upper left')
fig.text(.13,.02,'282 repository–library instances; 89 have no ground-truth pairs.\nThose 89 have undefined recovery rates and are excluded, not scored as zero.',fontsize=8)
fig.tight_layout(rect=(0,.09,1,1))
for ext in ['png','pdf','svg']:fig.savefig(p/f'library-recovery-distribution.{ext}',dpi=200)
with (p/'instances.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=rows[0].keys());w.writeheader();w.writerows(rows)
stats={'instances':len(rows),'assessableInstances':len(valid),'undefinedRecoveryInstances':len(rows)-len(valid),'correct':sum(r['correct'] for r in rows),'groundTruth':sum(r['groundTruth'] for r in rows),'medianRecoveryPercent':float(median),'meanRecoveryPercent':float(np.mean(x))}
(p/'statistics.json').write_text(json.dumps(stats,indent=2)+'\n');print(stats)
# The final-trace scope attributes each distinct request to its queried source library.
assert sum(r['requests'] for r in rows)==27051
fig,axes=plt.subplots(1,2,figsize=(10.6,4.6))
for ax in axes:ax.grid(alpha=.18);ax.set_ylim(0,102);ax.set_ylabel('Cumulative share of library instances (%)')
ax=axes[0];times=np.sort([r['validationSeconds']/60 for r in rows]);ax.step(times,np.arange(1,len(times)+1)/len(times)*100,where='post',color='#32688e',lw=2)
ax.set_xscale('symlog',linthresh=.1);ax.set_xticks([0,.1,1,10,100]);ax.set_xticklabels(['0','0.1','1','10','100']);ax.set_xlim(0,max(times)*1.1);ax.set_xlabel('Qwen validation request time (minutes)');ax.set_title('(a) Validation time: all 282 instances')
ax.axvline(np.median(times),ls='--',color='#aa6036',lw=1,label=f'Median: {np.median(times):.2f} min');ax.legend(frameon=False,loc='lower right',fontsize=9)
ax=axes[1];ax.step(x,y,where='post',color='#32688e',lw=2);ax.set_xlim(-1,101);ax.set_xlabel('Correctly recovered ground-truth pairs (%)');ax.set_title('(b) Recovery rate: 193 assessable instances');ax.axvline(median,ls='--',color='#aa6036',lw=1,label=f'Median: {median:.1f}%');ax.legend(frameon=False,loc='upper left',fontsize=9)
fig.text(.075,.035,'Unit: repository–library instance. Time sums distinct Qwen requests used in the final traces; it includes server overhead.\nRecovery is undefined for 89 instances with no ground-truth pairs. Time axis is linear near zero and logarithmic above 0.1 min.',fontsize=8)
fig.tight_layout(rect=(0,.11,1,1),w_pad=2.5)
for ext in ['png','pdf','svg']:fig.savefig(p/f'library-distributions.{ext}',dpi=220)
stats.update(totalValidationSeconds=float(sum(r['validationSeconds'] for r in rows)),validationRequests=sum(r['requests'] for r in rows),medianValidationMinutes=float(np.median(times)),zeroValidationInstances=int(sum(times==0)),maxValidationMinutes=float(max(times)))
(p/'statistics.json').write_text(json.dumps(stats,indent=2)+'\n')
(p/'README.md').write_text('''# Library distributions

Unit: repository–library instance, preserving repeated libraries across repositories. All 282 selected instances are included without anchor or minimum-size filtering. Recovery rates are defined for 193 instances; the 89 zero-ground-truth instances are excluded from that curve, not counted as 0% recovery.

Qwen time sums total_duration for the 27,051 distinct requests represented in the final recovery traces, attributed to the source library. It includes model loading and service overhead and excludes embeddings and shared workflow costs. It is not full library process time, nor the sum of all 29,855 executed original/recheck requests. Requests omitted from the final traces are outside this plot's scope. Zero indicates no Qwen request in that library's final trace.

The curves are empirical cumulative distributions. The time axis is linear from 0 to 0.1 minutes and logarithmic beyond that. PNG, vector PDF, and editable SVG are provided. instances.csv contains plot-level data. Reproduce with scripts/collect-library-distributions.mjs and scripts/plot-library-distributions.py.
''')
print(stats)
