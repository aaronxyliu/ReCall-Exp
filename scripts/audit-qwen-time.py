from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parents[1]
original=ROOT/'results/autodl-rq1-strict-2026-11-14/ReCall Exp/results/rq1-strict-one-to-one-real'
revised=ROOT/'results/autodl-rq1-prompt-recheck/archived-cache'
progress=json.loads((ROOT/'RQ1/final-results/progress.json').read_text())
seen={};rows=[];digest=hashlib.sha256()
fields=['total_duration','load_duration','prompt_eval_duration','eval_duration']
def summarize(responses):
 out={k:sum(r[k] for r in responses)/1e9 for k in fields}
 out['count']=len(responses);out['compute']=out['prompt_eval_duration']+out['eval_duration'];out['residual']=out['total_duration']-out['compute']-out['load_duration'];return out
for row in progress['rows']:
 subject=row['subject'];phases={}
 for phase,base,expected in [('original',original,row['originalRequests']),('revised',revised,row['revisedRequests'])]:
  files=sorted((base/subject/'run/model-cache/chat').glob('*.json'));assert len(files)==expected,(subject,phase,len(files),expected)
  rs=[]
  for file in files:
   raw=file.read_bytes();d=json.loads(raw);r=d['response'];assert all(k in r for k in fields)
   identity=(r['model'],r['created_at']);assert identity not in seen,(file,seen.get(identity));seen[identity]=str(file)
   digest.update(str(file.relative_to(ROOT)).encode()+hashlib.sha256(raw).digest());rs.append(r)
  phases[phase]=summarize(rs)
 rows.append(dict(subject=subject,**phases))
totals={phase:{k:sum(r[phase][k] for r in rows) for k in rows[0][phase]} for phase in ['original','revised']}
totals['combined']={k:totals['original'][k]+totals['revised'][k] for k in totals['original']}
trace=json.loads((ROOT/'RQ1/final-results/validation-timing.json').read_text())['totals']
totals['finalTrace']=trace
out=ROOT/'results/qwen-time-audit-2026-11-15';out.mkdir(exist_ok=True)
(out/'summary.json').write_text(json.dumps(dict(policy='All archived original and revised chat requests; counts reconcile with recorded requests; model+created_at identities are globally unique. Ollama total_duration includes service overhead and potential queue time; residual is not automatically queue time.',inputSHA256=digest.hexdigest(),totals=totals,rows=rows),indent=2)+'\n')
print(json.dumps(totals,indent=2))
