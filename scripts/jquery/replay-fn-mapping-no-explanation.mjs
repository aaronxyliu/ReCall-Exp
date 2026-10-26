import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import {output,read,write,hash,now} from './common.mjs';
const base=path.join(output,'recovery-bottlenecks/false-negatives');
const visible=path.join(base,'short-variable-mapping-replay');
const dest=path.join(base,'short-mapping-no-explanation-replay');
const baseline=read(path.join(visible,'results.json')).records;
if(baseline.length!==114)throw Error('Expected 114 matched cases');
const digest=read(path.join(visible,'sample.json')).modelDigest;
const server=process.env.OLLAMA_URL||'http://127.0.0.1:11434';
const tasks=baseline.map(old=>{
 const request=structuredClone(old.request);
 const oldEnding='Use one compact source-to-bundled mapping object. For false, briefly identify the concrete difference and relevant variables. For true, explanation must be "".';
 if(!request.messages[0].content.includes(oldEnding))throw Error('Unexpected prompt ending');
 request.messages[0].content=request.messages[0].content.replace('{"variable_mapping": {...}, "equivalent": <boolean>, "explanation": "<string>"}','{"variable_mapping": {...}, "equivalent": <boolean>}').replace(oldEnding,'Use one compact source-to-bundled mapping object. Do not output an explanation.');
 delete request.format.properties.explanation;
 request.format.required=request.format.required.filter(k=>k!=='explanation');
 return {id:old.id,build:old.build,bundleId:old.bundleId,sourceId:old.sourceId,sourceName:old.sourceName,requiredVariables:old.requiredVariables,baselineDecision:old.decision,baselineWallMs:old.wallMs,baselineOutputTokens:old.response.eval_count,request,key:hash(JSON.stringify({digest,request}))};
});
function parse(content,task){
 let value;try{value=JSON.parse(content)}catch{}
 const mapping=value?.variable_mapping,keys=task.requiredVariables.map(v=>v.key);
 const valid=value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===2&&typeof value.equivalent==='boolean'&&mapping&&typeof mapping==='object'&&!Array.isArray(mapping)&&Object.keys(mapping).length===keys.length&&keys.every(k=>Object.hasOwn(mapping,k)&&(typeof mapping[k]==='string'||mapping[k]===null));
 return valid?{decision:value.equivalent,verdict:value.equivalent?'accept':'reject',variableMapping:mapping}:{decision:null,verdict:'invalid',variableMapping:mapping??null};
}
function chat(body){return new Promise((resolve,reject)=>{
 const url=new URL(server+'/api/chat'),client=url.protocol==='https:'?https:http;
 const req=client.request(url,{method:'POST',headers:{'Content-Type':'application/json'}},res=>{let raw='';res.setEncoding('utf8');res.on('data',x=>raw+=x);res.on('end',()=>{try{if(res.statusCode>=400)throw Error('HTTP '+res.statusCode+': '+raw.slice(0,300));resolve(JSON.parse(raw))}catch(e){reject(e)}});res.on('error',reject)});
 const timer=setTimeout(()=>req.destroy(Error('180-second timeout')),180000);req.on('close',()=>clearTimeout(timer));req.on('error',reject);req.end(JSON.stringify(body));
})}
const records=[];
function code(s,lang){const mark='`'.repeat(Math.max(3,1+Math.max(0,...[...s.matchAll(/`+/g)].map(x=>x[0].length))));return '\n'+mark+lang+'\n'+s+'\n'+mark+'\n\n'}
function exportCase(r){const u=JSON.parse(r.request.messages[1].content);fs.mkdirSync(path.join(dest,'cases'),{recursive:true});fs.writeFileSync(path.join(dest,'cases',r.id+'.md'),`# ${r.id}: ${r.sourceName}\n\nPrevious decision (mapping + explanation): ${r.baselineDecision}. Mapping-only decision: ${r.decision??r.verdict}. Thinking off.\n\n## Source\n`+code(u.reference_source,'javascript')+'## Bundled\n'+code(u.bundled_function,'javascript')+'## Model output (unedited)\n'+code(r.response?.message?.content||r.error||'','json'))}
function status(state,inProgress=null){
 const counts={accepted:records.filter(r=>r.decision===true).length,rejected:records.filter(r=>r.decision===false).length,invalid:records.filter(r=>r.verdict==='invalid').length,errors:records.filter(r=>r.verdict==='error').length};
 const transitions={trueToTrue:records.filter(r=>r.baselineDecision===true&&r.decision===true).length,trueToFalse:records.filter(r=>r.baselineDecision===true&&r.decision===false).length,falseToTrue:records.filter(r=>r.baselineDecision===false&&r.decision===true).length,falseToFalse:records.filter(r=>r.baselineDecision===false&&r.decision===false).length};
 const byBuild=Object.fromEntries([...new Set(tasks.map(t=>t.build))].map(b=>{const rs=records.filter(r=>r.build===b);return [b,{completed:rs.length,total:tasks.filter(t=>t.build===b).length,accepted:rs.filter(r=>r.decision===true).length,rejected:rs.filter(r=>r.decision===false).length,baselineAccepted:baseline.filter(r=>r.build===b&&r.decision===true).length}]}));
 const summary={updated:now(),status:state,completed:records.length,total:114,inProgress,...counts,acceptanceOfAll114Percent:100*counts.accepted/114,thinkingCharacters:records.reduce((n,r)=>n+(r.response?.message?.thinking?.length||0),0),transitions,byBuild};write(path.join(dest,'status.json'),summary);if(state==='complete')write(path.join(dest,'summary.json'),summary);
 let md=`# Mapping output without explanation\n\nStatus: **${state}**; ${records.length}/114 complete. Accepted: ${counts.accepted}; rejected: ${counts.rejected}; invalid: ${counts.invalid}; errors: ${counts.errors}.\n\nCompared with the 105/114 mapping-plus-explanation baseline, only the explanation-related output instructions and schema field are removed. The variable-mapping field, required source keys, mapping/behavior-check instructions, function inputs, model digest, thinking off, temperature 0, seed 42, context 16,384 and 384-token output limit are preserved. Each response must contain a complete variable_mapping and an equivalent boolean. No negative candidates or recovery iterations are evaluated. Acceptance on source-linked pairs is not unrestricted semantic accuracy or overall precision; FN103 has an independently documented browser edge case.\n\n| Build | Completed | Accepted | Rejected | Baseline accepted |\n|---|---:|---:|---:|---:|\n`;
 for(const [b,v] of Object.entries(byBuild))md+=`| ${b} | ${v.completed}/${v.total} | ${v.accepted} | ${v.rejected} | ${v.baselineAccepted} |\n`;
 md+='\n## Cases\n\n| Case | Build | Source | Baseline decision | Mapping-only decision |\n|---|---|---|---|---|\n';for(const r of records)md+=`| [${r.id}](cases/${r.id}.md) | ${r.build} | ${r.sourceName} | ${r.baselineDecision} | ${r.decision??r.verdict} |\n`;
 md+='\n[Comparison analysis](ANALYSIS.md), [exact requests/settings](sample.json), [raw responses](results.json).\n';fs.writeFileSync(path.join(dest,'REPORT.md'),md);
}
if(process.argv.includes('--export-only')){for(const task of tasks){const f=path.join(dest,'requests',task.id+'.json');if(fs.existsSync(f)){const r=read(f);if(r.key===task.key){records.push(r);exportCase(r)}}}status(records.length===114?'complete':'partial');process.exit(0)}
const tags=await fetch(server+'/api/tags').then(r=>{if(!r.ok)throw Error('Cannot read local model tags');return r.json()});if(tags.models.find(m=>m.name===tasks[0].request.model)?.digest!==digest)throw Error('Model digest changed');
write(path.join(dest,'sample.json'),{created:now(),promptVersion:'short-full-variable-mapping-no-explanation',comparison:'Remove only explanation field/instructions from explicit full-mapping baseline. All other settings, user messages, variable keys and mapping schema remain unchanged.',modelDigest:digest,server,tasks});
for(const task of tasks){const f=path.join(dest,'requests',task.id+'.json');let r=fs.existsSync(f)?read(f):null;
 if(!r||r.key!==task.key){status('running',task.id);console.log('START',task.id,now());const start=performance.now();r={...task,started:now()};try{r.response=await chat(task.request);Object.assign(r,parse(r.response.message?.content||'',task));if(r.response.message?.thinking)throw Error('Unexpected thinking output')}catch(e){r.error=String(e);r.decision=null;r.verdict='error'}r.wallMs=performance.now()-start;r.finished=now();write(f,r);console.log('DONE',task.id,r.verdict,Math.round(r.wallMs)+'ms',r.response?.eval_count)}records.push(r);exportCase(r);status('running');
}
status('complete');write(path.join(dest,'results.json'),{created:now(),records});
