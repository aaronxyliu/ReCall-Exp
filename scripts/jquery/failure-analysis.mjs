import fs from 'node:fs';
import path from 'node:path';
import {output,read,write,now} from './common.mjs';
// Offline diagnostics only: never feeds oracle labels back into recovery.
const d=read(path.join(output,'detector-input.json'));
const truth=new Map(read(path.join(output,'ground-truth.json')).records.map(g=>[g.bundleId,g]));
const rows=[];
for(const b of d.bundles){
 const file=path.join(output,'recovery',b.build+'.json');if(!fs.existsSync(file))continue;
 const r=read(file),accepted=new Map(r.promotions.map(p=>[p.bundleId,p]));
 const adj=b.functions.map(()=>new Set());
 for(const e of b.edges){adj[e.from].add(e.to);adj[e.to].add(e.from)}
 const siblings=new Map();b.functions.forEach((f,i)=>{const key=f.parent??'root';if(!siblings.has(key))siblings.set(key,[]);siblings.get(key).push(i)});
 for(const group of siblings.values())for(let i=0;i<group.length;i++)for(let j=1;j<=r.configuration.siblingWindow;j++)if(group[i+j]!=null){adj[group[i]].add(group[i+j]);adj[group[i+j]].add(group[i])}
 const queries=new Map(),pairs=new Map();
 for(const q of r.queries){if(!queries.has(q.bundleId))queries.set(q.bundleId,[]);queries.get(q.bundleId).push(q)}
 for(const p of r.pairs){if(!pairs.has(p.bundleId))pairs.set(p.bundleId,[]);pairs.get(p.bundleId).push(p)}
 const distance=b.functions.map(()=>Infinity),frontier=[];
 b.functions.forEach((f,i)=>{if(accepted.has(f.id)){distance[i]=0;frontier.push(i)}});
 for(let i=0;i<frontier.length;i++)for(const j of adj[frontier[i]])if(distance[j]===Infinity){distance[j]=distance[frontier[i]]+1;frontier.push(j)}
 const categories={},records=[];let correct=0;
 b.functions.forEach((f,i)=>{
  const g=truth.get(f.id);if(!g?.sourceId)return;
  const promotion=accepted.get(f.id);if(promotion?.sourceId===g.sourceId){correct++;return}
  const qs=queries.get(f.id)||[],ps=pairs.get(f.id)||[];
  const near=[...adj[i]].filter(j=>accepted.has(b.functions[j].id));
  const truePairs=ps.filter(p=>p.sourceId===g.sourceId);
  let category;
  if(promotion)category='wrongly-promoted';
  else if(!qs.length)category=f.code.length>r.configuration.maxCodeCharacters?'oversized-never-queried':!near.length?'no-recovered-neighbor-never-queried':'has-neighbor-never-queried';
  else if(!qs.some(q=>q.candidates.some(c=>c.sourceId===g.sourceId)))category='queried-true-source-never-in-candidate-pool';
  else if(!truePairs.length)category='true-source-in-pool-never-in-top3';
  else if(truePairs.some(p=>p.verdict==='accept'))category='true-pair-accepted-but-not-promoted';
  else if(truePairs.every(p=>p.verdict==='uncertain'))category='true-top3-pair-always-uncertain';
  else if(truePairs.some(p=>p.verdict==='reject'))category='true-top3-pair-rejected-without-any-accept';
  else category='true-top3-pair-invalid-or-error';
  categories[category]=(categories[category]||0)+1;
  records.push({bundleId:f.id,name:f.name,sourceId:g.sourceId,category,recoveredNeighbors:near.length,distanceToRecovered:Number.isFinite(distance[i])?distance[i]:null,queryCount:qs.length,truePairVerdicts:truePairs.map(p=>p.verdict),queryStatuses:qs.map(q=>q.status)});
 });
 rows.push({build:b.build,status:r.status,checkpoint:r.created,referencePopulation:d.sources.reduce((n,s)=>n+s.functions.length,0),supportedTargets:correct+records.length,correctlyRecovered:correct,remaining:records.length,categories,remainingWithRecoveredNeighbor:records.filter(x=>x.recoveredNeighbors>0).length,remainingEverQueried:records.filter(x=>x.queryCount>0).length,records});
}
write(path.join(output,'failure-analysis.json'),{created:now(),policy:'Offline source-map identity diagnostics. Categories use all attempts through each checkpoint; no semantic-equivalence proof or detector input.',builds:rows});
console.log(JSON.stringify(rows.map(({records,...r})=>r),null,2));
