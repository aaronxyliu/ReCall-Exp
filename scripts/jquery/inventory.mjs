import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SourceMapConsumer} from 'source-map';
import {analyze} from './analysis.mjs';
import {measure, own, fnTypes} from './measure.mjs';
import {root, output, write, read, hash, now} from './common.mjs';

export function offsets(code){const out=[0];for(let i=0;i<code.length;i++)if(code[i]==='\n')out.push(i+1);return out}
export function containing(functions,pos){let lo=0,hi=functions.length;while(lo<hi){const mid=(lo+hi)>>1;if(functions[mid].span[0]<=pos)lo=mid+1;else hi=mid}for(let i=lo-1;i>=0;i--)if(pos<functions[i].span[1])return functions[i];return null}
export function inventory(code,key,file){
 const analysis=analyze(code);
 const byNode=new Map(analysis.functions.map((f,i)=>[f.node,i]));
 const functions=analysis.functions.map((f,i)=>{
  let parent=analysis.parents.get(f.node);while(parent&&!fnTypes.has(parent.type))parent=analysis.parents.get(parent);
  const captures=new Map();
  own(f.node.body,(n,p)=>{if(n.type!=='Identifier')return;if((p?.type==='MemberExpression'&&!p.computed&&p.property===n)||(p?.type==='Property'&&!p.computed&&p.key===n))return;
   const binding=analysis.lookup(n);if(!binding||binding.ambiguous||!binding.scope)return;
   let scope=binding.scope;while(scope&&!scope.fn)scope=scope.parent;
   if(scope?.fn===f.node)return;
   const init=binding.init||binding.target;
   captures.set(n.name,{name:n.name,bindingKind:binding.parameter!=null?'enclosing-parameter':'lexically-resolved-enclosing-binding',enclosingFunction:scope?.fn?(analysis.functions[byNode.get(scope.fn)]?.name||'<anonymous>'):'module',parameterIndex:binding.parameter??null,writes:binding.writes||0,initializer:init?code.slice(...init.range).slice(0,320):null,initializerTruncated:init?init.range[1]-init.range[0]>320:false});
  });
  const feature=measure(f.node);
  return {id:`${key}:${f.node.range[0]}:${f.node.range[1]}`,index:i,file,name:f.name,span:f.node.range,loc:f.node.loc,type:f.node.type,parent:parent?byNode.get(parent):null,...feature,code:code.slice(...f.node.range),codeSha256:hash(code.slice(...f.node.range)),captures:[...captures.values()],astHash:analysis.features[i].fullHash};
 });
 const edges=analysis.edges.map(e=>({from:e.from,to:e.to,kind:e.kind}));
 for(const f of functions)if(f.parent!=null)edges.push({from:f.parent,to:f.index,kind:'contains'});
 const seen=new Set();const uniqueEdges=edges.filter(e=>{const k=JSON.stringify(e);if(seen.has(k))return false;seen.add(k);return true});
 return {file,sha256:hash(code),functions,edges:uniqueEdges,unresolvedCalls:analysis.features.reduce((n,f)=>n+f.unresolvedCalls,0)};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const manifest=read(path.join(output,'build-manifest.json'));const sourceFiles=new Map();const sourceAnalyses=new Map();const bundleFiles=[];const groundTruth=[];
 for(const build of manifest.builds){
  const map=read(path.join(root,build.map));
  for(let i=0;i<map.sources.length;i++)if(/(?:^|\/)jquery\/(?:dist|src)/.test(map.sources[i])&&map.sourcesContent?.[i]){
   const code=map.sourcesContent[i],key='s'+hash(code).slice(0,16);if(!sourceFiles.has(key)){const file=map.sources[i];const inv=inventory(code,key,file);sourceFiles.set(key,{key,file,code,...inv});sourceAnalyses.set(key,offsets(code))}
  }
 }
 if(!sourceFiles.size)throw new Error('No jQuery distribution sources found in maps');
 for(const build of manifest.builds){
  const code=fs.readFileSync(path.join(root,build.bundle),'utf8');const inv=inventory(code,build.id,build.bundle);const map=read(path.join(root,build.map));
  const consumer=new SourceMapConsumer(map),generatedLines=offsets(code),votes=inv.functions.map(()=>({total:0,labels:{},samples:[]}));
  const sources=new Map();for(let i=0;i<map.sources.length;i++){const content=map.sourcesContent?.[i];if(content){const key='s'+hash(content).slice(0,16);if(sourceFiles.has(key))sources.set(consumer.sources[i],key)}}
  consumer.eachMapping(m=>{
   const pos=generatedLines[m.generatedLine-1]+m.generatedColumn;if(!Number.isFinite(pos))return;
   const b=containing(inv.functions,pos);if(!b||m.source==null||m.originalLine==null)return;const vote=votes[b.index];vote.total++;
   const sourceKey=sources.get(m.source);if(!sourceKey)return;
   const source=sourceFiles.get(sourceKey),lines=sourceAnalyses.get(sourceKey),original=lines[m.originalLine-1]+m.originalColumn;
   const s=containing(source.functions,original);if(!s)return;
   vote.labels[s.id]=(vote.labels[s.id]||0)+1;
   if(vote.samples.length<8)vote.samples.push({generated:pos,source:s.id,original});
  });
  for(const b of inv.functions){const v=votes[b.index],ranked=Object.entries(v.labels).sort((a,b)=>b[1]-a[1]);const winner=ranked[0];const purity=winner?winner[1]/v.total:0;groundTruth.push({build:build.id,bundleId:b.id,sourceId:winner&&winner[1]>=2&&purity>=0.8&&(!ranked[1]||winner[1]>ranked[1][1])?winner[0]:null,status:winner&&winner[1]>=2&&purity>=0.8&&(!ranked[1]||winner[1]>ranked[1][1])?'supported':'unresolved',mappedOwnPoints:v.total,votes:ranked,purity,samples:v.samples});}
  bundleFiles.push({build:build.id,...inv});console.log('inventoried',build.id,inv.functions.length);
 }
 const detector={created:now(),policy:'All bundle functions retained for detector input; no map identities or jQuery-only oracle filtering. Reference is JavaScript distribution input to the bundler.',sources:[...sourceFiles.values()].map(({code,...s})=>s),bundles:bundleFiles};
 write(path.join(output,'detector-input.json'),detector);
 write(path.join(output,'ground-truth.json'),{created:now(),policy:'Own-function positional source-map voting; >=2 points, >=80% purity, strict unique winner. Positional identity oracle, not independent semantic proof. Unresolved retained.',records:groundTruth});
 write(path.join(output,'inventory-summary.json'),{sourceFiles:[...sourceFiles.values()].map(s=>({file:s.file,sha256:s.sha256,functions:s.functions.length,anchorEligible:s.functions.filter(f=>f.propertyOperations>=10).length,extractionFailures:s.functions.filter(f=>f.extractionStatus!=='ok').length})),builds:bundleFiles.map(b=>{const gt=groundTruth.filter(g=>g.build===b.build),linked=new Set(gt.filter(g=>g.sourceId).map(g=>g.bundleId));return {build:b.build,allFunctions:b.functions.length,allAnchorEligible:b.functions.filter(f=>f.propertyOperations>=10).length,jquerySourceLinked:linked.size,jqueryAnchorEligible:b.functions.filter(f=>linked.has(f.id)&&f.propertyOperations>=10).length,unresolvedAllFunctions:gt.filter(g=>!g.sourceId).length,extractionFailures:b.functions.filter(f=>f.extractionStatus!=='ok').length}})});
}
