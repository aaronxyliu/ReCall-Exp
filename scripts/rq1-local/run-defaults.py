"""Fresh default-settings run; sequential reference preparation and separate scoring."""
import json,pathlib,subprocess,time,datetime,importlib.util,hashlib,sys,os
BASE=pathlib.Path(__file__).resolve().parents[3]; DATA=BASE/'ReCall Dataset'; EXP=BASE/'ReCall Exp'
RESUME=False
if '--resume' in sys.argv:raise ValueError('Fresh default run only')
REFERENCES=os.environ.get('RECALL_REFERENCES_ROOT')
if not REFERENCES:raise ValueError('Set RECALL_REFERENCES_ROOT to independently obtained packages grouped by subject; historical source snapshots are not allowed')
ROOT=pathlib.Path(sys.argv[1]).resolve(); ROOT.mkdir(parents=True,exist_ok=RESUME)
def read(p): return json.loads(p.read_text())
def write(p,x):
 t=p.with_suffix(p.suffix+'.tmp');t.write_text(json.dumps(x,indent=2));t.replace(p)
def stamp(t): return datetime.datetime.fromtimestamp(t,datetime.timezone(datetime.timedelta(hours=8))).isoformat()
index=read(DATA/'qualified-dataset/index.json');start=time.time()
spec=importlib.util.spec_from_file_location('score',DATA/'tools/score.py');scorer=importlib.util.module_from_spec(spec);spec.loader.exec_module(scorer)
requested=[x for x in sys.argv[2:] if x!='--resume']
previous=read(ROOT/'experiment.json') if RESUME else None
if RESUME:
 if previous.get('status')!='stopped':raise ValueError('Only explicitly stopped experiments can be resumed')
 if previous['datasetIndexSHA256']!=hashlib.sha256((DATA/'qualified-dataset/index.json').read_bytes()).hexdigest():raise ValueError('Dataset index changed')
 if requested and requested!=previous['subjects']:raise ValueError('Resume subject selection changed')
 requested=previous['subjects']
if requested and (len(requested)!=len(set(requested)) or set(requested)-{e['subject'] for e in index['subjects']}):raise ValueError('Unknown or duplicate subject selection')
subjects=[next(e for e in index['subjects'] if e['subject']==key) for key in requested] if requested else index['subjects']
write(ROOT/'selected-subjects.json',subjects)
rows=[{'subject':e['subject'],'status':'queued','denominator':len(read(DATA/'qualified-dataset'/e['records'])['pairs'])} for e in subjects]
manifest={'startedAt':stamp(start),'pid':os.getpid(),'subjects':[e['subject'] for e in subjects],'datasetIndexSHA256':hashlib.sha256((DATA/'qualified-dataset/index.json').read_bytes()).hexdigest(),'commits':{n:subprocess.check_output(['git','-C',str(BASE/n),'rev-parse','HEAD'],text=True).strip() for n in ['ReCall','ReCall Dataset']},'timingPolicy':'Fresh per-subject caches; no historical responses or checkpoints imported','policy':'Unmodified ReCall defaults via config={}; bundler hint=null; all recovery/model/graph options inherited from current ReCall defaults; independent matching packages; separate oracle scoring; sequential subjects.'}
prior_elapsed=0
if RESUME:
 old_progress=read(ROOT/'progress.json');rows=old_progress['rows']
 prior_elapsed=old_progress.get('elapsedSeconds',0)
 manifest=previous;manifest['pid']=os.getpid();manifest['status']='running'
 manifest.setdefault('resumptions',[]).append({'resumedAt':stamp(start),'priorElapsedSeconds':prior_elapsed,'previousStop':previous.get('stoppedAt')})
