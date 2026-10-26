import fs from 'node:fs';
import path from 'node:path';
import {output,read,write,hash,now} from './common.mjs';
import {server,api} from './models.mjs';
import {verdictOnlyTFPrompt,parseTFVerdict} from './variable-mapping-policy.mjs';
const review=path.join(output,'first-positive-review'),base=path.join(review,'explanation-replay-27b'),dest=path.join(review,'verdict-only-27b-tf');
const baseline=read(path.join(base,'results.json')).records,manifest=read(path.join(base,'model-manifest.json'));
if(baseline.length!==44||baseline.some(r=>!['accept','reject'].includes(r.verdict)))throw Error('Expected completed 44-case 27B baseline');
const tasks=baseline.map(old=>{const request=structuredClone(old.request);request.messages[0].content=verdictOnlyTFPrompt(request.messages[0].content);delete request.format;return {id:old.id,build:old.build,category:old.category,wrongName:old.wrongName,correctName:old.correctName,bundleId:old.bundleId,wrongSourceId:old.wrongSourceId,correctSourceId:old.correctSourceId,baselineDecision:old.decision,baselineWallMs:old.wallMs,baselineRequestKey:old.key,request,key:hash(JSON.stringify({modelDigest:manifest.digest,request}))};});
const records=[];
const counts=rs=>({accepted:rs.filter(r=>r.decision===true).length,rejected:rs.filter(r=>r.decision===false).length,invalid:rs.filter(r=>r.verdict==='invalid').length,errors:rs.filter(r=>r.verdict==='error').length});
function timing(rs){const xs=rs.map(r=>r.wallMs),sorted=[...xs].sort((a,b)=>a-b),q=p=>sorted.length?sorted[Math.floor((sorted.length-1)*p)]:null;return {calls:rs.length,totalWallMs:xs.reduce((a,b)=>a+b,0),medianWallMs:q(.5),p95WallMs:q(.95),firstCallWallMs:xs[0]??null,outputTokens:rs.reduce((n,r)=>n+(r.response?.eval_count||0),0),loadMs:rs.reduce((n,r)=>n+(r.response?.load_duration||0)/1e6,0),promptTokens:rs.reduce((n,r)=>n+(r.response?.prompt_eval_count||0),0),cachedPromptTokens:rs.reduce((n,r)=>n+(r.response?.prompt_eval_cached_count||0),0)};}
function updateCase(r){
 const file=path.join(review,r.id+'.md'),marker='<!-- verdict-only-27b-tf:start -->',existing=fs.readFileSync(file,'utf8'),laterMarker='<!-- remaining-27b-tf-analysis:start -->';
 const later=existing.includes(laterMarker)?'\n'+existing.slice(existing.indexOf(laterMarker)):'';
 const original=existing.split(marker)[0].trimEnd();
 const text='\n\n'+marker+'\n## Qwen3.5 27B: T/F only\n\nThinking off. Mapping and behavior-check instructions retained, but no mapping or explanation is generated. Only T or F is requested. Model, function inputs, temperature, seed, context and maximum output budget are unchanged.\n\n**With mapping/explanation:** '+r.baselineDecision+'. **T/F-only decision:** '+(r.decision??r.verdict)+'.\n\n**Observed API time:** mapping/explanation '+(r.baselineWallMs/1000).toFixed(3)+' s; T/F only '+(r.wallMs/1000).toFixed(3)+' s.\n\n**Raw output:**\n\n```text\n'+(r.response?.message?.content||r.error||'')+'\n```\n\n[Exact request and raw response](verdict-only-27b-tf/requests/'+r.id+'.json). Output tokens: '+(r.response?.eval_count??'unavailable')+'.\n<!-- verdict-only-27b-tf:end -->\n';
 fs.writeFileSync(file,original+text+later);
}
function save(state,inProgress=null){
 const previous=baseline.filter(b=>records.some(r=>r.id===b.id)),before=counts(previous),after=counts(records),t0=timing(previous),t1=timing(records);
 const transitions={acceptedToRejected:records.filter(r=>r.baselineDecision===true&&r.decision===false).length,rejectedToAccepted:records.filter(r=>r.baselineDecision===false&&r.decision===true).length,acceptedToAccepted:records.filter(r=>r.baselineDecision===true&&r.decision===true).length,rejectedToRejected:records.filter(r=>r.baselineDecision===false&&r.decision===false).length};
 const byCategory=Object.fromEntries([...new Set(baseline.map(r=>r.category))].map(c=>[c,{total:baseline.filter(r=>r.category===c).length,completed:records.filter(r=>r.category===c).length,withMapping:counts(previous.filter(r=>r.category===c)),tfOnly:counts(records.filter(r=>r.category===c))}]));
 const summary={updated:now(),status:state,total:44,completed:records.length,inProgress,model:manifest.model,withMapping:before,tfOnly:after,transitions,byCategory,timingWithMapping:t0,timingTFOnly:t1,medianSpeedup:t1.medianWallMs?t0.medianWallMs/t1.medianWallMs:null,totalSpeedup:t1.totalWallMs?t0.totalWallMs/t1.totalWallMs:null,thinkingCharacters:records.reduce((n,r)=>n+(r.response?.message?.thinking?.length||0),0),uniqueRequestKeys:new Set(records.map(r=>r.key)).size,scope:'Same selected 44 source-distinct pairs. Request only T/F, without JSON schema, mapping or explanation output. Retain mapping/check instructions and source keys; no internal mapping is returned or verified. No recovery iteration or overall-accuracy estimate.'};
 write(path.join(dest,'status.json'),summary);write(path.join(dest,'results.json'),{created:now(),summary,records});if(state==='complete')write(path.join(dest,'summary.json'),summary);
 const sec=x=>x==null?'—':(x/1000).toFixed(3)+' s';
 let md='# Qwen3.5 27B: T/F output only\n\nStatus: **'+state+'**, '+records.length+'/44 complete.\n\nSame 44 function pairs and model digest as the completed 27B mapping-plus-explanation diagnostic. Thinking off, temperature 0, seed 42, context 16,384 and maximum output budget 384 are unchanged. The mapping and behavior-check instructions and source keys remain. The output contract changes to a single literal T or F, with no JSON schema, quotes, mapping or explanation. This does not generate a mapping and hide it; no intermediate mapping or reasoning trace is returned or verified. No correct identities or human findings are included in the requests.\n\n';
 md+='| Metric | Mapping + explanation | T/F only |\n|---|---:|---:|\n';
 for(const name of ['accepted','rejected','invalid','errors'])md+='| '+name+' | '+before[name]+' | '+after[name]+' |\n';
 for(const [label,key] of [['Total request wall time','totalWallMs'],['Median per request','medianWallMs'],['P95 per request','p95WallMs'],['First request','firstCallWallMs'],['Reported loading time, summed','loadMs']])md+='| '+label+' | '+sec(t0[key])+' | '+sec(t1[key])+' |\n';
 md+='| Total output tokens | '+t0.outputTokens+' | '+t1.outputTokens+' |\n';
 md+='\nPreviously accepted → now rejected: '+transitions.acceptedToRejected+'; previously rejected → now accepted: '+transitions.rejectedToAccepted+'. These are selected source-identity negatives, not overall semantic accuracy or precision. Latency compares saved mapping/explanation calls with fresh T/F calls; loading, prompt caching and system load can affect observed speed.\n\n';
 md+='## Category comparison\n\n| Category | Completed | Mapping/explanation rejected | T/F rejected |\n|---|---:|---:|---:|\n';
 for(const [name,c]of Object.entries(byCategory))md+='| '+name+' | '+c.completed+'/'+c.total+' | '+c.withMapping.rejected+' | '+c.tfOnly.rejected+' |\n';
 md+='\n## Individual cases\n\n| Case | Wrong reference | Mapping/explanation verdict | T/F verdict | Previous time | T/F time | Raw output |\n|---|---|---|---|---:|---:|---|\n';
 for(const r of records)md+='| ['+r.id+'](../'+r.id+'.md) | '+r.wrongName+' | '+r.baselineDecision+' | '+(r.decision??r.verdict)+' | '+sec(r.baselineWallMs)+' | '+sec(r.wallMs)+' | '+JSON.stringify(r.response?.message?.content||r.error||'').replaceAll('|','\\|')+' |\n';
 md+='\n[Exact requests and prompt](sample.json), [raw results](results.json), [model metadata](model-manifest.json), [previous 27B run](../explanation-replay-27b/REPORT.md). Full recovery remains stopped.\n';
 fs.writeFileSync(path.join(dest,'REPORT.md'),md);
 const index=path.join(review,'README.md'),marker='<!-- verdict-only-27b-tf-summary:start -->',original=fs.readFileSync(index,'utf8').split(marker)[0].trimEnd();
 fs.writeFileSync(index,original+'\n\n'+marker+'\n## 27B T/F-only diagnostic\n\n[T/F-only verdicts and latency comparison](verdict-only-27b-tf/REPORT.md): '+records.length+'/44 complete; accepted '+after.accepted+', rejected '+after.rejected+', invalid '+after.invalid+', errors '+after.errors+'. All previous outputs remain preserved.\n<!-- verdict-only-27b-tf-summary:end -->\n');
}
if(process.argv.includes('--export-only')){for(const task of tasks){const file=path.join(dest,'requests',task.id+'.json');if(fs.existsSync(file)){const r=read(file);if(r.key===task.key){records.push(r);updateCase(r)}}}save(records.length===44?'complete':'partial');process.exit(0);}
const tags=await fetch(server+'/api/tags').then(r=>{if(!r.ok)throw Error('Cannot read model tags');return r.json()});
if(tags.models.find(m=>m.name===manifest.model)?.digest!==manifest.digest)throw Error('27B model digest changed');
write(path.join(dest,'model-manifest.json'),{created:now(),...manifest,verifiedAt:now(),protocol:'T/F only, thinking off; identical deployment digest'});
write(path.join(dest,'sample.json'),{created:now(),promptVersion:'jquery-pilot-v8-review-27b-tf-only',model:manifest.model,digest:manifest.digest,baselineResultsHash:hash(fs.readFileSync(path.join(base,'results.json'))),tasks});
for(const task of tasks){const file=path.join(dest,'requests',task.id+'.json');let r=fs.existsSync(file)?read(file):null;
 if(!r||r.key!==task.key){save('running',task.id);console.log('START',task.id,now());r={...task,modelDigest:manifest.digest,started:now()};const start=performance.now();
  try{const result=await api('chat',task.request);Object.assign(r,result,parseTFVerdict(result.response.message?.content||''));if(result.response.message?.thinking)throw Error('Unexpected thinking text')}
  catch(error){r.error=String(error);r.decision=null;r.verdict='error'}
  r.wallMs=performance.now()-start;r.finished=now();write(file,r);console.log('DONE',task.id,r.verdict,Math.round(r.wallMs)+'ms',JSON.stringify(r.response?.message?.content),r.response?.eval_count);
 }
 records.push(r);updateCase(r);save('running');
}
save('complete');
