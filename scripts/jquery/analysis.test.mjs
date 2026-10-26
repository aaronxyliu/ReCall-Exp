import test from 'node:test';
import assert from 'node:assert/strict';
import {inventory,containing} from './inventory.mjs';
import {enumerate} from './measure.mjs';
import {interiorBodyPoint} from './oracle-point.mjs';
import {SourceMapConsumer,SourceMapGenerator} from 'source-map';

test('own-body features exclude nested function operations',()=>{
 const inv=inventory('function outer(x){x.a; function inner(y){y.b;y.c;} return x.d;}','test','fixture.js');
 assert.equal(inv.functions.length,2);
 assert.equal(inv.functions[0].propertyOperations,2);
 assert.equal(inv.functions[1].propertyOperations,2);
 assert.equal(containing(inv.functions,inv.functions[1].span[0]+1).index,1);
 assert.ok(inv.edges.some(e=>e.kind==='contains'&&e.from===0&&e.to===1));
});
test('POG exact match can collide for behaviorally different operations',()=>{
 const a=inventory('function a(x){return x.value+1}','a','a.js').functions[0];
 const b=inventory('function b(y){return y.value-1}','b','b.js').functions[0];
 assert.equal(a.pogHash,b.pogHash);
 assert.notEqual(a.astHash,b.astHash);
});
test('call resolution respects shadowed parameters',()=>{
 const inv=inventory('function helper(){return 1} function a(helper){return helper()} function b(){return helper()}','c','c.js');
 assert.ok(!inv.edges.some(e=>e.kind==='call'&&e.from===1&&e.to===0));
 assert.ok(inv.edges.some(e=>e.kind==='call'&&e.from===2&&e.to===0));
});
test('header mappings must not contaminate body identity votes',()=>{
 const source='const f = function(x) { return x.a; };';
 const code='const a = function(n) { return n.a; };';
 const s=inventory(source,'source','fixture.js'),b=inventory(code,'bundle','bundle.js');
 const fn=enumerate(code).functions[0].node;
 const map=new SourceMapGenerator({file:'bundle.js'});
 for(const [generated,original] of [[code.indexOf('function'),0],[code.indexOf('n.a'),source.indexOf('x.a')],[code.indexOf('n.a')+2,source.indexOf('x.a')+2]])map.addMapping({generated:{line:1,column:generated},original:{line:1,column:original},source:'./node_modules/jquery/dist-module/fixture.js'});
 map.setSourceContent('./node_modules/jquery/dist-module/fixture.js',source);
 const consumer=new SourceMapConsumer(map.toJSON());let raw=0,rawCorrect=0,kept=0,keptCorrect=0;
 consumer.eachMapping(m=>{assert.equal(m.source,consumer.sources[0]);if(!containing(b.functions,m.generatedColumn))return;raw++;const correct=containing(s.functions,m.originalColumn)?.id===s.functions[0].id;if(correct)rawCorrect++;if(interiorBodyPoint({span:fn.body.range,block:true},m.generatedColumn)){kept++;if(correct)keptCorrect++}});
 assert.ok(rawCorrect/raw<.8);
 assert.equal(kept,2);
 assert.equal(keptCorrect/kept,1);
});
test('expression-bodied arrows retain their first and last expression tokens',()=>{
 const node=enumerate('const f = x => x + 1;').functions[0].node;
 const body={span:node.body.range,block:false};
 assert.equal(interiorBodyPoint(body,node.body.range[0]),true);
 assert.equal(interiorBodyPoint(body,node.body.range[1]-1),true);
 assert.equal(interiorBodyPoint(body,node.body.range[0]-1),false);
});
