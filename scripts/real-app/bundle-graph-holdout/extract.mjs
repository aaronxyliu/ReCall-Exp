// Holdout adapter only. Imports the frozen analyzer without changing its options.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {Analyzer} from '../bundle-graph-v2/analyzer.mjs';
import {moduleGraph} from '../bundle-graph-v2/module-graph.mjs';
import {collectContext} from '../bundle-graph-v2/context.mjs';
const [slug,side]=process.argv.slice(2),base=path.resolve('results/real-app/bundle-graph-v2-holdout'),dir=base+'/subjects/'+slug;
const read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const [p,h]of Object.entries(read(base+'/analyzer-freeze.json').files))assert.equal(sha(p),h,'Frozen code changed: '+p);
assert(['source','bundle'].includes(side));assert(!fs.existsSync(dir+'/'+side+'-relations.json'));
const d=read(dir+'/detector-input.json'),prep=read(dir+'/prepared.json'),art=read(dir+'/artifacts.json'),a=new Analyzer(),start=Date.now();
const rows=d[side==='source'?'sourceShards':'bundleShards'],specs=[];let skipped=0;
for(const p of rows){const row=read(dir+'/'+p);if(row.parseError){skipped++;continue}
 const code=fs.readFileSync(dir+'/'+(side==='source'?row.sourceFile:row.file),'utf8'),functions=row.functions.map(f=>({id:f.id,span:f.span}));
 if(side==='source')a.addUnit({id:row.key,path:path.posix.normalize(row.file.replace(/^webpack:\/\/\//,'')),code,functions});
 else specs.push({id:row.build,path:prep.bundles.find(b=>b.build===row.build).artifact.js,code,functions,contextOnly:false,aliasPaths:art.files.filter(f=>f.jsSha256===row.sha256).map(f=>f.js)});
 if(global.gc&&a.units.length%100===0)global.gc();
}
let contextInfo=null;
if(side==='bundle'){
 const existing=new Set(specs.flatMap(s=>[s.path,...s.aliasPaths]));
 for(const f of art.contextJavaScript)if(!existing.has(f.path)){assert.equal(sha(f.path),f.sha256);specs.push({path:f.path,functions:[],contextOnly:true});existing.add(f.path)}
 const c=collectContext(specs,{roots:art.roots});
 contextInfo={...c,units:c.units.map(({code,functions,...u})=>({...u,matchableFunctions:functions.length}))};
 for(let i=0;i<c.units.length;i++){a.addUnit({...c.units[i],runtimeGroup:'manifest-build'});if(global.gc&&i%20===0)global.gc()}
}
const r=a.solve();r.moduleGraph=moduleGraph(a);r.context=contextInfo;
r.provenance={detectorSha256:sha(dir+'/detector-input.json'),analyzerSha256:sha(new URL('../bundle-graph-v2/analyzer.mjs',import.meta.url)),extractorSha256:sha(new URL(import.meta.url)),elapsedMs:Date.now()-start,skipped};
fs.writeFileSync(dir+'/'+side+'-relations.json',JSON.stringify(r)+'\n');
console.log(JSON.stringify({slug,side,edges:r.edges.length,modules:r.moduleGraph.modules.length,errors:r.errors,elapsedMs:r.provenance.elapsedMs}));
