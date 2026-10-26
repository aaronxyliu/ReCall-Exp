import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
const root=process.cwd(),baseline=path.resolve('results/jquery-4.0.0/experiment-4-minified-ranking-top5');
const dest=path.resolve(process.env.EXPERIMENT_OUTPUT||'results/jquery-4.0.0/experiment-5-validator-4b');
process.env.EXPERIMENT_OUTPUT=dest;process.env.PROMOTION_POLICY='first-positive';process.env.VALIDATOR_MODEL='qwen3.5:4b';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const write=(p,x)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n')};
if(dest===baseline)throw Error('Separate experiment output required');
const runtime=path.join(dest,'implementation'),scriptDir=path.join(runtime,'scripts/jquery');
if(!fs.existsSync(dest+'/input-provenance.json')){
 fs.mkdirSync(scriptDir,{recursive:true});const inputs=[];
 for(const f of ['build-manifest.json','detector-input.json','ground-truth.json','inventory-summary.json','browser-smoke.json','ast-baseline.json','name-baseline.json','anchor-evaluation.json','feature-definition-sensitivity.json']){const bytes=fs.readFileSync(path.join(baseline,f));fs.writeFileSync(path.join(dest,f),bytes);inputs.push({file:f,sha256:hash(bytes)})}
 const files=[];
 const reportBytes=fs.readFileSync('scripts/jquery/experiment-5-report.py');fs.writeFileSync(path.join(scriptDir,'experiment-5-report.py'),reportBytes);files.push({file:'scripts/jquery/experiment-5-report.py',sha256:hash(reportBytes)});
 for(const f of fs.readdirSync(path.join(baseline,'implementation/scripts/jquery')).filter(f=>/\.(mjs|py)$/.test(f))){const bytes=fs.readFileSync(path.join(baseline,'implementation/scripts/jquery',f));fs.writeFileSync(path.join(scriptDir,f),bytes);files.push({file:'scripts/jquery/'+f,sha256:hash(bytes)})}
 fs.mkdirSync(path.join(runtime,'notes/jquery'),{recursive:true});const prompt=fs.readFileSync(path.join(baseline,'implementation/notes/jquery/validator-system-prompt.txt'));fs.writeFileSync(path.join(runtime,'notes/jquery/validator-system-prompt.txt'),prompt);files.push({file:'notes/jquery/validator-system-prompt.txt',sha256:hash(prompt)});
 const cfg={...read(baseline+'/study-config.json'),experiment:5,validatorModel:'qwen3.5:4b',created:new Date().toISOString(),validatorPolicy:'jquery-pilot-v11-three-input-reference-patterns-tf',embeddingPromptVersion:'minified-semantic-comparison-v2',topK:5,promotionPolicy:'first-positive',baseline:baseline,provenance:'Fresh experiment caches. Source functions minified with Terser then embedded using approved semantic-comparison instruction; bundled code embedded as-is. Validation receives source, minified source, and bundled code; approved reference-and-examples prompt; 4B T/F, thinking off. Top-five candidates checked in order, stop on first positive; retain round-level one-to-one conflicts.'};
 write(dest+'/study-config.json',cfg);write(dest+'/implementation-manifest.json',{created:new Date().toISOString(),files});write(dest+'/input-provenance.json',{created:new Date().toISOString(),baseline,inputs,importedCaches:false,oraclePolicy:'Source maps and oracle held out of matching. Copied oracle used only in offline reporting.',runtime:'implementation/scripts/jquery',promptSha256:hash(prompt)});
}else{
 const manifest=read(dest+'/implementation-manifest.json');for(const f of manifest.files)if(hash(fs.readFileSync(path.join(runtime,f.file)))!==f.sha256)throw Error('Frozen implementation changed: '+f.file);
}
// Retain the vendored POG module layout used by measure.mjs.
const vendorDest=path.join(runtime,'vendor/debun');
if(!fs.existsSync(vendorDest)){
 fs.mkdirSync(vendorDest,{recursive:true});const manifest=read(dest+'/implementation-manifest.json');
 for(const sub of ['fingerprint-collector','utils'])fs.cpSync(path.join(root,'vendor/debun',sub),path.join(vendorDest,sub),{recursive:true});
 fs.copyFileSync(path.join(root,'vendor/debun/package.json'),path.join(vendorDest,'package.json'));
 fs.symlinkSync(path.join(root,'vendor/debun/node_modules'),path.join(vendorDest,'node_modules'),'dir');
 for(const sub of ['fingerprint-collector','utils'])for(const name of fs.readdirSync(path.join(vendorDest,sub))){const rel='vendor/debun/'+sub+'/'+name;manifest.files.push({file:rel,sha256:hash(fs.readFileSync(path.join(runtime,rel)))})}
 manifest.files.push({file:'vendor/debun/package.json',sha256:hash(fs.readFileSync(path.join(vendorDest,'package.json')))});write(dest+'/implementation-manifest.json',manifest);
}
const old=fs.existsSync(dest+'/execution-status.json')?read(dest+'/execution-status.json'):null;
if(old?.status==='complete'){console.log('Experiment 5 already complete');process.exit(0)}
const started=old?.started||new Date().toISOString(),stages=[];
const state=status=>write(dest+'/execution-status.json',{status,experiment:5,validatorModel:'qwen3.5:4b',started,updated:new Date().toISOString(),baseline,stages});
try{
 for(const file of ['recover.mjs','report.mjs','verify.mjs','analyze-recovery-bottlenecks.py','audit-wrong-identities.mjs','experiment-5-report.py']){
  const stage={file,started:new Date().toISOString(),status:'running'};stages.push(stage);state('running');console.log('STAGE',file);
  const code=await new Promise((resolve,reject)=>{const child=spawn(file.endsWith('.py')?'python3':process.execPath,[path.join(scriptDir,file),...(file==='verify.mjs'?['--complete']:[])],{cwd:root,stdio:'inherit',env:process.env});child.on('error',reject);child.on('exit',(code,signal)=>resolve(code??signal??1))});
  stage.finished=new Date().toISOString();stage.status=code===0?'complete':'failed';stage.exitCode=code;state(code===0?'running':'failed');if(code!==0)throw Error(file+' failed '+code);
 }
 state('complete');
}catch(e){state('failed');throw e}
