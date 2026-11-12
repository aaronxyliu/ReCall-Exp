import sys,json,statistics,time
from pathlib import Path
root=Path(sys.argv[1]);baseline=Path(sys.argv[2]);p=json.loads((root/'progress.json').read_text());rows=[]
for key in p['completed']:
 new=json.loads((root/key/'run/evaluation-v2.json').read_text());oldPath=baseline/key/'run/evaluation-v2.json';old=json.loads(oldPath.read_text()) if oldPath.exists() else None
 rows.append(dict(subject=key,correct=new['correct'],gt=new['groundTruthPairs'],wrong=new['wrong'],rate=new['recoveryRate'],precision=new['recoveryPrecision'],baselineFinal=old is not None,beforeCorrect=old['correct'] if old else None,beforeWrong=old['wrong'] if old else None,additionalCorrect=new['correct']-old['correct'] if old else None))
matched=[r for r in rows if r['baselineFinal']];g=sum(r['gt'] for r in matched);a=sum(r['beforeCorrect'] for r in matched);b=sum(r['correct'] for r in matched)
out={'at':time.time(),'completed':len(rows),'running':p['running'],'failed':p['failed'],'matchedBaselineRepositories':len(matched),'additionalCorrect':b-a,'additionalWrong':sum(r['wrong']-r['beforeWrong'] for r in matched),'beforePrecision':a/(a+sum(r['beforeWrong'] for r in matched)) if a else None,'afterPrecision':b/(b+sum(r['wrong'] for r in matched)) if b else None,'gt':g,'beforeRate':a/g if g else None,'afterRate':b/g if g else None,'rows':rows}
target=root/'before-after.json';temporary=target.with_suffix('.tmp');temporary.write_text(json.dumps(out,indent=2));temporary.replace(target);print(json.dumps({k:v for k,v in out.items() if k!='rows'}),flush=True)
