import json,collections
from pathlib import Path
import numpy as np
from scipy.stats import rankdata
p=Path(__file__).resolve().parents[1]/'results/library-characteristics';s=json.load(open(p/'snapshot.json'));m=json.load(open(p/'metadata.json'));c=json.load(open(p/'categories.json'));stats=json.load(open(p/'statistics.json'));labels=[x for xs in c['groups'].values() for x in xs];assert len(labels)==len(set(labels));keys=[(r['repository'],r['library']) for r in s['rows']];assert len(keys)==len(set(keys))
rs=[r for r in s['rows'] if r['groundTruthPairs']>=20 and r['anchors']>0];names={r['library'] for r in rs};md={r['package']:r for r in m['packages']};assert names==set(md)==set(labels)
for r in rs:
 assert 0<=r['correctAnchors']<=r['anchors']<=r['groundTruthPairs'];assert r['correctAnchors']<=r['correct']<=r['groundTruthPairs'];assert r['sourceFunctionCount']>0
for r in md.values():assert r['npmStars']>=0 and r['downloads']>=0
periods={(r['downloadStart'],r['downloadEnd']) for r in md.values()};assert len(periods)==1
import csv
packages=list(csv.DictReader(open(p/'packages.csv')));rng=np.random.default_rng(3441)
def corr(x,y):return float(np.corrcoef(rankdata(x),rankdata(y))[0,1])
def bootstrap(rows,key,cluster=None):
 groups={}
 for i,r in enumerate(rows):groups.setdefault(r[cluster] if cluster else i,[]).append(r)
 groups=list(groups.values());values=[]
 for _ in range(1000):
  sample=[r for i in rng.integers(0,len(groups),len(groups)) for r in groups[i]];values.append(corr([float(r[key]) for r in sample],[float(r['recovery']) for r in sample]))
 return np.quantile(values,[.025,.975]).tolist()
for r in rs:r['recovery']=r['correct']/r['groundTruthPairs'];r['anchorFraction']=r['anchors']/r['groundTruthPairs']
ci={k:bootstrap(rs,k,'library') for k in ['sourceFunctionCount','groundTruthPairs','meanSourceCharacters','nestedFraction','anchorFraction']}
for k in ['npmStars','downloads','githubStars']:ci[k]=bootstrap([r for r in packages if r[k]!=''],k)
stats['bootstrap95PercentileCI']=ci;stats['bootstrapNote']='1000 replicates; library-cluster resampling for instance-level metrics; package resampling for popularity. GitHub shared-upstream dependence is instead checked by upstream aggregation sensitivity.'
(p/'statistics.json').write_text(json.dumps(stats,indent=2));print(json.dumps({'validatedInstances':len(rs),'packages':len(names),'period':list(periods),'bootstrapCI':ci},indent=2))
