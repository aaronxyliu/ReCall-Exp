import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';import {performance} from 'node:perf_hooks';
import {extractFeatures,identifyAnchors} from '../../../ReCall/components/pog/index.mjs';
import {resolveModules} from '../../../ReCall/components/modules/index.mjs';
import {buildGraph,graphDigest} from '../../../ReCall/components/graph/index.mjs';
import {recoverFunctions} from '../../../ReCall/components/pipeline/index.mjs';
import {normalizeConfig} from '../../../ReCall/src/config.mjs';
import {hash,readJSON,writeJSON,inventoryDigest} from '../../../ReCall/src/shared/artifacts.mjs';
import {implementationDigest} from '../../../ReCall/src/workflow/run.mjs';
import {libraryScope} from '../../../ReCall/src/analysis/library-scope.mjs';
import {oracleIndex,simulationClient,scoreSimulation,requireAlignedInputs} from './validator.mjs';
if(!process.argv[2])throw Error('Usage: node scripts/simulation/run.mjs PREPARED_RUN_ROOT [SUBJECT ...]');
const root=path.resolve(process.argv[2]),base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),subjects=process.argv.slice(3).length?process.argv.slice(3):['primefaces--primeng','swimlane--ngx-datatable'];
if(fs.existsSync(path.join(root,'summary.json')))throw Error('Completed experiment exists; choose a fresh run directory');
const started=performance.now(),rows=[],network={embedding:0,tags:0,validation:0},realFetch=globalThis.fetch;
globalThis.fetch=async(url,opts)=>{const u=new URL(url),body=opts?.body?JSON.parse(opts.body):null;if(u.origin!=='http://127.0.0.1:11434'||!['/api/embed','/api/tags'].includes(u.pathname)||body&&body.model!=='qwen3-embedding:0.6b')throw Error('Simulation forbids validation-model and unrelated network requests: '+url);network[u.pathname==='/api/embed'?'embedding':'tags']++;return realFetch(url,opts)};
const write=(p,x)=>writeJSON(path.join(root,p),x,{overwrite:true}),progress=(stage,extra={})=>{const x={at:new Date().toISOString(),stage,elapsedSeconds:(performance.now()-started)/1000,...extra,completed:rows,network};write('progress.json',x);console.log(JSON.stringify(x,(k,v)=>k==='completed'?v.map(r=>({subject:r.subject,mode:r.mode,...r.score})):v))};
const staticArtifact=(dir,name,fn)=>{const file=path.join(dir,name+'.json');if(fs.existsSync(file))return readJSON(file);const result=fn();writeJSON(file,result);return result};
write('method.json',{implementationDigest:implementationDigest(),subjects,embedding:'qwen3-embedding:0.6b',validation:'ground-truth-simulation',astBeforeRanking:true,topK:3,radius:1,crossChunk:true,libraryGate:false,policy:'Controlled old global-source versus strict per-library source recovery. Identical source inputs aligned with the collection corpus and full supplied bundle graph. Only the validation model is replaced by exact ground-truth decisions; AST precheck and POG anchors remain unchanged. Unknown oracle pairs are not promoted by simulation validator. Historical model runs are context, not controlled baselines.'});
for(const subject of subjects){
 const dir=path.join(root,subject),input=path.join(dir,'input');progress('export',{subject});
 if(!fs.existsSync(input))execFileSync(process.execPath,[path.join(base,'ReCall Dataset/tools/export-inputs.mjs'),'esbuild/'+subject,input,'--references',path.join(dir,'references/packages')]);
 const config=normalizeConfig({recovery:{libraryGate:false,crossChunk:true},models:{cacheDir:path.join(root,'embedding-cache')}});
 progress('features',{subject});const source=staticArtifact(dir,'source',()=>extractFeatures(readJSON(path.join(input,'source.json')))),bundle=staticArtifact(dir,'bundle',()=>extractFeatures(readJSON(path.join(input,'bundle.json'))));
 progress('bundle-graph',{subject,sourceFunctions:source.functions.length,bundleFunctions:bundle.functions.length});
 const bundleModules=staticArtifact(dir,'bundleModules',()=>resolveModules(bundle,{...config.modules,isolateLibraries:false})),bundleGraph=staticArtifact(dir,'bundleGraph',()=>buildGraph(bundle,{...config.graph,moduleMap:bundleModules,isolateLibraries:false}));
 // Ground truth is loaded only after code-only input discovery and bundle parsing.
 const truth=readJSON(path.join(dir,'ground-truth/relations.json')),index=oracleIndex(source,bundle,truth.pairs);
 writeJSON(path.join(dir,'alignment-check.json'),requireAlignedInputs(index),{overwrite:true});
 for(const mode of ['unrestricted','isolated']){
  const out=path.join(dir,mode);fs.mkdirSync(out,{recursive:true});progress('source-graph',{subject,mode});
  const isolated=mode==='isolated',modules=staticArtifact(out,'sourceModules',()=>resolveModules(source,{...config.modules,isolateLibraries:isolated})),graph=staticArtifact(out,'sourceGraph',()=>buildGraph(source,{...config.graph,moduleMap:modules,isolateLibraries:isolated}));
  const scopes=new Map(source.units.map(u=>[u.id,libraryScope(u)])),fScopes=new Map(source.functions.map(f=>[f.id,scopes.get(f.unit)]));
  const crossLibraryEdges=graph.edges.filter(e=>fScopes.get(e.from)!==fScopes.get(e.to)).length;
  // Reproduce former global anchor uniqueness/candidate/settlement policy without
  // changing any code, IDs, spans, graph edges or oracle mapping. Only grouping
  // metadata in this experimental control is collapsed after graph construction.
  const effective=isolated?source:{...source,units:source.units.map(({packageRoot,packageInfo,library,...u})=>({...u,library:null})),functions:source.functions.map(f=>({...f,library:null}))};
  if(!isolated)effective.inputDigest=inventoryDigest(effective);
  const sourceGraph=isolated?graph:{...graph,inputDigest:effective.inputDigest};if(!isolated)sourceGraph.graphDigest=graphDigest(sourceGraph);
  const anchors=identifyAnchors(effective,bundle,config.recovery);writeJSON(path.join(out,'anchors.json'),anchors,{overwrite:true});
  const client=simulationClient(config.models,index),begin=performance.now();let last=0;
  progress('recover',{subject,mode,anchors:anchors.matches.length,crossLibrarySourceEdges:crossLibraryEdges});
  const recovery=await recoverFunctions({source:effective,bundle,sourceGraph,bundleGraph,anchors,config:config.recovery,models:client,onProgress:e=>{if(performance.now()-last>15000){last=performance.now();progress('recover',{subject,mode,...e,oracleChecks:client.oracleStats})}},onCheckpoint:r=>{writeJSON(path.join(out,'checkpoint.json'),r,{overwrite:true});progress('checkpoint',{subject,mode,round:r.stats.rounds,status:r.status,score:scoreSimulation(index,r),oracleChecks:client.oracleStats})}});
  recovery.simulation={embeddingModel:config.models.embeddingModel,validationModelCalls:client.stats.validationRequests,oracleChecks:client.oracleStats,policy:'Only model validation replaced; original POG and AST acceptances retained.'};for(const p of recovery.promotions)if(p.validator==='ground-truth-simulation')p.kind='simulation-recovered';
  writeJSON(path.join(out,'recovery.json'),recovery,{overwrite:true});
  const row={subject,mode,score:scoreSimulation(index,recovery),sourceFunctions:source.functions.length,bundleFunctions:bundle.functions.length,sourceParseFailures:source.diagnostics.filter(d=>d.kind==='parse-error').length,sourceGraphEdges:graph.edges.length,crossLibrarySourceEdges:crossLibraryEdges,anchors:anchors.matches.length,rounds:recovery.stats.rounds,queries:recovery.queries.length,oracleChecks:client.oracleStats,model:client.stats,elapsedSeconds:(performance.now()-begin)/1000,status:recovery.status};rows.push(row);writeJSON(path.join(out,'summary.json'),row,{overwrite:true});write('summary.json',rows);progress('completed-variant',{subject,mode});
 }
}
progress('completed');
