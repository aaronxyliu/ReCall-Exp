"""Read public npm/GitHub metadata for the frozen recovery snapshot."""
import json,gzip,re,hashlib,datetime,urllib.request,urllib.parse,urllib.error,concurrent.futures
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'results/library-characteristics';root.mkdir(exist_ok=True)
snap=json.load(open(root/'snapshot.json'))
packages={}
for r in snap['rows']:
 if r['groundTruthPairs']>=20 and r['anchors']>0:packages.setdefault(r['library'],set()).update(r['sourceVersions'])
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
def get(url):
 req=urllib.request.Request(url,headers={'User-Agent':'ReCall-research-metadata/1.0','Accept':'application/json','Accept-Encoding':'gzip'})
 with urllib.request.urlopen(req,timeout=30) as f:
  raw=f.read();raw=gzip.decompress(raw) if f.headers.get('Content-Encoding')=='gzip' else raw
  return json.loads(raw),{'url':url,'fetchedAt':now(),'responseDate':f.headers.get('Date'),'sha256':hashlib.sha256(raw).hexdigest()}
def gh_repo(v):
 r=v.get('repository');url=r.get('url','') if isinstance(r,dict) else r or ''
 m=re.search(r'github\.com[:/]([^/\s]+)/([^/#\s]+)',url)
 return m[1]+'/'+re.sub(r'\.git$','',m[2]) if m else None
def package(name):
 dest=root/'npm'/ (urllib.parse.quote(name,safe='')+'.json');dest.parent.mkdir(exist_ok=True)
 if dest.exists():return json.load(open(dest))
 row={'package':name,'experimentalVersions':sorted(packages[name])}
 try:
  d,receipt=get('https://registry.npmjs.org/'+urllib.parse.quote(name,safe=''));latest=d.get('dist-tags',{}).get('latest');v=d.get('versions',{}).get(latest,{})
  row.update(metadataReceipt=receipt,npmStars=sum(bool(x) for x in d['users'].values()) if isinstance(d.get('users'),dict) else None,npmStarsFieldPresent=isinstance(d.get('users'),dict),latestVersion=latest,description=v.get('description') or d.get('description'),keywords=v.get('keywords',d.get('keywords',[])),repository=v.get('repository'),githubRepo=gh_repo(v),homepage=v.get('homepage'),versionMetadata={})
  for version in packages[name]:
   z=d.get('versions',{}).get(version)
   row['versionMetadata'][version]=None if z is None else {k:z.get(k) for k in ['description','keywords','repository','homepage','deprecated','dist']}
 except Exception as e:row['metadataError']=str(e)
 try:
  d,receipt=get('https://api.npmjs.org/downloads/point/last-month/'+urllib.parse.quote(name,safe='@/'));row.update(downloads=d.get('downloads'),downloadStart=d.get('start'),downloadEnd=d.get('end'),downloadsReceipt=receipt)
 except Exception as e:row['downloadsError']=str(e)
 dest.write_text(json.dumps(row,indent=2));print('npm',name,'stars',row.get('npmStars'),'downloads',row.get('downloads'),flush=True);return row
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:rows=list(pool.map(package,sorted(packages)))
repos=sorted({r['githubRepo'] for r in rows if r.get('githubRepo')})
def github(repo):
 dest=root/'github'/(repo.replace('/','--')+'.json');dest.parent.mkdir(exist_ok=True)
 if dest.exists():return json.load(open(dest))
 row={'requestedRepository':repo}
 try:
  d,receipt=get('https://api.github.com/repos/'+repo);row.update(receipt=receipt,fullName=d['full_name'],htmlURL=d['html_url'],stars=d['stargazers_count'],forks=d['forks_count'],archived=d['archived'],description=d.get('description'),topics=d.get('topics'))
 except Exception as e:row['error']=str(e)
 dest.write_text(json.dumps(row,indent=2));print('github',repo,row.get('stars'),row.get('error',''),flush=True);return row
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:gh={r['requestedRepository']:r for r in pool.map(github,repos)}
for row in rows:row['github']=gh.get(row.get('githubRepo'))
(root/'metadata.json').write_text(json.dumps({'collectedAt':now(),'packages':rows},indent=2))
print('DONE',len(rows),'packages',len(gh),'repositories',flush=True)
