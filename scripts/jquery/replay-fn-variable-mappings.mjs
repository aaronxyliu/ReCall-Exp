import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import {output,read,write,hash,now} from './common.mjs';
import {sourceVariableKeys,mappingPrompt,mappingSchema,parseMappingResult} from './variable-mapping-policy.mjs';
const base=path.join(output,'recovery-bottlenecks/false-negatives');
const dest=path.join(base,'short-variable-mapping-replay');
const rows=read(path.join(base,'summary.json')).rows;
if(rows.length!==114)throw Error('Expected 114 fixed historical FN cases');
const baseline=read(path.join(base,'nonthinking-explanations/results.json')).records;
const template=read(path.join(base,'nonthinking-explanations/short-variable-mappings-FN022/request.json'));
const digest=read(path.join(base,'nonthinking-explanations/sample.json')).modelDigest;
const server=process.env.OLLAMA_URL||'http://127.0.0.1:11434';
const tasks=rows.map((r,i)=>{
 const id='FN'+String(i+1).padStart(3,'0'),variables=sourceVariableKeys(r.correctSourceCode),keys=variables.map(v=>v.key);
 const request=structuredClone(template);request.messages=[{role:'system',content:mappingPrompt(keys)},{role:'user',content:JSON.stringify({reference_source:r.correctSourceCode,bundled_function:r.bundleCode})}];request.format=mappingSchema(keys);
 return {id,build:r.build,bundleId:r.bundleId,sourceId:r.sourceId,sourceName:r.sourceName,externalLibraryBindings:r.externalLibraryBindings,requiredVariables:variables,baselineDecision:baseline.find(x=>x.id===id).decision,request,key:hash(JSON.stringify({digest,request}))};
});
function chat(body){return new Promise((resolve,reject)=>{
 const url=new URL(server+'/api/chat'),client=url.protocol==='https:'?https:http;
 const req=client.request(url,{method:'POST',headers:{'Content-Type':'application/json'}},res=>{let raw='';res.setEncoding('utf8');res.on('data',x=>raw+=x);res.on('end',()=>{try{if(res.statusCode>=400)throw Error('HTTP '+res.statusCode+': '+raw.slice(0,300));resolve(JSON.parse(raw))}catch(e){reject(e)}});res.on('error',reject)});
 const timer=setTimeout(()=>req.destroy(Error('180-second timeout')),180000);req.on('close',()=>clearTimeout(timer));req.on('error',reject);req.end(JSON.stringify(body));
})}
function code(s,language='text'){const fence='`'.repeat(Math.max(3,1+Math.max(0,...[...String(s).matchAll(/`+/g)].map(x=>x[0].length))));return `\n${fence}${language}\n${s}\n${fence}\n\n`}
const records=[];
function exportCase(task,r){const u=JSON.parse(task.request.messages[1].content);let md=`# ${task.id}: ${task.sourceName}\n\nBuild: ${task.build}. Thinking disabled. Required variable names are extracted only from the supplied source; no candidate mapping is supplied to the model.\n\n## Reference\n`+code(u.reference_source,'javascript')+'## Bundled\n'+code(u.bundled_function,'javascript')+'## Model output (unedited)\n'+code(r.response?.message?.content||r.error||'','json');md+=`Elapsed: ${(r.wallMs/1000).toFixed(2)} seconds. Verdict: ${r.verdict}.\n`;fs.mkdirSync(path.join(dest,'cases'),{recursive:true});fs.writeFileSync(path.join(dest,'cases',task.id+'.md'),md)}
function status(state,inProgress=null){
 const counts={accepted:records.filter(r=>r.decision===true).length,rejected:records.filter(r=>r.decision===false).length,invalid:records.filter(r=>r.verdict==='invalid').length,errors:records.filter(r=>r.verdict==='error').length};
 const transitions={falseToTrue:records.filter(r=>r.baselineDecision===false&&r.decision===true).length,trueToFalse:records.filter(r=>r.baselineDecision===true&&r.decision===false).length,trueToTrue:records.filter(r=>r.baselineDecision===true&&r.decision===true).length,falseToFalse:records.filter(r=>r.baselineDecision===false&&r.decision===false).length};
 const byBuild=Object.fromEntries([...new Set(tasks.map(t=>t.build))].map(b=>{const rs=records.filter(r=>r.build===b);return [b,{completed:rs.length,total:tasks.filter(t=>t.build===b).length,accepted:rs.filter(r=>r.decision===true).length,rejected:rs.filter(r=>r.decision===false).length,invalid:rs.filter(r=>r.verdict==='invalid').length,errors:rs.filter(r=>r.verdict==='error').length}]}));
 const summary={updated:now(),status:state,completed:records.length,total:tasks.length,inProgress,...counts,acceptedOfAll114Percent:100*counts.accepted/tasks.length,thinkingCharacters:records.reduce((n,r)=>n+(r.response?.message?.thinking?.length||0),0),transitions,byBuild};
 write(path.join(dest,'status.json'),summary);
 if(state==='complete')write(path.join(dest,'summary.json'),summary);
 let md=`# Short variable-mapping prompt: 114 historical FN pairs\n\nStatus: **${state}**; ${records.length}/114 complete. Accepted: ${counts.accepted}; rejected: ${counts.rejected}; invalid: ${counts.invalid}; errors: ${counts.errors}.\n\nThinking off; temperature 0; seed 42; context 16,384; output limit 384. Same shorter prompt as the FN022 test, with per-source required keys and matching JSON schema. Scope qualifiers distinguish shadowed variables (f0 is the outer function; f1, f2, etc. follow nested function source order). Only source variable names are extracted; no bundle correspondences or source-map labels are included in prompts. All 114 cases are the held-fixed historical ground-truth FN pairs, representing 70 source definitions across three builds. No recovery loop or negative pairs are run. Accepted/114 is positive-pair validation success, not overall accuracy, precision, or end-to-end recovery. Mappings are recorded but full mapping accuracy is not separately ground-truth-labelled.\n\n## Results by build\n\n| Build | Completed | Accepted | Rejected |\n|---|---:|---:|---:|\n`;
 for(const [b,v] of Object.entries(byBuild))md+=`| ${b} | ${v.completed}/${v.total} | ${v.accepted} | ${v.rejected} |\n`;
 md+=`\n## Comparison with previous explanation-only replay\n\nOn completed cases: false → true ${transitions.falseToTrue}; true → false ${transitions.trueToFalse}; true → true ${transitions.trueToTrue}; false → false ${transitions.falseToFalse}. The previous full replay accepted 59/114.\n\n## Cases\n\n| Case | Build | Source | Decision | Explanation |\n|---|---|---|---|---|\n`;
 for(const r of records)md+=`| [${r.id}](cases/${r.id}.md) | ${r.build} | ${r.sourceName} | ${r.decision??r.verdict} | ${(r.explanation||'').replaceAll('|','\\|').replaceAll('\n',' ')} |\n`;
 md+='\n[Final metrics and comparison](ANALYSIS.md) · [Machine-readable metrics](analysis-summary.json).\n';
 fs.writeFileSync(path.join(dest,'REPORT.md'),md);
}
if(process.argv.includes('--export-only')){for(const task of tasks){const file=path.join(dest,'requests',task.id+'.json');if(fs.existsSync(file)){const r=read(file);if(r.key===task.key){records.push(r);exportCase(task,r)}}}status(records.length===114?'complete':'partial');process.exit(0)}
const tags=await fetch(server+'/api/tags').then(r=>{if(!r.ok)throw Error('Cannot read local model tags');return r.json()});if(tags.models.find(m=>m.name===template.model)?.digest!==digest)throw Error('Validator digest changed');
write(path.join(dest,'sample.json'),{created:now(),promptVersion:'functions-only-short-full-variable-mapping',modelDigest:digest,server,selection:'The same 114 historical ground-truth FN pairs. Required variable keys come from source syntax only; no candidate mapping or oracle identity hints are given.',tasks});
for(const task of tasks){
 const file=path.join(dest,'requests',task.id+'.json');let r=fs.existsSync(file)?read(file):null;
 if(!r||r.key!==task.key){status('running',task.id);console.log('START',task.id,task.sourceName,now());const start=performance.now();r={...task,started:now()};
  try{r.response=await chat(task.request);Object.assign(r,parseMappingResult(r.response.message?.content||'',task.requiredVariables.map(v=>v.key)));if(r.response.message?.thinking)throw Error('Unexpected thinking content')}catch(e){r.error=String(e);r.decision=null;r.verdict='error'}
  r.wallMs=performance.now()-start;r.finished=now();write(file,r);console.log('DONE',task.id,r.verdict,Math.round(r.wallMs)+'ms',r.response?.eval_count,JSON.stringify(r.explanation));
 }
 records.push(r);exportCase(task,r);status('running');
}
status('complete');write(path.join(dest,'results.json'),{created:now(),records});
