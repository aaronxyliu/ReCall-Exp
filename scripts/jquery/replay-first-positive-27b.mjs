import fs from 'node:fs';
import path from 'node:path';
import {output,read,write,hash,now} from './common.mjs';
import {server,api} from './models.mjs';
import {parseMappingExplainAllResult} from './variable-mapping-policy.mjs';
const model='qwen3.5:27b';
const review=path.join(output,'first-positive-review'),base=path.join(review,'explanation-replay'),dest=path.join(review,'explanation-replay-27b');
const baseline=read(path.join(base,'results.json')).records;
if(baseline.length!==44||baseline.some(r=>!['accept','reject'].includes(r.verdict)))throw Error('Expected completed 44-case 4B explanation baseline');
const records=[];
const quantile=(xs,p)=>{const a=xs.filter(Number.isFinite).sort((a,b)=>a-b);return a.length?a[Math.floor((a.length-1)*p)]:null};
function timing(rs){const times=rs.map(r=>r.wallMs);return {calls:rs.length,totalWallMs:times.reduce((a,b)=>a+b,0),medianWallMs:quantile(times,.5),p95WallMs:quantile(times,.95),firstCallWallMs:times[0]??null,medianAfterFirstMs:quantile(times.slice(1),.5),outputTokens:rs.reduce((n,r)=>n+(r.response?.eval_count||0),0),loadMs:rs.reduce((n,r)=>n+(r.response?.load_duration||0)/1e6,0),promptTokens:rs.reduce((n,r)=>n+(r.response?.prompt_eval_count||0),0),cachedPromptTokens:rs.reduce((n,r)=>n+(r.response?.prompt_eval_cached_count||0),0)};}
function counts(rs){return {accepted:rs.filter(r=>r.decision===true).length,rejected:rs.filter(r=>r.decision===false).length,invalid:rs.filter(r=>r.verdict==='invalid').length,errors:rs.filter(r=>r.verdict==='error').length};}
function updateCase(r){
 const file=path.join(review,r.id+'.md'),marker='<!-- explanation-replay-27b:start -->';
 const existing=fs.readFileSync(file,'utf8'),laterMarker='<!-- verdict-only-27b-tf:start -->';
 const later=existing.includes(laterMarker)?'\n'+existing.slice(existing.indexOf(laterMarker)):'';
 const original=existing.split(marker)[0].trimEnd();
 let text='\n\n'+marker+'\n## Qwen3.5 27B comparison\n\n';
 text+='Same request as the 4B explanation replay except model=qwen3.5:27b. Thinking off; output limit 384 tokens.\n\n';
 text+='**4B decision:** '+r.baselineDecision+'. **27B decision:** '+(r.decision??r.verdict)+'.\n\n';
 text+='**Observed API time:** 4B '+(r.baselineWallMs/1000).toFixed(3)+' s; 27B '+(r.wallMs/1000).toFixed(3)+' s. These are measurements from separate runs, including request overhead and any loading.\n\n';
 if(r.explanation)text+='**27B explanation:**\n\n> '+r.explanation.replaceAll('\n','\n> ')+'\n\n';
 text+='**Full 27B output (unedited):**\n\n```json\n'+(r.response?.message?.content||r.error||'')+'\n```\n\n';
 text+='[Exact 27B request and response](explanation-replay-27b/requests/'+r.id+'.json). Generation exit: '+(r.response?.done_reason||'error')+'; output tokens: '+(r.response?.eval_count??'unavailable')+'.\n<!-- explanation-replay-27b:end -->\n';
 fs.writeFileSync(file,original+text+later);
}
function save(state,inProgress=null){
 const previous=baseline.filter(b=>records.some(r=>r.id===b.id));
 const transitions={trueToTrue:records.filter(r=>r.baselineDecision===true&&r.decision===true).length,trueToFalse:records.filter(r=>r.baselineDecision===true&&r.decision===false).length,falseToTrue:records.filter(r=>r.baselineDecision===false&&r.decision===true).length,falseToFalse:records.filter(r=>r.baselineDecision===false&&r.decision===false).length};
 const byCategory=Object.fromEntries([...new Set(baseline.map(r=>r.category))].map(c=>[c,{total:baseline.filter(r=>r.category===c).length,completed:records.filter(r=>r.category===c).length,model4b:counts(previous.filter(r=>r.category===c)),model27b:counts(records.filter(r=>r.category===c))}]));
 const t4=timing(previous),t27=timing(records);
 const summary={updated:now(),status:state,total:44,completed:records.length,inProgress,model,model4b:counts(previous),model27b:counts(records),transitions,byCategory,timing4b:t4,timing27b:t27,medianLatencyRatio:t4.medianWallMs?t27.medianWallMs/t4.medianWallMs:null,totalLatencyRatio:t4.totalWallMs?t27.totalWallMs/t4.totalWallMs:null,thinkingCharacters:records.reduce((n,r)=>n+(r.response?.message?.thinking?.length||0),0),uniqueRequestKeys:new Set(records.map(r=>r.key)).size,scope:'Selected 44 previously accepted source-distinct pairs. Rejection rate is not overall semantic accuracy. Same prompts and settings except model alias; historical 4B timing versus fresh 27B timing is observational, not a controlled runtime benchmark. No recovery iteration.'};
 write(path.join(dest,'status.json'),summary);write(path.join(dest,'results.json'),{created:now(),summary,records});
 if(state==='complete')write(path.join(dest,'summary.json'),summary);
 let md='# Qwen3.5 27B versus 4B on the 44 reviewed pairs\n\nStatus: **'+state+'**, '+records.length+'/44 complete.\n\nThe two function inputs, system prompt, complete mapping schema, explanation requirement for both verdicts, thinking off, temperature 0, seed 42, context 16,384, and 384-token output budget are identical. Only the model alias changes. The correct source function and human findings are not sent to either model. Original results are preserved, with a 27B section appended to each review file. The full recovery experiment remains stopped.\n\n';
 md+='## Verdicts\n\n| Metric | 4B | 27B |\n|---|---:|---:|\n';
 for(const name of ['accepted','rejected','invalid','errors'])md+='| '+name+' | '+summary.model4b[name]+' | '+summary.model27b[name]+' |\n';
 md+='\n4B true → 27B false: '+transitions.trueToFalse+'; 4B false → 27B true: '+transitions.falseToTrue+'. Source-distinct pairs were selected for prior mistakes; these are not overall precision, recall, or unrestricted semantic-accuracy estimates.\n\n';
 md+='## Observed execution time\n\n| Metric | 4B | 27B |\n|---|---:|---:|\n';
 const format=v=>v==null?'—':(v/1000).toFixed(3)+' s';
 for(const [name,key] of [['Total API request wall time','totalWallMs'],['Median per request','medianWallMs'],['P95 per request','p95WallMs'],['First request','firstCallWallMs'],['Median excluding first request','medianAfterFirstMs'],['Reported loading time, summed','loadMs']])md+='| '+name+' | '+format(t4[key])+' | '+format(t27[key])+' |\n';
 md+='| Generated tokens, total | '+t4.outputTokens+' | '+t27.outputTokens+' |\n';
 md+='\nThese are historical 4B calls versus fresh 27B calls on the same cases, not randomized interleaved measurements. Runtime, quantization, model loading, prompt caches, output length, and system load can affect latency. Repeated identical requests across build occurrences are not independent observations. Full load/prefill/generation timing fields and model metadata are retained.\n\n';
 md+='## By human-reviewed category\n\n| Category | Completed | 4B rejected | 27B rejected |\n|---|---:|---:|---:|\n';
 for(const [c,s] of Object.entries(byCategory))md+='| '+c+' | '+s.completed+'/'+s.total+' | '+s.model4b.rejected+' | '+s.model27b.rejected+' |\n';
 md+='\n## Individual cases\n\n| Case | Wrong reference | 4B verdict | 27B verdict | 4B time | 27B time | 27B explanation |\n|---|---|---|---|---:|---:|---|\n';
 for(const r of records)md+='| ['+r.id+'](../'+r.id+'.md) | '+r.wrongName+' | '+r.baselineDecision+' | '+(r.decision??r.verdict)+' | '+format(r.baselineWallMs)+' | '+format(r.wallMs)+' | '+(r.explanation||r.error||'No valid complete output').replaceAll('|','\\|').replaceAll('\n',' ')+' |\n';
 md+='\n[Exact requests](sample.json), [raw results](results.json), [model metadata](model-manifest.json), [4B diagnostic](../explanation-replay/REPORT.md), [review index](../README.md).\n';
 fs.writeFileSync(path.join(dest,'REPORT.md'),md);
 const index=path.join(review,'README.md'),marker='<!-- explanation-replay-27b-summary:start -->';
 const existing=fs.readFileSync(index,'utf8'),laterMarker='<!-- verdict-only-27b-tf-summary:start -->';
 const later=existing.includes(laterMarker)?'\n'+existing.slice(existing.indexOf(laterMarker)):'';
 const original=existing.split(marker)[0].trimEnd();
 fs.writeFileSync(index,original+'\n\n'+marker+'\n## Qwen3.5 27B diagnostic\n\n[27B versus 4B verdicts and execution time](explanation-replay-27b/REPORT.md): '+records.length+'/44 complete; 27B accepted '+summary.model27b.accepted+', rejected '+summary.model27b.rejected+', invalid '+summary.model27b.invalid+', errors '+summary.model27b.errors+'. Original and 4B diagnostic outputs remain intact. Full recovery remains stopped.\n<!-- explanation-replay-27b-summary:end -->\n'+later);
}
if(process.argv.includes('--export-only')){
 for(const old of baseline){const file=path.join(dest,'requests',old.id+'.json');if(fs.existsSync(file)){const r=read(file);records.push(r);updateCase(r)}}save(records.length===44?'complete':'partial');process.exit(0);
}
const tags=await fetch(server+'/api/tags').then(r=>{if(!r.ok)throw Error('Cannot read local model tags');return r.json()});
const item=tags.models.find(m=>m.name===model);if(!item)throw Error('Required local model missing: '+model);
const [show,version]=await Promise.all([api('show',{model}),fetch(server+'/api/version').then(r=>r.json())]);
write(path.join(dest,'model-manifest.json'),{created:now(),server,model,digest:item.digest,tag:item,show:show.response,serverVersion:version,baselineModelManifest:read(path.join(output,'model-manifest.json'))});
const tasks=baseline.map(old=>{const request=structuredClone(old.request);request.model=model;const original=structuredClone(request);original.model=old.request.model;if(JSON.stringify(original)!==JSON.stringify(old.request))throw Error('Non-model request field changed');return {id:old.id,build:old.build,category:old.category,bundleId:old.bundleId,wrongSourceId:old.wrongSourceId,wrongName:old.wrongName,correctSourceId:old.correctSourceId,correctName:old.correctName,requiredVariables:old.requiredVariables,baselineDecision:old.decision,baselineWallMs:old.wallMs,baselineRequestKey:old.key,baselineRequest:old.request,request,key:hash(JSON.stringify({modelDigest:item.digest,request}))};});
write(path.join(dest,'sample.json'),{created:now(),model,digest:item.digest,promptVersion:'jquery-pilot-v8-review-explain-both-verdicts',selection:'Same 44 wrong-reference pairs as the 4B explanation diagnostic. Only the model field changes.',baselineResultsHash:hash(fs.readFileSync(path.join(base,'results.json'))),tasks});
for(const task of tasks){
 const file=path.join(dest,'requests',task.id+'.json');let r=fs.existsSync(file)?read(file):null;
 if(!r||r.key!==task.key){save('running',task.id);console.log('START',task.id,now());r={id:task.id,build:task.build,category:task.category,wrongName:task.wrongName,correctName:task.correctName,bundleId:task.bundleId,wrongSourceId:task.wrongSourceId,correctSourceId:task.correctSourceId,baselineDecision:task.baselineDecision,baselineWallMs:task.baselineWallMs,baselineRequestKey:task.baselineRequestKey,requiredVariables:task.requiredVariables,modelDigest:item.digest,key:task.key,request:task.request,started:now()};const start=performance.now();
  try{const result=await api('chat',task.request);Object.assign(r,result,parseMappingExplainAllResult(result.response.message?.content||'',task.requiredVariables));if(result.response.message?.thinking)throw Error('Unexpected thinking text')}
  catch(error){r.error=String(error);r.decision=null;r.verdict='error'}
  r.wallMs=performance.now()-start;r.finished=now();write(file,r);console.log('DONE',task.id,r.verdict,Math.round(r.wallMs)+'ms',r.response?.done_reason,r.response?.eval_count);
 }
 records.push(r);updateCase(r);save('running');
}
save('complete');
