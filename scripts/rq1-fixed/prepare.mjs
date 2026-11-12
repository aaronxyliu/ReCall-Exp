// Offline input preparation only. Extract ALL available texts of selected libraries,
// never filter functions/files by accepted pairs. Correspondence labels are scorer-only.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {SourceMapConsumer} from 'source-map';
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
export function prepare(dataset,subject,out){
 const record=path.join(dataset,subject.records),bytes=fs.readFileSync(record);
 if(hash(bytes)!==subject.recordsSHA256)throw Error('Changed ground-truth records');
 const gt=JSON.parse(bytes),base=path.dirname(record),sources=new Map(),canonicalSources=new Map(),selected=new Set(subject.selectedLibraries),assets=new Map();
 fs.mkdirSync(out,{recursive:true});
 for(const a of gt.capture.assets){
  const file=path.join(base,'runtime-js',a.sha256+'.js');
  if(hash(fs.readFileSync(file))!==a.sha256)throw Error('Changed captured script');
  // Identical bytes at different URLs remain separate captured units for GT scoring.
  const identity=a.url+'#'+a.sha256;
  assets.set(identity,{id:'b-'+hash(identity),path:file,environment:a.channels.some(x=>/worker/.test(x))?'worker':'main'});
  if(a.map.status!=='map-found')continue;
  const mapBytes=fs.readFileSync(path.join(base,'source-maps',a.map.sha256+'.map'));
  if(hash(mapBytes)!==a.map.sha256)throw Error('Changed source map');
  const consumer=new SourceMapConsumer(JSON.parse(mapBytes.toString().replace(/^\)\]\}'[^\n]*\n/,'')));
  for(const source of consumer.sources){
   const owner=[...source.replaceAll('\\','/').matchAll(/(?:^|\/)(?:node_modules|~)\/((?:@[^/]+\/)?[^/]+)/g)].at(-1);
   const name=owner?.[1];
   if(!selected.has(name))continue;
   const code=consumer.sourceContentFor(source,true);if(code===null)continue;
   const identity=source+'#'+hash(code);if(sources.has(identity))continue;
   // Keep package-relative paths for graph resolution; isolate source URL namespaces.
   const rel=source.replaceAll('\\','/').slice(owner.index+owner[0].length).replace(/^\//,'')||path.basename(source);
   const canonical=JSON.stringify([name,rel,hash(code)]);
   // Different map URL prefixes can name the same package file. One reference
   // unit per package/path/content avoids artificial duplicate candidate identities.
   if(canonicalSources.has(canonical)){sources.set(identity,canonicalSources.get(canonical));continue;}
   const safe=rel.split('/').filter(x=>x&&x!=='.'&&x!=='..').join('/')||'source.js';
   const prefix=source.slice(0,source.length-rel.length);
   const filename=path.join(out,'references',hash(prefix).slice(0,16),safe);
   fs.mkdirSync(path.dirname(filename),{recursive:true});
   const actual=fs.existsSync(filename)&&fs.readFileSync(filename,'utf8')!==code?filename+'.'+hash(code).slice(0,12)+'.js':filename;
   fs.writeFileSync(actual,code);
   const entry={id:'s-'+hash(identity),path:actual,packageRoot:path.join(out,'references',hash(prefix).slice(0,16)),library:{name,version:'captured-source-snapshot'}};
   sources.set(identity,entry);canonicalSources.set(canonical,entry);
  }
 }
 const sourceManifest={roots:[path.join(out,'references')],files:[...new Set(sources.values())]};
 const bundleManifest={roots:[path.join(base,'runtime-js')],files:[...assets.values()]};
 const identities={source:Object.fromEntries([...sources].map(([key,value])=>[key,value.id])),bundle:Object.fromEntries([...assets].map(([key,value])=>[key,value.id]))};
 for(const [name,value]of Object.entries({sourceManifest,bundleManifest,identities,provenance:{repo:subject.repo,commit:subject.commit,recordsSHA256:subject.recordsSHA256,referenceMode:'all available selected-library source texts embedded in captured maps; not complete installed package distributions',sourceFiles:sources.size,bundleFiles:assets.size,selectedLibraries:subject.selectedLibraries}}))fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(value,null,2)+'\n');
 return {sourceManifest,bundleManifest};
}
