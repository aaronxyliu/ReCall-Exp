// Offline replay of supplied graph input units; no models or recovery worker.
import fs from 'node:fs';import zlib from 'node:zlib';
import {Analyzer} from '../../ReCall/src/engine/analyzer.mjs';
import {graphLanguage} from '../../ReCall/src/analysis/graph-syntax.mjs';
const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('Usage: node replay-graph-syntax.mjs units.json[.gz] summary.json');
const bytes=fs.readFileSync(input),units=JSON.parse(input.endsWith('.gz')?zlib.gunzipSync(bytes):bytes),groups={};
for(const unit of units){const r=groups[unit.repo||'supplied']??={files:0,metadataOrAssets:0,analyzed:0,errors:[],diagnostics:{}};r.files++;
 try{if(graphLanguage(unit.path)==='asset')r.metadataOrAssets++;const a=new Analyzer();a.addUnit({...unit,functions:[]});const v=a.solve();r.errors.push(...v.errors);if(!v.errors.length)r.analyzed++;for(const d of v.diagnostics)r.diagnostics[d.kind]=(r.diagnostics[d.kind]||0)+1}catch(error){r.errors.push({file:unit.path,error:error.message})}}
const result={at:new Date().toISOString(),scope:'Isolated replay of previously failing whole-file graph inputs; no dependency closure rebuild, ranking, Qwen, or recovery-rate measurement.',groups};fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
