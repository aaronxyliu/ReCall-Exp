import path from 'node:path';
import {output,read,write,hash,now} from './common.mjs';
import {parseDecision} from './validator-policy.mjs';
const source=path.join(output,'wrong-identity-audit'),dest=path.join(source,'thinking-replay/context-controls');
const c1=read(path.join(source,'cases/W01.json')),c13=read(path.join(source,'cases/W13.json'));
const data=read(path.join(output,'detector-input.json'));
const ref=data.sources.flatMap(s=>s.functions).find(f=>f.name==='showHide');
const b=data.bundles.find(b=>b.build===c13.build),helper=b.functions.find(f=>f.name==='wt');
const tasks=[];
for(const c of [c1,c13])for(const enriched of [false,true]){
 const request=structuredClone(c.request);request.think=false;request.options.num_predict=32;
 if(enriched){const user=JSON.parse(request.messages[1].content);
  if(c.id==='W01')user.manually_verified_binding_context={source_to_bundle:{dataUser:'O',dataPriv:'b'},distinct_storage_instances:[['dataUser','dataPriv'],['O','b']],evidence_note:'Manually audited program binding identities from source/API roles and correspondence evidence; these are distinct storage allocations, not aliases. This is an explanatory context intervention, not detector-produced evidence.'};
  else{
   user.reference_captures=user.reference_captures.map(x=>x.name==='showHide'?{...x,initializer:ref.code,initializerTruncated:false}:x);
   user.bundle_captures=user.bundle_captures.map(x=>x.name==='wt'?{...x,initializer:helper.code,initializerTruncated:false}:x);
   user.supported_neighbor_correspondences=user.supported_neighbor_correspondences.map(x=>x.reference_name==='showHide'?{...x,reference_code:ref.code,bundle_code:helper.code}:x);
  }
  request.messages[1].content=JSON.stringify(user);
 }
 tasks.push({id:c.id+(enriched?'-enriched-context':'-original-context'),caseId:c.id,enriched,request,key:hash(JSON.stringify(request))});
}
const records=[];
for(const task of tasks){
 const start=performance.now();let record={...task,started:now()};
 try{const r=await fetch((process.env.OLLAMA_URL||'http://127.0.0.1:11434')+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(task.request),signal:AbortSignal.timeout(180000)});if(!r.ok)throw new Error('HTTP '+r.status);record.response=await r.json();Object.assign(record,parseDecision(record.response.message?.content||''))}catch(e){record.error=String(e);record.verdict='error'}
 record.wallMs=performance.now()-start;record.finished=now();write(path.join(dest,task.id+'.json'),record);records.push(record);console.log(task.id,record.verdict,Math.round(record.wallMs)+'ms');
}
write(path.join(dest,'summary.json'),{created:now(),policy:'Four fresh non-thinking requests. Compare original v5 inputs with explicit manually audited store bindings (W01) or complete helper bodies (W13). The binding augmentation is oracle-informed diagnostic context, not an automatic detector result or a recovery evaluation.',records});
