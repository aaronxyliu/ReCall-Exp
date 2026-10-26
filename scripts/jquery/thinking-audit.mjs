import fs from 'node:fs';
import path from 'node:path';
import {api,settings} from './models.mjs';
import {output,read,write,hash,now} from './common.mjs';
const folder=path.join(output,'thinking-diagnostic');fs.mkdirSync(folder,{recursive:true});
const truth=new Map(read(path.join(output,'ground-truth.json')).records.map(g=>[g.bundleId,g]));
const recovery=read(path.join(output,'calibration-nonthinking-v3/recovery/esbuild-readable-keep.json'));
const label=p=>{const g=truth.get(p.bundleId);return g?.nonTarget?'wrong':!g?.sourceId?'unassessed':g.sourceId===p.sourceId?'correct':'wrong'};
const batches=new Map();for(const pair of recovery.pairs){if(!batches.has(pair.requestKey))batches.set(pair.requestKey,[]);batches.get(pair.requestKey).push(pair)}
const groups=[['accepted-wrong-identity',4,pairs=>pairs.some(p=>p.verdict==='accept'&&label(p)==='wrong')],['accepted-correct-identity',3,pairs=>pairs.some(p=>p.verdict==='accept'&&label(p)==='correct')&&!pairs.some(p=>p.verdict==='accept'&&label(p)==='wrong')],['all-uncertain',2,pairs=>pairs.every(p=>p.verdict==='uncertain')],['other',1,()=>true]];
let selected;const sampleFile=path.join(folder,'sample.json');
if(fs.existsSync(sampleFile))selected=read(sampleFile).batches;
else{selected=[];const used=new Set();for(const [stratum,count,predicate] of groups){const candidates=[...batches].filter(([key,pairs])=>!used.has(key)&&predicate(pairs)).sort((a,b)=>hash(a[0]).localeCompare(hash(b[0]))).slice(0,count);for(const [requestKey,pairs] of candidates){used.add(requestKey);selected.push({stratum,requestKey,pairs:pairs.map(p=>({...p,oracle:label(p)}))})}}write(sampleFile,{created:now(),selection:'Fixed stratified diagnostic, enriched for observed non-thinking identity errors; not an unbiased precision/FPR estimate. Selected before thinking outputs were observed. No prompt tuning from these results.',model:settings.validator,thinking:true,num_predict:1536,batches:selected})}
const results=[];
for(const item of selected){const file=path.join(folder,item.requestKey+'.json');let record;if(fs.existsSync(file))record=read(file);else{
 const baseline=read(path.join(output,'model-cache/validations',item.requestKey+'.json'));
 const request={...baseline.request,think:true,options:{...baseline.request.options,num_predict:1536}};
 const start=now();try{const response=await api('chat',request);let decoded;try{decoded=JSON.parse(response.response.message?.content||'')}catch{}const valid=Array.isArray(decoded)&&decoded.length===item.pairs.length&&decoded.every(v=>['accept','reject','uncertain'].includes(v));record={started:start,finished:now(),requestKey:item.requestKey,stratum:item.stratum,request,...response,verdicts:valid?decoded:item.pairs.map(()=>'invalid')};}catch(error){record={started:start,finished:now(),requestKey:item.requestKey,stratum:item.stratum,request,error:String(error),verdicts:item.pairs.map(()=>'error')}}write(file,record)}
 results.push({...item,thinkingVerdicts:record.verdicts,wallMs:record.wallMs,tokens:record.response?.eval_count,doneReason:record.response?.done_reason});write(path.join(folder,'results.json'),{created:now(),status:results.length===selected.length?'complete':'running',selection:read(sampleFile).selection,results});console.log('thinking diagnostic',results.length,'/',selected.length,item.stratum,record.verdicts,Math.round(record.wallMs||0)+'ms',record.response?.eval_count+' tokens');
}
const pairs=results.flatMap(r=>r.pairs.map((p,i)=>({...p,thinkingVerdict:r.thinkingVerdicts[i]})));
const stats=key=>{const accepted=pairs.filter(p=>p[key]==='accept');const correct=accepted.filter(p=>p.oracle==='correct').length,wrong=accepted.filter(p=>p.oracle==='wrong').length;return {pairs:pairs.length,accepted:accepted.length,correctAccepted:correct,wrongAccepted:wrong,unassessedAccepted:accepted.length-correct-wrong,conditionalAcceptedIdentityPrecision:correct+wrong?100*correct/(correct+wrong):null,uncertain:pairs.filter(p=>p[key]==='uncertain').length,invalid:pairs.filter(p=>p[key]==='invalid').length,errors:pairs.filter(p=>p[key]==='error').length}};
write(path.join(folder,'summary.json'),{created:now(),selection:read(sampleFile).selection,nonThinking:stats('verdict'),thinking:stats('thinkingVerdict'),pairs});
