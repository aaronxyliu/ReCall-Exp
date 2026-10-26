import {test} from 'node:test';import assert from 'node:assert/strict';
import {recognize} from './recognize.mjs';import {analyzeModules} from './adapted-module-graph.mjs';import {parseModule} from 'meriyah';
function spec(code){const functions=[];function walk(n){if(!n?.type)return;if(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(n.type))functions.push({id:'b:'+n.range.join(':'),span:n.range});for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(walk);else if(v?.type)walk(v)}}walk(parseModule(code,{next:true,ranges:true}));return {id:'b',build:'b',kind:'bundle',code,functions}}
test('authors chunk999 pattern recognizes sparse legacy array and preserves numeric IDs',()=>{const r=recognize(spec('webpackJsonp([0],[,function(m,e,r){},,function(m,e,r){}]);'));assert.equal(r.patternName,'chunk999');assert.equal(r.tableType,'ArrayExpression');assert.deepEqual(r.factories.map(f=>f.moduleId),['1','3'])});
test('authors legacy pattern recognizes numeric object keys without renumbering',()=>{const r=recognize(spec('webpackJsonp([0],{12:function(m,e,r){},57:function(m,e,r){}});'));assert.deepEqual(r.factories.map(f=>f.moduleId),['12','57'])});
test('non-webpack global calls do not match the legacy namespace pattern',()=>{const r=recognize(spec('otherLoader([0],{1:function(m,e,r){}});'));assert.equal(r.kind,'unrecognized')});
test('original chunk whole-file position gate rejects a registration far below the start',()=>{const r=recognize(spec('\n'.repeat(22)+'webpackJsonp([0],{1:function(m,e,r){}});'));assert.equal(r.kind,'unrecognized')});
test('recognized sparse-array factories retain exact spans and enable cross-module call resolution',()=>{
 const s=spec('webpackJsonp([0],[,function(m,e,r){function f(){}m.exports=f},function(m,e,r){var dep=r(1);function caller(){dep()}e.caller=caller}]);'),r=recognize(s),g=analyzeModules([s]);assert.ok(g.solver.converged);assert.equal(g.modules.length,2);assert.deepEqual(g.modules.map(m=>m.factorySpan),r.factories.map(f=>f.factorySpan));assert.equal(g.functionEdges.length,1);assert.equal(g.functionEdges[0].calleeText,'dep');
});
test('recognition alone does not fabricate an edge for an unresolved imported function',()=>{
 const s=spec('webpackJsonp([0],{1:function(m,e,r){function f(){}m.exports=f},2:function(m,e,r){var dep=r(99);function caller(){dep()}}});'),g=analyzeModules([s]);assert.equal(g.functionEdges.length,0);assert.ok(g.imports.some(e=>e.request===99&&e.to===null));
});
