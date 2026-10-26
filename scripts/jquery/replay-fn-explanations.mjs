import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import {output,read,write,hash,now} from './common.mjs';
import {validatorPrompt,validatorResponseSchema,parseValidationResult} from './validator-policy.mjs';
import {validatorUserMessage,settings} from './models.mjs';
const base=path.join(output,'recovery-bottlenecks/false-negatives');
const dest=path.join(base,'nonthinking-explanations');
const rows=read(path.join(base,'summary.json')).rows;
if(rows.length!==114)throw Error('Expected exactly 114 selected FN occurrences');
const manifest=read(path.join(output,'model-manifest.json'));
const server=process.env.OLLAMA_URL||'http://127.0.0.1:11434';
const tasks=rows.map((r,i)=>{
 const id='FN'+String(i+1).padStart(3,'0');
 const request={model:settings.validator,messages:[{role:'system',content:validatorPrompt},{role:'user',content:validatorUserMessage({code:r.bundleCode},{code:r.correctSourceCode})}],think:false,stream:false,keep_alive:'60m',format:validatorResponseSchema,options:{temperature:0,num_ctx:16384,num_predict:384,seed:42}};
 return {id,build:r.build,bundleId:r.bundleId,sourceId:r.sourceId,sourceName:r.sourceName,externalLibraryBindings:r.externalLibraryBindings,sourceFree:r.sourceFree,bundleFree:r.bundleFree,localComparison:r.localComparison,request,key:hash(JSON.stringify({digests:manifest.digests,request}))};
});
function chat(body){return new Promise((resolve,reject)=>{
 const url=new URL(server+'/api/chat'),client=url.protocol==='https:'?https:http;
 const req=client.request(url,{method:'POST',headers:{'Content-Type':'application/json'}},res=>{let raw='';res.setEncoding('utf8');res.on('data',x=>raw+=x);res.on('end',()=>{try{if(res.statusCode>=400)throw Error('HTTP '+res.statusCode+': '+raw.slice(0,300));resolve(JSON.parse(raw))}catch(e){reject(e)}});res.on('error',reject)});
 const timer=setTimeout(()=>req.destroy(Error('180-second timeout')),180000);req.on('close',()=>clearTimeout(timer));req.on('error',reject);req.end(JSON.stringify(body));
})}
function block(s,lang='text'){const mark='`'.repeat(Math.max(3,1+Math.max(0,...[...String(s).matchAll(/`+/g)].map(x=>x[0].length))));return `\n${mark}${lang}\n${s}\n${mark}\n\n`}
const records=[];
function exportCase(task,r){const u=JSON.parse(task.request.messages[1].content);let md=`# ${task.id}: ${task.sourceName}\n\nBuild: ${task.build}. Ground-truth source pair; historical validator rejected this pair. Thinking disabled.\n\n## Reference function\n`+block(u.reference_source,'javascript')+'## Bundled function\n'+block(u.bundled_function,'javascript')+`## New decision\n\n${typeof r.decision==='boolean'?r.decision:r.verdict}\n\n## Model explanation\n\n`+(r.explanation?block(r.explanation):r.decision===true?'No behavioral difference reported.\n\n':block(r.response?.message?.content||r.error||'No valid output.'))+'## Raw final output\n'+block(r.response?.message?.content||'','json');fs.mkdirSync(path.join(dest,'cases'),{recursive:true});fs.writeFileSync(path.join(dest,'cases',task.id+'.md'),md)}
function status(state,inProgress=null){
 const counts={accepted:records.filter(r=>r.decision===true).length,rejected:records.filter(r=>r.decision===false).length,invalid:records.filter(r=>r.verdict==='invalid').length,errors:records.filter(r=>r.verdict==='error').length};
 write(path.join(dest,'status.json'),{updated:now(),status:state,completed:records.length,total:tasks.length,inProgress,...counts,thinkingCharacters:records.reduce((n,r)=>n+(r.response?.message?.thinking?.length||0),0)});
 let md=`# Ground-truth FN replay with explanations\n\nStatus: **${state}**; ${records.length}/114 complete. Accepted: ${counts.accepted}; rejected: ${counts.rejected}; invalid: ${counts.invalid}; errors: ${counts.errors}.\n\nThinking is disabled. Each user message contains only the ground-truth reference and bundled function. The system prompt ending now requires an explanation for false decisions. Output budget: 384 tokens; temperature 0; seed 42; context 16,384. No wrong candidate pairs or recovery iterations are run. Raw requests/responses are preserved under requests/. Historical predictions are unchanged. This error-selected sample cannot measure overall precision or false-positive rate.\n\n| Case | Build | Source | Decision | Explanation |\n|---|---|---|---|---|\n`;
 for(const r of records)md+=`| [${r.id}](cases/${r.id}.md) | ${r.build} | ${r.sourceName} | ${r.decision??r.verdict} | ${(r.explanation||'').replaceAll('|','\\|').replaceAll('\n',' ')} |\n`;
 md+='\n[Analysis of rejection reasons](ANALYSIS.md) · [Targeted checks of explanation claims](checked-claims.json).\n';
 fs.writeFileSync(path.join(dest,'README.md'),md);
}
if(process.argv.includes('--export-only')){
 for(const task of tasks){const file=path.join(dest,'requests',task.id+'.json');if(fs.existsSync(file)){const r=read(file);if(r.key===task.key){records.push(r);exportCase(task,r)}}}
 status(records.length===114?'complete':'partial');process.exit(0);
}
const tags=await fetch(server+'/api/tags').then(r=>{if(!r.ok)throw Error('Cannot read model tags');return r.json()});
const name=settings.validator;
if(tags.models.find(m=>m.name===name)?.digest!==manifest.digests[name])throw Error('Validator digest changed');
write(path.join(dest,'sample.json'),{created:now(),promptVersion:'jquery-pilot-v7-functions-only-explain-false',selection:'114 ground-truth pairs whose historical correct top-three candidate was never accepted. No negative candidates or source-map identity hints in requests.',modelDigest:manifest.digests[name],server,tasks});
for(const task of tasks){
 const file=path.join(dest,'requests',task.id+'.json');let r=fs.existsSync(file)?read(file):null;
 if(!r||r.key!==task.key){status('running',task.id);console.log('START',task.id,task.build,task.sourceName,now());const start=performance.now();r={...task,started:now()};
  try{r.response=await chat(task.request);Object.assign(r,parseValidationResult(r.response.message?.content||''));if(r.response.message?.thinking)throw Error('Unexpected thinking content despite think:false')}catch(e){r.error=String(e);r.decision=null;r.verdict='error'}
  r.wallMs=performance.now()-start;r.finished=now();write(file,r);console.log('DONE',task.id,r.verdict,Math.round(r.wallMs)+'ms',r.response?.eval_count,JSON.stringify(r.explanation));
 }
 records.push(r);exportCase(task,r);status('running');
}
status('complete');write(path.join(dest,'results.json'),{created:now(),records});
