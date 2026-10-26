"""Pair saved browser chunks using their own sourceMappingURL, never filename guesses."""
import pathlib,json,re,hashlib
base=pathlib.Path('results/real-app/bundling-dataset')
for d in base.iterdir():
 p=d/'collected-static'
 if not p.exists():continue
 doc=json.loads((d/'artifacts.json').read_text());pairs=[];missing=[]
 for j in sorted(p.rglob('*.js')):
  refs=re.findall(r'(?m)//[#@] sourceMappingURL=([^\s]+)',j.read_text())
  m=j.parent/refs[-1] if refs else pathlib.Path(str(j)+'.map')
  if not m.exists():missing.append(str(j));continue
  pairs.append({'js':str(j.resolve()),'map':str(m.resolve()),'jsSha256':hashlib.sha256(j.read_bytes()).hexdigest(),'mapSha256':hashlib.sha256(m.read_bytes()).hexdigest(),'profile':'existing-map-enabled-container-output','pairing':'explicit-sourceMappingURL' if refs else 'adjacent-map'})
 doc['files']=pairs;doc['coverage']={'allJavaScript':len(list(p.rglob('*.js'))),'paired':len(pairs),'missingMaps':missing,'container':'rq1-gt-'+doc['subject']['slug'].lower()}
 (d/'artifacts.json').write_text(json.dumps(doc,indent=2)+'\n')
 print(d.name,len(pairs),len(missing))
