import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
const out=path.resolve('results/real-app/vue-admin-template-all-libraries');
if(!fs.existsSync(out+'/detector-input.json'))throw Error('Run prepare-all.mjs first');
for(const f of JSON.parse(fs.readFileSync(out+'/implementation-manifest.json')).files){const h=crypto.createHash('sha256').update(fs.readFileSync(out+'/implementation/'+f.file)).digest('hex');if(h!==f.sha256)throw Error('Frozen file changed: '+f.file)}
process.env.EXPERIMENT_OUTPUT=out;process.env.VALIDATOR_MODEL='qwen3.5:27b';process.env.PROMOTION_POLICY='first-positive';
const old=fs.existsSync(out+'/execution-status.json')?JSON.parse(fs.readFileSync(out+'/execution-status.json')):null,started=old?.started||new Date().toISOString();
const state=(status,extra={})=>fs.writeFileSync(out+'/execution-status.json',JSON.stringify({status,started,updated:new Date().toISOString(),...extra},null,2)+'\n');
state('running');
for(const [cmd,args] of [[process.execPath,[out+'/implementation/scripts/jquery/recover.mjs']],['python3',['scripts/real-app/report-all.py']]]){
 const code=await new Promise((resolve,reject)=>{const child=spawn(cmd,args,{stdio:'inherit',env:process.env});child.on('error',reject);child.on('exit',code=>resolve(code))});
 if(code!==0){state('failed',{command:cmd,args,exitCode:code});process.exit(code||1)}
}
state('complete',{verification:'passed'});
