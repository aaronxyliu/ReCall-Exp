import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {oracleIndex} from './simulation/validator.mjs';
const root=path.resolve(import.meta.dirname,'..');
const base=path.join(root,'results/autodl-rq1-strict-2026-11-14/ReCall Exp/results');
const read=p=>JSON.parse(fs.readFileSync(p));
const index=read(path.resolve(root,'../ReCall Dataset/qualified-dataset/index.json'));
const timing=read(path.join(root,'manuscript/data/rq1-bundler-breakdown.json'));
const rows=[];
for(const sub of index.subjects){
 const dir=path.join(base,'rq1-strict-one-to-one-real',sub.subject,'run');
 const source=read(path.join(dir,'source.json')),bundle=read(path.join(dir,'bundle.json'));
 const gt=read(path.join(base,'rq1-crosschunk-simulation-2026-11-10',sub.subject,'ground-truth/relations.json'));
 const oracle=oracleIndex(source,bundle,gt.pairs);
 const rec=read(path.join(root,'results/autodl-rq1-prompt-recheck',sub.subject,'run/recovery.json'));
 const libs=new Map(sub.selectedLibraries.map(l=>[l,{subject:sub.subject,bundler:sub.subject.split('/')[0],library:l,groundTruth:0,correct:0,validationSeconds:0,requests:0,repositoryAverageMinutes:timing.subjects.find(r=>r.subject===sub.subject).processSeconds/60/sub.libraryCount}]));
 for(const s of oracle.expected.values())libs.get(JSON.parse(s)[0]).groundTruth++;
 const recovered=new Set();
 for(const m of rec.promotions)if(oracle.decision(m.sourceId,m.bundleId)==='accept')recovered.add(oracle.targetKeys.get(m.bundleId));
 for(const t of recovered)libs.get(JSON.parse(oracle.expected.get(t))[0]).correct++;
 const seen=new Set();
 for(const q of rec.queries)for(const c of q.checks){
  if(c.validator!=='model'||seen.has(c.response.created_at))continue;
  seen.add(c.response.created_at);
  const lib=libs.get(JSON.parse(oracle.sourceKeys.get(c.sourceId))[0]);assert(lib);
  lib.validationSeconds+=c.response.total_duration/1e9;lib.requests++;
 }
 for(const r of libs.values()){assert(r.groundTruth===sub.libraryPairs[r.library]);r.recovery=r.groundTruth?r.correct/r.groundTruth:null;rows.push(r);}
}
assert.equal(rows.length,282);assert.equal(rows.reduce((s,r)=>s+r.correct,0),49867);assert.equal(rows.reduce((s,r)=>s+r.groundTruth,0),58128);
const out=path.join(root,'results/library-distributions-2026-11-17');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'instances.json'),JSON.stringify(rows,null,2));console.log('282 instances; '+rows.filter(r=>r.groundTruth>0).length+' with ground-truth pairs.');
