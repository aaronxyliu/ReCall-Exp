import os,json,csv,collections,textwrap
from pathlib import Path
os.environ.setdefault('MPLCONFIGDIR','/tmp/recall-mpl-cache')
import numpy as np
from scipy.stats import spearmanr,rankdata
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.ticker import PercentFormatter,ScalarFormatter
root=Path(__file__).resolve().parents[1]/'results/library-characteristics'
snap=json.load(open(root/'snapshot.json'));meta={r['package']:r for r in json.load(open(root/'metadata.json'))['packages']};taxonomy=json.load(open(root/'categories.json'));cats={k:g for g,names in taxonomy['groups'].items() for k in names}
rows=[]
for raw in snap['rows']:
 if raw['groundTruthPairs']<20 or raw['anchors']==0:continue
 r=dict(raw);r.update(recovery=r['correct']/r['groundTruthPairs'],anchorFraction=r['anchors']/r['groundTruthPairs'],category=cats[r['library']]);r['versions']=';'.join(r.pop('sourceVersions'));assert r['sourceFunctionCount']>0;rows.append(r)
packages=[]
for name in sorted({r['library'] for r in rows}):
 rr=[r for r in rows if r['library']==name];m=meta[name];g=sum(r['groundTruthPairs'] for r in rr);c=sum(r['correct'] for r in rr)
 packages.append(dict(library=name,category=cats[name],instances=len(rr),groundTruthPairs=g,correct=c,recovery=c/g,meanInstanceRecovery=np.mean([r['recovery'] for r in rr]),anchorFraction=sum(r['anchors'] for r in rr)/g,sourceFunctionCount=float(np.median([r['sourceFunctionCount'] for r in rr])),npmStars=m.get('npmStars'),downloads=m.get('downloads'),githubStars=(m.get('github') or {}).get('stars'),githubRepo=(m.get('github') or {}).get('fullName'),npmURL='https://www.npmjs.com/package/'+name,githubURL=(m.get('github') or {}).get('htmlURL'),description=m.get('description'),downloadStart=m.get('downloadStart'),downloadEnd=m.get('downloadEnd')))
def csvout(name,rr):
 with open(root/name,'w') as f:w=csv.DictWriter(f,fieldnames=list(rr[0]));w.writeheader();w.writerows(rr)
csvout('instances.csv',rows);csvout('packages.csv',packages)
def rho(rr,k):
 rr=[r for r in rr if r.get(k) is not None];return dict(n=len(rr),spearman=float(spearmanr([r[k] for r in rr],[r['recovery'] for r in rr]).statistic))
def partial(rr,k,controls):
 rr=[r for r in rr if r.get(k) is not None and all(r.get(c) is not None for c in controls)];z=np.column_stack([np.ones(len(rr))]+[rankdata([r[c] for r in rr]) for c in controls]);res=[]
 for key in [k,'recovery']:
  a=rankdata([r[key] for r in rr]);res.append(a-z@np.linalg.lstsq(z,a,rcond=None)[0])
 return dict(n=len(rr),partialRankCorrelation=float(np.corrcoef(res)[0,1]),controls=controls)
statistics={'snapshot':snap['snapshot'],'completedRepositories':len(snap['completed']),'instances':len(rows),'packages':len(packages),'size':{k:rho(rows,k) for k in ['sourceFunctionCount','groundTruthPairs']},'popularity':{k:rho(packages,k) for k in ['npmStars','downloads','githubStars']},'codeStructure':{k:rho(rows,k) for k in ['meanSourceCharacters','nestedFraction','anchorFraction']},'adjusted':{k:partial(packages,k,['anchorFraction','sourceFunctionCount']) for k in ['npmStars','downloads','githubStars']},'categories':{}}
for cat in taxonomy['groups']:
 rr=[r for r in packages if r['category']==cat];vals=[r['recovery'] for r in rr];statistics['categories'][cat]=dict(packages=len(rr),instances=sum(r['instances'] for r in rr),mean=float(np.mean(vals)),median=float(np.median(vals)),pooled=sum(r['correct'] for r in rr)/sum(r['groundTruthPairs'] for r in rr))
