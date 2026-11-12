"""Sequential incremental candidate-policy experiment; no GT reaches recovery."""
import json,subprocess,time,os,sys
from pathlib import Path
here=Path(__file__).resolve().parent;work=here.parents[2];dataset=work/'ReCall Dataset/bundling-dataset';root=Path(sys.argv[1]).resolve();baseline=Path(sys.argv[2]).resolve();root.mkdir(parents=True,exist_ok=True)
subjects=json.loads((dataset/'one-to-one-evaluation-v2.json').read_text())['subjects'];prior=json.loads((baseline/'progress.json').read_text());completed=set(prior['completed'])
# Obtain completed-pair gains first; partial/unstarted subjects follow.
subjects.sort(key=lambda s:(s['subject'] not in completed, s['oneToOnePairs']))
state={'startedAt':time.time(),'total':len(subjects),'completed':[],'failed':[],'running':None,'phase':os.environ.get('RECALL_EXPERIMENT_PHASE','AST before embedding top-three continuation'),'baseline':str(baseline)}
def save():
 p=root/'progress.json';t=p.with_suffix('.tmp');t.write_text(json.dumps(state,indent=2));t.replace(p)
for subject in subjects:
 key=subject['subject'];folder=root/key;folder.mkdir(parents=True,exist_ok=True);state['running']=key;save()
 if (folder/'run/evaluation-v2.json').exists():code=0
 else:
  attempt=0
  while True:
   with open(folder/'console.log','a') as log:code=subprocess.run(['node','--max-old-space-size=24576',str(here/'continue-one.mjs'),str(dataset),key,str(root),str(baseline)],stdout=log,stderr=subprocess.STDOUT,env=os.environ).returncode
   if code==0:break
   tail=(folder/'console.log').read_text()[-5000:];attempt+=1
   if attempt>=3 or not any(k in tail for k in ['fetch failed','TimeoutError','ECONNRESET','ECONNREFUSED','HTTP 502','HTTP 503','HTTP 504']):break
   state['retrying']=key;save();time.sleep(15)
  state.pop('retrying',None)
 state['completed' if code==0 else 'failed'].append(key);save();subprocess.run([sys.executable,str(here/'report.py'),str(root),str(baseline)])
state.update(running=None,finishedAt=time.time());save()
