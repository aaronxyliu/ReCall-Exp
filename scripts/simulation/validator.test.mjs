import test from 'node:test';import assert from 'node:assert/strict';import {simulationClient} from './validator.mjs';
test('simulation delegates embeddings and makes no chat or validation-model metadata requests',async()=>{const before=globalThis.fetch,calls=[];globalThis.fetch=async(url,opts)=>{const body=opts?.body?JSON.parse(opts.body):null;calls.push({url,body});if(url.endsWith('/tags'))return {ok:true,json:async()=>({models:[{name:'fixture-embedding',digest:'test'}]})};assert(url.endsWith('/embed'));assert.equal(body.model,'fixture-embedding');return {ok:true,json:async()=>({embeddings:body.input.map(()=>[1,0])})}};try{const c=simulationClient({embeddingModel:'fixture-embedding'},{decision:()=> 'accept'});assert.deepEqual(await c.embed(['function f(){}']),[[1,0]]);assert.equal((await c.validate({source:{id:'s'},bundle:{id:'b'}})).verdict,'accept');assert.equal(c.stats.validationRequests,0);assert.equal(c.oracleStats.calls,1);assert.equal(calls.length,2)}finally{globalThis.fetch=before}});

test('alignment rejects missing counterparts without changing oracle or source inventories',async()=>{
 const {requireAlignedInputs}=await import('./validator.mjs');
 const index={sourceKeys:new Map([['s','source-key']]),targetKeys:new Map([['b','target-key']]),expected:new Map([['target-key','source-key']])};
 assert.equal(requireAlignedInputs(index).groundTruthPairs,1);
 index.expected.set('unavailable-target','unavailable-source');assert.throws(()=>requireAlignedInputs(index),/1 missing source counterparts, 1 missing target counterparts/);
 assert.equal(index.expected.size,2);assert.equal(index.sourceKeys.size,1);
});