write(ROOT/'experiment.json',manifest)
def report():
 elapsed=prior_elapsed+time.time()-start;done=[r for r in rows if r['status']=='completed']; scored=[r for r in rows if 'score' in r];correct=sum(r['score']['correctTargets'] for r in scored);pred=sum(r['score']['predictedPairsWithinOracle'] for r in scored);den=sum(r['denominator'] for r in rows)
 # Repository-average ETA is deliberately labeled low confidence for heterogeneous subjects.
 remaining=(sum(r['elapsedSeconds'] for r in done)/len(done))*(len(rows)-len(done)) if done else None
 out={'status':manifest.get('status','running'),'updatedAt':stamp(time.time()),'elapsedSeconds':elapsed,'completed':len(done),'total':len(rows),'correctTargets':correct,'denominator':den,'recoveryRateSoFar':correct/den,'pairPrecisionWithinOracle':correct/pred if pred else None,'estimatedFinishedAt':stamp(time.time()+remaining) if remaining is not None else None,'etaBasis':'Low-confidence mean completed-repository duration; unavailable until first completion','rows':rows};write(ROOT/'progress.json',out)
 lines=['# Local RQ1 progress','',f"Updated: {out['updatedAt']}",f"Completed: {len(done)}/{len(rows)} | Elapsed: {elapsed/3600:.2f} h",f"Recovery so far: {correct}/{den} ({correct/den:.2%}); queued targets remain in denominator",f"Assessed pair precision: {correct/pred:.2%}" if pred else 'Assessed pair precision: pending',f"Estimated finish: {out['estimatedFinishedAt'] or 'pending first completed repository'}",out['etaBasis'],'','| Subject | Status | Recovery | Precision | Elapsed (s) |','|---|---|---|---|---|']
 for r in rows:
  s=r.get('score',{});lines.append(f"| {r['subject']} | {r['status']} | {s.get('correctTargets','—')}/{r['denominator']} | {format(s['pairPrecisionWithinOracle'],'.2%') if s.get('pairPrecisionWithinOracle') is not None else '—'} | {r.get('elapsedSeconds',0):.0f} |")
 (ROOT/'PROGRESS.md').write_text('\n'.join(lines)+'\n')
 with (ROOT/'progress-history.jsonl').open('a') as f:f.write(json.dumps({k:v for k,v in out.items() if k!='rows'})+'\n')
report()
for entry,row in zip(subjects,rows):
 if row['status']=='completed':continue
 folder=ROOT/entry['subject'];folder.mkdir(parents=True,exist_ok=RESUME);t=time.time();previous_subject_elapsed=row.get('elapsedSeconds',0);row['status']='exporting';report()
 try:
  with (folder/'worker.log').open('a' if RESUME else 'w') as log:
   subprocess.run(['node',str(EXP/'scripts/rq1-local/prepare-references.mjs'),str(pathlib.Path(REFERENCES).parent),entry['subject']],stdout=log,stderr=subprocess.STDOUT,check=True)
   if not (folder/'input/source.json').exists():subprocess.run(['node',str(DATA/'tools/export-inputs.mjs'),entry['subject'],str(folder/'input'),'--references',str(pathlib.Path(REFERENCES)/entry['subject'])],stdout=log,stderr=subprocess.STDOUT,check=True)
   lock=folder/'run/.recall.lock'
   if lock.exists():
    pid=read(lock)['pid']
    try:os.kill(pid,0)
    except ProcessLookupError:lock.rename(folder/('stale-lock-'+str(pid)+'.json'))
    else:raise RuntimeError('Existing worker PID is alive; refusing to resume')
   args=['node',str(EXP/'scripts/rq1-local/run-default-one.mjs'),str(folder)]
   if RESUME and (folder/'run/run.json').exists():args.append('--resume')
   row['status']='running';p=subprocess.Popen(args,stdout=log,stderr=subprocess.STDOUT)
   last=None
   while True:
    code=p.poll();row['elapsedSeconds']=previous_subject_elapsed+time.time()-t
    live=folder/'live.json'
    if live.exists():
     try:row['live']=read(live)
     except json.JSONDecodeError:pass
    run=folder/'run';result=run/('recovery.json' if (run/'recovery.json').exists() else 'checkpoint.json')
    if result.exists() and result.stat().st_mtime_ns!=last:
     try:
      row['score']=scorer.score(entry,read(run/'source.json'),read(run/'bundle.json'),read(result));last=result.stat().st_mtime_ns;write(folder/'score.json',row['score'])
     except (json.JSONDecodeError,FileNotFoundError):pass
    report()
    if code is not None:break
    time.sleep(30)
   if code:raise RuntimeError(f'Worker exited {code}; see worker.log')
   status=read(run/'status.json')['status'];row['status']='completed' if status=='fixed-point' else status
 except Exception as e:row['status']='failed';row['error']=str(e)
 row['elapsedSeconds']=previous_subject_elapsed+time.time()-t;report()
manifest['finishedAt']=stamp(time.time());manifest['status']='completed' if all(r['status']=='completed' for r in rows) else 'incomplete';write(ROOT/'experiment.json',manifest);report()
