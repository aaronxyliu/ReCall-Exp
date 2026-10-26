import pathlib,subprocess,json
root=pathlib.Path(__file__).resolve().parents[3];out=root/'results/real-app/bundle-graph-v2/validation';out.mkdir(exist_ok=True,parents=True);rows=[]
for family in ['rspack','rolldown','turbopack','parcel']:
 for n in [500,2000,8000]:
  p=subprocess.run(['node','--expose-gc','--max-old-space-size=8192','scripts/real-app/bundle-graph-v2/scale.mjs',family,str(n)],cwd=root,text=True,capture_output=True)
  if p.returncode:raise RuntimeError(p.stderr)
  r=json.loads(p.stdout);rows.append(r);print(family,n,r['elapsedMs'],r['rssEndMiB'],flush=True)
(out/'synthetic-scale.json').write_text(json.dumps({'policy':'One fresh process per case, simple static module chain, code and correct expected direct-call edges generated mechanically. No models, maps or oracle. Times include parse, compilation, solve and module-graph extraction; RSS is completion RSS, not peak. One trial per case; no asymptotic or real-repository representativeness claim.', 'rows':rows},indent=2)+'\n')