# Repeated builds are collapsed for popularity; shared upstream repositories are a sensitivity view.
githubGroups=[]
for repo in sorted({r['githubRepo'] for r in packages if r['githubRepo']}):
 rr=[r for r in packages if r['githubRepo']==repo];githubGroups.append(dict(githubStars=rr[0]['githubStars'],recovery=sum(r['correct'] for r in rr)/sum(r['groundTruthPairs'] for r in rr)))
statistics['githubUpstreamSensitivity']=rho(githubGroups,'githubStars')
statistics['popularityMeanInstanceSensitivity']={k:rho([{**r,'recovery':r['meanInstanceRecovery']} for r in packages],k) for k in ['npmStars','downloads','githubStars']}
(root/'statistics.json').write_text(json.dumps(statistics,indent=2))
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':11,'axes.spines.top':False,'axes.spines.right':False,'axes.labelcolor':'#243447','text.color':'#243447','axes.edgecolor':'#b7c3ce'})
allbins=[]
def scatter(ax,rr,key,label,title,zero=False):
 rr=[r for r in rr if r.get(key) is not None];xs=np.array([r[key] for r in rr]);ys=np.array([r['recovery'] for r in rr]);ax.scatter(xs,ys,s=35,alpha=.55,c='#2378a5',edgecolor='white',linewidth=.4)
 bounds=np.unique(np.quantile(xs,[0,.25,.5,.75,1]));bins=[]
 for i,(lo,hi) in enumerate(zip(bounds[:-1],bounds[1:])):
  sel=(xs>=lo)&((xs<=hi) if i==len(bounds)-2 else (xs<hi))
  if sel.any():bins.append(dict(metric=key,lower=float(lo),upper=float(hi),n=int(sel.sum()),x=float(np.median(xs[sel])),mean=float(np.mean(ys[sel]))))
 ax.plot([b['x'] for b in bins],[b['mean'] for b in bins],'-o',color='#cc6033',lw=2,ms=5)
 for b in bins:ax.annotate('n='+str(b['n']),(b['x'],b['mean']),xytext=(0,10),textcoords='offset points',ha='center',fontsize=8,color='#a64624')
 allbins.extend(bins)
 if key in ['sourceFunctionCount','groundTruthPairs','meanSourceCharacters','downloads','githubStars']:ax.set_xscale('log')
 elif zero:ax.set_xscale('symlog',linthresh=1);ax.set_xticks([0,1,10,100,1000]);ax.xaxis.set_major_formatter(ScalarFormatter())
 if key=='nestedFraction':ax.xaxis.set_major_formatter(PercentFormatter(1))
 ax.set_ylim(-.025,1.06);ax.yaxis.set_major_formatter(PercentFormatter(1));ax.set_xlabel(label);ax.set_ylabel('Recovery rate');ax.set_title(title,fontweight='bold',pad=12);ax.grid(alpha=.18);ax.set_axisbelow(True)
 ax.text(.035,.04,f"Spearman ρ = {rho(rr,key)['spearman']:.2f}  |  n = {len(rr)}",transform=ax.transAxes,fontsize=10,bbox=dict(facecolor='white',alpha=.9,edgecolor='none'))
def save(fig,name):
 for ext in ['png','pdf','svg']:fig.savefig(root/(name+'.'+ext),dpi=180,facecolor='white')
