import fs from 'node:fs';
import path from 'node:path';
import {output,read,write,hash,now} from './common.mjs';
import {server,api} from './models.mjs';
import {mappingExplainAllPrompt,mappingSchema,parseMappingExplainAllResult} from './variable-mapping-policy.mjs';
const review=path.join(output,'first-positive-review'),dest=path.join(review,'explanation-replay');
const cases=read(path.join(review,'cases.json')),manifest=read(path.join(output,'model-manifest.json'));
if(cases.length!==44)throw Error('Expected exactly 44 reviewed cases');
const tasks=cases.map(c=>{
 const old=read(path.join(output,'model-cache/validations',c.cacheKey+'.json'));
 const request=structuredClone(old.request),keys=request.format.properties.variable_mapping.required;
 const u=JSON.parse(request.messages[1].content);
 if(u.reference_source!==c.wrongCode||u.bundled_function!==c.bundleCode||old.decision!==true)throw Error('Input or baseline mismatch '+c.id);
 request.messages[0].content=mappingExplainAllPrompt(keys);
 request.format=mappingSchema(keys);
 if(request.think!==false||request.options.num_predict!==384)throw Error('Unexpected original settings');
 return {id:c.id,build:c.build,category:c.category,bundleId:c.bundleId,wrongSourceId:c.wrongSourceId,wrongName:c.wrongName,correctSourceId:c.correctSourceId,correctName:c.correctName,baselineDecision:old.decision,baselineKey:c.cacheKey,requiredVariables:keys,request,key:hash(JSON.stringify({digests:manifest.digests,request}))};
});
const records=[];
function updateCase(r){
 const file=path.join(review,r.id+'.md'),marker='<!-- explanation-replay:start -->';
 const existing=fs.readFileSync(file,'utf8'),laterMarker='<!-- explanation-replay-27b:start -->';
 const later=existing.includes(laterMarker)?'\n'+existing.slice(existing.indexOf(laterMarker)):'';
 const original=existing.split(marker)[0].trimEnd();
 let text='\n\n'+marker+'\n## New validation: mapping and explanation for both decisions\n\n';
 text+='Thinking off. Same two functions and 384-token output limit; explanation is now required for true and false. Original decision above is preserved.\n\n';
 text+='**New decision:** '+(r.decision??r.verdict)+'.\n\n';
 if(r.explanation)text+='**Model explanation:**\n\n> '+r.explanation.replaceAll('\n','\n> ')+'\n\n';
 text+='**Full model output (unedited):**\n\n```json\n'+(r.response?.message?.content||r.error||'')+'\n```\n\n';
 text+='[Exact new request and response](explanation-replay/requests/'+r.id+'.json). Generation exit: '+(r.response?.done_reason||'error')+'; output tokens: '+(r.response?.eval_count??'unavailable')+'.\n<!-- explanation-replay:end -->\n';
 fs.writeFileSync(file,original+text+later);
}
function save(state,inProgress=null){
 const summary={updated:now(),status:state,total:44,completed:records.length,inProgress,accepted:records.filter(r=>r.decision===true).length,rejected:records.filter(r=>r.decision===false).length,invalid:records.filter(r=>r.verdict==='invalid').length,errors:records.filter(r=>r.verdict==='error').length,thinkingCharacters:records.reduce((n,r)=>n+(r.response?.message?.thinking?.length||0),0),uniqueRequestKeys:new Set(records.map(r=>r.key)).size,policy:'Selected 44 previously accepted source-distinct pairs, not an overall semantic-accuracy sample. Explanations are model claims, not verified reasoning. No recovery iterations.'};
 write(path.join(dest,'status.json'),summary);write(path.join(dest,'results.json'),{created:now(),summary,records});
 let md='# Mapping plus explanations for all verdicts\n\nStatus: **'+state+'**, '+records.length+'/44 complete. Accepted: '+summary.accepted+'; rejected: '+summary.rejected+'; invalid: '+summary.invalid+'; errors: '+summary.errors+'.\n\n';
 md+='Only the explanation instructions and output field differ from the saved mapping-only requests. User messages, complete required variable keys, validator digest, thinking off, temperature 0, seed 42, context 16,384, and output budget 384 are preserved. Each occurrence has one call; identical requests across occurrences are not independent evidence. No new examples, correct identities, findings, or oracle hints are sent to the validator. The overall first-positive recovery experiment remains stopped.\n\n';
 md+='The explanation is a short model-generated justification, not a hidden thinking trace or independently verified proof. The 44 cases were selected for incorrect accepted identities; this diagnostic cannot establish overall precision or recall.\n\n';
 md+='| Case | Wrong reference | Correct source identity | New verdict | Explanation |\n|---|---|---|---|---|\n';
 for(const r of records)md+='| ['+r.id+'](../'+r.id+'.md) | '+r.wrongName+' | '+r.correctName+' | '+(r.decision??r.verdict)+' | '+(r.explanation||r.error||'No valid complete output').replaceAll('|','\\|').replaceAll('\n',' ')+' |\n';
 md+='\n[Exact prompts and settings](sample.json), [all results](results.json), [human review of the 44 cases](../README.md).\n';
 fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,'REPORT.md'),md);
 if(state==='complete')write(path.join(dest,'summary.json'),summary);
 const index=path.join(review,'README.md'),marker='<!-- explanation-replay-summary:start -->';
 const existing=fs.readFileSync(index,'utf8'),laterMarker='<!-- explanation-replay-27b-summary:start -->';
 const later=existing.includes(laterMarker)?'\n'+existing.slice(existing.indexOf(laterMarker)):'';
 const original=existing.split(marker)[0].trimEnd();
 fs.writeFileSync(index,original+'\n\n'+marker+'\n## Explanation replay\n\n[Mapping and explanations for all verdicts](explanation-replay/REPORT.md): '+records.length+'/44 complete; '+summary.accepted+' accepted, '+summary.rejected+' rejected, '+summary.invalid+' invalid, '+summary.errors+' errors. New output is appended to each case; original outputs are preserved. Thinking remains off.\n<!-- explanation-replay-summary:end -->\n'+later);
}
if(process.argv.includes('--export-only')){
 for(const task of tasks){const file=path.join(dest,'requests',task.id+'.json');if(fs.existsSync(file)){const r=read(file);if(r.key===task.key){records.push(r);updateCase(r)}}}
 save(records.length===44?'complete':'partial');process.exit(0);
}
const tags=await fetch(server+'/api/tags').then(r=>{if(!r.ok)throw Error('Cannot read local model tags');return r.json()});
if(tags.models.find(m=>m.name===tasks[0].request.model)?.digest!==manifest.digests[tasks[0].request.model])throw Error('Validator digest changed');
write(path.join(dest,'sample.json'),{created:now(),promptVersion:'jquery-pilot-v8-review-explain-both-verdicts',server,modelDigests:manifest.digests,inputCasesHash:hash(fs.readFileSync(path.join(review,'cases.json'))),scope:'44 saved previously accepted wrong-reference pairs only. The supported correct source is retained for human review and never included in model input.',tasks});
for(const task of tasks){
 const file=path.join(dest,'requests',task.id+'.json');let r=fs.existsSync(file)?read(file):null;
 if(!r||r.key!==task.key){save('running',task.id);console.log('START',task.id,now());r={...task,started:now()};const start=performance.now();
  try{const result=await api('chat',task.request);Object.assign(r,result,parseMappingExplainAllResult(result.response.message?.content||'',task.requiredVariables));if(result.response.message?.thinking)throw Error('Unexpected thinking text')}
  catch(error){r.error=String(error);r.decision=null;r.verdict='error'}
  r.wallMs=performance.now()-start;r.finished=now();write(file,r);console.log('DONE',task.id,r.verdict,Math.round(r.wallMs)+'ms',r.response?.done_reason,r.response?.eval_count);
 }
 records.push(r);updateCase(r);save('running');
}
save('complete');
