// Post-hoc audit sensitivity on saved graphs, not a changed analyzer result.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {graph} from '../connectivity/simulate.mjs';import {propagate} from '../multi-bundler/propagate.mjs';
const base=path.resolve('results/real-app/bundle-graph-v2-holdout'),read=p=>JSON.parse(fs.readFileSync(p));
const key=e=>JSON.stringify([e.from,e.to,e.kind,e.span]);
for(const subject of read(base+'/selection.json').subjects){
 const dir=base+'/subjects/'+subject.slug;if(fs.existsSync(dir+'/audit-sensitivity.json'))continue;
 const d=read(dir+'/detector-input.json'),refs=[],bf=[],se=[],be=[],buildOf=[],sourceOf=new Map();
 for(const p of d.sourceShards){const s=read(dir+'/'+p),off=refs.length;for(const f of s.functions){refs.push({...f,parent:s.key+':'+(f.parent??'root'),length:f.code.length});sourceOf.set(f.id,s.library)}for(const e of s.edges)se.push({from:e.from+off,to:e.to+off})}
 for(const p of d.bundleShards){const b=read(dir+'/'+p),off=bf.length;for(const f of b.functions){bf.push({...f,parent:b.build+':'+(f.parent??'root'),length:f.code.length});buildOf.push(b.build)}for(const e of b.edges)be.push({from:e.from+off,to:e.to+off})}
 const si=new Map(refs.map((f,i)=>[f.id,i])),bi=new Map(bf.map((f,i)=>[f.id,i])),sg=graph(refs,se),bg=graph(bf,be),targets=read(dir+'/ground-truth.json').records.filter(t=>t.sourceId),counts=new Map();
 for(const t of targets){const k=t.build+'|'+t.sourceId;counts.set(k,(counts.get(k)||0)+1)}
 const pairs=new Map(targets.filter(t=>counts.get(t.build+'|'+t.sourceId)===1).map(t=>[bi.get(t.bundleId),si.get(t.sourceId)])),seeds=read(dir+'/seed-audit.json').filter(p=>p.quality==='correct'&&p.eligible),seedPairs=new Map(seeds.map(t=>[bi.get(t.bundleId),si.get(t.sourceId)]));
 assert.equal(seedPairs.size,read(dir+'/population.json').seeds);
 const added=read(dir+'/added-edges.json'),screen=read(dir+'/risk-screen.json'),rows=[];
 for(const filter of ['unchanged-control','drop-write-only-and-getter-callback','drop-all-screen-flags']){
  const omitted={source:new Set(),bundle:new Set()};
  for(const f of screen.flags)if(filter==='drop-all-screen-flags'||filter==='drop-write-only-and-getter-callback'&&(f.reason==='write-only-assignment-target'||f.edge.kind==='callee-callback'))omitted[f.side].add(key(f.edge));
  const s=sg.map(x=>new Set(x)),b=bg.map(x=>new Set(x));for(const [side,index,adj]of [['source',si,s],['bundle',bi,b]])for(const e of added[side])if(!omitted[side].has(key(e))){const u=index.get(e.from),v=index.get(e.to);adj[u].add(v);adj[v].add(u)}
  for(const cross of [false,true]){
   const r=propagate({sourceGraph:s,bundleGraph:b,cross,pairs,seedPairs,buildOf,sourceLengths:refs.map(f=>f.length),bundleLengths:bf.map(f=>f.length)}),variant=cross?'improved-cross-chunk':'improved-per-chunk',original=read(dir+'/target-traces.json').filter(t=>t.variant===variant&&t.recovered),old=new Set(original.map(t=>t.bundleId)),lost=original.filter(t=>!r.round.has(bi.get(t.bundleId)));
   if(filter==='unchanged-control')assert.deepEqual(new Set([...r.round.keys()].map(i=>bf[i].id)),old);
   rows.push({filter,cross,recovered:r.round.size,lost:lost.length,omittedDirectedEdges:{source:omitted.source.size,bundle:omitted.bundle.size},libraries:read(dir+'/summary.json').libraries.map(l=>({library:l.library,targets:l.targets,recovered:targets.filter(t=>sourceOf.get(t.sourceId)===l.library&&r.round.has(bi.get(t.bundleId))).length,lost:lost.filter(t=>t.library===l.library).length})),lostTargets:lost.map(t=>({build:t.build,bundleId:t.bundleId,sourceId:t.sourceId,library:t.library}))});
  }
 }
 fs.writeFileSync(dir+'/audit-sensitivity.json',JSON.stringify({policy:'Diagnostic graph filtering only; frozen analyzer and main results unchanged. First filter removes write-only identifier references and getter-token callee-callbacks; keeps caller/getter accessor adjacency. Second conservatively drops all flagged getter-value edges, including potentially useful caller/accessor dependencies. No claim that remaining graph is precise.',rows})+'\n');
 console.log(subject.slug,rows.map(r=>[r.filter,r.cross,r.recovered,r.lost]));
}
