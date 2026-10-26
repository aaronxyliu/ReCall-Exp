import fs from 'node:fs';import path from 'node:path';
export function loadDetector(dir){const d=JSON.parse(fs.readFileSync(path.join(dir,'detector-input.json')));if(d.sourceShards){d.sources=d.sourceShards.map(p=>JSON.parse(fs.readFileSync(path.join(dir,p))));d.bundles=d.bundleShards.map(p=>JSON.parse(fs.readFileSync(path.join(dir,p))))}return d}
export function writeDetector(dir,{policy,sources,bundles}){
 const save=(items,kind)=>items.map((v,i)=>{const p=`inventory-shards/${kind}-${i}.json`;fs.mkdirSync(path.join(dir,'inventory-shards'),{recursive:true});const fd=fs.openSync(path.join(dir,p),'w');
 // Serialize functions individually so aggregate strings never reach V8's ~512MB limit.
 fs.writeSync(fd,'{');for(const [j,[key,value]]of Object.entries(v).entries()){if(j)fs.writeSync(fd,',');fs.writeSync(fd,JSON.stringify(key)+':');if(key==='functions'){fs.writeSync(fd,'[');value.forEach((f,i)=>{if(i)fs.writeSync(fd,',');fs.writeSync(fd,JSON.stringify(f))});fs.writeSync(fd,']')}else fs.writeSync(fd,JSON.stringify(value))}fs.writeSync(fd,'}\n');fs.closeSync(fd);return p});
 const sourceShards=save(sources,'source'),bundleShards=save(bundles,'bundle');fs.writeFileSync(path.join(dir,'detector-input.json'),JSON.stringify({policy,sourceShards,bundleShards},null,2)+'\n');
}
