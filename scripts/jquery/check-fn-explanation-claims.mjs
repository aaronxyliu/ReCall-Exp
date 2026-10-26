import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {output,read,write,now} from './common.mjs';
import {enumerate,children} from './measure.mjs';
const dest=path.join(output,'recovery-bottlenecks/false-negatives/nonthinking-explanations');
const record=id=>read(path.join(dest,'requests',id+'.json'));
const user=id=>JSON.parse(record(id).request.messages[1].content);
const results=[];
{
 const u=user('FN002'),a=vm.runInNewContext('('+u.reference_source+')'),b=vm.runInNewContext('('+u.bundled_function+')');
 assert.equal(a(''),'');assert.equal(b(''),'');results.push({case:'FN002',claim:'Empty string distinguishes the two functions',check:'Both actual functions return the empty string',passed:true});
}
for(const id of ['FN048','FN090']){assert.equal(vm.runInNewContext('!1'),false);results.push({case:id,claim:'!1 is true',check:'JavaScript evaluates !1 to false',passed:true})}
{
 const u=user('FN087'),a=vm.runInNewContext('('+u.reference_source+')'),b=vm.runInNewContext('('+u.bundled_function+')');assert.equal(a('false'),false);assert.equal(b('false'),false);results.push({case:'FN087',claim:'The bundle returns the string false',check:'Both actual functions return Boolean false for that input; no external helper is reached',passed:true});
}
for(const id of ['FN022','FN059','FN102']){
 const u=user(id),props={marker:'props'},speed={marker:'speed'},easing={marker:'easing'},callback=()=>{};
 const invoke=code=>{const ns={fn:{}};const f=vm.runInNewContext('('+code+')',{jQuery:ns,i:ns,T:ns,w:ns});f('method',props);const receiver={animate(...args){return args}};return ns.fn.method.call(receiver,speed,easing,callback)};
 const a=invoke(u.reference_source),b=invoke(u.bundled_function);assert.equal(a.length,4);assert.equal(b.length,4);[props,speed,easing,callback].forEach((v,i)=>{assert.equal(a[i],v);assert.equal(b[i],v)});
 results.push({case:id,claim:'animate receives props and speed in the wrong positions',check:'Under an explicitly aligned jQuery receiver, both actual wrappers pass [props,speed,easing,callback] unchanged',passed:true});
}
const data=read(path.join(output,'detector-input.json'));const helper=data.sources.flatMap(s=>s.functions).find(f=>f.name==='setPositiveNumber');
const fn=enumerate('const candidate=('+helper.code+');').functions[0].node;let uses=0;function walk(n){if(n.type==='Identifier'&&n.name==='_elem')uses++;for(const c of children(n))walk(c)}walk(fn.body);assert.equal(uses,0);
results.push({cases:['FN054','FN057','FN099'],claim:'setPositiveNumber needs its first element argument',check:'The actual helper body has zero references to its first parameter _elem',passed:true,helperSource:helper.code});
write(path.join(dest,'checked-claims.json'),{created:now(),scope:'Targeted checks of generated explanation claims, not a general equivalence proof. Namespace alignment for animate tests is an explicit controlled assumption, not input to the validation model. No inference calls.',results});
console.log('Verified',results.length,'targeted claim checks.');
