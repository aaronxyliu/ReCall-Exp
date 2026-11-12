"""Sequential incremental candidate-policy experiment; no GT reaches recovery."""
import json,subprocess,time,os,sys
from pathlib import Path
here=Path(__file__).resolve().parent;work=here.parents[2];dataset=work/'ReCall Dataset/bundling-dataset';root=Path(sys.argv[1]).resolve();baseline=Path(sys.argv[2]).resolve();root.mkdir(parents=True,exist_ok=True)
subjects=json.loads((dataset/'one-to-one-evaluation-v2.json').read_text())['subjects'];prior=json.loads((baseline/'progress.json').read_text());completed=set(prior['completed'])
# Obtain completed-pair gains first; partial/unstarted subjects follow.
priority=json.loads(os.environ.get('RECALL_PRIORITY_SUBJECTS','[]'));subjects.sort(key=lambda s:(priority.index(s['subject']) if s['subject'] in priority else len(priority),s['subject'] not in completed,s['oneToOnePairs']))
active={s['subject'] for s in subjects}
saved=json.loads((root/'progress.json').read_text()) if (root/'progress.json').exists() else {}
state={**saved,'startedAt':saved.get('startedAt',time.time()),'total':len(subjects),'completed':[s for s in saved.get('completed',[]) if s in active],'failed':[s for s in saved.get('failed',[]) if s in active and not (root/s/'run/evaluation-v2.json').exists()],'running':None,'phase':os.environ.get('RECALL_EXPERIMENT_PHASE','Graph syntax upgrade with first-hit AST continuation'),'baseline':str(baseline)}
state.pop('finishedAt',None)
def save():
 p=root/'progress.json';t=p.with_suffix('.tmp');t.write_text(json.dumps(state,indent=2));t.replace(p)
for subject in subjects:
 # Re-read cohort membership before dispatch so exclusions also apply mid-run.
 key=subject['subject'];active={s['subject'] for s in json.loads((dataset/'one-to-one-evaluation-v2.json').read_text())['subjects']};state['total']=len(active);state['completed']=[s for s in state['completed'] if s in active];state['failed']=[s for s in state['failed'] if s in active]
 if key not in active:save();continue
 folder=root/key;folder.mkdir(parents=True,exist_ok=True);state['running']=key;save()
 if (folder/'run/evaluation-v2.json').exists():code=0
 elif (folder/'run/recovery.json').exists():
  # A completed recovery with failed scoring must not repeat model work.
  with open(folder/'console.log','a') as log:code=subprocess.run(['node','--max-old-space-size=24576',str(here/'rescore-one.mjs'),str(dataset),key,str(root)],stdout=log,stderr=subprocess.STDOUT,env=os.environ).returncode
 else:
  attempt=0
  while True:
   with open(folder/'console.log','a') as log:code=subprocess.run(['node','--max-old-space-size=24576',str(here/'continue-one.mjs'),str(dataset),key,str(root),str(baseline)],stdout=log,stderr=subprocess.STDOUT,env=os.environ).returncode
   if code==0:break
   tail=(folder/'console.log').read_text()[-5000:];attempt+=1
   if attempt>=3 or not any(k in tail for k in ['fetch failed','TimeoutError','ECONNRESET','ECONNREFUSED','HTTP 502','HTTP 503','HTTP 504']):break
   state['retrying']=key;save();time.sleep(15)
  state.pop('retrying',None)
 state['completed' if code==0 else 'failed']=list(dict.fromkeys([*state['completed' if code==0 else 'failed'],key]));save();subprocess.run([sys.executable,str(here/'report.py'),str(root),str(baseline)])
state.update(running=None,finishedAt=time.time());save()
