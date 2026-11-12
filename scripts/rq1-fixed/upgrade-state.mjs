import fs from 'node:fs';import path from 'node:path';import {performance} from 'node:perf_hooks';
import {runDirectory,implementationDigest,migrateRecovery,hash,writeJSON} from './runtime.mjs';
const read=p=>JSON.parse(fs.readFileSync(p)),canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
function settings(config){const c=structuredClone(config);c.models.cacheDir=null;c.inputs.cacheDir=null;return canonical(c)}
export async function upgradeSubject({baseline,folder,config,manifests,onProgress,external=false}){
 const output=path.join(folder,'run'),receipt=path.join(folder,'continuation.json'),old=path.join(baseline,'run');
 if(fs.existsSync(receipt)&&read(receipt).status==='ready')return read(receipt);
 const priorPath=path.join(old,fs.existsSync(path.join(old,'recovery.json'))?'recovery.json':'checkpoint.json');
 if(!fs.existsSync(priorPath))return null;
 const lock=path.join(old,'.recall.lock');if(fs.existsSync(lock)){const pid=read(lock).pid;let alive=false;try{process.kill(pid,0);alive=true}catch{}if(alive)throw Error('Refusing to migrate a live baseline worker')}
 const prior=read(priorPath),oldRun=read(path.join(old,'run.json'));
 if(oldRun.node!==process.version)throw Error('Baseline Node version differs');
 if(hash(settings(oldRun.config))!==hash(settings(config)))throw Error('Baseline configuration differs beyond cache paths');
 fs.mkdirSync(output,{recursive:true});const cache=path.join(output,'model-cache'),oldCache=path.join(old,'model-cache');
 let rawCachePolicy='shared';
 if(fs.existsSync(oldCache)){
  if(!fs.existsSync(cache))fs.symlinkSync(fs.realpathSync(oldCache),cache,'dir');
  const a=fs.statSync(cache),b=fs.statSync(oldCache);if(a.dev!==b.dev||a.ino!==b.ino)throw Error('Continuation must share the verified raw-response cache');
 }else{
  if(prior.stats.validationCalls||prior.stats.embeddingFunctions)throw Error('Baseline raw cache missing despite prior candidate/model work');
  fs.mkdirSync(cache,{recursive:true});rawCachePolicy='empty-baseline-no-model-work';
 }
 const start=performance.now();await runDirectory({...manifests,output,config,prepareOnly:true,resume:true,onProgress});
 const nextRun=read(path.join(output,'run.json'));
 const seed=migrateRecovery({prior,oldSource:read(path.join(old,'source.json')),oldBundle:read(path.join(old,'bundle.json')),source:read(path.join(output,'source.json')),bundle:read(path.join(output,'bundle.json')),oldSourceGraph:read(path.join(old,'sourceGraph.json')),oldBundleGraph:read(path.join(old,'bundleGraph.json')),sourceGraph:read(path.join(output,'sourceGraph.json')),bundleGraph:read(path.join(output,'bundleGraph.json')),models:nextRun.config.models,implementation:{prior:oldRun.implementationDigest,next:implementationDigest()}});
 const pairs=p=>p.matches.map(m=>[m.bundleId,m.sourceId]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 if(hash(pairs(read(path.join(old,'anchors.json'))))!==hash(pairs(read(path.join(output,'anchors.json')))))throw Error('Anchor identities changed; refusing automatic continuation');
 fs.copyFileSync(priorPath,path.join(folder,'prior-recovery.json'));
 const priorTimingPath=path.join(baseline,'timing.json');const priorTiming=fs.existsSync(priorTimingPath)?read(priorTimingPath):null;
 if(priorTiming)writeJSON(path.join(folder,'prior-phase-timing.json'),priorTiming,{overwrite:true});
 writeJSON(path.join(output,'checkpoint.json'),{...seed,checkpointDigest:hash(seed)},{overwrite:true});
 const record={status:'ready',rawCachePolicy,baseline,path:priorPath,priorRecoverySHA256:hash(prior),...seed.continuation,staticUpgradeMs:performance.now()-start,priorWallMs:priorTiming?.totalWallMs||0,acceptedPreserved:seed.promotions.length,unmatched:seed.unrecovered.length};
 if(external)writeJSON(path.join(folder,'static-upgrade-timing.json'),{totalWallMs:record.staticUpgradeMs,preparationMs:record.staticUpgradeMs,modelCalls:0,embeddingMs:0,validationMs:0,scoringMs:0,stages:{staticUpgrade:record.staticUpgradeMs},byLibrary:{}},{overwrite:true});
 record.staticPreparedExternally=external;writeJSON(receipt,record,{overwrite:true});return record;
}
export function combineTiming(prior,phase){
 if(!prior)return phase;const result={...phase,continuation:true,phaseFile:'phase-timing.json',priorFile:'prior-phase-timing.json'};
 for(const k of ['preparationMs','modelCalls','embeddingMs','validationMs','scoringMs','totalWallMs'])result[k]=(prior[k]||0)+(phase[k]||0);
 result.stages={...prior.stages};for(const [k,v]of Object.entries(phase.stages||{}))result.stages[k]=(result.stages[k]||0)+v;
 result.byLibrary=structuredClone(prior.byLibrary||{});for(const [k,v]of Object.entries(phase.byLibrary||{})){result.byLibrary[k]??={validationMs:0,validationCalls:0};for(const f of ['validationMs','validationCalls'])result.byLibrary[k][f]+=v[f]||0}return result;
}
