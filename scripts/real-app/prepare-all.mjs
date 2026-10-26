import fs from 'node:fs';
import path from 'node:path';
import {inventory,offsets,containing} from '../jquery/inventory.mjs';
import {enumerate} from '../jquery/measure.mjs';
import {interiorBodyPoint} from '../jquery/oracle-point.mjs';
import {SourceMapConsumer} from 'source-map';
import {hash,write} from '../jquery/common.mjs';
const out=path.resolve('results/real-app/vue-admin-template-all-libraries');
if(fs.existsSync(out+'/detector-input.json'))throw Error('Prepared input exists; resume with run-all.mjs');
const dataset='/Users/aaronxyliu/GitHub/framework-sink-dataset/datasets/primary-60',art=dataset+'/artifacts',slug='PanJiaChen--vue-admin-template',repoDir=dataset+'/sources/'+slug;
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),libraries=['axios','core-js','element-ui','js-cookie','nprogress','path-to-regexp'];
const membership=s=>{const tail=s.split('/node_modules/').at(-1),parts=tail.split('/'),pkg=parts[0]?.startsWith('@')?parts.slice(0,2).join('/'):parts[0];return libraries.includes(pkg)?pkg:null};
const original=read(art+'/'+slug+'.map-enabled.manifest.json'),sources=[],sourceMap=new Map(),selected=[];
for(const f of original.files){const map=read(art+'/'+f.map);if(!map.sources.some(s=>membership(s)))continue;
 const bundleBytes=fs.readFileSync(art+'/'+f.js),mapBytes=fs.readFileSync(art+'/'+f.map);if(hash(bundleBytes)!==f.jsSha256||hash(mapBytes)!==f.mapSha256)throw Error('Dataset hash mismatch');
 const build=f.js.includes('chunk-elementUI.')?'webpack-element-ui-real':'webpack-vendor-real';
 const bundle='inputs/'+build+'.js',mapFile=bundle+'.map';fs.mkdirSync(out+'/inputs',{recursive:true});fs.writeFileSync(out+'/'+bundle,bundleBytes);fs.writeFileSync(out+'/'+mapFile,mapBytes);
 selected.push({id:build,bundle,map:mapFile,artifact:f,rawMap:map});
 for(let i=0;i<map.sources.length;i++){const file=map.sources[i],lib=membership(file);if(!lib)continue;const text=map.sourcesContent?.[i];if(text==null)throw Error('Missing target content '+file);
  const sha=hash(text),identity=file+'\0'+sha;if(sourceMap.has(identity))continue;
  const key='s'+hash(identity).slice(0,20),sourceFile='inputs/sources/'+lib+'/'+key+'-'+path.basename(file).replace(/[^a-zA-Z0-9._-]/g,'_');fs.mkdirSync(path.dirname(out+'/'+sourceFile),{recursive:true});fs.writeFileSync(out+'/'+sourceFile,text);
  const inv=inventory(text,key,file);for(const fn of inv.functions){fn.localParent=fn.parent;fn.parent=key+':'+(fn.parent??'root')}
  const instance=file.slice(0,file.lastIndexOf('/node_modules/')+'/node_modules/'.length)+lib;
  const source={key,library:lib,packageInstance:instance,sourceFile,...inv};sources.push(source);sourceMap.set(identity,source);
 }
 console.log('selected',build,'sources so far',sources.length);
}
if(selected.length!==2)throw Error('Unexpected target chunk count '+selected.length);
const bundles=[],records=[];
for(const b of selected){const map=b.rawMap,code=fs.readFileSync(out+'/'+b.bundle,'utf8'),inv=inventory(code,b.id,b.bundle);bundles.push({build:b.id,...inv});const consumer=new SourceMapConsumer(map),lines=offsets(code),lookup=new Map(),srcLines=new Map();
 for(let i=0;i<map.sources.length;i++){const text=map.sourcesContent?.[i],source=sourceMap.get(map.sources[i]+'\0'+hash(text??''));if(source){lookup.set(consumer.sources[i],source);srcLines.set(source.key,offsets(text))}}
 const bodies=new Map(enumerate(code).functions.map(f=>[f.node.range.join(':'),{span:f.node.body.range,block:f.node.body.type==='BlockStatement'}])),votes=inv.functions.map(()=>({total:0,labels:{},origins:{},samples:[]}));
 consumer.eachMapping(m=>{if(m.source==null||m.originalLine==null)return;const pos=lines[m.generatedLine-1]+m.generatedColumn,fn=containing(inv.functions,pos);if(!fn||!interiorBodyPoint(bodies.get(fn.span.join(':')),pos))return;
  const v=votes[fn.index],source=lookup.get(m.source),origin=source?source.library:'non-target';v.total++;v.origins[origin]=(v.origins[origin]||0)+1;if(!source)return;
  const original=srcLines.get(source.key)[m.originalLine-1]+m.originalColumn,ref=containing(source.functions,original);if(!ref)return;v.labels[ref.id]=(v.labels[ref.id]||0)+1;if(v.samples.length<8)v.samples.push({generated:pos,source:ref.id,original});
 });
 for(const fn of inv.functions){const v=votes[fn.index],ranked=Object.entries(v.labels).sort((a,b)=>b[1]-a[1]),w=ranked[0],purity=w?w[1]/v.total:0,supported=w&&w[1]>=2&&purity>=.8&&(!ranked[1]||w[1]>ranked[1][1]),origins=Object.entries(v.origins).sort((a,b)=>b[1]-a[1]),origin=origins[0]?.[1]>=2&&origins[0][1]/v.total>=.8?origins[0][0]:'unresolved',nonTarget=origin==='non-target';records.push({build:b.id,bundleId:fn.id,sourceId:supported?w[0]:null,status:supported?'supported':nonTarget?'non-target':'unresolved',origin,nonTarget,originVotes:origins,mappedOwnPoints:v.total,votes:ranked,purity,samples:v.samples})}
 console.log('inventoried',b.id,inv.functions.length);
}
write(out+'/detector-input.json',{created:new Date().toISOString(),policy:'All six directly declared JS libraries; full target-containing production chunks; source identities isolated by package path and content hash; no oracle labels.',sources,bundles});
write(out+'/ground-truth.json',{policy:'Frozen pilot oracle: generated innermost own-body interior mapping points; >=2 votes, >=80% purity, strict unique winner. Non-target origin requires >=2 and >=80% points. Unresolved retained; positional identity only.',records});
const baseline=path.resolve('results/jquery-4.0.0/experiment-4-minified-ranking-top5'),runtime=out+'/implementation';
fs.mkdirSync(runtime+'/scripts/jquery',{recursive:true});for(const name of fs.readdirSync(baseline+'/implementation/scripts/jquery').filter(x=>x.endsWith('.mjs')))fs.copyFileSync(baseline+'/implementation/scripts/jquery/'+name,runtime+'/scripts/jquery/'+name);
fs.mkdirSync(runtime+'/notes/jquery',{recursive:true});fs.copyFileSync(baseline+'/implementation/notes/jquery/validator-system-prompt.txt',runtime+'/notes/jquery/validator-system-prompt.txt');fs.mkdirSync(runtime+'/vendor/debun',{recursive:true});for(const sub of ['fingerprint-collector','utils'])fs.cpSync('vendor/debun/'+sub,runtime+'/vendor/debun/'+sub,{recursive:true});fs.copyFileSync('vendor/debun/package.json',runtime+'/vendor/debun/package.json');fs.symlinkSync(path.resolve('vendor/debun/node_modules'),runtime+'/vendor/debun/node_modules','dir');
const frozen=[];for(const dir of ['scripts/jquery','notes/jquery','vendor/debun/fingerprint-collector','vendor/debun/utils'])for(const name of fs.readdirSync(runtime+'/'+dir)){const file=dir+'/'+name;if(fs.statSync(runtime+'/'+file).isFile())frozen.push({file,sha256:hash(fs.readFileSync(runtime+'/'+file))})}write(out+'/implementation-manifest.json',{baseline,files:frozen});
const prior=path.resolve('results/real-app/vue-admin-template-three-libraries/model-cache');fs.cpSync(prior,out+'/model-cache',{recursive:true});
const evidence=[];for(const name of ['package.json','README.md','.rq1-provenance.json','vue.config.js','src/utils/request.js','src/utils/auth.js','src/permission.js','src/store/modules/app.js']){const file='inputs/repository/'+name,bytes=fs.readFileSync(repoDir+'/'+name);fs.mkdirSync(path.dirname(out+'/'+file),{recursive:true});fs.writeFileSync(out+'/'+file,bytes);evidence.push({file,sha256:hash(bytes)})}
write(out+'/study-config.json',{...read(baseline+'/study-config.json'),experiment:'real-application-all-direct-js-libraries',buildIds:selected.map(b=>b.id),baseline,libraries,created:new Date().toISOString(),treeShaking:'preserve original production configuration',sourceIdentityPolicy:'Source path plus content hash; nested package instances kept separate. File-local parent groups namespaced.',cachePolicy:'Reuse exact embedding and pair requests from prior three-library run; no recovery promotions or oracle labels imported.'});
write(out+'/build-manifest.json',{repo:original.files[0].repo,commit:original.files[0].commit,builds:selected.map(({rawMap,...b})=>b)});
const importedValidationFiles=fs.readdirSync(out+'/model-cache/validations').map(file=>({file,sha256:hash(fs.readFileSync(out+'/model-cache/validations/'+file))}));
write(out+'/input-provenance.json',{repo:original.files[0].repo,commit:original.files[0].commit,dataset,artifacts:selected.map(({rawMap,...b})=>b),libraryVersions:Object.fromEntries(libraries.map(l=>[l,read(repoDir+'/package.json').dependencies[l]])),sourcePolicy:'Exact published build-input JS sources from sourcesContent, not absent upstream modules; nested core-js instances included and distinguished by path.',repositoryEvidence:evidence,importedCache:{from:prior,embeddingFileSha256:hash(fs.readFileSync(prior+'/embeddings.json')),validations:importedValidationFiles},oracleImported:false,promotionsImported:false});
write(out+'/inventory-summary.json',{libraries:libraries.map(l=>({library:l,sourceFiles:sources.filter(s=>s.library===l).length,referenceFunctions:sources.filter(s=>s.library===l).reduce((n,s)=>n+s.functions.length,0),supportedTargets:records.filter(r=>r.sourceId&&r.origin===l).length})),builds:bundles.map(b=>({build:b.build,functions:b.functions.length,extractionFailures:b.functions.filter(f=>f.extractionStatus!=='ok').length,supportedTargets:records.filter(r=>r.build===b.build&&r.sourceId).length}))});
console.log(JSON.stringify(read(out+'/inventory-summary.json'),null,2));
// Snapshot frequency affects persistence only, not matching or model requests.
await import('./apply-persistence.mjs');
