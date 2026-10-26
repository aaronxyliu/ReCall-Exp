import fs from 'node:fs';
import path from 'node:path';
import {inventory,offsets,containing} from '../jquery/inventory.mjs';
import {enumerate} from '../jquery/measure.mjs';
import {interiorBodyPoint} from '../jquery/oracle-point.mjs';
import {SourceMapConsumer} from 'source-map';
import {hash,write} from '../jquery/common.mjs';
const root=process.cwd(),out=path.resolve('results/real-app/vue-admin-template-three-libraries'),dataset='/Users/aaronxyliu/GitHub/framework-sink-dataset/datasets/primary-60',art=dataset+'/artifacts',slug='PanJiaChen--vue-admin-template';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const manifest=read(art+'/'+slug+'.map-enabled.manifest.json');
const selected=manifest.files.filter(f=>f.js.includes('chunk-libs.'));
if(selected.length!==1)throw Error('Expected one vendor chunk');
const f=selected[0],bundleBytes=fs.readFileSync(art+'/'+f.js),mapBytes=fs.readFileSync(art+'/'+f.map);
if(hash(bundleBytes)!==f.jsSha256||hash(mapBytes)!==f.mapSha256)throw Error('Dataset hash mismatch');
fs.mkdirSync(out+'/inputs',{recursive:true});fs.writeFileSync(out+'/inputs/vendor.js',bundleBytes);fs.writeFileSync(out+'/inputs/vendor.js.map',mapBytes);
const map=JSON.parse(mapBytes),code=bundleBytes.toString(),libraries=['axios','nprogress','js-cookie'];
const library=s=>libraries.find(l=>s.includes('/node_modules/'+l+'/'));
const sources=[];
for(let i=0;i<map.sources.length;i++){
 const lib=library(map.sources[i]);if(!lib)continue;
 const text=map.sourcesContent?.[i];if(!text)throw Error('Missing target source');
 const sha=hash(text),key='s'+sha.slice(0,16),file='inputs/sources/'+lib+'/'+map.sources[i].split('/node_modules/'+lib+'/')[1];
 fs.mkdirSync(path.dirname(out+'/'+file),{recursive:true});fs.writeFileSync(out+'/'+file,text);
 const inv=inventory(text,key,map.sources[i]);
 // Parent indices are file-local. Namespace sibling-group identities for the joint reference pool.
 for(const fn of inv.functions){fn.localParent=fn.parent;fn.parent=key+':'+(fn.parent??'root')}
 sources.push({key,library:lib,sourceFile:file,...inv});
}
const build='webpack-vendor-real',inv=inventory(code,build,'inputs/vendor.js');
write(out+'/detector-input.json',{created:new Date().toISOString(),policy:'Three library source populations jointly searched against every function in complete application vendor chunk. Source-map identities excluded.',sources,bundles:[{build,...inv}]});
const consumer=new SourceMapConsumer(map),lines=offsets(code),lookup=new Map(),srcLines=new Map();
for(let i=0;i<map.sources.length;i++){const s=sources.find(s=>s.sha256===hash(map.sourcesContent?.[i]||''));if(s){lookup.set(consumer.sources[i],s);srcLines.set(s.key,offsets(map.sourcesContent[i]))}}
const bodies=new Map(enumerate(code).functions.map(f=>[f.node.range.join(':'),{span:f.node.body.range,block:f.node.body.type==='BlockStatement'}]));
const votes=inv.functions.map(()=>({total:0,labels:{},origins:{},samples:[]}));
consumer.eachMapping(m=>{
 if(m.source==null||m.originalLine==null)return;
 const pos=lines[m.generatedLine-1]+m.generatedColumn,b=containing(inv.functions,pos);if(!b||!interiorBodyPoint(bodies.get(b.span.join(':')),pos))return;
 const v=votes[b.index],s=lookup.get(m.source),origin=s?s.library:'non-target';v.total++;v.origins[origin]=(v.origins[origin]||0)+1;
 if(!s)return;const original=srcLines.get(s.key)[m.originalLine-1]+m.originalColumn,ref=containing(s.functions,original);if(!ref)return;
 v.labels[ref.id]=(v.labels[ref.id]||0)+1;if(v.samples.length<8)v.samples.push({generated:pos,source:ref.id,original});
});
const records=inv.functions.map(b=>{const v=votes[b.index],ranked=Object.entries(v.labels).sort((a,b)=>b[1]-a[1]),w=ranked[0],purity=w?w[1]/v.total:0,supported=w&&w[1]>=2&&purity>=.8&&(!ranked[1]||w[1]>ranked[1][1]),origins=Object.entries(v.origins).sort((a,b)=>b[1]-a[1]),origin=origins[0]?.[1]>=2&&origins[0][1]/v.total>=.8?origins[0][0]:'unresolved',nonTarget=origin==='non-target';return {build,bundleId:b.id,sourceId:supported?w[0]:null,status:supported?'supported':nonTarget?'non-target':'unresolved',origin,nonTarget,originVotes:origins,mappedOwnPoints:v.total,votes:ranked,purity,samples:v.samples}});
write(out+'/ground-truth.json',{policy:'Frozen pilot rule: innermost generated own-body interior points; >=2 votes, >=80% purity, unique winner. Non-target requires >=2 and >=80% origin points. Positional identity, not semantic proof.',records});
const baseline=path.resolve('results/jquery-4.0.0/experiment-4-minified-ranking-top5');
const runtime=out+'/implementation';fs.mkdirSync(runtime+'/scripts/jquery',{recursive:true});
for(const name of fs.readdirSync(baseline+'/implementation/scripts/jquery').filter(x=>x.endsWith('.mjs')))fs.copyFileSync(baseline+'/implementation/scripts/jquery/'+name,runtime+'/scripts/jquery/'+name);
fs.mkdirSync(runtime+'/notes/jquery',{recursive:true});fs.copyFileSync(baseline+'/implementation/notes/jquery/validator-system-prompt.txt',runtime+'/notes/jquery/validator-system-prompt.txt');
fs.mkdirSync(runtime+'/vendor/debun',{recursive:true});
for(const sub of ['fingerprint-collector','utils'])fs.cpSync('vendor/debun/'+sub,runtime+'/vendor/debun/'+sub,{recursive:true});
fs.copyFileSync('vendor/debun/package.json',runtime+'/vendor/debun/package.json');if(!fs.existsSync(runtime+'/vendor/debun/node_modules'))fs.symlinkSync(path.resolve('vendor/debun/node_modules'),runtime+'/vendor/debun/node_modules','dir');
const frozen=[];for(const dir of ['scripts/jquery','notes/jquery','vendor/debun/fingerprint-collector','vendor/debun/utils'])for(const name of fs.readdirSync(runtime+'/'+dir)){const p=dir+'/'+name;if(fs.statSync(runtime+'/'+p).isFile())frozen.push({file:p,sha256:hash(fs.readFileSync(runtime+'/'+p))})}
write(out+'/implementation-manifest.json',{baseline,files:frozen});
write(out+'/study-config.json',{...read(baseline+'/study-config.json'),experiment:'real-application-1',buildIds:[build],baseline,created:new Date().toISOString(),libraries,treeShaking:'original application production configuration; not overridden',provenance:'Use saved map-enabled production application build; entire vendor chunk retained. Fresh model caches; frozen experiment-4 algorithm and prompt.'});
write(out+'/input-provenance.json',{repo:f.repo,commit:f.commit,imageId:f.imageId,dataset,artifact:f,sourcePolicy:'Exact JavaScript build-input source text from sourcesContent, saved as individual reference files. Complete included package modules; not upstream unbundled modules absent from this build.',libraryVersions:{axios:'0.18.1',nprogress:'0.2.0','js-cookie':'2.2.0'},importedCaches:false});
write(out+'/inventory-summary.json',{sourceFiles:sources.map(s=>({file:s.file,library:s.library,sha256:s.sha256,functions:s.functions.length,anchorEligible:s.functions.filter(f=>f.propertyOperations>=10).length,extractionFailures:s.functions.filter(f=>f.extractionStatus!=='ok').length})),builds:[{build,allFunctions:inv.functions.length,allAnchorEligible:inv.functions.filter(f=>f.propertyOperations>=10).length,supportedTargets:records.filter(r=>r.sourceId).length,knownNonTarget:records.filter(r=>r.nonTarget).length,unresolved:records.filter(r=>!r.sourceId&&!r.nonTarget).length}]});
console.log(JSON.stringify({sources:sources.length,sourceFunctions:sources.reduce((n,s)=>n+s.functions.length,0),bundleFunctions:inv.functions.length,targets:records.filter(r=>r.sourceId).length,libraries:libraries.map(l=>({library:l,sourceFunctions:sources.filter(s=>s.library===l).reduce((n,s)=>n+s.functions.length,0),targets:records.filter(r=>r.sourceId&&r.origin===l).length}))},null,2));
