// Same fixed paired-neighborhood protocol; new subjects need newly frozen seeds.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {graph} from '../connectivity/simulate.mjs';
import {propagate} from '../multi-bundler/propagate.mjs';
const slug=process.argv[2],base=path.resolve('results/real-app/bundle-graph-v2-holdout'),dir=base+'/subjects/'+slug;
const read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),write=(p,x)=>fs.writeFileSync(dir+'/'+p,JSON.stringify(x)+'\n');
for(const [p,h]of Object.entries(read(base+'/analyzer-freeze.json').files))assert.equal(sha(p),h);
assert(!fs.existsSync(dir+'/summary.json'));
const subject=read(base+'/selection.json').subjects.find(s=>s.slug===slug),d=read(dir+'/detector-input.json'),prep=read(dir+'/prepared.json');
const sources=d.sourceShards.map(p=>read(dir+'/'+p)),bundles=d.bundleShards.map(p=>read(dir+'/'+p));
const refs=[],bf=[],se=[],be=[],sourceOf=new Map(),buildOf=[];
for(const s of sources){const off=refs.length;for(const f of s.functions){sourceOf.set(f.id,s.library);refs.push({...f,parent:s.key+':'+(f.parent??'root'),length:f.code.length})}for(const e of s.edges)se.push({from:e.from+off,to:e.to+off})}
for(const b of bundles){const off=bf.length;for(const f of b.functions){bf.push({...f,parent:b.build+':'+(f.parent??'root'),length:f.code.length});buildOf.push(b.build)}for(const e of b.edges)be.push({from:e.from+off,to:e.to+off})}
const si=new Map(refs.map((f,i)=>[f.id,i])),bi=new Map(bf.map((f,i)=>[f.id,i])),sg=graph(refs,se),bg=graph(bf,be),ag=sg.map(x=>new Set(x)),ab=bg.map(x=>new Set(x)),added={source:[],bundle:[]};
for(const [side,index,adj,baseGraph]of [['source',si,ag,sg],['bundle',bi,ab,bg]]){
 const r=read(dir+'/'+side+'-relations.json');assert(r.converged&&r.errors.length===0);assert.equal(r.provenance.detectorSha256,sha(dir+'/detector-input.json'));
 for(const e of r.edges){assert(index.has(e.from)&&index.has(e.to));const u=index.get(e.from),v=index.get(e.to);if(!baseGraph[u].has(v))added[side].push(e);adj[u].add(v);adj[v].add(u)}
}
const gt=read(dir+'/ground-truth.json'),targets=gt.records.filter(t=>t.sourceId),count=new Map();
for(const t of targets){const k=t.build+'|'+t.sourceId;count.set(k,(count.get(k)||0)+1)}
const nonunique=t=>count.get(t.build+'|'+t.sourceId)>1,eligible=targets.filter(t=>!nonunique(t)),pairs=new Map(eligible.map(t=>[bi.get(t.bundleId),si.get(t.sourceId)]));
function groups(fs){const g=new Map();fs.forEach((f,i)=>{if(f.propertyOperations<10||!f.pogHash)return;if(!g.has(f.pogHash))g.set(f.pogHash,[]);g.get(f.pogHash).push(i)});return g}
const sh=groups(refs),proposals=[],seedPairs=new Map();
for(const b of bundles)for(const [h,bs]of groups(b.functions))if(bs.length===1&&sh.get(h)?.length===1){
 const f=b.functions[bs[0]],s=refs[sh.get(h)[0]],t=gt.records.find(t=>t.build===b.build&&t.bundleId===f.id),quality=t?.sourceId===s.id?'correct':t?.sourceId||t?.status==='non-target'?'wrong':'unassessed',i=bi.get(f.id),j=si.get(s.id);
 proposals.push({build:b.build,bundleId:f.id,sourceId:s.id,quality,eligible:pairs.get(i)===j});if(quality==='correct'&&pairs.get(i)===j)seedPairs.set(i,j);
}
const hashPairs=xs=>crypto.createHash('sha256').update(JSON.stringify(xs.map(t=>[t.build,t.bundleId,t.sourceId]).sort((a,b)=>{for(let j=0;j<3;j++){if(a[j]<b[j])return-1;if(a[j]>b[j])return 1}return 0}))).digest('hex');
const population={targets:targets.length,eligibleTargets:eligible.length,seeds:seedPairs.size,targetPairSetSha256:hashPairs(targets),seedPairSetSha256:hashPairs(targets.filter(t=>seedPairs.get(bi.get(t.bundleId))===si.get(t.sourceId))),detectorSha256:sha(dir+'/detector-input.json'),oracleSha256:sha(dir+'/ground-truth.json')};
write('population.json',population);write('seed-audit.json',proposals);write('added-edges.json',added);
const variants=[],traces=[];let baselineRecovered;
for(const [variant,s,b,cross]of [['baseline',sg,bg,false],['source-only',ag,bg,false],['improved-per-chunk',ag,ab,false],['improved-cross-chunk',ag,ab,true]]){
 const r=propagate({sourceGraph:s,bundleGraph:b,cross,pairs,seedPairs,buildOf,sourceLengths:refs.map(f=>f.length),bundleLengths:bf.map(f=>f.length)});
 if(variant==='baseline')baselineRecovered=new Set(r.round.keys());else for(const i of baselineRecovered)assert(r.round.has(i));
 const xs=targets.map(t=>{const i=bi.get(t.bundleId),j=si.get(t.sourceId),p=r.parent.get(i),rec=r.round.has(i);if(p!=null){assert(s[pairs.get(p)].has(j));assert(b[i].has(p));assert.equal(r.round.get(p)+1,r.round.get(i))}
 return{variant,build:t.build,library:sourceOf.get(t.sourceId),bundleId:t.bundleId,sourceId:t.sourceId,recovered:rec,round:r.round.get(i)??null,parentBundleId:p==null?null:bf[p].id,parentSourceId:p==null?null:refs[pairs.get(p)].id,gate:rec?null:nonunique(t)?'non_one_to_one_oracle_identity':bf[i].length>18000?'bundle_size_limit':![...b[i]].some(k=>r.round.has(k)&&(cross||buildOf[i]===buildOf[k]))?'no_accepted_bundle_neighbor':refs[j].length>18000?'source_size_limit':'correct_source_not_in_neighborhood'};
 });traces.push(...xs);variants.push({variant,recovered:r.round.size,rate:targets.length?r.round.size/targets.length:null});console.log(slug,variant,r.round.size+'/'+targets.length);
}
const libraries=prep.selectedLibraries.map(l=>{const ts=targets.filter(t=>sourceOf.get(t.sourceId)===l);return{library:l,targets:ts.length,sourceParseFailures:prep.parseFailures.filter(p=>p.library===l).length,variants:Object.fromEntries(variants.map(v=>{const xs=traces.filter(t=>t.variant===v.variant&&t.library===l);return[v.variant,{recovered:xs.filter(t=>t.recovered).length,rate:xs.length?xs.filter(t=>t.recovered).length/xs.length:null,seeds:xs.filter(t=>t.round===0).length}]}))}});
write('target-traces.json',traces);write('summary.json',{...subject,modelCalls:0,population,variants,libraries,addedEdges:{source:added.source.length,bundle:added.bundle.length,crossChunk:added.bundle.filter(e=>e.fromUnit!==e.toUnit).length},seedProposals:Object.fromEntries(['correct','wrong','unassessed'].map(q=>[q,proposals.filter(p=>p.quality===q).length])),protocol:'Unchanged radius-one undirected original graph plus sibling window two; unique >=10-property-operation POG proposals, oracle-confirmed seeds only; <=18000 characters for promotions; ambiguous same-chunk source identities retained but ineligible; no model calls, initialization matching or module cliques; queue and layered BFS verified by unchanged propagator.'});
