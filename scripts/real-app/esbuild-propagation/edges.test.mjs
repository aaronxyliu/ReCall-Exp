import {test} from 'node:test';import assert from 'node:assert/strict';import {parseModule} from '../bundling-dataset/parse.mjs';import {buildRelations} from './edges.mjs';
function spec(id,code){const functions=[];function walk(n){if(!n?.type)return;if(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(n.type))functions.push({id:id+':'+n.range.join(':'),span:n.range,name:n.id?.name});for(const [k,v]of Object.entries(n)){if(k==='loc'||k==='range')continue;if(Array.isArray(v))v.forEach(walk);else if(v?.type)walk(v)}}walk(parseModule(code,{next:true,ranges:true}));return {id,path:'/pkg/'+id+'.js',code,functions}}
const f=(s,n)=>s.functions.find(f=>f.name===n).id;
test('relative ESM aliases and re-exports resolve by lexical binding, with shadowing respected',()=>{
 const a=spec('a','export function real(){}'),barrel=spec('barrel',"export {real as alias} from './a.js'"),b=spec('b',"import {alias as run} from './barrel.js';function caller(){run()}function shadow(run){run()}");const r=buildRelations([a,barrel,b]);const calls=r.edges.filter(e=>e.kind==='call');assert.equal(calls.length,1);assert.equal(calls[0].from,f(b,'caller'));assert.equal(calls[0].to,f(a,'real'));
});
test('namespace imports and export-all work; unresolved bare imports do not use names as guesses',()=>{
 const a=spec('a','export function foo(){}'),barrel=spec('barrel',"export * from './a.js'"),b=spec('b',"import * as ns from './barrel.js';import {foo as unknown} from 'missing';function caller(){ns.foo();unknown()}");const r=buildRelations([a,barrel,b]);assert.equal(r.edges.filter(e=>e.kind==='call').length,1);assert.ok(r.unresolvedImports.some(x=>x.request==='missing'));
});
test('multiple modeled alias targets are not emitted as singleton call edges',()=>{
 const s=spec('a','function f(){}function g(){}let x=flag?f:g;function caller(){x()}');const r=buildRelations([s]);assert.ok(!r.edges.some(e=>e.kind==='call'&&e.from===f(s,'caller')));
});
test('class dispatch distinguishes static/instance methods and resolves explicit super constructors',()=>{
 const s=spec('a','class A { constructor(){} foo(){} static foo(){} } class B extends A {constructor(){super()} run(){this.foo()}static run(){this.foo()}}');const r=buildRelations([s],{classDispatch:true});const calls=r.edges.filter(e=>e.kind==='call');assert.equal(calls.length,3);assert.equal(new Set(calls.map(e=>e.to)).size,3);
});
test('this is inherited by arrows but not ordinary nested functions',()=>{
 const s=spec('a','class A { foo(){} run(){function nested(){this.foo()} const arrow=()=>this.foo();} }');const r=buildRelations([s],{classDispatch:true});assert.equal(r.edges.filter(e=>e.kind==='call').length,1);assert.equal(r.edges.find(e=>e.kind==='call').from,s.functions.at(-1).id);
});
test('class factory return aliases require an explicit opt-in',()=>{
 const s=spec('a','var C=(()=>{class D{constructor(){}}return D})();function caller(){new C()}');assert.equal(buildRelations([s],{classDispatch:true}).edges.filter(e=>e.kind==='call').length,0);assert.equal(buildRelations([s],{classDispatch:true,iifeAliases:true}).edges.filter(e=>e.kind==='call').length,1);
});
test('ESM-exported object methods resolve without guessing a globally matching property name',()=>{
 const a=spec('a','export const provider={start(){},stop(){}}'),b=spec('b',"import {provider} from './a.js';function caller(){provider.start()}function shadow(provider){provider.start()}");const r=buildRelations([a,b],{objectProperties:true});const calls=r.edges.filter(e=>e.kind==='call');assert.equal(calls.length,1);assert.equal(calls[0].from,f(b,'caller'));assert.equal(calls[0].to,a.functions[0].id);
});
test('unknown computed property access and getters do not manufacture method targets',()=>{
 const s=spec('a','const p={foo(){},get fn(){return this.foo}};function a(){p[key]()}function b(){p.fn()}');assert.equal(buildRelations([s],{objectProperties:true}).edges.filter(e=>e.kind==='call').length,0);
});
