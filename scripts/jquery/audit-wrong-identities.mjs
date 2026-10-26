import fs from 'node:fs';
import path from 'node:path';
import {SourceMapConsumer} from 'source-map';
import {enumerate} from './measure.mjs';
import {root,output,read,write,hash,now,selectedBuilds} from './common.mjs';

// Read-only audit of completed predictions. Never changes oracle or detector labels.
const dest=path.join(output,'wrong-identity-audit');
const data=read(path.join(output,'detector-input.json'));
const truth=new Map(read(path.join(output,'ground-truth.json')).records.map(g=>[g.bundleId,g]));
const refs=new Map(data.sources.flatMap(s=>s.functions).map(f=>[f.id,f]));
const lines=s=>{const xs=[0];for(let i=0;i<s.length;i++)if(s[i]==='\n')xs.push(i+1);return xs};
const innermost=(fs,pos)=>fs.filter(f=>f.span[0]<=pos&&pos<f.span[1]).sort((a,b)=>(a.span[1]-a.span[0])-(b.span[1]-b.span[0]))[0];
const cases=[];
for(const build of selectedBuilds(read(path.join(output,'build-manifest.json')).builds)){
 const b=data.bundles.find(b=>b.build===build.id),bs=new Map(b.functions.map(f=>[f.id,f]));
 const r=read(path.join(output,'recovery',build.id+'.json'));
 const wrong=r.promotions.filter(p=>{const g=truth.get(p.bundleId);return g?.nonTarget||g?.sourceId&&g.sourceId!==p.sourceId});
 const code=fs.readFileSync(path.join(root,build.bundle),'utf8'),map=read(path.join(root,build.map)),consumer=new SourceMapConsumer(map),generatedLines=lines(code);
 const bodies=new Map(enumerate(code).functions.map(f=>[f.node.range.join(':'),f.node.body]));
 const mapSources=new Map();for(let i=0;i<map.sources.length;i++){const text=map.sourcesContent?.[i];if(!text)continue;const source=data.sources.find(s=>s.sha256===hash(text));if(source)mapSources.set(consumer.sources[i],{...source,text,lines:lines(text)})}
 const witnessById=new Map(wrong.map(p=>[p.bundleId,[]]));
 consumer.eachMapping(m=>{
  if(!m.source||m.originalLine==null)return;const pos=generatedLines[m.generatedLine-1]+m.generatedColumn;
  // Independent range-based innermost search, not the oracle's containing() routine.
  const f=innermost(b.functions,pos);if(!f||!witnessById.has(f.id))return;
  const body=bodies.get(f.span.join(':'));if(!body)return;
  const interior=body.type==='BlockStatement'?body.range[0]<pos&&pos<body.range[1]-1:body.range[0]<=pos&&pos<body.range[1];if(!interior)return;
  const s=mapSources.get(m.source),original=s?s.lines[m.originalLine-1]+m.originalColumn:null,target=s?innermost(s.functions,original):null;
  witnessById.get(f.id).push({generatedOffset:pos,generatedLine:m.generatedLine,generatedColumn:m.generatedColumn,generatedText:code.slice(pos,pos+36),source:m.source,originalLine:m.originalLine,originalColumn:m.originalColumn,originalOffset:original,sourceFunctionId:target?.id||null,originalText:s?s.text.slice(original,original+48):null});
 });
 for(const p of wrong){
  const id='W'+String(cases.length+1).padStart(2,'0'),g=truth.get(p.bundleId),bf=bs.get(p.bundleId),s=refs.get(p.sourceId),expected=refs.get(g.sourceId),q=r.queries.find(q=>q.id===p.queryId);
  const pair=r.pairs.find(p=>p.queryId===q.id&&p.sourceId===s.id),record=read(path.join(output,'model-cache/validations',pair.requestKey+'.json'));
  const sourceOwner=r.promotions.find(x=>x.sourceId===g.sourceId&&x.bundleId!==p.bundleId&&x.round<p.round);
  const witnesses=witnessById.get(p.bundleId),votes={};for(const w of witnesses)votes[w.sourceFunctionId||'unknown']=(votes[w.sourceFunctionId||'unknown']||0)+1;
  const parents=p.parentBundleIds.map(bundleId=>{const parent=r.promotions.find(x=>x.bundleId===bundleId),pg=truth.get(bundleId);return {bundleId,sourceId:parent.sourceId,correct:pg?.sourceId?pg.sourceId===parent.sourceId:null,round:parent.round}});
  const c={id,build:build.id,prediction:p,bundled:bf,predicted:s,expected,oracle:g,query:q,queryDecisions:r.pairs.filter(p=>p.queryId===q.id).map(p=>({...p,sourceName:refs.get(p.sourceId).name})),requestKey:pair.requestKey,request:record.request,response:record.response,parsedUserMessage:JSON.parse(record.request.messages[1].content),correctSourceInCandidatePool:q.candidates.some(c=>c.sourceId===g.sourceId),correctSourceRank:q.candidates.findIndex(c=>c.sourceId===g.sourceId)+1||null,correctSourceInTop3:q.topThree.includes(g.sourceId),correctSourceInTopK:(q.topCandidates||q.topThree).includes(g.sourceId),rankingTopK:r.configuration.topK,earlierWrongOwner:sourceOwner?{...sourceOwner,bundleName:bs.get(sourceOwner.bundleId).name,oracleSourceId:truth.get(sourceOwner.bundleId)?.sourceId}:null,parents,independentMapping:{votes,points:witnesses.length,allAgreeWithStoredIdentity:witnesses.length>=2&&witnesses.every(w=>w.sourceFunctionId===g.sourceId),witnesses}};
  cases.push(c);write(path.join(dest,'cases',id+'.json'),c);
 }
}
write(path.join(dest,'cases.json'),{created:now(),policy:'Independent inspection of raw source maps and saved model requests; frozen predictions and original oracle remain unchanged. No model calls.',cases});
console.log(JSON.stringify(cases.map(c=>({id:c.id,build:c.build,expected:c.expected?.name,predicted:c.predicted.name,rank:c.correctSourceRank,trueInTop3:c.correctSourceInTop3,points:c.independentMapping.points,mapsAgree:c.independentMapping.allAgreeWithStoredIdentity,earlierWrongOwner:c.earlierWrongOwner?.bundleName,wrongParents:c.parents.filter(p=>p.correct===false).length,top3:c.queryDecisions.map(p=>p.sourceName+':'+p.verdict)})),null,2));
