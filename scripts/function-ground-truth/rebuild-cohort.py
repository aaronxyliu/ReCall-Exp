"""Rebuild the frozen cohort with one collector policy; keep the v1 index intact."""
import json,subprocess,hashlib,time,argparse
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('dataset',type=Path);args=parser.parse_args()
exp=Path(__file__).resolve().parents[2];dataset=args.dataset.resolve();index=json.loads((dataset/'one-to-one-evaluation.json').read_text());rows=[]
for s in index['subjects']:
 original=dataset/s['records'];out=original.parent.parent/'ground-truth-v2'
 if not (out/'func-mapping.json').exists():
  log=Path('/tmp')/('recall-v2-'+s['subject'].replace('/','--')+'.log')
  with log.open('w') as stream:subprocess.run(['node',str(exp/'scripts/function-ground-truth/rebuild.mjs'),str(original.parent),str(out)],cwd=exp,stdout=stream,stderr=subprocess.STDOUT,check=True)
 d=json.loads((out/'func-mapping.json').read_text());old=json.loads(original.read_text());assert d['audit']['verifiedPairs']==len(d['pairs']);assert d['rebuild']['inputRecordSHA256']==hashlib.sha256(original.read_bytes()).hexdigest()
 for script,digest in d['rebuild']['collectorSHA256'].items():assert hashlib.sha256((exp/'scripts/function-ground-truth'/script).read_bytes()).hexdigest()==digest, 'Collector changed: '+script
 a={(p['source'],p['bundled']) for p in old['pairs']};b={(p['source'],p['bundled']) for p in d['pairs']}
 row={**s,'records':str((out/'func-mapping.json').relative_to(dataset)),'recordsSHA256':hashlib.sha256((out/'func-mapping.json').read_bytes()).hexdigest(),'oneToOnePairs':len(d['pairs'])}
 row['revisionComparison']={'oldPairs':len(a),'newPairs':len(b),'retained':len(a&b),'added':len(b-a),'removed':len(a-b),'failureCount':len(d.get('failures',[])),'missingSourceContentCount':len(d.get('missingSourceContents',[]))};rows.append(row)
 print(s['subject'],row['revisionComparison'],flush=True)
 Path('/tmp/recall-cohort-v2-progress.json').write_text(json.dumps(rows,indent=2))
new={**index,'pairDefinition':'reciprocal-body-mapped-v2','oneToOnePairs':sum(s['oneToOnePairs'] for s in rows),'subjects':rows,'revisionOf':'one-to-one-evaluation.json','role':'active-evaluation-oracle','note':'Same captures and library selections; rebuilt without recovery predictions. Original index preserved for running recovery provenance.'}
(dataset/'one-to-one-evaluation-v2.json').write_text(json.dumps(new,indent=2)+'\n')
print('TOTAL',new['oneToOnePairs'],flush=True)
