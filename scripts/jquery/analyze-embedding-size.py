"""Offline paired analysis of the completed fixed-sample model comparison."""
import json,random
from pathlib import Path
from collections import defaultdict
P=Path('results/jquery-4.0.0/embedding-source-instruction-size-v1');B=Path('results/jquery-4.0.0/minified-no-tree-shaking-mapping-v8')
def read(p):return json.loads(p.read_text())
a=read(P/'0.6b/pass-1/rankings.json');b=read(P/'4b/pass-1/rankings.json');groups=defaultdict(list)
for x,y in zip(a,b):
 assert x['queryId']==y['queryId'] and x['candidates']==y['candidates']
 groups[x['sourceId']].append((x,y))
rng=random.Random(20261020);clusters=list(groups.values());deltas=[]
for _ in range(5000):
 rows=[pair for _ in clusters for pair in rng.choice(clusters)]
 deltas.append(100*sum((y['rank']<=3)-(x['rank']<=3) for x,y in rows)/len(rows))
deltas.sort();analysis={'distinctSourceClusters':len(groups),'bootstrapReplicates':5000,'seed':20261020,'top3Delta4BMinus06BPercentagePoints':100*sum((y['rank']<=3)-(x['rank']<=3) for x,y in zip(a,b))/150,'clusteredPercentile95':[deltas[125],deltas[4874]]}
(P/'paired-analysis.json').write_text(json.dumps(analysis,indent=2)+'\n')
d=read(B/'detector-input.json');refs={f['id']:f for s in d['sources'] for f in s['functions']};bundles={(b['build'],f['id']):f for b in d['bundles'] for f in b['functions']}
md='# Top-three disagreements: 4B versus 0.6B\n\nSame revised instruction and candidate sets. These are source-map identity outcomes; similarities are not equivalence probabilities.\n'
for x,y in zip(a,b):
 if (x['rank']<=3)==(y['rank']<=3):continue
 f=refs[x['sourceId']];bf=bundles[x['build'],x['bundleId']]
 md+='\n## '+x['queryId']+' — '+f['name']+'\n\n0.6B rank '+str(x['rank'])+'; 4B rank '+str(y['rank'])+'.\n\nSource:\n\n```javascript\n'+f['code']+'\n```\n\nBundle:\n\n```javascript\n'+bf['code']+'\n```\n\n'
 for label,r in [('0.6B',x),('4B',y)]:md+=label+' top three: '+', '.join(refs[z['sourceId']]['name']+' ('+format(z['score'],'.4f')+')' for z in r['ranked'][:3])+'.\n\n'
(P/'DISAGREEMENTS.md').write_text(md)
p=P/'REPORT.md';s=p.read_text();marker='\n## Offline paired analysis\n';s=s.split(marker)[0];s+=marker+'\nTop-three difference, 4B minus 0.6B: '+format(analysis['top3Delta4BMinus06BPercentagePoints'],'.2f')+' percentage points. Source-grouped bootstrap percentile 95% interval: ['+', '.join(format(z,'.2f') for z in analysis['clusteredPercentile95'])+'], using '+str(len(groups))+' source clusters and 5,000 replicates. This small-sample interval should not be interpreted as proof of an improvement.\n\nThe deployed 0.6B model is Q8_0; the 4B model is Q4_K_M. Model size and quantization both differ. See [DISAGREEMENTS.md](DISAGREEMENTS.md) for all top-three gains and losses.\n';p.write_text(s);print(json.dumps(analysis))
