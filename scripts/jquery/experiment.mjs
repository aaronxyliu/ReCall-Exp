import {spawn} from 'node:child_process';
import path from 'node:path';
// Keep the previous abstaining-policy experiment intact.
process.env.EXPERIMENT_OUTPUT ||= 'results/jquery-4.0.0/minified-no-tree-shaking-mapping-v8';
const {output,write,now}=await import('./common.mjs');
const stages=[];
async function run(file,args=[]){
 const stage={file,started:now(),status:'running'};stages.push(stage);write(path.join(output,'execution-status.json'),{status:'running',stages});console.log('STAGE START',file,stage.started);
 const command=file.endsWith('.py')?'python3':process.execPath;
 const code=await new Promise((resolve,reject)=>{const child=spawn(command,['scripts/jquery/'+file,...args],{stdio:'inherit',env:{...process.env,VALIDATOR_THINK:'false'}});child.on('error',reject);child.on('exit',resolve)});
 stage.finished=now();stage.exitCode=code;stage.status=code===0?'complete':'failed';write(path.join(output,'execution-status.json'),{status:code===0?'running':'failed',stages});if(code!==0)throw new Error(file+' exited '+code);console.log('STAGE END',file,stage.finished);
}
// Historical thinking diagnostics are preserved; do not run them again.
await run('recover.mjs');
await run('report.mjs');
await run('anchors.mjs');
await run('verify.mjs',['--complete']);
await run('analyze-recovery-bottlenecks.py');
write(path.join(output,'execution-status.json'),{status:'complete',finished:now(),stages});
