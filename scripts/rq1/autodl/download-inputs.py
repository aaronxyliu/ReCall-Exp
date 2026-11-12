import gzip,hashlib,json,time,urllib.request,urllib.parse
from concurrent.futures import ThreadPoolExecutor,as_completed
from pathlib import Path
root=Path('/Users/aaronxyliu/GitHub/ReCall Research/ReCall Dataset/bundling-dataset')
base='https://raw.githubusercontent.com/aaronxyliu/Recall-Dataset/969e800678ad786af96053504d89b15fb1c4f0ae/bundling-dataset/'
def download(rel,expected):
 p=root/rel
 if p.exists() and hashlib.sha256(p.read_bytes()).hexdigest()==expected:return p
 for attempt in range(5):
  try:
   request=urllib.request.Request(base+urllib.parse.quote(rel,safe='/'),headers={'Accept-Encoding':'gzip'})
   with urllib.request.urlopen(request,timeout=90) as response:
    data=response.read()
    if response.headers.get('Content-Encoding')=='gzip':data=gzip.decompress(data)
   if hashlib.sha256(data).hexdigest()!=expected:raise ValueError('Hash mismatch '+rel)
   p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data);return p
  except Exception:
   if attempt==4:raise
   time.sleep(2*(attempt+1))
index=download('one-to-one-evaluation.json','6d92516f267ab41785c556918a5226c8d33892ccded94839052685d4cb984ea2')
subjects=json.loads(index.read_text())['subjects'];assert len(subjects)==26
jobs={}
with ThreadPoolExecutor(max_workers=8) as pool:
 futures={pool.submit(download,s['records'],s['recordsSHA256']):s for s in subjects}
 for f in as_completed(futures):
  p=f.result();record=json.loads(p.read_text())
  for a in record['capture']['assets']:
   jobs[str(p.parent.relative_to(root)/'runtime-js'/(a['sha256']+'.js'))]=a['sha256']
with ThreadPoolExecutor(max_workers=8) as pool:
 for i,f in enumerate(as_completed([pool.submit(download,p,h) for p,h in jobs.items()]),1):
  f.result()
  if i%50==0:print('Verified runtime assets',i,'/',len(jobs),flush=True)
(root/'remote-input-verification.json').write_text(json.dumps({'commit':'969e800678ad786af96053504d89b15fb1c4f0ae','subjects':26,'runtimeAssets':len(jobs),'allHashesVerified':True},indent=2)+'\n')
print('All 26 inputs verified',flush=True)
