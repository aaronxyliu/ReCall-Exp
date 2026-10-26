// Oracle-assisted connectivity simulation. This program deliberately reads the oracle.
// It never imports model/embedding clients, reads cached model judgments, or performs network I/O.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
export function graph(functions,edges,siblingWindow=2){
 const adj=functions.map(()=>new Set()),groups=new Map();
 for(const e of edges){adj[e.from].add(e.to);adj[e.to].add(e.from)}
 functions.forEach((f,i)=>{const key=f.parent??'root';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i)});
 for(const group of groups.values())for(let i=0;i<group.length;i++)for(let d=1;d<=siblingWindow;d++)if(group[i+d]!=null){adj[group[i]].add(group[i+d]);adj[group[i+d]].add(group[i])}
 return adj;
}
const copy=g=>g.map(s=>new Set(s));
export function neighborhood(i,g,radius=1){const seen=new Set([i]);let front=[i];for(let hop=0;hop<radius;hop++){const next=[];for(const u of front)for(const v of g[u])if(!seen.has(v)){seen.add(v);next.push(v)}front=next}seen.delete(i);return seen}
export function simulate({sourceGraph,bundleGraph,anchors,targets,radius=1,sourceEligible=()=>true,bundleEligible=()=>true}){
 const accepted=new Map(),used=new Set(),promotions=[];
 for(const p of anchors){assert(!accepted.has(p.bi),'Duplicate bundle anchor');assert(!used.has(p.si),'Duplicate source anchor');accepted.set(p.bi,p.si);used.add(p.si);promotions.push({...p,round:0,kind:'original-pog-anchor'})}
 const sn=sourceGraph.map((_,i)=>neighborhood(i,sourceGraph,radius)),bn=bundleGraph.map((_,i)=>neighborhood(i,bundleGraph,radius));
 const snapshots=[],rounds=[];let round=0;
 while(true){
  round++;const snapshot=new Map(accepted),pending=[],states=[];
  for(const t of targets){
   if(snapshot.has(t.bi))continue;
   const parents=[...bn[t.bi]].filter(b=>snapshot.has(b)),witnesses=parents.filter(b=>sn[snapshot.get(b)].has(t.si));
   let reason=!bundleEligible(t.bi)?'bundle_size_limit':!parents.length?'no_accepted_bundle_neighbor':!sourceEligible(t.si)?'source_size_limit':used.has(t.si)?'source_identity_already_used':!witnesses.length?'correct_source_not_in_neighborhood':'eligible_true_pair';
   states.push({bi:t.bi,si:t.si,reason,acceptedBundleNeighbors:parents,correctCandidateWitnesses:witnesses});
   if(reason==='eligible_true_pair')pending.push({...t,parentBi:witnesses[0],acceptedNeighborCount:parents.length,correctWitnessCount:witnesses.length});
  }
  const counts=new Map();for(const p of pending)counts.set(p.si,(counts.get(p.si)||0)+1);
  let added=0;for(const p of pending){if(counts.get(p.si)>1)continue;accepted.set(p.bi,p.si);used.add(p.si);promotions.push({...p,round,kind:'oracle-neighborhood-promotion'});added++}
  rounds.push({round,newAnchors:added,totalAnchors:accepted.size,remainingGateCounts:Object.fromEntries([...new Set(states.map(s=>s.reason))].map(reason=>[reason,states.filter(s=>s.reason===reason).length]))});snapshots.push(states);
  if(!added)break;
  assert(round<=targets.length+1,'Propagation did not converge');
 }
 // Independent oracle-pair graph BFS verifies paired reachability, not source-only connectivity.
 const pairs=[...anchors,...targets.filter(t=>!anchors.some(a=>a.bi===t.bi))],byBundle=new Map(pairs.map(p=>[p.bi,p]));
 const reached=new Set(anchors.map(a=>a.bi)),queue=[...reached];
 // The actual oracle has unique source identities. BFS equivalence assumes this invariant.
 assert.equal(new Set(pairs.map(p=>p.si)).size,pairs.length,'Oracle source aliasing needs an explicit policy');
 for(let j=0;j<queue.length;j++){const u=queue[j],p=byBundle.get(u);for(const v of bn[u]){const q=byBundle.get(v);if(!q||reached.has(v)||!bundleEligible(v)||!sourceEligible(q.si)||!sn[p.si].has(q.si))continue;reached.add(v);queue.push(v)}}
 assert.deepEqual([...accepted.keys()].sort((a,b)=>a-b),[...reached].sort((a,b)=>a-b),'Round simulation and independent paired-graph BFS disagree');
 return {accepted,promotions,rounds,snapshots,sourceNeighborhoods:sn,bundleNeighborhoods:bn,verification:'Fixed point equals independent BFS on oracle-pair intersection graph.'};
}
function main(){
 const base=path.resolve(process.argv[2]||'results/real-app/vue-admin-template-all-libraries'),out=path.resolve(process.argv[3]||path.join(base,'connectivity-simulation'));fs.mkdirSync(out,{recursive:true});
 const inputs=['detector-input.json','ground-truth.json','diagnostics/d-bundlr-module-graph/module-graph.json'];const bytes=Object.fromEntries(inputs.map(f=>[f,fs.readFileSync(path.join(base,f))]));
 const d=JSON.parse(bytes[inputs[0]]),oracle=JSON.parse(bytes[inputs[1]]),mg=JSON.parse(bytes[inputs[2]]),b=d.bundles.find(b=>b.build==='webpack-vendor-real'),refs=d.sources.flatMap(s=>s.functions),sourceOf=new Map(d.sources.flatMap(s=>s.functions.map(f=>[f.id,s]))),si=new Map(refs.map((f,i)=>[f.id,i])),bi=new Map(b.functions.map((f,i)=>[f.id,i]));
 const edges=[];let offset=0;for(const s of d.sources){edges.push(...s.edges.map(e=>({...e,from:e.from+offset,to:e.to+offset})));offset+=s.functions.length}
 const sg=graph(refs,edges),bg=graph(b.functions,b.edges),ag=copy(sg),ab=copy(bg);
 const edgeCounts={source:0,bundle:0};for(const e of mg.functionEdges){const idx=si.has(e.from)&&si.has(e.to)?si:bi.has(e.from)&&bi.has(e.to)?bi:null;if(!idx)continue;const g=idx===si?ag:ab,u=idx.get(e.from),v=idx.get(e.to);if(!g[u].has(v)){g[u].add(v);g[v].add(u);edgeCounts[idx===si?'source':'bundle']++}}
 const groups=fs=>{const m=new Map();fs.forEach((f,i)=>{if(f.propertyOperations<10||!f.pogHash)return;if(!m.has(f.pogHash))m.set(f.pogHash,[]);m.get(f.pogHash).push(i)});return m},sh=groups(refs),bh=groups(b.functions),anchors=[];
 for(const [h,bs]of bh)if(bs.length===1&&sh.get(h)?.length===1)anchors.push({bi:bs[0],si:sh.get(h)[0]});
 const allLabels=new Map(oracle.records.filter(t=>t.build===b.build).map(t=>[t.bundleId,t]));
 // Fail rather than silently sanitizing the fixed initial anchors using oracle labels.
 for(const a of anchors)assert.equal(allLabels.get(b.functions[a.bi].id)?.sourceId,refs[a.si].id,'Original anchor not confirmed; declare seed contamination policy before simulation');
 fs.writeFileSync(path.join(out,'initial-anchors.json'),JSON.stringify(anchors.map(a=>({bundleId:b.functions[a.bi].id,sourceId:refs[a.si].id,library:sourceOf.get(refs[a.si].id).library})),null,2)+'\n');
 const wanted=new Set(['axios','core-js']),targets=oracle.records.filter(t=>t.build===b.build&&t.sourceId&&wanted.has(sourceOf.get(t.sourceId)?.library)).map(t=>({bi:bi.get(t.bundleId),si:si.get(t.sourceId)}));
 assert.equal(targets.length,508);assert.equal(new Set(targets.map(t=>t.si)).size,targets.length);
 // All 30 original vendor anchors are held fixed; only these 508 targets can be newly promoted.
 const variants=[['original',sg,bg],['source-intermodule-only',ag,bg],['bundle-intermodule-only',sg,ab],['both-intermodule',ag,ab]],summary=[];
 for(const [id,sourceGraph,bundleGraph]of variants){
  const r=simulate({sourceGraph,bundleGraph,anchors,targets,sourceEligible:i=>refs[i].code.length<=18000,bundleEligible:i=>b.functions[i].code.length<=18000}),pm=new Map(r.promotions.map(p=>[p.bi,p])),final=new Map(r.snapshots.at(-1).map(s=>[s.bi,s]));
  const traces=targets.map(t=>{const src=sourceOf.get(refs[t.si].id),p=pm.get(t.bi),last=final.get(t.bi),history=r.snapshots.flatMap((states,i)=>{const s=states.find(s=>s.bi===t.bi);return s?[{round:i+1,reason:s.reason,acceptedBundleNeighborCount:s.acceptedBundleNeighbors.length,correctCandidateWitnessCount:s.correctCandidateWitnesses.length}]:[]});let parent=null;
   if(p?.parentBi!=null)parent={bundleId:b.functions[p.parentBi].id,sourceId:refs[r.accepted.get(p.parentBi)].id,sourceEdgePresent:sourceGraph[t.si].has(r.accepted.get(p.parentBi)),bundleEdgePresent:bundleGraph[t.bi].has(p.parentBi)};
   return {library:src.library,packageInstance:src.packageInstance,file:src.file,sourceId:refs[t.si].id,bundleId:b.functions[t.bi].id,sourceName:refs[t.si].name,status:p?'recovered':'unreached',kind:p?.kind??null,round:p?.round??null,parentWitness:parent,finalGate:last?.reason??null,timeline:history};
  });
  const libs=[...wanted].map(l=>{const ts=traces.filter(t=>t.library===l),recovered=ts.filter(t=>t.status==='recovered');return {library:l,targets:ts.length,initialAnchors:recovered.filter(t=>t.round===0).length,newOracleAnchors:recovered.filter(t=>t.round>0).length,recovered:recovered.length,connectivityRate:recovered.length/ts.length,unreached:ts.length-recovered.length,lastPromotionRound:Math.max(...recovered.map(t=>t.round)),finalGates:Object.fromEntries([...new Set(ts.filter(t=>t.finalGate).map(t=>t.finalGate))].map(k=>[k,ts.filter(t=>t.finalGate===k).length]))}});
  const packages=[...new Set(traces.map(t=>t.packageInstance))].map(pkg=>{const ts=traces.filter(t=>t.packageInstance===pkg);return {packageInstance:pkg,targets:ts.length,recovered:ts.filter(t=>t.status==='recovered').length,unreached:ts.filter(t=>t.status==='unreached').length}});
  const result={variant:id,configuration:{radius:1,siblingWindow:2,characterLimit:18000,originalAnchors:anchors.length,newPromotionScope:['axios','core-js'],ranking:'oracle selects true source anywhere in candidate pool; no top-K',validation:'oracle',rounds:'synchronous snapshot; all eligible true pairs promoted at round end',sourceIdentityPolicy:'strict one-to-one; all initial anchors oracle-confirmed; supported target identities unique'},libraries:libs,packageInstances:packages,rounds:r.rounds,verification:r.verification,targets:traces};
  fs.writeFileSync(path.join(out,id+'.json'),JSON.stringify(result,null,2)+'\n');summary.push({variant:id,libraries:libs,packageInstances:packages,productiveRounds:r.rounds.length-1,fixedPointRound:r.rounds.length});
 }
 const result={policy:'Oracle-assisted paired-neighborhood connectivity simulation, explicitly using ground truth to choose new anchors. Not model recovery or deployable detector performance. Original unique >=10-property-operation POG anchors are recomputed unchanged over all six references and whole vendor chunk. Only axios/core-js receive new oracle promotions; seven other-library initial anchors remain fixed context. No embeddings, ranking, validation, cached model decisions, new seeds, export-slot proposals, or module-pair scheduling are used.',initialAnchors:anchors.length,uniqueAdditionalIntermoduleEdges:edgeCounts,variants:summary,provenance:{inputs:inputs.map(f=>({file:f,sha256:sha(bytes[f])})),scriptSha256:sha(fs.readFileSync(fileURLToPath(import.meta.url)))},modelCalls:0};
 fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1]))main();
