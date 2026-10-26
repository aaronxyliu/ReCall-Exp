import fs from 'node:fs';
import path from 'node:path';
import {root,output,read,write,hash,now} from './common.mjs';
import {settings} from './models.mjs';
const old=path.join(root,'results/jquery-4.0.0/minified-no-tree-shaking');
if(output===old)throw Error('Refusing to overwrite historical output');
const files=['build-manifest.json','detector-input.json','ground-truth.json','inventory-summary.json','browser-smoke.json','ast-baseline.json','name-baseline.json','anchor-evaluation.json','feature-definition-sensitivity.json'];
const inputs=[];
for(const name of files){const source=path.join(old,name);if(!fs.existsSync(source))continue;const bytes=fs.readFileSync(source),dest=path.join(output,name);if(fs.existsSync(dest)&&hash(fs.readFileSync(dest))!==hash(bytes))throw Error('Existing input differs: '+name);fs.mkdirSync(path.dirname(dest),{recursive:true});if(!fs.existsSync(dest))fs.copyFileSync(source,dest);inputs.push({name,sha256:hash(bytes),source:path.relative(root,source)})}
const previous=read(path.join(old,'study-config.json'));
write(path.join(output,'study-config.json'),{...previous,validatorPolicy:settings.promptVersion,thinking:false,created:now(),provenance:'Reuse identical pinned fixtures/inventories/oracle from completed minified/no-tree-shaking baseline. New recovery outputs and validation cache are isolated.',supersedes:path.relative(root,old)});
const previousModels=read(path.join(old,'model-manifest.json'));
const emb=path.join(output,'model-cache/embeddings.json');if(!fs.existsSync(emb))fs.copyFileSync(path.join(old,'model-cache/embeddings.json'),emb);
const diagnostic=path.join(old,'recovery-bottlenecks/false-negatives/short-mapping-no-explanation-replay/results.json');
const imported=[],groups=new Map();
for(const r of read(diagnostic).records){const key=hash(JSON.stringify({digests:previousModels.digests,body:r.request}));if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r)}
const conflicts=[];
for(const [key,rows] of groups){if(new Set(rows.map(r=>r.decision)).size!==1){conflicts.push({key,cases:rows.map(r=>r.id)});continue}const r=rows[0],dest=path.join(output,'model-cache/validations',key+'.json');if(!fs.existsSync(dest))write(dest,{key,created:r.finished,decision:r.decision,verdict:r.verdict,variableMapping:r.variableMapping,reason:'Compact variable mapping and binary verdict; no explanation requested.',wallMs:r.wallMs,request:r.request,response:r.response,provenance:{source:path.relative(root,diagnostic),cases:rows.map(r=>r.id),originalKey:r.key}});imported.push({key,cases:rows.map(r=>r.id)})}
write(path.join(output,'input-provenance.json'),{created:now(),previousOutput:path.relative(root,old),inputs,previousModelDigests:previousModels.digests,reusedEmbeddings:{source:path.relative(root,path.join(old,'model-cache/embeddings.json')),sha256:hash(fs.readFileSync(emb))},importedExactRequestJudgments:imported,excludedConflictingDiagnosticKeys:conflicts,policy:'No source-map labels enter validation prompts or detector candidate selection. Cached judgments are reused only by full request and model digest hash, never by oracle label.'});
console.log(JSON.stringify({output,inputs:inputs.length,reusedExactRequests:imported.length,conflictingKeys:conflicts.length,settings},null,2));
