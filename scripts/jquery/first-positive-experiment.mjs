import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
process.env.EXPERIMENT_OUTPUT||='results/jquery-4.0.0/minified-no-tree-shaking-mapping-v8-first-positive';
process.env.PROMOTION_POLICY='first-positive';
const root=process.cwd(),baseline=path.join(root,'results/jquery-4.0.0/minified-no-tree-shaking-mapping-v8'),dest=path.resolve(root,process.env.EXPERIMENT_OUTPUT);
if(dest===baseline)throw Error('First-positive experiment must have isolated output');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n')};
const baselineSummary=read(path.join(baseline,'summary.json'));
if(baselineSummary.status!=='complete')throw Error('Baseline is not complete');
const provenance=path.join(dest,'input-provenance.json');
if(!fs.existsSync(provenance)){
 const inputs=[];
 for(const name of ['build-manifest.json','detector-input.json','ground-truth.json','inventory-summary.json','browser-smoke.json','ast-baseline.json','name-baseline.json','anchor-evaluation.json','feature-definition-sensitivity.json']){
  const bytes=fs.readFileSync(path.join(baseline,name));fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,name),bytes);inputs.push({name,sha256:hash(bytes)});
 }
 const config=read(path.join(baseline,'study-config.json'));
 write(path.join(dest,'study-config.json'),{...config,promotionPolicy:'first-positive',created:new Date().toISOString(),baseline:path.relative(root,baseline),provenance:'Change only candidate selection: stop at first accepted top-three candidate. Preserve round-level one-to-one source conflicts; prompt, ranking, anchors and maps unchanged.'});
 const cache=path.join(dest,'model-cache');fs.mkdirSync(path.join(cache,'validations'),{recursive:true});
 const embeddings=fs.readFileSync(path.join(baseline,'model-cache/embeddings.json'));fs.writeFileSync(path.join(cache,'embeddings.json'),embeddings);
 const imported=[];
 for(const name of fs.readdirSync(path.join(baseline,'model-cache/validations')).filter(f=>f.endsWith('.json'))){
  const bytes=fs.readFileSync(path.join(baseline,'model-cache/validations',name));fs.writeFileSync(path.join(cache,'validations',name),bytes);imported.push({key:name.slice(0,-5),sha256:hash(bytes)});
 }
 write(provenance,{created:new Date().toISOString(),baseline:path.relative(root,baseline),inputs,embeddingSha256:hash(embeddings),importedExactRequests:imported,modelDigests:read(path.join(baseline,'model-manifest.json')).digests,policy:'Reuse exact requests and model digests; no oracle labels enter matching. New neighborhoods may require fresh requests. Baseline is not modified.'});
}
const snapshot=[];
for(const name of ['recover.mjs','promotion-policy.mjs','models.mjs','variable-mapping-policy.mjs','common.mjs','report.mjs','verify.mjs','analyze-recovery-bottlenecks.py','first-positive-experiment.mjs']){
 const bytes=fs.readFileSync(path.join(root,'scripts/jquery',name)),target=path.join(dest,'implementation',name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);snapshot.push({file:name,sha256:hash(bytes)});
}
write(path.join(dest,'implementation-manifest.json'),{created:new Date().toISOString(),files:snapshot});
const {metadata}=await import('./models.mjs');
const meta=await metadata();
if(JSON.stringify(meta.digests)!==JSON.stringify(read(provenance).modelDigests))throw Error('Model digests changed from baseline');
await import('./experiment.mjs');
