import fs from 'node:fs';
import path from 'node:path';
import {SourceMapConsumer} from 'source-map';
import {enumerate} from './measure.mjs';
import {offsets,containing} from './inventory.mjs';
import {interiorBodyPoint} from './oracle-point.mjs';
import {output,root,read,write,hash,now} from './common.mjs';

// Offline evaluation only. This file is never imported by recover.mjs.
const data=read(path.join(output,'detector-input.json')),builds=read(path.join(output,'build-manifest.json')).builds;
const sources=new Map(data.sources.map(s=>[s.sha256,s])),sourceLines=new Map(),records=[];
for(const build of builds){
 const bundle=data.bundles.find(b=>b.build===build.id),code=fs.readFileSync(path.join(root,build.bundle),'utf8'),lines=offsets(code),map=read(path.join(root,build.map)),consumer=new SourceMapConsumer(map);
 const bodies=new Map(enumerate(code).functions.map(f=>[f.node.range.join(':'),{span:f.node.body.range,block:f.node.body.type==='BlockStatement'}]));
 const sourceLookup=new Map();for(let i=0;i<map.sources.length;i++){const content=map.sourcesContent?.[i];if(!content)continue;const key=hash(content);if(!sources.has(key))continue;sourceLookup.set(consumer.sources[i],sources.get(key));if(!sourceLines.has(key))sourceLines.set(key,offsets(content))}
 const votes=bundle.functions.map(()=>({total:0,labels:{},origins:{},samples:[]}));
 consumer.eachMapping(m=>{
  if(m.source==null||m.originalLine==null)return;const pos=lines[m.generatedLine-1]+m.generatedColumn,b=containing(bundle.functions,pos);if(!b)return;
  const body=bodies.get(b.span.join(':'));if(!interiorBodyPoint(body,pos))return;
  const v=votes[b.index];v.total++;const source=sourceLookup.get(m.source);
  const origin=source?'jquery':m.source.endsWith('experiments/jquery/app/main.js')?'application':/webpack\/(?:bootstrap|runtime\/)/.test(m.source)?'bundler-runtime':'unknown';
  v.origins[origin]=(v.origins[origin]||0)+1;
  if(!source)return;
  const original=sourceLines.get(source.sha256)[m.originalLine-1]+m.originalColumn,s=containing(source.functions,original);if(!s)return;
  v.labels[s.id]=(v.labels[s.id]||0)+1;if(v.samples.length<8)v.samples.push({generated:pos,source:s.id,original});
 });
 for(const b of bundle.functions){const v=votes[b.index],ranked=Object.entries(v.labels).sort((a,b)=>b[1]-a[1]),winner=ranked[0],purity=winner?winner[1]/v.total:0,supported=winner&&winner[1]>=2&&purity>=.8&&(!ranked[1]||winner[1]>ranked[1][1]);
  const origins=Object.entries(v.origins).sort((a,b)=>b[1]-a[1]),origin=origins[0]&&origins[0][1]>=2&&origins[0][1]/v.total>=.8?origins[0][0]:'unresolved',nonTarget=['application','bundler-runtime'].includes(origin);
  records.push({build:build.id,bundleId:b.id,sourceId:supported?winner[0]:null,status:supported?'supported':nonTarget?'non-target':'unresolved',origin,nonTarget,originVotes:origins,mappedOwnPoints:v.total,votes:ranked,purity,samples:v.samples})}
}
write(path.join(output,'ground-truth.json'),{created:now(),policy:'Generated own-body interior points only: exclude function header and body-boundary mapping points, assign to innermost function, >=2 points, >=80% purity, unique winner. Source-map positional identity oracle, not semantic proof.',records});
const inventory=read(path.join(output,'inventory-summary.json'));
for(const row of inventory.builds){const b=data.bundles.find(b=>b.build===row.build),g=records.filter(g=>g.build===row.build),linked=new Set(g.filter(g=>g.sourceId).map(g=>g.bundleId));row.jquerySourceLinked=linked.size;row.jqueryOriginSupported=g.filter(g=>g.origin==='jquery').length;row.knownNonTarget=g.filter(g=>g.nonTarget).length;row.jqueryAnchorEligible=b.functions.filter(f=>linked.has(f.id)&&f.propertyOperations>=10).length;row.unresolvedAllFunctions=g.filter(g=>!g.sourceId&&!g.nonTarget).length}
write(path.join(output,'inventory-summary.json'),inventory);
console.log(inventory.builds.map(b=>({build:b.build,sourceLinked:b.jquerySourceLinked,unresolved:b.unresolvedAllFunctions})));
