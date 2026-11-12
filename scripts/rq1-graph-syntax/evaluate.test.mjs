import test from 'node:test';
import assert from 'node:assert/strict';
import {score} from './evaluate.mjs';

function fixture(prefix){
 const code=prefix+'const o={connect(){return 1;}};',start=code.indexOf('connect'),end=code.lastIndexOf('}');
 const sourceId='s:'+code.indexOf('(){')+':'+end,bundleId='b:0:1';
 const source={units:[{id:'s',code}],functions:[{id:sourceId,unit:'s',span:[code.indexOf('(){'),end]}],diagnostics:[]};
 const bundle={units:[{id:'b',code:';'}],functions:[{id:bundleId,unit:'b',span:[0,1]}],diagnostics:[]};
 return score({pairs:[{library:'fixture',source:'src@'+start+'-'+end,bundled:'out@0-1'}],selection:{selected:['fixture']}},{source:{src:'s'},bundle:{out:'b'}},source,bundle,{promotions:[{sourceId,bundleId,kind:'pog-anchor'}],queries:[],stats:{},configuration:{topK:3},status:'fixed-point'});
}
test('method span alignment scores an ordinary object method',()=>{
 const result=fixture('');assert.equal(result.correct,1);assert.equal(result.methodSpanAlignment.source,1);
});
test('method alignment handles a program body wider than the JS argument limit',()=>{
 const result=fixture(';'.repeat(150000));assert.equal(result.correct,1);assert.equal(result.recoveryRate,1);assert.equal(result.methodSpanAlignment.source,1);
});
