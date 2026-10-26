import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {analyzeModules} from './module-graph.mjs';import {inventory} from './inventory/inventory.mjs';import {writeDetector,loadDetector} from './io.mjs';
test('export names matching Object prototype keys do not crash or introduce functions',()=>{
 const code='function f(){} module.exports={constructor:f,toString:f};';const s={...inventory(code,'a','/pkg/a.js'),key:'a',id:'a',kind:'source',code};
 const g=analyzeModules([s]);assert.ok(g.solver.converged);assert.deepEqual(g.modules[0].functionExports.constructor,[s.functions[0].id]);assert.deepEqual(g.modules[0].functionExports.toString,[s.functions[0].id]);
});
test('sharded detector serialization preserves nested function data exactly',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'connectivity-shards-'));try{const d={policy:'test',sources:[{functions:[{id:'s:0:1',code:'function a(){}'}],edges:[]}],bundles:[{functions:[],file:'test.js'}]};writeDetector(dir,d);const x=loadDetector(dir);assert.deepEqual(x.sources,d.sources);assert.deepEqual(x.bundles,d.bundles);assert.equal(x.policy,d.policy)}finally{fs.rmSync(dir,{recursive:true,force:true})}
});
