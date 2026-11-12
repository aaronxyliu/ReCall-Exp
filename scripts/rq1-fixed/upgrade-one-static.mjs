import fs from 'node:fs';import path from 'node:path';import {upgradeSubject} from './upgrade-state.mjs';import {normalizeConfig} from './runtime.mjs';
const [baselineArg,folderArg]=process.argv.slice(2),baseline=path.resolve(baselineArg),folder=path.resolve(folderArg),read=p=>JSON.parse(fs.readFileSync(p)),input=path.join(folder,'input');
fs.mkdirSync(folder,{recursive:true});if(!fs.existsSync(input))fs.symlinkSync(fs.realpathSync(path.join(baseline,'input')),input,'dir');
console.log(await upgradeSubject({baseline,folder,config:normalizeConfig(read(path.join(baseline,'experiment.json')).config),manifests:{sourceManifest:read(path.join(input,'sourceManifest.json')),bundleManifest:read(path.join(input,'bundleManifest.json'))},external:true}));