fig,axs=plt.subplots(1,2,figsize=(12,5.5));scatter(axs[0],rows,'sourceFunctionCount','Functions in supplied source-reference inventory (log)','Reference inventory size');scatter(axs[1],rows,'groundTruthPairs','GT-evaluable library functions in the build (log)','Evaluated build size');fig.suptitle('Library size and recovery',fontsize=18,x=.075,ha='left',y=.99);fig.text(.075,.915,f"{len(rows)} repository–library instances • GT ≥ 20 and initial anchors > 0",color='#526275');fig.text(.075,.025,'Orange line: mean recovery within quartile ranges; x-position is the median size in each range.\nReference size counts supplied matching functions, not every function in the published npm package.',fontsize=10,color='#526275');fig.tight_layout(rect=[0,.10,1,.88],w_pad=3);save(fig,'size-recovery')
fig,axs=plt.subplots(1,3,figsize=(16,5.5))
for ax,key,label,title in zip(axs,['npmStars','downloads','githubStars'],['Recorded npm stars (symlog)','npm downloads, last 30 days (log)','Upstream GitHub stars (log)'],['npm stars','npm downloads','GitHub repository stars']):scatter(ax,packages,key,label,title,zero=key=='npmStars')
fig.suptitle('Library popularity and recovery',fontsize=18,x=.065,ha='left',y=.99);fig.text(.065,.915,'One point per package; recovery pools its retained builds. Public popularity collected on 8 November 2026.',color='#526275');fig.text(.065,.025,'Orange line: quartile-bin mean; labels show package counts. npm download window: 9 October–7 November 2026.\nGitHub stars belong to upstream repositories and can be shared by several packages. Popularity is measured across versions.',fontsize=10,color='#526275');fig.tight_layout(rect=[0,.10,1,.88],w_pad=2.5);save(fig,'popularity-recovery')
order=sorted(statistics['categories'],key=lambda c:statistics['categories'][c]['mean']);fig,ax=plt.subplots(figsize=(11.5,6.2));rng=np.random.default_rng(348)
values=[[r['recovery'] for r in packages if r['category']==c] for c in order];ax.boxplot(values,vert=False,patch_artist=True,widths=.5,showfliers=False,boxprops=dict(facecolor='#dce9f1',edgecolor='#638398'),medianprops=dict(color='#243447',linewidth=1.5),whiskerprops=dict(color='#638398'),capprops=dict(color='#638398'))
for i,(cat,vals) in enumerate(zip(order,values),1):
 ax.scatter(vals,i+rng.uniform(-.15,.15,len(vals)),s=29,alpha=.65,c='#2378a5',edgecolor='white',lw=.3);ax.scatter([np.mean(vals)],[i],marker='D',s=55,c='#cc6033',zorder=5)
labels=[c+'\n'+str(statistics['categories'][c]['packages'])+' packages, '+str(statistics['categories'][c]['instances'])+' instances' for c in order];ax.set_yticks(range(1,len(order)+1),labels);ax.set_xlim(0,1.04);ax.xaxis.set_major_formatter(PercentFormatter(1));ax.set_xlabel('Package recovery rate (pooled across retained builds)');ax.grid(axis='x',alpha=.18);ax.set_axisbelow(True);ax.set_title('Functionality category and recovery',fontsize=18,fontweight='bold',loc='left',pad=20);ax.scatter([],[],marker='D',s=45,c='#cc6033',label='Unweighted package mean');ax.legend(frameon=False,loc='lower left',bbox_to_anchor=(0,-.23),fontsize=10);fig.text(.04,.025,'Primary-purpose categories were manually assigned from public package metadata; assignments and boundary cases are recorded.\nBoxes: median and interquartile range; whiskers: 1.5×IQR. Categories overlap in behavior and are not causal explanations.',fontsize=9,color='#526275');fig.tight_layout(rect=[0,.12,1,1]);save(fig,'category-recovery')
fig,axs=plt.subplots(1,2,figsize=(12,5.5));scatter(axs[0],rows,'meanSourceCharacters','Mean source-function length, characters (log)','Function length');scatter(axs[1],rows,'nestedFraction','Fraction of source functions nested inside functions','Function nesting');fig.suptitle('Additional source-code characteristics',fontsize=18,x=.075,ha='left',y=.99);fig.text(.075,.915,f"{len(rows)} retained repository–library instances • descriptive associations",color='#526275');fig.text(.075,.025,'Orange lines show quartile-bin mean recovery. Function length and nesting are calculated from the supplied source inventory.\nThese characteristics can correlate with anchor coverage, package purpose and compilation behavior.',fontsize=10,color='#526275');fig.tight_layout(rect=[0,.10,1,.88],w_pad=3);save(fig,'structure-recovery')
csvout('binned-means.csv',allbins)
print(json.dumps(statistics,indent=2))
