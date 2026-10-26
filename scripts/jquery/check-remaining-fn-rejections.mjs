import vm from 'node:vm';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {output,read,write,now} from './common.mjs';
const dest=path.join(output,'recovery-bottlenecks/false-negatives/short-variable-mapping-replay');
const cases=read(path.join(dest,'results.json')).records.filter(r=>r.decision===false);
const results=[];
function compile(code,env){return vm.runInNewContext('('+code+')',env)}
function norm(v){return v===undefined?{type:'undefined'}:{type:typeof v,value:v}}
for(const c of cases){const u=JSON.parse(c.request.messages[1].content),checks=[];
 function check(name,a,b){assert.deepEqual(structuredClone(a),structuredClone(b),c.id+': '+name);checks.push({name,agreed:true})}
 if(['FN008','FN038','FN082'].includes(c.id)){
  for(const length of [0,1,3])for(const matchAt of [-1,0,2]){
   const invoke=(code,source)=>{const collection=Array.from({length},(_,i)=>({index:i})),receiver={};const log=[];const ns={contains(a,b){log.push([a.index,b===receiver]);return a.index===matchAt}};
    const env=source?{i:99,len:length,jQuery:ns,self:collection}:{t:99,r:length,o:collection,i:c.id==='FN008'?ns:collection,T:ns,w:ns};const f=compile(code,env),value=f.call(receiver);return {result:norm(value),index:source?env.i:env.t,log}};
   check('loop length '+length+', match '+matchAt,invoke(u.reference_source,true),invoke(u.bundled_function,false));
  }
 }else if(c.id==='FN011'){
  for(const value of ['resolved','rejected',null,1]){
   const a={state:'pending',stateString:value},b={n:'pending',a:value};const x=compile(u.reference_source,a)(),y=compile(u.bundled_function,b)();check('state value '+value,{state:a.state,result:norm(x)},{state:b.n,result:norm(y)});
  }
 }else if(['FN061','FN104','FN103'].includes(c.id)){
  const modes=['absent','empty','returns-undefined','returns-null','returns-zero','returns-false','returns-string'];
  const values=[undefined,null,0,7,'abc',[null,2,'x'],function(i,old){return 'computed:'+i+':'+old}];
  const invoke=(code,source,nodeType,hookMode,value,getter=false,empty=false)=>{
   const log=[],element={nodeType,type:'input',nodeName:'INPUT',value:'original'};
   let hooks;if(hookMode!=='absent'){hooks={};if(hookMode!=='empty')hooks.set=function(elem,val,key){log.push(['set',elem===element,val,key]);return {'returns-undefined':undefined,'returns-null':null,'returns-zero':0,'returns-false':false,'returns-string':'handled'}[hookMode]}}
   function jq(){return {val(){return 'old'}}}jq.valHooks={input:hooks};jq.map=(array,fn)=>Array.from(array,fn);
   const env=source?{jQuery:jq,value,valueIsFunction:typeof value==='function',hooks:undefined}:{T:jq,w:jq,e:value,r:typeof value==='function',t:undefined};
   const f=compile(code,env);let receiver;
   if(c.id==='FN103'){receiver={length:empty?0:1,each(callback){if(!empty)log.push(['callback-return',norm(callback.call(element,0))]);return this}};if(!empty)receiver[0]=element;}
   else receiver=element;
   const out=c.id==='FN103'?(getter?f.call(receiver):f.call(receiver,value)):f.call(receiver,0);
   return {result:out===receiver?{type:'receiver'}:norm(out),value:element.value,log};
  };
  for(const nodeType of [0,1])for(const mode of modes)for(const value of values){
   check('nodeType '+nodeType+', hooks '+mode+', value '+typeof value,invoke(u.reference_source,true,nodeType,mode,value),invoke(u.bundled_function,false,nodeType,mode,value));
  }
  if(c.id==='FN103')for(const empty of [true,false])for(const mode of modes)check('getter empty '+empty+', hooks '+mode,invoke(u.reference_source,true,1,mode,'unused',true,empty),invoke(u.bundled_function,false,1,mode,'unused',true,empty));
 }else if(c.id==='FN087'){
  const inputs=['true','false','null','0','12','1.5','01','abc','[1,2]','{"x":1}','', 'NaN','Infinity'];
  const pattern=/^(?:\{[\w\W]*\}|\[[\w\W]*\])$/;
  for(const value of inputs){const a=compile(u.reference_source,{rbrace:pattern}),b=compile(u.bundled_function,{at:pattern});check('getData '+value,norm(a(value)),norm(b(value)))}
 }else if(c.id==='FN110'){
  const invoke=(code,source,crossDomain,mime,override,header,event)=>{
   const log=[],xhr={status:200,statusText:'OK',responseType:'text',responseText:'body',open(...args){log.push(['open',...args])},setRequestHeader(...args){log.push(['header',...args])},send(data){log.push(['send',data])},abort(){log.push(['abort'])},getAllResponseHeaders(){return 'x: y'}};
   if(override)xhr.overrideMimeType=value=>log.push(['mime',value]);
   const options={type:'GET',url:'/local-test',async:true,crossDomain,mimeType:mime?'text/plain':undefined,xhrFields:{auditField:7},hasContent:true,data:'payload',xhr(){return xhr}};
   const status={0:200};const f=compile(code,source?{xhrSuccessStatus:status}:{Xn:status});const transport=f(options),headers=header==='existing'?{'X-Requested-With':'Custom'}:header==='other'?{'Other':'value'}:{};
   transport.send(headers,(...args)=>log.push(['complete',...args]));
   if(event==='load')xhr.onload();else if(event==='error')xhr.onerror();else if(event==='abort')transport.abort();
   return {log,headers,auditField:xhr.auditField};
  };
  for(const crossDomain of [false,true])for(const mime of [false,true])for(const override of [false,true])for(const header of ['empty','existing','other'])for(const event of ['none','load','error','abort'])check('XHR '+[crossDomain,mime,override,header,event].join(','),invoke(u.reference_source,true,crossDomain,mime,override,header,event),invoke(u.bundled_function,false,crossDomain,mime,override,header,event));
 }
 assert.ok(checks.length,c.id+' unhandled');results.push({id:c.id,sourceName:c.sourceName,checks:checks.length,allAgree:checks.every(t=>t.agreed),observations:checks});
}
write(path.join(dest,'remaining-rejection-checks.json'),{created:now(),scope:'Controlled invocation tests of actual saved source/bundle bodies under explicitly aligned external bindings and mocked receivers/helpers. This is diagnostic, not a universal semantic proof or a detector result. No model calls. Source-map identity is unchanged.',results});
console.log(JSON.stringify(results.map(({observations,...r})=>r),null,2));
