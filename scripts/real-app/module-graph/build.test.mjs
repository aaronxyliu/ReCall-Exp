import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseModule} from 'meriyah';
import {analyzeModules} from './build.mjs';
function spec(key,code,kind='source'){
 const functions=[];function walk(n){if(!n?.type)return;if(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(n.type))functions.push({id:key+':'+n.range.join(':'),span:n.range,name:n.id?.name});for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(walk);else if(v?.type)walk(v)}}walk(parseModule(code,{next:true,ranges:true}));
 return {id:key,key,kind,file:'/pkg/'+key+'.js',code,functions,build:kind==='bundle'?key:undefined};
}
test('CommonJS export aliases and require aliases resolve across modules, while shadowed require does not',()=>{
 const a=spec('a','function f(){}; var alias=f; module.exports={foo:alias};');
 const b=spec('b',"var req=require, api=req('./a'); function caller(){return api['foo']()}; function shadow(require){return require('./a')};");
 const g=analyzeModules([a,b]);assert.ok(g.solver.converged);assert.equal(g.imports.length,1);assert.equal(g.functionEdges.length,1);assert.equal(g.functionEdges[0].to,a.functions.find(f=>f.name==='f').id);assert.equal(g.functionEdges[0].from,b.functions.find(f=>f.name==='caller').id);
});
test('webpack factory parameter roles and require.d getter export connect imported calls',()=>{
 const b=spec('chunk',`(window.webpackJsonp=window.webpackJsonp||[]).push([[0],{a:function(m,e,r){function f(){};r.d(e,'foo',function(){return f})},b:function(m,e,r){var req=r,api=req('a');function call(){return api.foo()} e.call=call}}]);`,'bundle');
 const g=analyzeModules([b]);assert.ok(g.solver.converged);assert.equal(g.modules.length,2);assert.equal(g.imports.filter(x=>x.to).length,1);assert.equal(g.functionEdges.length,1);assert.equal(g.functionEdges[0].calleeText,'api.foo');assert.equal(g.modules.find(m=>m.moduleId==='a').functionExports.foo.length,1);
});
test('re-export chains reach a fixed point without crossing package identities by basename',()=>{
 const a=spec('a','module.exports=function exported(){};'),b=spec('b',"module.exports=require('./a');"),c=spec('c',"var f=require('./b');function run(){return f()}");
 const g=analyzeModules([c,b,a]);assert.ok(g.solver.converged);assert.equal(g.functionEdges.length,1);assert.equal(g.functionEdges[0].to,a.functions[0].id);
});
test('ambiguous exported callees are retained separately, never emitted as singleton edges',()=>{
 const a=spec('a','function f(){}function g(){}module.exports={foo:f};module.exports.foo=g;'),b=spec('b',"var api=require('./a');function run(){return api.foo()}");
 const g=analyzeModules([a,b]);assert.equal(g.functionEdges.length,0);assert.equal(g.ambiguousCalls.length,2);
});
test('unresolved and nonconstant imports remain explicit; ordinary function parameters are not require',()=>{
 const a=spec('a',"var x=require('./absent');require(name);function unrelated(req){req('a')}");const g=analyzeModules([a]);assert.equal(g.imports.length,2);assert.ok(g.imports.every(e=>e.to===null));assert.ok(g.imports.some(e=>e.reason==='nonconstant-require'));
});
test('relative import resolution keeps nested package copies separate',()=>{
 const a=spec('a','module.exports=function outer(){}'),aa=spec('aa','module.exports=function inner(){}'),b=spec('b',"var f=require('./a');function run(){f()}"),bb=spec('bb',"var f=require('./a');function run(){f()}");
 aa.file='/pkg/nested/a.js';bb.file='/pkg/nested/b.js';
 const g=analyzeModules([a,aa,b,bb]);assert.equal(g.functionEdges.length,2);assert.equal(g.functionEdges.find(e=>e.from===bb.functions[0].id).to,aa.functions[0].id);assert.equal(g.functionEdges.find(e=>e.from===b.functions[0].id).to,a.functions[0].id);
});
test('webpack 5-style export getter object and lexical require shadowing',()=>{
 const b=spec('chunk',`self.webpackChunkdemo.push([[1],{a:function(m,e,r){function f(){};r.d(e,{foo:()=>f})},b:function(m,e,r){var api=r('a');function run(){api.foo()} function shadow(r){r('a')} }}]);`,'bundle');
 const g=analyzeModules([b]);assert.equal(g.modules.length,2);assert.equal(g.imports.length,1);assert.equal(g.functionEdges.length,1);
});
