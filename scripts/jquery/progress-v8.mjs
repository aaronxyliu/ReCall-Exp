import fs from 'node:fs';
import path from 'node:path';
import {output,read,now} from './common.mjs';
const truth=new Map(read(path.join(output,'ground-truth.json')).records.map(r=>[r.bundleId,r]));
const rows=[];
for(const name of ['esbuild-min-keep','rollup-min-keep','webpack-min-keep']){
 const file=path.join(output,'recovery',name+'.json');if(!fs.existsSync(file)){rows.push({build:name,status:'not-started'});continue}
 const r=read(file),l=p=>{const g=truth.get(p.bundleId);return g?.nonTarget?'wrong':!g?.sourceId?'unassessed':g.sourceId===p.sourceId?'correct':'wrong'};
 const supported=[...truth.values()].filter(g=>g.build===name&&g.sourceId).length;
 const correct=r.promotions.filter(p=>l(p)==='correct').length;
 const pending=r.queries.filter(q=>q.status==='pending'),owners=new Map();
 for(const q of pending)owners.set(q.acceptedCandidates[0],(owners.get(q.acceptedCandidates[0])||0)+1);
 const proposed=pending.filter(q=>owners.get(q.acceptedCandidates[0])===1).map(q=>({bundleId:q.bundleId,sourceId:q.acceptedCandidates[0]}));
 const provisionalCorrect=correct+proposed.filter(p=>l(p)==='correct').length;
 rows.push({build:name,status:r.status,round:r.round,supported,committed:r.promotions.length,correct,recoveryPercent:100*correct/supported,wrong:r.promotions.filter(p=>l(p)==='wrong').length,unassessed:r.promotions.filter(p=>l(p)==='unassessed').length,provisionalCorrect,provisionalRecoveryPercent:100*provisionalCorrect/supported,provisionalNote:'Pending matches may still conflict with later queries in this round.',completedQueries:r.queries.length,pairs:r.pairs.length,calls:r.modelCalls,cacheHits:r.cacheHits,invalid:r.pairs.filter(p=>p.verdict==='invalid').length,errors:r.pairs.filter(p=>p.verdict==='error').length});
}
const compact=process.argv.includes('--compact');
console.log(JSON.stringify({checked:now(),builds:compact?rows.map(r=>Object.fromEntries(['build','status','round','correct','recoveryPercent','provisionalCorrect','completedQueries','pairs','calls','cacheHits','invalid','errors'].filter(k=>k in r).map(k=>[k,r[k]]))):rows},null,compact?0:2));
