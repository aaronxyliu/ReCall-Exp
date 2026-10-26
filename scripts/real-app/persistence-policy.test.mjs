import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.EXPERIMENT_OUTPUT=fs.mkdtempSync(path.join(os.tmpdir(),'fapi-persistence-'));
const {write,output}=await import('../../results/real-app/vue-admin-template-all-libraries/implementation/scripts/jquery/common.mjs');
test('coalesced running snapshots preserve immediate judgments and final recovery state',()=>{
 const checkpoint=path.join(output,'recovery/test.json'),cache=path.join(output,'model-cache/validations/test.json');
 try {
  write(checkpoint,{status:'running',promotions:[1],pairs:[1]});write(checkpoint,{status:'running',promotions:[1,2],pairs:[1,2]});assert.deepEqual(JSON.parse(fs.readFileSync(checkpoint)).pairs,[1]);
  write(cache,{verdict:'accept'});write(cache,{verdict:'reject'});assert.equal(JSON.parse(fs.readFileSync(cache)).verdict,'reject');
  write(checkpoint,{status:'fixed-point',promotions:[1,2],pairs:[1,2]});assert.deepEqual(JSON.parse(fs.readFileSync(checkpoint)).pairs,[1,2]);assert.equal(fs.existsSync(checkpoint+'.tmp'),false);
 } finally {fs.rmSync(output,{recursive:true,force:true})}
});
