// Score an already completed recovery without invoking recovery or models.
import path from 'node:path';
import {readJSON as read,writeJSON as write} from './runtime.mjs';
import {score} from './evaluate.mjs';
const [dataset,key,root]=process.argv.slice(2),folder=path.join(root,key),run=path.join(folder,'run');
const index=read(path.join(dataset,'one-to-one-evaluation-v2.json')),subject=index.subjects.find(s=>s.subject===key);
if(!subject)throw Error('Subject outside active cohort');
const result=read(path.join(run,'recovery.json'));
if(result.status!=='fixed-point')throw Error('Recovery has not completed');
const report=score(read(path.join(dataset,subject.records)),read(path.join(folder,'input/identities.json')),read(path.join(run,'source.json')),read(path.join(run,'bundle.json')),result);
Object.assign(report,{partial:false,scoredAt:new Date().toISOString(),oracleRevision:{pairDefinition:index.pairDefinition,recordSHA256:subject.recordsSHA256},candidatePolicy:result.candidatePolicy});
for(const name of ['evaluation-v2.json','evaluation.json'])write(path.join(run,name),report,{overwrite:true});
write(path.join(run,'status.json'),{status:result.status,scoringRepaired:true},{overwrite:true});
console.log(JSON.stringify({subject:key,correct:report.correct,gt:report.groundTruthPairs,rate:report.recoveryRate}));
