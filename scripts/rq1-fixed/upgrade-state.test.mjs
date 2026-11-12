import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {upgradeSubject,combineTiming} from './upgrade-state.mjs';import {runDirectory as resumeDirectory} from './runtime.mjs';import {runDirectory} from '../../../ReCall/src/workflow/run.mjs';import {normalizeConfig} from '../../../ReCall/src/config.mjs';
test('filesystem upgrade retains accepted state and resumes through normal digest checks with raw-cache reuse',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'recall-upgrade-')),baseline=path.join(root,'old'),folder=path.join(root,'new');let chats=0;const previous=globalThis.fetch;
 globalThis.fetch=async(url,opts)=>({ok:true,json:async()=>{if(url.endsWith('/tags'))return {models:[{name:'qwen3-embedding:0.6b',digest:'e'},{name:'qwen3.5:27b',digest:'v'}]};if(url.endsWith('/embed'))return {embeddings:JSON.parse(opts.body).input.map(()=>[1,1])};chats++;return {message:{content:'F'}}}});
 try{
  const a='function anchor(o){o.a;o.b;o.c;o.d;o.e;o.f;o.g;o.h;o.i;o.j;}';
  const manifests={sourceManifest:{roots:[root],files:[{id:'s',path:path.join(root,'s.js'),code:a+'function helper(x){return x+1}',library:{name:'lib',version:'1'}}]},bundleManifest:{roots:[root],files:[{id:'b',path:path.join(root,'b.js'),code:a+'function target(y){return y+1}'}]}};
  const config=normalizeConfig({recovery:{libraryGate:false,conflictPolicy:'retain',topK:3},graph:{useModules:false,siblingWindow:2}});
  const old=await runDirectory({...manifests,output:path.join(baseline,'run'),config});assert.equal(old.promotions.length,1);assert(chats>0);const priorChats=chats;
  fs.writeFileSync(path.join(baseline,'timing.json'),JSON.stringify({totalWallMs:10,validationMs:8}));
  const receipt=await upgradeSubject({baseline,folder,config,manifests});assert.equal(receipt.acceptedPreserved,1);assert.equal(receipt.priorWallMs,10);assert(fs.lstatSync(path.join(folder,'run/model-cache')).isSymbolicLink());
  const next=await resumeDirectory({...manifests,output:path.join(folder,'run'),config,resume:true});assert.deepEqual(next.promotions,old.promotions);assert.equal(chats,priorChats);assert(next.queries.some(q=>q.phase==='baseline'));assert(next.queries.some(q=>q.phase==='source-resolution-method-v1'));assert.equal(next.continuation.preservedAcceptedPairs,1);
 }finally{globalThis.fetch=previous;fs.rmSync(root,{recursive:true,force:true})}
});
test('phase timings remain separate while cumulative report time is additive',()=>{
 const t=combineTiming({totalWallMs:100,validationMs:80,byLibrary:{lib:{validationMs:50,validationCalls:5}}},{totalWallMs:20,validationMs:10,stages:{inputs:2},byLibrary:{lib:{validationMs:10,validationCalls:1}}});assert.equal(t.totalWallMs,120);assert.equal(t.validationMs,90);assert.equal(t.byLibrary.lib.validationCalls,6);assert.equal(t.phaseFile,'phase-timing.json');
});

test('zero-anchor baseline with no inference cache continues with an empty new cache',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'recall-upgrade-empty-')),baseline=path.join(root,'old'),folder=path.join(root,'new'),previous=globalThis.fetch;
 globalThis.fetch=async()=>({ok:true,json:async()=>({models:[{name:'qwen3-embedding:0.6b',digest:'e'},{name:'qwen3.5:27b',digest:'v'}]})});
 try{const manifests={sourceManifest:{roots:[root],files:[{id:'s',path:path.join(root,'s.js'),code:'function f(){return 1}',library:{name:'lib',version:'1'}}]},bundleManifest:{roots:[root],files:[{id:'b',path:path.join(root,'b.js'),code:'function g(){return 1}'}]}};const config=normalizeConfig({recovery:{libraryGate:false,conflictPolicy:'retain',topK:3},graph:{useModules:false}});await runDirectory({...manifests,output:path.join(baseline,'run'),config});assert(!fs.existsSync(path.join(baseline,'run/model-cache')));const receipt=await upgradeSubject({baseline,folder,config,manifests});assert.equal(receipt.acceptedPreserved,0);assert.equal(receipt.rawCachePolicy,'empty-baseline-no-model-work');const result=await resumeDirectory({...manifests,output:path.join(folder,'run'),config,resume:true});assert.equal(result.promotions.length,0)}finally{globalThis.fetch=previous;fs.rmSync(root,{recursive:true,force:true})}
});
