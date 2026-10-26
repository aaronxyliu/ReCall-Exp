import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
const out=path.resolve('results/real-app/vue-admin-template-three-libraries');
if(!fs.existsSync(out+'/input-provenance.json'))throw Error('Run prepare.mjs first');
process.env.EXPERIMENT_OUTPUT=out;process.env.VALIDATOR_MODEL='qwen3.5:27b';process.env.PROMOTION_POLICY='first-positive';
const started=new Date().toISOString();
const state=(status,extra={})=>fs.writeFileSync(out+'/execution-status.json',JSON.stringify({status,started,updated:new Date().toISOString(),...extra},null,2)+'\n');
state('running');
for(const [cmd,args] of [[process.execPath,[out+'/implementation/scripts/jquery/recover.mjs']],['python3',['scripts/real-app/report.py']]]){
 const code=await new Promise((resolve,reject)=>{const child=spawn(cmd,args,{stdio:'inherit',env:process.env});child.on('error',reject);child.on('exit',code=>resolve(code))});
 if(code!==0){state('failed',{command:cmd,args,exitCode:code});process.exit(code||1)}
}
state('complete',{verification:'passed'});
