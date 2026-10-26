import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import {output,read,write,hash,now} from './common.mjs';
import {parseDecision} from './validator-policy.mjs';

// Diagnostic only. The main validator configuration and predictions are unchanged.
const dest=path.join(output,'wrong-identity-audit/thinking-replay');
const cases=read(path.join(output,'wrong-identity-audit/cases.json')).cases;
const manifest=read(path.join(output,'model-manifest.json'));
const server=process.env.OLLAMA_URL||'http://127.0.0.1:11434';
const tags=await fetch(server+'/api/tags').then(r=>{if(!r.ok)throw new Error('Cannot read local model tags');return r.json()});
for(const [name,digest] of Object.entries(manifest.digests))if(tags.models.find(m=>m.name===name)?.digest!==digest)throw new Error('Model digest changed: '+name);
const order=['W04','W13',...cases.map(c=>c.id).filter(id=>!['W04','W13'].includes(id))];
const tasks=[];
function add(c,variant,think,correct=false){
 const request=structuredClone(c.request);request.think=think;request.options.num_predict=8192;
 if(correct){const user=JSON.parse(request.messages[1].content);user.reference_source=c.expected.code;user.reference_captures=c.expected.captures.slice(0,10);request.messages[1].content=JSON.stringify(user)}
 const key=hash(JSON.stringify({digests:manifest.digests,request}));
 tasks.push({id:c.id+'-'+variant,caseId:c.id,variant,sourcePair:correct?'source-map counterpart':'original wrongly identified source',expectedSemanticDecision:correct||['W06','W11','W12'].includes(c.id),thinking:think,baselineRequestKey:c.requestKey,request,key});
}
for(const id of order)add(cases.find(c=>c.id===id),'wrong-pair-thinking',true);
for(const id of ['W04','W13'])add(cases.find(c=>c.id===id),'wrong-pair-nonthinking-budget-control',false);
if(process.env.REPLAY_COUNTERPARTS==='1')for(const id of order)add(cases.find(c=>c.id===id),'counterpart-thinking',true,true);
const sample={created:now(),selection:'All 13 final wrong identities, including 10 demonstrated semantic negatives and 3 same-call-behavior positives; 2 non-thinking budget controls. Optional correct-counterpart batch omitted by default after excessive runtime. Error-selected diagnostic, not population precision.',numPredict:8192,timeoutMs:600000,modelDigests:manifest.digests,server,comparison:'Original prompt and user context retained. Thinking is enabled and output budget increased from 32 to 8192 to accommodate reasoning. This is not a think-only causal ablation; two non-thinking same-budget controls address selected obvious cases.',tasks};
write(path.join(dest,'sample.json'),sample);
const records=[];
// Native HTTP avoids fetch/undici's separate ~300-second header deadline.
function chat(request){return new Promise((resolve,reject)=>{
 const url=new URL(server+'/api/chat'),client=url.protocol==='https:'?https:http;
 const req=client.request(url,{method:'POST',headers:{'Content-Type':'application/json'}},res=>{let raw='';res.setEncoding('utf8');res.on('data',chunk=>raw+=chunk);res.on('end',()=>{if((res.statusCode||500)>=400)reject(new Error('HTTP '+res.statusCode+': '+raw.slice(0,600)));else try{resolve(JSON.parse(raw))}catch(error){reject(error)}});res.on('error',reject)});
 const timer=setTimeout(()=>req.destroy(new Error('Diagnostic request exceeded 600 seconds')),600000);
 req.on('error',reject);req.on('close',()=>clearTimeout(timer));req.end(JSON.stringify(request));
})}
function status(state,inProgress=null){write(path.join(dest,'execution-status.json'),{created:now(),status:state,completed:records.length,total:tasks.length,inProgress,results:records.map(r=>({id:r.id,caseId:r.caseId,variant:r.variant,expectedSemanticDecision:r.expectedSemanticDecision,decision:r.decision,verdict:r.verdict,wallMs:r.wallMs,evalCount:r.response?.eval_count,thinkingCharacters:r.response?.message?.thinking?.length||0,doneReason:r.response?.done_reason,error:r.error}))})}
for(const task of tasks){
 const file=path.join(dest,'requests',task.id+'.json');let record;
 if(fs.existsSync(file)&&read(file).key===task.key&&!read(file).error){record=read(file);console.log('replay cached',task.id,record.verdict)}
 else{
  if(fs.existsSync(file))write(path.join(dest,'attempts',task.id+'-'+Date.now()+'.json'),read(file));
  const started=now();status('running',{id:task.id,started,thinking:task.thinking,numPredict:8192});console.log('START',task.id,started);
  const start=performance.now();record={...task,started};
  try{
   record.response=await chat(task.request);Object.assign(record,parseDecision(record.response.message?.content||''));
  }catch(error){record.error=String(error);record.decision=null;record.verdict='error'}
  record.finished=now();record.wallMs=performance.now()-start;write(file,record);
  console.log('DONE',task.id,record.verdict,Math.round(record.wallMs)+'ms','tokens',record.response?.eval_count,'thinking',record.response?.message?.thinking?.length||0,'reason',record.response?.done_reason);
 }
 records.push(record);status('running');
}
status('complete');
write(path.join(dest,'results.json'),{created:now(),selection:sample.selection,comparison:sample.comparison,records});
console.log('Thinking replay complete',records.length);
