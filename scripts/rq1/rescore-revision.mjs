/** Re-score frozen recovery outputs with a new oracle; never supplies GT to ReCall.
 * Keep the original run's input manifest and evaluation.json for resume/provenance.
 * A separate evaluation-v2.json drives reporting once the revision marker is set.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {score} from './evaluate.mjs';
import {prepareInputs} from '../../../ReCall/src/workflow/inputs.mjs';
const [datasetArg,rootArg,...flags]=process.argv.slice(2);
if(!datasetArg||!rootArg)throw Error('Usage: rescore-revision.mjs DATASET RUN_ROOT [--watch]');
const dataset=path.resolve(datasetArg),root=path.resolve(rootArg),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p));
const indexPath=path.join(dataset,'one-to-one-evaluation-v2.json'),indexBytes=fs.readFileSync(indexPath),index=JSON.parse(indexBytes);
if(index.pairDefinition!=='reciprocal-body-mapped-v2'||index.subjects.length!==26)throw Error('Unexpected revised cohort');
const revision={pairDefinition:index.pairDefinition,indexSHA256:sha(indexBytes),cohortGroundTruthPairs:index.oneToOnePairs,repositoryCount:index.subjects.length,index:indexPath};
const atomic=(p,value)=>{const temp=p+'.tmp-'+process.pid;fs.writeFileSync(temp,JSON.stringify(value,null,2)+'\n');fs.renameSync(temp,p)};
// Check every oracle before publishing the marker, avoiding mixed or incomplete revisions.
const oracles=new Map(index.subjects.map(s=>{const bytes=fs.readFileSync(path.join(dataset,s.records));if(sha(bytes)!==s.recordsSHA256)throw Error('Revised oracle digest mismatch: '+s.subject);return [s.subject,JSON.parse(bytes)]}));
const seen=new Map();
async function sweep(){
 const failures=[];let completed=0,checkpoints=0;
 for(const s of index.subjects){
  const folder=path.join(root,s.subject),run=path.join(folder,'run'),input=path.join(folder,'input');
  const final=fs.existsSync(path.join(run,'recovery.json'))&&fs.existsSync(path.join(folder,'timing.json'));
  const resultFile=path.join(run,final?'recovery.json':'checkpoint.json');
  if(!fs.existsSync(resultFile))continue;
  const inventoriesMissing=!fs.existsSync(path.join(run,'source.json'))||!fs.existsSync(path.join(run,'bundle.json'));
  if(inventoriesMissing&&!final)continue;
  try{
   // Migration omitted reproducible inventories for already completed subjects.
   // Restore from the original manifests, never from oracle pair membership.
   if(inventoriesMissing){
    const config=read(path.join(run,'run.json')).config;
    const restored=await prepareInputs({sourceManifest:read(path.join(input,'sourceManifest.json')),bundleManifest:read(path.join(input,'bundleManifest.json')),inputs:config.inputs,recovery:config.recovery});
    atomic(path.join(run,'source.json'),restored.source);atomic(path.join(run,'bundle.json'),restored.bundle);
   }
   const provenance=read(path.join(input,'provenance.json')),gt=oracles.get(s.subject);
   if(gt.rebuild.inputRecordSHA256!==provenance.recordsSHA256||JSON.stringify([...gt.selection.selected].sort())!==JSON.stringify([...provenance.selectedLibraries].sort()))throw Error('Revision changes the frozen source population');
   const bytes=fs.readFileSync(resultFile),signature=sha(bytes)+':'+s.recordsSHA256+':'+final;
   if(seen.get(s.subject)===signature){if(final)completed++;else checkpoints++;continue}
   const result=JSON.parse(bytes),source=read(path.join(run,'source.json')),bundle=read(path.join(run,'bundle.json'));
   if(source.inputDigest!==result.sourceDigest||bundle.inputDigest!==result.bundleDigest)throw Error('Recovery/inventory digest mismatch');
   const report=score(gt,read(path.join(input,'identities.json')),source,bundle,result);
   report.oracleRevision={...revision,recordSHA256:s.recordsSHA256};report.partial=!final;report.scoredAt=new Date().toISOString();
   atomic(path.join(run,final?'evaluation-v2.json':'checkpoint-evaluation-v2.json'),report);
   seen.set(s.subject,signature);if(final)completed++;else checkpoints++;
   console.log(JSON.stringify({subject:s.subject,partial:!final,correct:report.correct,groundTruthPairs:report.groundTruthPairs}));
  }catch(error){failures.push({subject:s.subject,error:error.message})}
 }
 atomic(path.join(root,'revision-scoring-status.json'),{at:new Date().toISOString(),completed,checkpoints,failures});
 atomic(path.join(root,'evaluation-revision.json'),revision);
}
do{
 await sweep();
 if(!flags.includes('--watch'))break;
 await new Promise(resolve=>setTimeout(resolve,30000));
}while(true);
