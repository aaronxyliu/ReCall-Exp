import fs from 'node:fs';
import path from 'node:path';
import {runDirectory} from '../../../ReCall/src/workflow/run.mjs';
const [folder]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p));
const input=path.join(folder,'input');
if(read(path.join(input,'source.json')).referenceOrigin!=='independent-package-directory')throw Error('Independent source packages required');
await runDirectory({sourceManifest:read(path.join(input,'source.json')),bundleManifest:read(path.join(input,'bundle.json')),config:{},output:path.join(folder,'run'),onProgress:e=>fs.writeFileSync(path.join(folder,'live.json'),JSON.stringify({at:new Date().toISOString(),...e}))});
