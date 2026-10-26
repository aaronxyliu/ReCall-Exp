import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import {output,read,write,hash,now} from './common.mjs';
import {binaryValidatorPrompt as validatorPrompt,parseDecision} from './validator-policy.mjs';
import {validatorUserMessage} from './models.mjs';

const base=path.join(output,'wrong-identity-audit');
const dest=path.join(base,'functions-only-thinking');
const readable=path.join(base,'readable-cases');
const cases=read(path.join(base,'cases.json')).cases;
const manifest=read(path.join(output,'model-manifest.json'));
const server=process.env.OLLAMA_URL||'http://127.0.0.1:11434';
const tasks=cases.map(c=>{
 const request=structuredClone(c.request);
 request.messages=[{role:'system',content:validatorPrompt},{role:'user',content:validatorUserMessage(c.bundled,c.predicted)}];
 request.think=true;request.options.num_predict=8192;
 return {id:c.id,request,key:hash(JSON.stringify({digests:manifest.digests,request})),expectedSemanticDecision:['W06','W11','W12'].includes(c.id)};
});
function fence(text,lang='text'){
 const longest=Math.max(0,...[...String(text).matchAll(/`+/g)].map(x=>x[0].length));
 const mark='`'.repeat(Math.max(3,longest+1));return `\n${mark}${lang}\n${text}\n${mark}\n\n`;
}
function exportMarkdown(){
 fs.mkdirSync(readable,{recursive:true});
 const files=read(path.join(readable,'manifest.json'));
 const statusFile=path.join(dest,'status.json');
 const progress=fs.existsSync(statusFile)?read(statusFile):null;
 let index='# Function-pair validation with thinking\n\n';
 if(progress)index+=`Status: **${progress.status}**; ${progress.completed}/${progress.total} cases completed.${progress.interruptedCase?' Interrupted case: '+progress.interruptedCase+'.':''}\n\n`;
 index+='Each user message contains only `reference_source` and `bundled_function`. The unchanged system prompt asks for a semantic-equivalence judgment. Thinking is enabled; the output limit is 8,192 tokens. Full request/response records are saved separately in `../functions-only-thinking/requests/`.\n\nTen pairs have demonstrated behavioral differences. W06, W11 and W12 have equivalent invocation behavior but different source identities. A `true` decision for those three is not a semantic false positive. An empty final output is unresolved, not false.\n\n| Case | Reference | Actual source | Decision |\n|---|---|---|---|\n';
 for(const c of cases){
  const task=tasks.find(t=>t.id===c.id),file=path.join(dest,'requests',c.id+'.json');
  const saved=fs.existsSync(file)?read(file):null;
  const r=saved?.key===task.key?saved:null;
  const entry=files.find(x=>x.id===c.id);
  const decision=r?.decision===true?'true':r?.decision===false?'false':r?'no valid decision':'pending';
  let md=`# ${c.id}\n\n## Reference function\n`+fence(c.predicted.code,'javascript');
  md+='## Bundled function\n'+fence(c.bundled.code,'javascript');
  md+=`## Model decision\n\n${decision}\n\n`;
  // All these cases are known source-identity mismatches, even if invocation-equivalent.
  if(typeof r?.decision==='boolean'&&r.decision!==task.expectedSemanticDecision){
   md+='## Correct corresponding function\n'+fence(c.expected.code,'javascript');
  }else if(r?.decision===true&&task.expectedSemanticDecision){
   md+='The pair has equivalent invocation behavior; the source identity differs.\n\n';
  }else if(r&&r.decision===null){
   md+='No usable final boolean was returned.\n\n';
  }
  md+='## Thinking text\n';
  const thinking=r?.response?.message?.thinking;
  md+=thinking?fence(thinking):r?'No thinking text returned.\n':'Pending.\n';
  fs.writeFileSync(path.join(readable,entry.file),md);
  entry.thinkingVerdict=r?.verdict??'pending';
  entry.diagnostic='functions-only-thinking';
  index+=`| [${c.id}](${entry.file}) | ${c.predicted.name} | ${c.expected.name} | ${decision} |\n`;
 }
 fs.writeFileSync(path.join(readable,'README.md'),index);
 write(path.join(readable,'manifest.json'),files);
}
function chat(body){return new Promise((resolve,reject)=>{
 const url=new URL(server+'/api/chat');const client=url.protocol==='https:'?https:http;
 const req=client.request(url,{method:'POST',headers:{'Content-Type':'application/json'}},res=>{
  let raw='';res.setEncoding('utf8');res.on('data',x=>raw+=x);res.on('end',()=>{try{if(res.statusCode>=400)throw new Error('HTTP '+res.statusCode+': '+raw.slice(0,200));resolve(JSON.parse(raw))}catch(e){reject(e)}});res.on('error',reject);
 });
 const timer=setTimeout(()=>req.destroy(new Error('600-second timeout')),600000);
 req.on('close',()=>clearTimeout(timer));req.on('error',reject);req.end(JSON.stringify(body));
})}
if(process.argv.includes('--export-only')){exportMarkdown();process.exit(0)}
const tags=await fetch(server+'/api/tags').then(r=>r.json());
for(const [name,digest] of Object.entries(manifest.digests))if(tags.models.find(m=>m.name===name)?.digest!==digest)throw new Error('Model digest changed: '+name);
write(path.join(dest,'sample.json'),{created:now(),promptVersion:'jquery-pilot-v6-functions-only-default-true',comparison:'Same saved pairs and system prompt. User message reduced to two functions only. Thinking enabled with 8192 output tokens; original recovery results unchanged.',digests:manifest.digests,tasks});
const records=[];
function status(state,inProgress=null){write(path.join(dest,'status.json'),{updated:now(),status:state,completed:records.length,total:tasks.length,inProgress,results:records.map(r=>({id:r.id,decision:r.decision,verdict:r.verdict,expectedSemanticDecision:r.expectedSemanticDecision,seconds:r.wallMs/1000,tokens:r.response?.eval_count,doneReason:r.response?.done_reason}))});exportMarkdown()}
for(const task of tasks){
 const file=path.join(dest,'requests',task.id+'.json');let r=fs.existsSync(file)?read(file):null;
 if(!r||r.key!==task.key||r.error){
  status('running',task.id);console.log('START',task.id,now());const start=performance.now();r={...task,started:now()};
  try{r.response=await chat(task.request);Object.assign(r,parseDecision(r.response.message?.content||''))}catch(e){r.error=String(e);r.decision=null;r.verdict='error'}
  r.wallMs=performance.now()-start;r.finished=now();write(file,r);
  console.log('DONE',task.id,r.verdict,Math.round(r.wallMs)+'ms',r.response?.eval_count);
 }
 records.push(r);status('running');
}
status('complete');write(path.join(dest,'results.json'),{created:now(),records});
