// Independent scoring of atomic checkpoints; GT never enters the recovery API.
import fs from 'node:fs';import path from 'node:path';import {readJSON as read,writeJSON as write} from './runtime.mjs';import {score} from './evaluate.mjs';
const [dataset,root]=process.argv.slice(2),index=read(path.join(dataset,'one-to-one-evaluation-v2.json')),seen=new Map();
while(true){const status={at:new Date().toISOString(),completed:0,checkpoints:0,failures:[]};
 for(const s of index.subjects){const run=path.join(root,s.subject,'run'),final=fs.existsSync(path.join(run,'evaluation-v2.json'));if(final){status.completed++;continue}const checkpoint=path.join(run,'checkpoint.json');if(!fs.existsSync(checkpoint)||!fs.existsSync(path.join(run,'source.json')))continue;
  try{const st=fs.statSync(checkpoint),signature=st.mtimeMs+':'+st.size;if(seen.get(s.subject)===signature){status.checkpoints++;continue}const report=score(read(path.join(dataset,s.records)),read(path.join(root,s.subject,'input/identities.json')),read(path.join(run,'source.json')),read(path.join(run,'bundle.json')),read(checkpoint));report.partial=true;report.scoredAt=new Date().toISOString();write(path.join(run,'checkpoint-evaluation-v2.json'),report,{overwrite:true});seen.set(s.subject,signature);status.checkpoints++}catch(e){status.failures.push({subject:s.subject,error:e.message})}
 }
 write(path.join(root,'revision-scoring-status.json'),status,{overwrite:true});if(fs.existsSync(path.join(root,'progress.json'))&&read(path.join(root,'progress.json')).finishedAt)break;await new Promise(r=>setTimeout(r,30000));
}
