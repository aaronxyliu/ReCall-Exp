// Static-only continuation preparation. Never invokes recovery or a model.
import fs from 'node:fs';import path from 'node:path';
import {upgradeSubject} from './upgrade-state.mjs';import {normalizeConfig} from './runtime.mjs';
const [baselineRoot,outputRoot]=process.argv.slice(2);if(!baselineRoot||!outputRoot)throw Error('Usage: prepare-upgrade BASELINE OUTPUT');
const read=p=>JSON.parse(fs.readFileSync(p));const baseline=path.resolve(baselineRoot),root=path.resolve(outputRoot),state={at:new Date().toISOString(),prepared:[],skipped:[],failures:[]};
for(const bundler of fs.readdirSync(baseline,{withFileTypes:true}).filter(e=>e.isDirectory()))for(const subject of fs.readdirSync(path.join(baseline,bundler.name),{withFileTypes:true}).filter(e=>e.isDirectory())){
 const key=bundler.name+'/'+subject.name,old=path.join(baseline,key),folder=path.join(root,key),input=path.join(folder,'input');
 if(!fs.existsSync(path.join(old,'timing.json'))){state.skipped.push(key);continue}
 try{fs.mkdirSync(folder,{recursive:true});if(!fs.existsSync(input))fs.symlinkSync(fs.realpathSync(path.join(old,'input')),input,'dir');const oldConfig=read(path.join(old,'experiment.json')).config;const config=normalizeConfig(oldConfig);const record=await upgradeSubject({baseline:old,folder,config,manifests:{sourceManifest:read(path.join(input,'sourceManifest.json')),bundleManifest:read(path.join(input,'bundleManifest.json'))},external:true});state.prepared.push({key,accepted:record.acceptedPreserved,unmatched:record.unmatched});console.log(JSON.stringify(state.prepared.at(-1)))}catch(e){state.failures.push({key,error:e.stack});console.log(JSON.stringify(state.failures.at(-1)))}
 state.at=new Date().toISOString();fs.writeFileSync(path.join(root,'static-upgrade-status.json'),JSON.stringify(state,null,2));if(global.gc)global.gc();
}

state.complete=true;state.at=new Date().toISOString();fs.writeFileSync(path.join(root,'static-upgrade-status.json'),JSON.stringify(state,null,2));
