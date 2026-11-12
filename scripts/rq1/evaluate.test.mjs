import {test} from 'node:test';
import assert from 'node:assert/strict';
import {score} from './evaluate.mjs';
test('GT denominator is fixed; wrong matches and unassessed outputs stay distinct',()=>{
 const gt={selection:{selected:['lib']},pairs:[{library:'lib',source:'a@0-5',bundled:'b@0-5'},{library:'lib',source:'a@6-9',bundled:'b@6-9'},{library:'lib',source:'a@10-20',bundled:'b@10-20'}]};
 const inventory=ids=>({functions:ids.map(id=>({id})),diagnostics:[]});
 const result={status:'fixed-point',stats:{},promotions:[{sourceId:'s:0:5',bundleId:'t:0:5',kind:'pog-anchor'},{sourceId:'s:0:5',bundleId:'t:6:9',kind:'model-recovered'},{sourceId:'s:0:5',bundleId:'outside',kind:'model-recovered'}],queries:[{bundleId:'t:6:9',candidates:[{sourceId:'s:0:5'},{sourceId:'s:6:9'}],checks:[{sourceId:'s:0:5',verdict:'accept'},{sourceId:'s:6:9',verdict:'reject'}]}]};
 const r=score(gt,{source:{a:'s'},bundle:{b:'t'}},inventory(['s:0:5','s:6:9']),inventory(['t:0:5','t:6:9','t:10:20']),result);
 assert.equal(r.recoveryRate,1/3);assert.equal(r.recoveryPrecision,1/2);assert.equal(r.unassessedPromotions,1);assert.equal(r.validation.fp,1);assert.equal(r.validation.fn,1);assert.equal(r.validation.accuracy,0);assert.equal(r.top5FirstRate,1);assert.equal(r.top5AllGroundTruthRate,1/3);assert.equal(r.sourceInventoryCovered,2);
});
test('method-header span alignment does not penalize equivalent parser boundaries',()=>{
 const code='const x={foo(a){return a+1}};';
 const start=code.indexOf('foo'),end=code.indexOf('}}')+1,valueStart=code.indexOf('(a)');
 const inventory=unit=>({units:[{id:unit,code}],functions:[{id:`${unit}:${valueStart}:${end}`,unit,span:[valueStart,end]}],diagnostics:[]});
 const gt={selection:{selected:['lib']},pairs:[{library:'lib',source:`a@${start}-${end}`,bundled:`b@${start}-${end}`}]};
 const r=score(gt,{source:{a:'s'},bundle:{b:'t'}},inventory('s'),inventory('t'),{status:'fixed-point',stats:{},queries:[],promotions:[{sourceId:`s:${valueStart}:${end}`,bundleId:`t:${valueStart}:${end}`,kind:'pog-anchor'}]});
 assert.equal(r.correct,1);assert.deepEqual(r.methodSpanAlignment,{source:1,bundle:1});
});
test('AST and model precision are separate and exclude unassessed targets',()=>{
 const gt={selection:{selected:['lib']},pairs:[{library:'lib',source:'a@0-5',bundled:'b@0-5'},{library:'lib',source:'a@6-9',bundled:'b@6-9'}]};
 const inventory=ids=>({functions:ids.map(id=>({id})),diagnostics:[]});
 const result={status:'fixed-point',stats:{},promotions:[{sourceId:'s:0:5',bundleId:'t:0:5',kind:'ast-recovered',validator:'ast'},{sourceId:'s:0:5',bundleId:'t:6:9',kind:'model-recovered',validator:'model'}],queries:[
  {bundleId:'t:0:5',candidates:[{sourceId:'s:0:5'}],checks:[{sourceId:'s:0:5',verdict:'accept',validator:'ast'}]},
  {bundleId:'t:6:9',candidates:[{sourceId:'s:0:5'}],checks:[{sourceId:'s:0:5',verdict:'accept',validator:'model'}]},
  {bundleId:'outside',candidates:[],checks:[{sourceId:'s:0:5',verdict:'accept',validator:'ast'}]}]};
 const r=score(gt,{source:{a:'s'},bundle:{b:'t'}},inventory(['s:0:5','s:6:9']),inventory(['t:0:5','t:6:9']),result);
 assert.equal(r.astValidation.acceptancePrecision,1);assert.equal(r.astValidation.decisions,1);
 assert.equal(r.modelValidation.acceptancePrecision,0);assert.equal(r.validation.fp,1);
 assert.equal(r.acceptanceChannels.ast.precision,1);assert.equal(r.acceptanceChannels.model.precision,0);
 assert.equal(r.allAstAcceptances,2);assert.equal(r.allModelChecks,1);
});
test('any correct retained alternative recovers a GT pair without forgiving extra wrong pairs',()=>{
 const gt={selection:{selected:['lib']},pairs:[{library:'lib',source:'a@0-5',bundled:'b@0-5'},{library:'lib',source:'a@6-9',bundled:'b@6-9'}]};
 const inventory=ids=>({functions:ids.map(id=>({id})),diagnostics:[]});
 const result={status:'fixed-point',stats:{},queries:[],promotions:[
  {sourceId:'s:0:5',bundleId:'t:0:5',kind:'ast-recovered',validator:'ast'},
  {sourceId:'s:6:9',bundleId:'t:0:5',kind:'ast-recovered',validator:'ast'},
  {sourceId:'s:0:5',bundleId:'t:6:9',kind:'model-recovered',validator:'model'},
  {sourceId:'s:0:5',bundleId:'t:0:5',kind:'ast-recovered',validator:'ast'}]};
 const r=score(gt,{source:{a:'s'},bundle:{b:'t'}},inventory(['s:0:5','s:6:9']),inventory(['t:0:5','t:6:9']),result);
 assert.equal(r.correct,1);assert.equal(r.recoveryRate,.5);assert.equal(r.anyMatchTargetPrecision,.5);
 assert.equal(r.recovered,3);assert.equal(r.wrong,2);assert.equal(r.recoveryPrecision,1/3);
 assert.equal(r.multipleMatches.bundledFunctionsWithMultipleSources,1);assert.equal(r.multipleMatches.sourceChunkGroupsWithMultipleTargets,1);
 assert.equal(r.acceptanceChannels.ast.precision,.5);
});
