import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const out=path.resolve('results/real-app/vue-admin-template-all-libraries'),manifestPath=out+'/implementation-manifest.json',manifest=JSON.parse(fs.readFileSync(manifestPath));
const file='scripts/jquery/common.mjs',target=out+'/implementation/'+file,baseline=fs.readFileSync(path.join(manifest.baseline,'implementation',file),'utf8');
const original="export function write(p, data) { fs.mkdirSync(path.dirname(p), {recursive:true}); fs.writeFileSync(p, JSON.stringify(data,null,2)+'\\n'); }";
const replacement=`const lastRecoverySnapshot = new Map();
export function write(p, data) {
 const recoverySnapshot=path.dirname(p)===path.join(output,'recovery')&&Array.isArray(data?.promotions)&&Array.isArray(data?.pairs);
 if(recoverySnapshot&&data.status==='running'&&Date.now()-(lastRecoverySnapshot.get(p)||0)<30000)return;
 fs.mkdirSync(path.dirname(p),{recursive:true});const text=JSON.stringify(data,null,2)+'\\n';
 if(recoverySnapshot){const temporary=p+'.tmp';fs.writeFileSync(temporary,text);fs.renameSync(temporary,p);lastRecoverySnapshot.set(p,Date.now())}
 else fs.writeFileSync(p,text);
}`;
if(!baseline.includes(original))throw Error('Unexpected baseline persistence implementation');
const updated=baseline.replace(original,replacement),current=fs.readFileSync(target,'utf8'),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
if(current===updated&&manifest.persistenceOnlyChange){console.log('Persistence optimization already applied');}
else {
 if(current!==baseline)throw Error('Unexpected implementation; preserve and review before changing');
 const recovery=out+'/recovery';if(fs.existsSync(recovery)&&fs.readdirSync(recovery).some(f=>f.endsWith('.json')))throw Error('Apply before recovery; existing runs require a stopped checkpoint and explicit replay verification');
 const backup=out+'/checkpoint-persistence-before';fs.mkdirSync(backup,{recursive:true});fs.writeFileSync(backup+'/common.mjs',baseline);fs.copyFileSync(manifestPath,backup+'/implementation-manifest.json');fs.writeFileSync(target,updated);
 const change={created:new Date().toISOString(),file,originalSha256:sha(baseline),updatedSha256:sha(updated),scope:'Only persistence helper: running recovery snapshots at most once per 30 seconds, atomic rename; all fixed-point and per-request cache writes immediate. No matching, input, prompt, model setting, ranking, promotion, or request-key change.',before:'checkpoint-persistence-before/',checkpointBytes:0};
 for(const row of manifest.files)if(row.file===file)row.sha256=change.updatedSha256;manifest.persistenceOnlyChange=change;
 fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(out+'/persistence-change.json',JSON.stringify(change,null,2)+'\n');fs.writeFileSync(out+'/persistence-replay-verification.json',JSON.stringify({created:new Date().toISOString(),passed:true,preservedPairDecisions:0,preservedQueries:0,preservedPromotions:0,verified:['Persistence-only change applied before any recovery; no prior matching decisions exist to replay.']},null,2)+'\n');console.log('Persistence optimization applied before recovery');
}
