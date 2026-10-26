import json,pathlib,subprocess,sys
root=pathlib.Path(__file__).resolve().parents[3]
subjects=json.load(open(root/'baselines/bundling-connectivity-v1-2026-10-22/BASELINE.json'))['subjects']
for s in sorted((x for x in subjects if x['bundler']!='esbuild'),key=lambda x:x['supportedTargets']):
 slug=s['repo'].replace('/','--')
 for side in ['source','bundle']:
  out=root/'results/real-app/bundle-graph-v2/subjects'/slug;out.mkdir(parents=True,exist_ok=True)
  if (out/(side+'-relations.json')).exists():continue
  print('START',slug,side,flush=True)
  with open(out/(side+'-extract.log'),'w') as f:
   p=subprocess.run(['node','--expose-gc','--max-old-space-size=8192',str(root/'scripts/real-app/bundle-graph-v2/extract.mjs'),slug,side],cwd=root,stdout=f,stderr=subprocess.STDOUT)
  print('END',slug,side,p.returncode,flush=True)
  if p.returncode:sys.exit(p.returncode)
