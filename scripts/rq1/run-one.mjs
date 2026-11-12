// One process per repository bounds memory. Only prepared JS manifests enter ReCall.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {runDirectory,implementationDigest} from '../../../ReCall/src/workflow/run.mjs';
import {normalizeConfig} from '../../../ReCall/src/config.mjs';
import {prepare} from './prepare.mjs';
import {evaluate} from './evaluate.mjs';
const [dataset,key,root]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p));
const subject=read(path.join(dataset,'one-to-one-evaluation.json')).subjects.find(s=>s.subject===key);
if(!subject)throw Error('Unknown subject');
const folder=path.join(root,key),input=path.join(folder,'input'),output=path.join(folder,'run');fs.mkdirSync(folder,{recursive:true});
const log=event=>{const e={at:new Date().toISOString(),...event};fs.appendFileSync(path.join(folder,'events.jsonl'),JSON.stringify(e)+'\n');console.log(JSON.stringify(e))};
const endpoint=process.env.RECALL_MODEL_ENDPOINT||'http://127.0.0.1:11434';
const experimentFile=path.join(folder,'experiment.json');
if(fs.existsSync(experimentFile)){
 const previous=read(experimentFile);
 if(previous.config.models.endpoint!==endpoint)throw Error('Model endpoint changed; choose a new experiment directory');
 if(previous.groundTruthSHA256!==subject.recordsSHA256||previous.implementationDigest!==implementationDigest())throw Error('Dataset or implementation changed; choose a new experiment directory');
}
const now=performance.now();log({stage:'prepare',repo:subject.repo});
let manifests;
if(fs.existsSync(path.join(input,'sourceManifest.json')))manifests={sourceManifest:read(path.join(input,'sourceManifest.json')),bundleManifest:read(path.join(input,'bundleManifest.json'))};
else manifests=prepare(dataset,subject,input);
const config=normalizeConfig({recovery:{topK:Number(process.env.RECALL_TOP_K??5),libraryGate:process.env.RECALL_UNGATED!=='1',conflictPolicy:process.env.RECALL_RETAIN_CONFLICTS==='1'?'retain':'discard'},models:{endpoint,validationModel:'qwen3.5:27b',astFirst:process.env.RECALL_AST_FIRST==='1'}});
if(fs.existsSync(experimentFile)&&JSON.stringify(read(experimentFile).config)!==JSON.stringify(config))throw Error('Experiment configuration changed; choose a fresh output directory');
const timing={preparationMs:performance.now()-now,stages:{},modelCalls:0,embeddingMs:0,validationMs:0,byLibrary:{}};
// Instrument transport without changing requests, decisions, or model defaults.
const originalFetch=globalThis.fetch,codeLibraries=new Map(),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
globalThis.fetch=async(url,options)=>{
 const start=performance.now();let body;try{body=JSON.parse(options?.body||'null')}catch{}
 let libs=[];
 if(String(url).endsWith('/api/chat')){try{const pair=JSON.parse(body.messages.at(-1).content);libs=[...(codeLibraries.get(hash(pair.source_function))||[])];}catch{}}
 try{const response=await originalFetch(url,options);
  // Consume the clone to measure actual response completion, not headers alone.
  if(body?.model){const data=await response.clone().json();const ms=performance.now()-start,kind=String(url).endsWith('/api/chat')?'validation':'embedding';timing.modelCalls++;timing[kind+'Ms']+=ms;
   for(const library of libs){timing.byLibrary[library]??={validationMs:0,validationCalls:0};timing.byLibrary[library].validationMs+=ms/libs.length;timing.byLibrary[library].validationCalls+=1/libs.length}
   fs.appendFileSync(path.join(folder,'model-timing.jsonl'),JSON.stringify({at:new Date().toISOString(),kind,ms,libraries:libs,promptTokens:data.prompt_eval_count,outputTokens:data.eval_count,serverDurationNs:data.total_duration})+'\n');
  }return response;
 }catch(error){log({stage:'model-error',error:error.message,ms:performance.now()-start});throw error}
};
let stage=null,stageStart=performance.now(),lastPrint=0;
const progress=e=>{
 if(stage!==e.stage){if(stage)timing.stages[stage]=(timing.stages[stage]||0)+performance.now()-stageStart;stage=e.stage;stageStart=performance.now();
  if(stage==='recovery'){for(const f of read(path.join(output,'source.json')).functions){const k=hash(f.code);if(!codeLibraries.has(k))codeLibraries.set(k,new Set());if(f.library)codeLibraries.get(k).add(f.library.name)}}
 }
 if(Date.now()-lastPrint>10000||e.stage!=='recovery'||e.status){log(e);lastPrint=Date.now()}
 fs.writeFileSync(path.join(folder,'live.json'),JSON.stringify({at:new Date().toISOString(),repo:subject.repo,...e,timing},null,2));
};
try{
 fs.writeFileSync(path.join(folder,'experiment.json'),JSON.stringify({repo:subject.repo,commit:subject.commit,groundTruthSHA256:subject.recordsSHA256,implementationDigest:implementationDigest(),config,startedAt:new Date().toISOString()},null,2));
 await runDirectory({...manifests,output,config,resume:fs.existsSync(path.join(output,'run.json'))||(fs.existsSync(output)&&fs.readdirSync(output).every(name=>name==='model-cache')),onProgress:progress});
 if(stage)timing.stages[stage]=(timing.stages[stage]||0)+performance.now()-stageStart;
 const scoreStart=performance.now();const report=evaluate(path.join(dataset,subject.records),input,output);timing.scoringMs=performance.now()-scoreStart;timing.totalWallMs=performance.now()-now;
 fs.writeFileSync(path.join(folder,'timing.json'),JSON.stringify(timing,null,2));
 log({stage:'evaluated',repo:subject.repo,correct:report.correct,denominator:report.groundTruthPairs,precision:report.recoveryPrecision,ms:timing.totalWallMs});
}catch(error){log({stage:'failed',error:error.stack});process.exitCode=1}
