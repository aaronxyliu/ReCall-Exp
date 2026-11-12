import json,gzip,re,hashlib,datetime,urllib.request,urllib.parse,concurrent.futures
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'results/library-characteristics';meta=json.load(open(root/'metadata.json'));rows=meta['packages'];now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
def get(url,kind='json'):
 req=urllib.request.Request(url,headers={'User-Agent':'ReCall-research-metadata/1.0','Accept':'application/json' if kind=='json' else 'text/html','Accept-Encoding':'gzip'})
 with urllib.request.urlopen(req,timeout=30) as f:
  raw=f.read();raw=gzip.decompress(raw) if f.headers.get('Content-Encoding')=='gzip' else raw
  return (json.loads(raw) if kind=='json' else raw.decode()),{'url':url,'finalURL':f.geturl(),'fetchedAt':now(),'responseDate':f.headers.get('Date'),'sha256':hashlib.sha256(raw).hexdigest()}
for row in rows:
 if row.get('metadataError'):
  try:
   d,receipt=get('https://registry.npmjs.org/'+urllib.parse.quote(row['package'],safe=''));v=d['versions'][d['dist-tags']['latest']];r=v.get('repository');url=r.get('url','') if isinstance(r,dict) else r or '';m=re.search(r'github\.com[:/]([^/\s]+)/([^/#\s]+)',url)
   row.update(metadataReceipt=receipt,npmStars=sum(bool(x) for x in d.get('users',{}).values()),description=v.get('description') or d.get('description'),keywords=v.get('keywords',d.get('keywords',[])),repository=r,githubRepo=m[1]+'/'+re.sub(r'\.git$','',m[2]) if m else None,homepage=v.get('homepage'),versionMetadata={version:{k:d['versions'].get(version,{}).get(k) for k in ['description','keywords','repository','homepage','deprecated','dist']} for version in row['experimentalVersions']});row.pop('metadataError',None)
  except Exception as e:row['metadataRetryError']=str(e)
 # npm CLI star command interprets an omitted users map as an empty map.
 if row.get('metadataReceipt') and not row.get('npmStarsFieldPresent') and row.get('npmStars') is None:row.update(npmStars=0,npmStarsNote='Full registry metadata omits users; interpreted as empty, matching npm CLI star command.')
missing=[r for r in rows if r.get('downloads') is None and not r['package'].startswith('@')]
if missing:
 url='https://api.npmjs.org/downloads/point/last-month/'+','.join(r['package'] for r in missing)
 try:
  data,receipt=get(url)
  for row in missing:
   d=data.get(row['package'])
   if d is not None and d.get('downloads') is not None:row.update(downloads=d['downloads'],downloadStart=d['start'],downloadEnd=d['end'],downloadsReceipt=receipt);row.pop('downloadsError',None)
 except Exception as e:print('bulk downloads',e,flush=True)
def html(repo):
 dest=root/'github'/(repo.replace('/','--')+'.json');old=json.load(open(dest)) if dest.exists() else {'requestedRepository':repo}
 if old.get('stars') is not None:return old
 try:
  data,receipt=get('https://github.com/'+repo,'html');values=set(map(int,re.findall(r'"stargazerCount"\s*:\s*(\d+)',data)))
  if len(values)!=1:raise ValueError('Expected a unique exact repository star counter, found '+str(values))
  receipt['method']='public GitHub HTML embedded repository metadata';old.update(receipt=receipt,stars=next(iter(values)),htmlURL=receipt['finalURL'],fullName='/'.join(urllib.parse.urlparse(receipt['finalURL']).path.strip('/').split('/')[:2]),apiError=old.pop('error',None));(root/'github'/(repo.replace('/','--')+'.html.gz')).write_bytes(gzip.compress(data.encode()))
 except Exception as e:old['htmlError']=str(e)
 dest.write_text(json.dumps(old,indent=2));print(repo,old.get('stars'),old.get('htmlError',''),flush=True);return old
repos=sorted({r['githubRepo'] for r in rows if r.get('githubRepo')})
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:gh={r['requestedRepository']:r for r in pool.map(html,repos)}
for row in rows:
 row['github']=gh.get(row.get('githubRepo'));(root/'npm'/(urllib.parse.quote(row['package'],safe='')+'.json')).write_text(json.dumps({k:v for k,v in row.items() if k!='github'},indent=2))
meta.update(collectedAt=now(),packages=rows);(root/'metadata.json').write_text(json.dumps(meta,indent=2));print('DONE',len(rows),'npm',sum(r.get('npmStars') is not None for r in rows),'downloads',sum(r.get('downloads') is not None for r in rows),'github',sum((r.get('github') or {}).get('stars') is not None for r in rows),flush=True)
