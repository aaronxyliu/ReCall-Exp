import fs from 'node:fs';
import path from 'node:path';
import {runDirectory} from '../../../ReCall/src/workflow/run.mjs';
const [folder]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p));
const input=path.join(folder,'input'),output=path.join(folder,'run');
if(read(path.join(input,'source.json')).referenceOrigin!=='independent-package-directory')throw Error('Historical/map-derived inputs cannot be used for new isolated recovery. Export fresh independent package references into a new experiment directory.');
const config=read(path.join(input,'known-reference-config.json'));
if(process.env.RECALL_MODEL_CACHE)config.models={...config.models,cacheDir:path.resolve(process.env.RECALL_MODEL_CACHE)};
await runDirectory({sourceManifest:read(path.join(input,'source.json')),bundleManifest:read(path.join(input,'bundle.json')),config,output,resume:process.argv.includes('--resume'),onProgress:e=>{fs.writeFileSync(path.join(folder,'live.json'),JSON.stringify({at:new Date().toISOString(),...e}));}});
