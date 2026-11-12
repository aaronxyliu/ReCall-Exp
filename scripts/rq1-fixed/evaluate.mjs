// Evaluation is isolated from recovery. Unknown targets are unassessed, never negatives.
import fs from 'node:fs';
import {matchingMultiplicity} from './runtime.mjs';
import path from 'node:path';
import {parse} from '@babel/parser';
export const ratio=(n,d)=>d?n/d:null;
const location=(id,lookup)=>{const m=/^(.*)@(\d+)-(\d+)$/.exec(id);return m&&lookup[m[1]]?lookup[m[1]]+':'+m[2]+':'+m[3]:null};
// Babel includes a method's key in its span; ESTree uses the FunctionExpression
// value starting at its parameter list. Reconcile only verified method headers,
// never nearest/overlapping arbitrary functions. This affects scoring, not recovery.
function alignMethods(inventory){
 const ids=new Set(inventory.functions.map(f=>f.id)),units=new Map((inventory.units||[]).map(u=>[u.id,u])),cache=new Map(),byUnit=new Map();
 for(const f of inventory.functions){if(!byUnit.has(f.unit))byUnit.set(f.unit,[]);byUnit.get(f.unit).push(f)}
 let aligned=0;
 const resolve=id=>{
  if(!id||ids.has(id))return id;
  const match=/^(.*):(\d+):(\d+)$/.exec(id);if(!match)return id;
  const [,unit,start,end]=match,u=units.get(unit);if(!u)return id;
  if(!cache.has(unit)){
   const methods=new Map();let ast;
   try{ast=parse(u.code,{sourceType:'unambiguous',allowReturnOutsideFunction:true,plugins:['jsx','decorators-legacy']})}catch{cache.set(unit,methods);return id}
   const stack=[ast.program];while(stack.length){const n=stack.pop();if(!n||typeof n!=='object')continue;
    if(['ObjectMethod','ClassMethod','ClassPrivateMethod'].includes(n.type)&&n.body)methods.set(n.start+':'+n.end,n.body.start);
    for(const [k,v]of Object.entries(n))if(!['loc','extra','tokens','comments'].includes(k)&&v&&typeof v==='object'){if(Array.isArray(v))stack.push(...v);else stack.push(v)}
   }cache.set(unit,methods);
  }
  const body=cache.get(unit).get(start+':'+end);if(body===undefined)return id;
  const matches=(byUnit.get(unit)||[]).filter(f=>f.span[0]>=Number(start)&&f.span[0]<body&&f.span[1]===Number(end));
  if(matches.length!==1)return id;aligned++;return matches[0].id;
 };
 return {resolve,count:()=>aligned};
}
export function score(gt,identities,source,bundle,result){
 const sourceIds=new Set(source.functions.map(f=>f.id)),bundleIds=new Set(bundle.functions.map(f=>f.id));
 const sa=alignMethods(source),ba=alignMethods(bundle);
 const truth=new Map(),rows=gt.pairs.map(p=>({...p,s:sa.resolve(location(p.source,identities.source)),b:ba.resolve(location(p.bundled,identities.bundle))}));
 for(const p of rows)if(p.b){if(!truth.has(p.b))truth.set(p.b,new Set());truth.get(p.b).add(p.s)}
 const promotions=[...new Map(result.promotions.map(p=>[JSON.stringify([p.bundleId,p.sourceId]),p])).values()];
 const predictions=new Map();
 for(const p of promotions){if(!predictions.has(p.bundleId))predictions.set(p.bundleId,new Map());predictions.get(p.bundleId).set(p.sourceId,p)}
 function stats(rs,library=null){
  const bs=new Set(rs.map(p=>p.b).filter(Boolean));
  const ps=promotions.filter(p=>bs.has(p.bundleId));
  const correct=rs.filter(p=>p.s&&predictions.get(p.b)?.has(p.s));
  const anchors=rs.filter(p=>[...(predictions.get(p.b)?.values()||[])].some(x=>x.kind==='pog-anchor'));
  const qs=result.queries.filter(q=>bs.has(q.bundleId));
  const first=new Map();for(const q of qs)if(!first.has(q.bundleId))first.set(q.bundleId,q);
  const hit=q=>q.candidates.slice(0,5).some(c=>truth.get(q.bundleId)?.has(c.sourceId));
  const checks=qs.flatMap(q=>q.checks.map(c=>({...c,bundleId:q.bundleId,truth:truth.get(q.bundleId).has(c.sourceId)})));
  const astChecks=checks.filter(c=>c.validator==='ast'),modelChecks=checks.filter(c=>c.validator==='model'||!c.validator);
  const channelStats=items=>{
   const ds=items.filter(c=>['accept','reject'].includes(c.verdict));
   const tp=ds.filter(c=>c.verdict==='accept'&&c.truth).length,fp=ds.filter(c=>c.verdict==='accept'&&!c.truth).length;
   const tn=ds.filter(c=>c.verdict==='reject'&&!c.truth).length,fn=ds.filter(c=>c.verdict==='reject'&&c.truth).length;
   return {tp,fp,tn,fn,invalidOrError:items.length-ds.length,decisions:ds.length,accuracy:ratio(tp+tn,ds.length),acceptancePrecision:ratio(tp,tp+fp),positiveRecall:ratio(tp,tp+fn)};
  };
  const unique=items=>[...new Map(items.map(c=>[JSON.stringify([c.bundleId,c.sourceId]),c])).values()];
  const decisions=checks.filter(c=>['accept','reject'].includes(c.verdict));
  const tp=decisions.filter(c=>c.verdict==='accept'&&c.truth).length,fp=decisions.filter(c=>c.verdict==='accept'&&!c.truth).length;
  const tn=decisions.filter(c=>c.verdict==='reject'&&!c.truth).length,fn=decisions.filter(c=>c.verdict==='reject'&&c.truth).length;
  const assessedTargets=new Set(ps.map(p=>p.bundleId)),correctTargets=new Set(correct.map(p=>p.b));
  return {library,anyMatchTargetPrecision:ratio(correctTargets.size,assessedTargets.size),targetTruePositives:correctTargets.size,targetFalsePositives:assessedTargets.size-correctTargets.size,multipleMatches:matchingMultiplicity(ps),groundTruthPairs:rs.length,sourceInventoryCovered:rs.filter(p=>sourceIds.has(p.s)).length,bundleInventoryCovered:rs.filter(p=>bundleIds.has(p.b)).length,recovered:ps.length,correct:correct.length,wrong:ps.filter(p=>!truth.get(p.bundleId).has(p.sourceId)).length,recoveryRate:ratio(correct.length,rs.length),recoveryPrecision:ratio(ps.filter(p=>truth.get(p.bundleId).has(p.sourceId)).length,ps.length),anchors:anchors.length,anchorPrecision:ratio(correct.filter(p=>predictions.get(p.b)?.get(p.s)?.kind==='pog-anchor').length,anchors.length),anchorRate:ratio(anchors.length,rs.length),correctAnchors:correct.filter(p=>predictions.get(p.b)?.get(p.s)?.kind==='pog-anchor').length,rankedTargets:first.size,top5FirstHit:[...first.values()].filter(hit).length,top5FirstRate:ratio([...first.values()].filter(hit).length,first.size),top5EverRate:ratio(new Set(qs.filter(hit).map(q=>q.bundleId)).size,first.size),top5AllGroundTruthRate:ratio(new Set(qs.filter(hit).map(q=>q.bundleId)).size,rs.length),validation:channelStats(modelChecks),modelValidation:channelStats(modelChecks),astValidation:channelStats(astChecks),uniqueAstValidation:channelStats(unique(astChecks)),uniqueModelValidation:channelStats(unique(modelChecks)),combinedDecisions:channelStats(checks),acceptanceChannels:Object.fromEntries(['ast','model'].map(channel=>{const accepted=ps.filter(p=>(p.validator||(p.kind==='pog-anchor'?'anchor':'model'))===channel);const correct=accepted.filter(p=>truth.get(p.bundleId).has(p.sourceId)).length;return [channel,{assessed:accepted.length,correct,wrong:accepted.length-correct,precision:ratio(correct,accepted.length)}]}))};
 }
 const total=stats(rows);
 return {schema:'recall.rq1-score/v1',methodSpanAlignment:{source:sa.count(),bundle:ba.count()},...total,status:result.status,multipleMatches:matchingMultiplicity(promotions),allPromotions:promotions.length,assessedPredictionFraction:ratio(total.recovered,promotions.length),unassessedPromotions:promotions.filter(p=>!truth.has(p.bundleId)).length,allAnchorPromotions:promotions.filter(p=>p.kind==='pog-anchor').length,allAstAcceptances:result.queries.reduce((n,q)=>n+q.checks.filter(c=>c.validator==='ast').length,0),allModelChecks:result.queries.reduce((n,q)=>n+q.checks.filter(c=>c.validator==='model'||!c.validator).length,0),allValidationChecks:result.queries.reduce((n,q)=>n+q.checks.length,0),byLibrary:[...new Set(gt.selection.selected)].map(name=>stats(rows.filter(p=>p.library===name),name)),sourceParseFailures:source.diagnostics.filter(d=>d.kind==='parse-error'),bundleParseFailures:bundle.diagnostics.filter(d=>d.kind==='parse-error'),recoveryStats:result.stats};
}
export function evaluate(record,input,run){
 const read=f=>JSON.parse(fs.readFileSync(f));
 const result=read(path.join(run,'recovery.json'));
 const report=score(read(record),read(path.join(input,'identities.json')),read(path.join(run,'source.json')),read(path.join(run,'bundle.json')),result);
 const libraries=read(path.join(run,'libraries.json')).libraries;
 report.libraryGate={enabled:result.configuration?.libraryGate!==false,effectiveAllowedLibraries:result.configuration?.libraryGate===false?libraries.length:libraries.filter(l=>l.detected).length,selected:libraries.length,detected:libraries.filter(l=>l.detected).length,libraries:libraries.map(({library,matchedAnchorFunctions,detected})=>({library,matchedAnchorFunctions,detected}))};
 report.rawAnchorCandidates=read(path.join(run,'anchors.json')).matches.length;
 fs.writeFileSync(path.join(run,'evaluation.json'),JSON.stringify(report,null,2)+'\n');return report;
}
