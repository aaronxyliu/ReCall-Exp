"""Sequential, resumable cohort runner. Progress is durable; no oracle enters ReCall."""
import json, subprocess, time, argparse, os, urllib.request
from pathlib import Path
HERE=Path(__file__).resolve().parent
WORK=HERE.parents[2]
p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);p.add_argument('--subject',action='append');p.add_argument('--endpoint',default='http://127.0.0.1:11434');p.add_argument('--ast-first',action='store_true');p.add_argument('--ungated',action='store_true');p.add_argument('--priority-subject',action='append',default=[]);p.add_argument('--retain-conflicts',action='store_true');p.add_argument('--top-k',type=int,default=5);a=p.parse_args()
if a.top_k<1:p.error('top-k must be positive')
root=a.output.resolve();root.mkdir(parents=True,exist_ok=True)
# Never silently combine endpoints or reuse completed results from another server.
for record in root.glob('*/*/experiment.json'):
 saved=json.loads(record.read_text())['config']
 if saved['recovery'].get('topK',5)!=a.top_k:p.error('Existing experiment uses another top-k; choose a fresh output directory')
 if saved['recovery'].get('conflictPolicy','discard')!=('retain' if a.retain_conflicts else 'discard'):
  p.error('Existing experiment uses another conflict policy; choose a fresh output directory')
 if saved['models'].get('astFirst',False)!=a.ast_first or saved['recovery']['libraryGate']==a.ungated:
  p.error('Existing experiment uses different AST/gating settings; choose a fresh output directory')
 if saved['models']['endpoint'] != a.endpoint:
  p.error('Existing experiment uses another endpoint; choose a fresh output directory')
worker_env={**os.environ,'RECALL_TOP_K':str(a.top_k),'RECALL_MODEL_ENDPOINT':a.endpoint,'RECALL_AST_FIRST':'1' if a.ast_first else '0','RECALL_UNGATED':'1' if a.ungated else '0','RECALL_RETAIN_CONFLICTS':'1' if a.retain_conflicts else '0'}
dataset=WORK/'ReCall Dataset/bundling-dataset'
subjects=json.loads((dataset/'one-to-one-evaluation.json').read_text())['subjects']
if a.subject:subjects=[s for s in subjects if s['subject'] in a.subject]
subjects.sort(key=lambda s:(0 if s['subject'] in a.priority_subject else 1,s['oneToOnePairs']))
started=time.time();state={'startedAt':started,'total':len(subjects),'completed':[],'failed':[],'running':None,'etaSeconds':None}
def wait_for_models():
 while True:
  try:
   with urllib.request.urlopen(a.endpoint.rstrip('/')+'/api/tags',timeout=15) as response: json.load(response)
   state.pop('waitingForModel',None);return
  except Exception as error:
   state['waitingForModel']=str(error);(root/'progress.json').write_text(json.dumps(state,indent=2));print('Waiting for model service: '+str(error),flush=True);time.sleep(15)
for s in subjects:
 wait_for_models()
 key=s['subject'];folder=root/key;folder.mkdir(parents=True,exist_ok=True)
 state['running']=key;(root/'progress.json').write_text(json.dumps(state,indent=2))
 if (folder/'run/evaluation.json').exists():status=0
 else:
  while True:
   with (folder/'console.log').open('a') as log:
    status=subprocess.run(['node','--max-old-space-size=12288',str(HERE/'run-one.mjs'),str(dataset),key,str(root)],stdout=log,stderr=subprocess.STDOUT,env=worker_env).returncode
   if status==0:break
   tail=(folder/'console.log').read_text()[-6000:]
   if not any(message in tail for message in ['fetch failed','TimeoutError','ECONNRESET','ECONNREFUSED','HTTP 502','HTTP 503','HTTP 504']):break
   state['retryingSubject']=key;(root/'progress.json').write_text(json.dumps(state,indent=2))
   time.sleep(15);wait_for_models()
  state.pop('retryingSubject',None)
 state['completed' if status==0 else 'failed'].append(key)
 state['elapsedSeconds']=time.time()-started
 # Repository sizes differ dramatically: this is only a pair-weighted rough projection.
 done=sum(x['oneToOnePairs'] for x in subjects if x['subject'] in state['completed'])
 remaining=sum(x['oneToOnePairs'] for x in subjects if x['subject'] not in state['completed']+state['failed'])
 state['etaSeconds']=state['elapsedSeconds']*remaining/done if done else None
 print(json.dumps(state),flush=True);(root/'progress.json').write_text(json.dumps(state,indent=2))
state['running']=None;state['finishedAt']=time.time();(root/'progress.json').write_text(json.dumps(state,indent=2))
