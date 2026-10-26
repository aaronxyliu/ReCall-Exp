import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import {output,read,write,hash,now} from './common.mjs';
import {parseDecision} from './validator-policy.mjs';
const base=path.join(output,'recovery-bottlenecks/false-negatives');
const visible=path.join(base,'short-variable-mapping-replay');
const dest=path.join(base,'short-hidden-mapping-replay');
const baseline=read(path.join(visible,'results.json')).records;
if(baseline.length!==114)throw Error('Expected 114 baseline cases');
const digest=read(path.join(visible,'sample.json')).modelDigest;
const server=process.env.OLLAMA_URL||'http://127.0.0.1:11434';
const tasks=baseline.map(old=>{
 const request=structuredClone(old.request),prompt=request.messages[0].content;
 const before=prompt.split('\n\nReturn only:\n')[0];
 const keys=prompt.slice(prompt.lastIndexOf('\n\nRequired source keys:'));
 if(!before||!keys.startsWith('\n\nRequired source keys:'))throw Error('Unexpected baseline prompt');
 request.messages[0].content=before+'\n\nPerform the variable mapping and behavior checks before deciding, but do not output the mapping or an explanation. Return exactly one JSON boolean: true or false.'+keys;
 request.format={type:'boolean'};
 return {id:old.id,build:old.build,bundleId:old.bundleId,sourceId:old.sourceId,sourceName:old.sourceName,externalLibraryBindings:old.externalLibraryBindings,requiredVariables:old.requiredVariables,visibleDecision:old.decision,visibleWallMs:old.wallMs,visibleOutputTokens:old.response.eval_count,request,key:hash(JSON.stringify({digest,request}))};
});
function chat(body){return new Promise((resolve,reject)=>{
 const url=new URL(server+'/api/chat'),client=url.protocol==='https:'?https:http;
 const req=client.request(url,{method:'POST',headers:{'Content-Type':'application/json'}},res=>{let raw='';res.setEncoding('utf8');res.on('data',x=>raw+=x);res.on('end',()=>{try{if(res.statusCode>=400)throw Error('HTTP '+res.statusCode+': '+raw.slice(0,300));resolve(JSON.parse(raw))}catch(e){reject(e)}});res.on('error',reject)});
 const timer=setTimeout(()=>req.destroy(Error('180-second timeout')),180000);req.on('close',()=>clearTimeout(timer));req.on('error',reject);req.end(JSON.stringify(body));
})}
const records=[];
function exportCase(r){const u=JSON.parse(r.request.messages[1].content);const fence=s=>'`'.repeat(Math.max(3,1+Math.max(0,...[...s.matchAll(/`+/g)].map(m=>m[0].length))));const code=(s,lang)=>'\n'+fence(s)+lang+'\n'+s+'\n'+fence(s)+'\n\n';fs.mkdirSync(path.join(dest,'cases'),{recursive:true});fs.writeFileSync(path.join(dest,'cases',r.id+'.md'),`# ${r.id}: ${r.sourceName}\n\nVisible mapping decision: ${r.visibleDecision}. Decision-only result: ${r.decision??r.verdict}. Thinking off.\n\n## Source\n`+code(u.reference_source,'javascript')+'## Bundled\n'+code(u.bundled_function,'javascript')+'## Model output\n'+code(r.response?.message?.content||r.error||'','json'))}
function status(state,inProgress=null){
 const counts={accepted:records.filter(r=>r.decision===true).length,rejected:records.filter(r=>r.decision===false).length,invalid:records.filter(r=>r.verdict==='invalid').length,errors:records.filter(r=>r.verdict==='error').length};
 const transitions={visibleTrue_hiddenTrue:records.filter(r=>r.visibleDecision===true&&r.decision===true).length,visibleTrue_hiddenFalse:records.filter(r=>r.visibleDecision===true&&r.decision===false).length,visibleFalse_hiddenTrue:records.filter(r=>r.visibleDecision===false&&r.decision===true).length,visibleFalse_hiddenFalse:records.filter(r=>r.visibleDecision===false&&r.decision===false).length};
 const byBuild=Object.fromEntries([...new Set(tasks.map(t=>t.build))].map(b=>{const rs=records.filter(r=>r.build===b);return [b,{completed:rs.length,total:tasks.filter(t=>t.build===b).length,accepted:rs.filter(r=>r.decision===true).length,rejected:rs.filter(r=>r.decision===false).length,visibleAccepted:baseline.filter(r=>r.build===b&&r.decision===true).length}]}));
 const summary={updated:now(),status:state,completed:records.length,total:114,inProgress,...counts,acceptanceOfAll114Percent:100*counts.accepted/114,thinkingCharacters:records.reduce((n,r)=>n+(r.response?.message?.thinking?.length||0),0),transitions,byBuild};write(path.join(dest,'status.json'),summary);if(state==='complete')write(path.join(dest,'summary.json'),summary);
 let md=`# Mapping instruction without visible mapping or explanation\n\nStatus: **${state}**; ${records.length}/114 complete. Accepted: ${counts.accepted}; rejected: ${counts.rejected}; invalid: ${counts.invalid}; errors: ${counts.errors}.\n\nThe mapping and behavior-check instructions, source-variable key lists, function pairs, model digest, thinking off, temperature 0, seed 42, context 16,384 and 384-token output limit are preserved. The final-output instruction and schema change from an explicit mapping/decision/explanation object to one JSON boolean. The instruction to map variables remains, but no intermediate mapping is returned and its completion cannot be verified. This is not equivalent to generating mappings and merely hiding their display.\n\nBaseline with visible mappings: 105/114 accepted. This is acceptance on selected source-linked pairs, not overall accuracy, false-positive performance, or full recovery. FN103 has a separately documented browser-semantic counterexample; source-map correspondence is not universal equivalence. No model-generated explanations are available for this condition.\n\n| Build | Completed | Accepted | Rejected | Visible-mapping baseline accepted |\n|---|---:|---:|---:|---:|\n`;
 for(const [b,v]of Object.entries(byBuild))md+=`| ${b} | ${v.completed}/${v.total} | ${v.accepted} | ${v.rejected} | ${v.visibleAccepted} |\n`;
 md+='\n## Cases\n\n| Case | Build | Source | Visible decision | Decision-only |\n|---|---|---|---|---|\n';for(const r of records)md+=`| [${r.id}](cases/${r.id}.md) | ${r.build} | ${r.sourceName} | ${r.visibleDecision} | ${r.decision??r.verdict} |\n`;
 md+='\n[Comparison metrics](ANALYSIS.md), [raw requests and responses](results.json).\n';fs.writeFileSync(path.join(dest,'REPORT.md'),md);
}
if(process.argv.includes('--export-only')){for(const task of tasks){const file=path.join(dest,'requests',task.id+'.json');if(fs.existsSync(file)){const r=read(file);if(r.key===task.key){records.push(r);exportCase(r)}}}status(records.length===114?'complete':'partial');process.exit(0)}
const tags=await fetch(server+'/api/tags').then(r=>{if(!r.ok)throw Error('Cannot read model tags');return r.json()});if(tags.models.find(m=>m.name===tasks[0].request.model)?.digest!==digest)throw Error('Model digest changed');
write(path.join(dest,'sample.json'),{created:now(),promptVersion:'short-mapping-instruction-decision-only',comparison:'Suppress explicit mapping and explanation output; retain the mapping/behavior instructions and source keys. Response schema changes to a boolean. All other request settings and user messages are unchanged. No negative candidates or recovery loops.',modelDigest:digest,server,tasks});
for(const task of tasks){const file=path.join(dest,'requests',task.id+'.json');let r=fs.existsSync(file)?read(file):null;
 if(!r||r.key!==task.key){status('running',task.id);console.log('START',task.id,now());const start=performance.now();r={...task,started:now()};try{r.response=await chat(task.request);Object.assign(r,parseDecision(r.response.message?.content||''));if(r.response.message?.thinking)throw Error('Unexpected thinking output')}catch(e){r.error=String(e);r.decision=null;r.verdict='error'}r.wallMs=performance.now()-start;r.finished=now();write(file,r);console.log('DONE',task.id,r.verdict,Math.round(r.wallMs)+'ms',r.response?.eval_count)}records.push(r);exportCase(r);status('running');
}
status('complete');write(path.join(dest,'results.json'),{created:now(),records});
