"""Render the frozen RQ1 anchor/recovery snapshot; no experiment access."""
import json,os
from pathlib import Path
os.environ.setdefault('MPLCONFIGDIR','/tmp/recall-mpl-cache')
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.ticker import PercentFormatter
m=Path(__file__).resolve().parents[1]/'manuscript'
snap=json.load(open(m/'data/rq1-anchor-recovery-snapshot.json'))
rs=[r for r in snap['rows'] if r['groundTruthPairs']>=20 and r['anchors']>0]
assert len(rs)==84
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':8,'axes.spines.top':False,'axes.spines.right':False,'axes.linewidth':.6,'pdf.fonttype':42})
fig,axes=plt.subplots(1,2,figsize=(7.2,3))
for ax,adjusted in zip(axes,[False,True]):
 x=[r['anchors']/r['groundTruthPairs'] for r in rs]
 y=[(r['correct']-r['correctAnchors'])/(r['groundTruthPairs']-r['anchors']) if adjusted else r['correct']/r['groundTruthPairs'] for r in rs]
 ax.scatter(x,y,s=14,color='#2378a5',alpha=.48,linewidths=.3)
 xx=[];yy=[]
 for i in range(10):
  lo=i/20;hi=(i+1)/20;vals=[b for a,b in zip(x,y) if a>=lo-1e-12 and (a<hi-1e-12 or i==9 and a<=hi+1e-12)]
  xx.append((lo+hi)/2);yy.append(sum(vals)/len(vals) if vals else float('nan'))
  if vals:ax.annotate(str(len(vals)),(xx[-1],yy[-1]),xytext=(0,5),textcoords='offset points',ha='center',fontsize=6.5,color='#a64624')
 ax.plot(xx,yy,color='#cc6033',marker='o',markersize=3,linewidth=1.6)
 ax.set_xlim(0,.5);ax.set_ylim(0,1.09);ax.set_xticks([0,.1,.2,.3,.4,.5]);ax.xaxis.set_major_formatter(PercentFormatter(1,decimals=0));ax.yaxis.set_major_formatter(PercentFormatter(1,decimals=0));ax.grid(alpha=.18);ax.set_axisbelow(True)
 ax.set_xlabel('Initial anchor percentage');ax.set_ylabel('Non-anchor recovery rate' if adjusted else 'Overall recovery rate')
 ax.set_title('(b) Beyond initial anchors' if adjusted else '(a) Overall recovery',fontsize=9)
fig.tight_layout(pad=.6,w_pad=1.5)
fig.savefig(m/'figures/rq1-anchor-recovery.pdf');fig.savefig(m/'figures/rq1-anchor-recovery.png',dpi=200)
