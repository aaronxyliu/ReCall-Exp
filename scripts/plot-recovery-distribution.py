import json,csv,os
from pathlib import Path
os.environ.setdefault('MPLCONFIGDIR','/tmp/recall-mpl-cache')
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.ticker import PercentFormatter,MaxNLocator
p=Path(__file__).resolve().parents[1]/'results/library-characteristics'
s=json.load(open(p/'snapshot.json'));instances=[r for r in s['rows'] if r['groundTruthPairs']>=20 and r['anchors']>0]
libraries=[];repos=[]
for key,out in [('library',libraries),('repository',repos)]:
 for name in sorted({r[key] for r in instances}):
  rr=[r for r in instances if r[key]==name];g=sum(r['groundTruthPairs'] for r in rr);c=sum(r['correct'] for r in rr);out.append(dict(name=name,correct=c,gt=g,recovery=c/g,instances=len(rr)))
bins=np.linspace(0,1,11);stats={};table=[]
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':11,'axes.spines.top':False,'axes.spines.right':False,'axes.labelcolor':'#243447','text.color':'#243447','axes.edgecolor':'#b7c3ce'})
fig,axes=plt.subplots(1,2,figsize=(11.5,5.3))
for ax,rows,title,color in zip(axes,[libraries,repos],['Library-level distribution','Repository-level distribution'],['#2378a5','#bc632d']):
 vals=np.array([r['recovery'] for r in rows]);counts,_=np.histogram(vals,bins);ax.bar(bins[:-1],counts,width=.095,align='edge',color=color,alpha=.8,edgecolor='white')
 for x,n in zip(bins[:-1]+.0475,counts):
  if n:ax.text(x,n+.15,str(n),ha='center',fontsize=10,color='#243447')
 mean=float(vals.mean());median=float(np.median(vals));ax.axvline(mean,color='#20394c',ls='--',lw=1.7,label=f'Mean {mean:.1%}');ax.axvline(median,color='#20394c',ls=':',lw=1.7,label=f'Median {median:.1%}')
 ax.set_xlim(0,1);ax.set_ylim(0,max(counts)*1.25+1);ax.set_xticks(bins);ax.xaxis.set_major_formatter(PercentFormatter(1,decimals=0));ax.yaxis.set_major_locator(MaxNLocator(integer=True));ax.set_xlabel('Recovery rate');ax.set_ylabel('Number of libraries' if rows is libraries else 'Number of repositories');ax.set_title(f'{title} (n={len(rows)})',fontweight='bold',pad=12);ax.grid(axis='y',alpha=.18);ax.set_axisbelow(True);ax.legend(frameon=False,loc='upper left',fontsize=9)
 stats[title]=dict(n=len(rows),mean=mean,median=median,min=float(vals.min()),max=float(vals.max()),counts=counts.tolist())
 for lo,hi,n in zip(bins[:-1],bins[1:],counts):table.append(dict(level='library' if rows is libraries else 'repository',lower=lo,upper=hi,count=int(n)))
fig.suptitle('Recovery-rate distributions across libraries and repositories',fontsize=17,x=.075,ha='left',y=.99)
fig.text(.075,.91,f"23 completed repositories • {len(instances)} retained repository–library instances • snapshot 8 November 2026, 14:30 China time",fontsize=10,color='#526275')
fig.text(.075,.025,'Retained instances: GT ≥ 20 and initial anchors > 0. Recovery pools correct/GT counts within each library or repository.\nBins are 10 percentage points wide; the final bin includes 100%. Means and medians give each library/repository equal weight.',fontsize=9,color='#526275')
fig.tight_layout(rect=[0,.10,1,.87],w_pad=3)
for ext in ['png','pdf','svg']:fig.savefig(p/('recovery-distribution.'+ext),dpi=180,facecolor='white')
(p/'recovery-distribution-statistics.json').write_text(json.dumps(stats,indent=2))
for name,rr in [('recovery-distribution-bins.csv',table),('recovery-distribution-libraries.csv',libraries),('recovery-distribution-repositories.csv',repos)]:
 with open(p/name,'w') as f:w=csv.DictWriter(f,fieldnames=list(rr[0]));w.writeheader();w.writerows(rr)
assert sum(stats['Library-level distribution']['counts'])==len(libraries)
assert sum(stats['Repository-level distribution']['counts'])==len(repos)
print(json.dumps(stats,indent=2))
