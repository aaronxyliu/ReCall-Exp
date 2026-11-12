"""Switch only after the old worker finishes; never terminates worker inference."""
import json,os,time,subprocess,sys,shlex
from pathlib import Path
base=Path('/Users/aaronxyliu/GitHub/ReCall Research');exp=base/'ReCall Exp';old=exp/'results/rq1-autodl-first-accept-top3-26';new=exp/'results/rq1-autodl-top3-fixed-26'
worker_pid=int(sys.argv[1]);driver_pid=int(sys.argv[2]);subject=sys.argv[3]
def status(pid):
 try:return next(l.split(':',1)[1].strip().split()[0] for l in Path(f'/proc/{pid}/status').read_text().splitlines() if l.startswith('State:'))
 except FileNotFoundError:return None
last=None
while True:
 prep=new/'static-upgrade-status.json'
 try:d=json.loads(prep.read_text())
 except (FileNotFoundError,json.JSONDecodeError):d={}
 worker_done=status(worker_pid) in (None,'Z');ready=d.get('complete') and not d.get('failures')
 state=(worker_done,len(d.get('prepared',[])),len(d.get('failures',[])),bool(d.get('complete')))
 if state!=last:print(json.dumps({'at':time.time(),'workerFinished':worker_done,'staticPrepared':state[1],'staticFailures':state[2],'staticComplete':state[3]}),flush=True);last=state
 if worker_done and ready:break
 time.sleep(10)
if status(driver_pid)!='T':raise RuntimeError('Old scheduler is not paused; refusing concurrent dispatch')
b=old/subject
if not (b/'timing.json').exists() or not (b/'run/recovery.json').exists() or (b/'run/.recall.lock').exists():raise RuntimeError('Worker boundary lacks final durable state')
index=json.loads((base/'ReCall Dataset/bundling-dataset/one-to-one-evaluation.json').read_text());completed=[];accepted=0
for s in index['subjects']:
 key=s['subject'];src=old/key;dst=new/key;dst.mkdir(parents=True,exist_ok=True);inp=dst/'input'
 if not inp.exists():inp.symlink_to((src/'input').resolve(),target_is_directory=True)
 cache=src/'run/model-cache'
 if cache.exists():
  (dst/'run').mkdir(exist_ok=True);target=dst/'run/model-cache'
  if not target.exists():target.symlink_to(cache.resolve(),target_is_directory=True)
 if (src/'timing.json').exists() and (src/'run/recovery.json').exists():completed.append(key);accepted+=len(json.loads((src/'run/recovery.json').read_text())['promotions'])
meta=json.loads((new/'continuation-root.json').read_text());meta.update(status='running',baselineCompleted=completed,baselineAcceptedPairs=accepted,switchedAt=time.time(),oldScheduler='paused; no worker inference interrupted');(new/'continuation-root.json').write_text(json.dumps(meta,indent=2))
p=json.loads((old/'progress.json').read_text());p.update(completed=completed,running=None,etaSeconds=None,pausedForUpgrade=True,continuedAtRoot=str(new));(old/'progress.json').write_text(json.dumps(p,indent=2))
(exp/'results/rq1-active-run.json').write_text(json.dumps({'root':str(new),'baseline':str(old),'runtime':str(base/'ReCall Fixed Runtime'),'at':time.time()},indent=2))
subprocess.run(['tmux','new-window','-t','recall-rq1','-n','fixed-driver','-c',str(exp),'bash scripts/rq1-fixed/run-cohort.sh results/rq1-autodl-top3-fixed-26'],check=True)
cmd='env RECALL_RUNTIME_ROOT='+shlex.quote(str(base/'ReCall Fixed Runtime'))+' /root/autodl-tmp/recall-tools/node-v24.15.0-linux-x64/bin/node scripts/rq1-fixed/rescore-revision.mjs '+shlex.quote(str(base/'ReCall Dataset/bundling-dataset'))+' results/rq1-autodl-top3-fixed-26 --watch'
subprocess.run(['tmux','new-window','-t','recall-rq1','-n','fixed-oracle','-c',str(exp),cmd],check=True)
print(json.dumps({'started':str(new),'preservedAccepted':accepted,'baselineCompleted':len(completed),'oldWorkerState':status(worker_pid)}),flush=True)
