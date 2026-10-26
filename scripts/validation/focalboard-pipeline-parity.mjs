import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
const exp=process.argv[2],tool=process.argv[3],output=process.argv[4],slug='mattermost--focalboard';
assert(exp&&tool&&output,'Usage: node runner EXP_ROOT TOOL_ROOT NEW_OUTPUT');assert(!fs.existsSync(output),'Choose a new output directory');fs.mkdirSync(output,{recursive:true});
// No metadata/inference service is contacted, even accidentally.
let networkAttempts=0;globalThis.fetch=async()=>{networkAttempts++;throw Error('Network forbidden during oracle connectivity simulation')};
const importTool=relative=>import(pathToFileURL(path.join(tool,relative))),{extractFeatures,identifyAnchors}=await importTool('components/pog/index.mjs'),{inventoryDigest,hash}=await importTool('src/shared/artifacts.mjs'),{preparePipeline,recoverFunctions}=await importTool('components/pipeline/index.mjs'),{buildGraph}=await importTool('components/graph/index.mjs');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),write=(name,obj)=>fs.writeFileSync(path.join(output,name+'.json'),JSON.stringify(obj,null,2)+'\n');
const frozen=path.join(exp,'baselines/bundling-connectivity-v1-2026-10-22/results/real-app/bundling-dataset',slug),priorDir=path.join(exp,'results/real-app/bundle-graph-v2/subjects',slug),prior=read(path.join(priorDir,'summary.json')),d=read(path.join(frozen,'detector-input.json')),gt=read(path.join(frozen,'ground-truth.json')),oldTrace=read(path.join(priorDir,'target-traces.json')),priorRelations={source:read(path.join(priorDir,'source-relations.json')),bundle:read(path.join(priorDir,'bundle-relations.json'))};
assert.equal(sha(path.join(frozen,'detector-input.json')),prior.provenance.inventorySha256);assert.equal(sha(path.join(frozen,'ground-truth.json')),prior.provenance.oracleSha256);
const frozenHashes=Object.fromEntries(['detector-input.json','ground-truth.json','prepared.json','seed-audit.json'].map(f=>[path.join(frozen,f),sha(path.join(frozen,f))]));
const {propagate}=await import(pathToFileURL(path.join(exp,'scripts/real-app/multi-bundler/propagate.mjs')));
const versions=Object.fromEntries(d.sources.map(s=>[s.library,read(path.join(exp,'results/real-app/bundling-dataset',slug,'build-project/node_modules',s.library,'package.json')).version]));
const sourceManifest={roots:[path.join(frozen,'inputs/sources')],files:d.sources.map(s=>({id:s.key,path:path.join(frozen,s.sourceFile),library:{name:s.library,version:versions[s.library]}}))};
const contextUnits=priorRelations.bundle.context.units;
const bundleManifest={roots:[...new Set(contextUnits.map(u=>path.dirname(u.path)))],files:d.bundles.map(b=>({id:b.build,path:contextUnits.find(u=>u.id===b.build).path,code:fs.readFileSync(path.join(frozen,b.file),'utf8')}))};
const started=performance.now(),source=extractFeatures(sourceManifest),bundle=extractFeatures(bundleManifest);
// Saved non-target chunks remain context only, exactly as in the previous run.
for(const unit of contextUnits.filter(u=>u.contextOnly)){
 assert.equal(sha(unit.path),unit.sha256);bundle.units.push({id:unit.id,path:unit.path,code:fs.readFileSync(unit.path,'utf8'),environment:unit.environment||'main',runtimeGroup:'manifest-build',contextOnly:true,library:null,functionIds:[]});
}
bundle.inputDigest=inventoryDigest(bundle);
const oldFunctions={source:d.sources.flatMap(s=>s.functions),bundle:d.bundles.flatMap(b=>b.functions)};
for(const side of ['source','bundle']){
 const inventory=side==='source'?source:bundle;assert.deepEqual(new Set(inventory.functions.map(f=>f.id)),new Set(oldFunctions[side].map(f=>f.id)),'Changed function population on '+side);
 const byId=new Map(oldFunctions[side].map(f=>[f.id,f]));for(const f of inventory.functions){const old=byId.get(f.id);assert.equal(f.code,old.code);assert.equal(f.pogHash,old.pogHash);assert.equal(f.propertyOperations,old.propertyOperations)}
}
const targets=gt.records.filter(t=>t.sourceId),count=new Map();for(const t of targets){const key=JSON.stringify([t.build,t.sourceId]);count.set(key,(count.get(key)||0)+1)}
const eligible=targets.filter(t=>count.get(JSON.stringify([t.build,t.sourceId]))===1),truth=new Map(eligible.map(t=>[t.bundleId,t.sourceId]));
const config={recovery:{minFeatures:10,minAnchors:3,radius:1,maxCodeCharacters:18000,libraryGate:false},graph:{siblingWindow:2,includeContainment:true,useModules:true}};
const anchors=identifyAnchors(source,bundle,config.recovery),oldAnchors=oldTrace.filter(t=>t.variant==='improved-per-chunk'&&t.recovered&&t.round===0);
const pairKey=p=>JSON.stringify([p.bundleId,p.sourceId]),pairSet=xs=>new Set(xs.map(pairKey));assert.deepEqual(pairSet(anchors.matches),pairSet(oldAnchors),'Changed POG seeds');for(const p of anchors.matches)assert.equal(truth.get(p.bundleId),p.sourceId,'Unconfirmed POG seed');
const prepared=preparePipeline({source,bundle,config});
write('source',source);write('bundle',bundle);write('source-manifest',sourceManifest);write('bundle-manifest',bundleManifest);write('config',config);for(const [k,v]of Object.entries(prepared))if(v!==null)write(k,v);
const libraries=new Map(source.functions.map(f=>[f.id,f.library.name]));
const variants=[['baseline-control',buildGraph(source,{siblingWindow:2,includeContainment:true}),buildGraph(bundle,{siblingWindow:2,includeContainment:true}),false],['source-only',prepared.sourceGraph,buildGraph(bundle,{siblingWindow:2,includeContainment:true}),false],['improved-per-chunk',prepared.sourceGraph,prepared.bundleGraph,false],['improved-cross-chunk',prepared.sourceGraph,prepared.bundleGraph,true]];
const results=[];
const pairHash=xs=>hash(xs.map(p=>[p.bundleId,p.sourceId]).sort((a,b)=>a[0].localeCompare(b[0])||a[1].localeCompare(b[1])));
const makeAdj=(graph,functions)=>{const index=new Map(functions.map((f,i)=>[f.id,i])),adj=functions.map(()=>new Set());for(const e of graph.edges){const a=index.get(e.from),b=index.get(e.to);adj[a].add(b);adj[b].add(a)}return {index,adj}};
for(const [variant,sourceGraph,bundleGraph,crossChunk]of variants){
 const r=await recoverFunctions({source,bundle,sourceGraph,bundleGraph,anchors,config:{...prepared.options,crossChunk},candidateSelector:({bundle,candidates})=>{const correct=truth.get(bundle.id);return correct&&candidates.some(s=>s.id===correct)?correct:null}});
 assert.equal(networkAttempts,0);assert.equal(r.stats.validationCalls,0);assert.equal(r.stats.embeddingFunctions,0);
 const current=pairSet(r.promotions),old=oldTrace.filter(t=>t.variant===variant&&t.recovered),previous=pairSet(old),missing=[...previous].filter(k=>!current.has(k)),added=[...current].filter(k=>!previous.has(k));
 for(const p of r.promotions)assert.equal(truth.get(p.bundleId),p.sourceId);
 const sm=makeAdj(sourceGraph,source.functions),bm=makeAdj(bundleGraph,bundle.functions),accepted=new Map(r.promotions.map(p=>[p.bundleId,p.sourceId]));
 const reference=propagate({sourceGraph:sm.adj,bundleGraph:bm.adj,cross:crossChunk,pairs:new Map(eligible.map(t=>[bm.index.get(t.bundleId),sm.index.get(t.sourceId)])),seedPairs:new Map(anchors.matches.map(p=>[bm.index.get(p.bundleId),sm.index.get(p.sourceId)])),buildOf:bundle.functions.map(f=>f.unit),sourceLengths:source.functions.map(f=>f.code.length),bundleLengths:bundle.functions.map(f=>f.code.length)});
 assert.deepEqual(new Set([...reference.round.keys()].map(i=>bundle.functions[i].id)),new Set(r.promotions.map(p=>p.bundleId)),'Independent propagation differs');
 const witnesses=[];
 for(const p of r.promotions.filter(p=>p.round>0)){
  const parent=p.parentBundleIds.find(id=>accepted.has(id)&&sm.adj[sm.index.get(p.sourceId)].has(sm.index.get(accepted.get(id)))&&bm.adj[bm.index.get(p.bundleId)].has(bm.index.get(id)));
  assert(parent,'No paired source/bundle edge witness');witnesses.push({bundleId:p.bundleId,sourceId:p.sourceId,parentBundleId:parent,parentSourceId:accepted.get(parent),round:p.round});
 }
 const priorRound=new Map(old.map(t=>[pairKey(t),t.round])),roundDifferences=r.promotions.filter(p=>priorRound.get(pairKey(p))!==p.round).map(p=>({bundleId:p.bundleId,sourceId:p.sourceId,previousRound:priorRound.get(pairKey(p)),currentRound:p.round}));
 const rows=prior.libraries.map(l=>{const actual=r.promotions.filter(p=>libraries.get(p.sourceId)===l.library),expected=old.filter(t=>t.library===l.library);return {library:l.library,version:versions[l.library],targets:l.supportedTargets,previousRecovered:expected.length,currentRecovered:actual.length,previousRate:expected.length/l.supportedTargets,currentRate:actual.length/l.supportedTargets}});
 results.push({variant,previousRecovered:old.length,currentRecovered:r.promotions.length,targets:targets.length,identicalRecoveredPairs:missing.length===0&&added.length===0,missingPairs:missing.map(JSON.parse),addedPairs:added.map(JSON.parse),libraries:rows,rounds:r.stats.rounds,identicalPromotionRounds:roundDifferences.length===0,roundDifferences,previousRecoveredPairSha256:pairHash(old),currentRecoveredPairSha256:pairHash(r.promotions),independentBfsVerified:true,checkedPromotionWitnesses:witnesses.length});
 write(variant+'-witnesses',witnesses);
 write(variant+'-recovery',r);console.log(JSON.stringify(results.at(-1)));
}
assert(results.every(v=>v.identicalRecoveredPairs&&v.identicalPromotionRounds),'Current pipeline differs from recorded experiment');
for(const [file,digest]of Object.entries(frozenHashes))assert.equal(sha(file),digest,'Frozen input changed');
const adjacency=graph=>{const set=new Set();for(const e of graph.edges)set.add(JSON.stringify([e.from,e.to].sort()));return set};
const edgeComparison={};for(const side of ['source','bundle']){const old=adjacency(priorRelations[side]),current=adjacency(prepared[side+'Graph']);edgeComparison[side]={priorModelledEdges:old.size,currentEdgesIncludingSiblings:current.size,missingPriorModelledEdges:[...old].filter(e=>!current.has(e)).map(JSON.parse)}}
const result={repo:prior.repo,commit:prior.commit,bundler:prior.bundler,baselineId:prior.baselineId,modelCalls:0,networkAttempts,inventory:{sourceFunctions:source.functions.length,bundleFunctions:bundle.functions.length,targets:targets.length,eligibleTargets:eligible.length,initialAnchors:anchors.matches.length,contextOnlyUnits:contextUnits.filter(u=>u.contextOnly).length},protocol:'Ground-truth function is selected only if present in the current radius-one candidate neighborhood; no ranking, top-K, minification, validation, embeddings, network, or response-cache reads. Same initial POG anchors, target population, original one-to-one identities, sibling window two, <=18000-character promotion limit. Containment enabled and library gating disabled to match the historical simulation. Cross-chunk is reported separately.',variants:results,edgeComparison,elapsedMs:performance.now()-started,provenance:{toolRoot:path.resolve(tool),runnerSha256:sha(fileURLToPath(import.meta.url)),inputs:frozenHashes,previousSummarySha256:sha(path.join(priorDir,'summary.json')),previousTraceSha256:sha(path.join(priorDir,'target-traces.json')),pipelineSha256:sha(path.join(tool,'components/pipeline/index.mjs'))}};
write('comparison',result);
 const body=['# ReCall pipeline parity: mattermost/focalboard','',`Commit: ${prior.commit}; bundler: Parcel.`, '', 'The current POG, module-map, graph, and neighborhood pipeline was rerun from saved JavaScript. Ground truth selected candidates inside the neighborhood; no models, embeddings, response caches, or network requests were used.','', '| Library | Targets | Previous module-aware result | Current result |','|---|---:|---:|---:|',...results.find(r=>r.variant==='improved-per-chunk').libraries.map(l=>`| ${l.library} ${l.version} | ${l.targets} | ${l.previousRecovered}/${l.targets} (${(l.previousRate*100).toFixed(2)}%) | ${l.currentRecovered}/${l.targets} (${(l.currentRate*100).toFixed(2)}%) |`),'','All four variants reproduce the identical recovered function pairs and promotion rounds. Local baseline: 36/38 (94.74%); module-aware: 37/38 (97.37%). Cross-chunk: 37/38 (97.37%); this example has one matchable chunk plus two context-only chunks, so it does not test propagation between multiple target chunks.','', 'The fixed population is 38 confirmed targets, 42 reference functions, 736 bundled functions, and five original POG anchors. Library gating is disabled because the previous simulation used a preselected reference pool. Containment is enabled, matching the saved original graph; radius one, sibling window two, and 18,000-character limits are unchanged.','', 'Reproduce from ReCall Exp with a fresh output directory:', '', '```sh', 'node --max-old-space-size=4096 scripts/validation/focalboard-pipeline-parity.mjs "$PWD" "../ReCall" results/validation/focalboard-parity-rerun', '```', '', 'Recovered-pair hashes, seed/feature equality checks, independent BFS checks, and source/bundle witnesses are in comparison.json and the per-variant files. This is a connectivity parity check, not a new model accuracy experiment.'];
 fs.writeFileSync(path.join(output,'README.md'),body.join('\n')+'\n');console.log('Saved comparison to '+output);
