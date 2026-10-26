// Characterize the unchanged analyzer. Unsupported mutations are findings, not repaired here.
import fs from 'node:fs';import path from 'node:path';import {transformSync} from 'esbuild';import {Analyzer} from '../analyzer.mjs';import {parseModule} from '../../bundling-dataset/parse.mjs';
const out=path.resolve('results/real-app/multi-bundler-robustness-v1');fs.mkdirSync(out,{recursive:true});
function spec(id,code,p='/'+id+'.js'){
 const ast=parseModule(code,{next:true,ranges:true}),functions=[],roles={};const todo=[ast];while(todo.length){const n=todo.pop();if(/^(FunctionExpression|FunctionDeclaration|ArrowFunctionExpression)$/.test(n.type)){
  const returns=n.body.type==='BlockStatement'?n.body.body.filter(x=>x.type==='ReturnStatement').map(x=>x.argument):[n.body];let marker=null;const expressions=returns.filter(Boolean);while(expressions.length){const e=expressions.pop();if(e.type==='Literal'&&['TARGET_MARKER','CALLER_MARKER'].includes(e.value))marker=e.value;else if(!/Function/.test(e.type))for(const v of Object.values(e))for(const c of Array.isArray(v)?v:[v])if(c?.type)expressions.push(c)}
  const fid=id+':'+n.range.join(':');functions.push({id:fid,span:n.range});if(marker)roles[marker]=fid;
 }for(const [k,v]of Object.entries(n)){if(['loc','range'].includes(k))continue;for(const c of Array.isArray(v)?v:[v])if(c?.type)todo.push(c)}}return{id,path:p,code,functions,roles}
}
const target='function target(){return "TARGET_MARKER"}',caller=expr=>`function caller(){${expr};return "CALLER_MARKER"}`;
const rsp=(global='rspackChunkdemo',ids=[1,2],alias=false,dot=false)=>`(self${dot?'.'+global:'['+JSON.stringify(global)+']'}=[]).push([[0],{${JSON.stringify(ids[0])}:(m,x,r)=>{${target};r.d(x,{go:()=>target})},${JSON.stringify(ids[1])}:(m,x,r)=>{${alias?'const requireAlias=r;':''}const ns=${alias?'requireAlias':'r'}(${JSON.stringify(ids[0])});${caller('ns.go()')}}}])`;
const turbo=(triple=false)=>`(globalThis.TURBOPACK||=[]).push([0,1,e=>{${target};e.s(['go',${triple?'0,target':'()=>target'}])},2,e=>{const ns=e.i(1);${caller('ns.go()')}}])`;
const parcel=()=>`const loader=globalThis.parcelRequireDemo;loader.register('one',(m,x)=>{${target};x.go=target});loader.register('two',(m,x)=>{const ns=loader('one');${caller('ns.go()')}})`;
const runtime='export var lazy=(cb,mod)=>()=>((mod||cb((mod={exports:{}}).exports,mod)),mod.exports);';
const roll=()=>`const lazy=(cb,mod)=>()=>((mod||cb((mod={exports:{}}).exports,mod)),mod.exports);const req=lazy((x,m)=>{${target};m.exports={go:target}});${caller('req().go()')}`;
const cases=[];function add(family,name,codes,{expected=true,group='ordinary'}={}){cases.push({family,name,codes:codes.map((s,i)=>typeof s==='string'?{id:'u'+i,code:s,path:'/u'+i+'.js'}:s),expected,group})}
for(const [family,make]of [['rspack',rsp],['rolldown',roll],['turbopack',turbo],['parcel',parcel]]){
 const base=make();add(family,'baseline',[base]);add(family,'local-renaming',[base.replace(/\btarget\b/g,'a9').replace(/\bcaller\b/g,'b7').replace(/\bns\b/g,'q8').replace(/\blazy\b/g,'z6').replace(/\bloader\b/g,'l5')]);
 add(family,'export-property-renaming',[base.replace(/\bgo\b/g,'renamedExport')]);add(family,'whitespace-comments',[`/* application changed */\n\n${base}\n// trailing comment`]);add(family,'esbuild-minification',[transformSync(base,{minify:true,treeShaking:false,target:'es2022',format:'esm'}).code]);
 add(family,'unrelated-code-and-shadow',[`function unrelated(ns){function target(){return 9}return target(ns)}\n${base}`]);
}
add('rspack','string-module-ids',[rsp('rspackChunkdemo',['library/a','app/b'])]);add('rspack','require-binding-alias',[rsp('rspackChunkdemo',[91,25],true)]);
add('rspack','custom-chunk-global',[rsp('myApplicationChunks')],{group:'configuration'});add('rspack','dot-chunk-global',[rsp('rspackChunkdemo',[1,2],false,true)],{group:'emitted-syntax'});
add('turbopack','direct-value-export-array',[turbo(true)]);
add('turbopack','hoisted-factory-expression',[`const factory=e=>{${target};e.s(['go',0,target])};(globalThis.TURBOPACK||=[]).push([0,1,factory,2,e=>{const ns=e.i(1);${caller('ns.go()')}}])`],{group:'emitted-syntax'});
const esmLib={id:'lib',path:'/chunks/lib-NEW-HASH.js',code:`export ${target};export {target as go}`},esmApp={id:'app',path:'/chunks/app-NEW-HASH.js',code:`import {go as renamed} from './lib-NEW-HASH.js';${caller('renamed()')}`};
add('shared','chunk-hash-renaming-and-order',[esmApp,esmLib]);
const rf={id:'runtime',path:'/chunks/runtime-randomHASH.js',code:runtime},ra={id:'app',path:'/chunks/app.js',code:`import {lazy as arbitraryName} from './runtime-randomHASH.js';const req=arbitraryName((x,m)=>{${target};m.exports={go:target}});${caller('req().go()')}`};
add('rolldown','external-runtime-supplied',[ra,rf]);add('rolldown','external-runtime-omitted',[ra],{group:'input-context'});
add('parcel','register-function-alias',[`const loader=globalThis.parcelRequireDemo;const register=loader.register;register('one',(m,x)=>{${target};x.go=target});register('two',(m,x)=>{const ns=loader('one');${caller('ns.go()')}})`],{group:'emitted-syntax'});
add('parcel','independent-loaders-must-not-cross-link',[`const a=globalThis.parcelRequireA,b=globalThis.parcelRequireB;a.register('same',(m,x)=>{${target};x.go=target});b.register('consumer',(m,x)=>{const ns=b('same');${caller('ns.go()')}})`],{expected:false,group:'runtime-isolation'});
add('shared','ordinary-return-and-argument-alias',[`${target};function identity(x){return x}const alias=identity(target);${caller('alias()')}`],{group:'application-flow'});
add('shared','computed-export-key',[{id:'lib',path:'/lib.js',code:`export ${target};export {target as go}`},{id:'app',path:'/app.js',code:`import * as ns from './lib.js';${caller('ns["g"+"o"]()')}`}],{group:'application-flow'});
add('shared','literal-dynamic-import',[{id:'lib',path:'/lib.js',code:`export ${target};export {target as go}`},{id:'app',path:'/app.js',code:`async function caller(){const ns=await import('./lib.js');ns.go();return "CALLER_MARKER"}`}],{group:'application-flow'});
const results=[];for(const c of cases){try{const a=new Analyzer(),roles={};for(const x of c.codes){const s=spec(x.id,x.code,x.path);Object.assign(roles,s.roles);a.addUnit(s)}const r=a.solve();if(!roles.TARGET_MARKER||!roles.CALLER_MARKER)throw Error('Role marker lost');const observed=r.edges.some(e=>e.kind==='call'&&e.from===roles.CALLER_MARKER&&e.to===roles.TARGET_MARKER);results.push({family:c.family,name:c.name,group:c.group,expected:c.expected,observed,pass:observed===c.expected,modules:r.stats.modules,unresolvedImports:r.units.flatMap(u=>u.unresolved),codes:c.codes})}catch(e){results.push({...c,pass:false,error:e.message})}}
fs.writeFileSync(out+'/mutation-probes.json',JSON.stringify({policy:'Targeted hand-written semantic probes and esbuild minification; not freshly rebuilt real applications or a representative repository sample. Analyzer unchanged. A failed positive probe is missing coverage; a failed negative probe is a spurious edge.',results},null,2)+'\n');console.log(JSON.stringify(results.map(({family,name,group,expected,observed,pass,error})=>({family,name,group,expected,observed,pass,error})),null,2));
