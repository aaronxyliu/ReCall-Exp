import path from 'node:path';
import {output,read,write,now} from './common.mjs';
const data=read(path.join(output,'detector-input.json')),gt=new Map(read(path.join(output,'ground-truth.json')).records.map(g=>[g.bundleId,g]));
const source=new Map();for(const f of data.sources.flatMap(s=>s.functions)){if(!source.has(f.astHash))source.set(f.astHash,[]);source.get(f.astHash).push(f)}
const builds=[];
for(const b of data.bundles){const groups=new Map();for(const f of b.functions){if(!groups.has(f.astHash))groups.set(f.astHash,[]);groups.get(f.astHash).push(f)}const records=[];
 for(const [key,fs] of groups){const refs=source.get(key);if(fs.length!==1||refs?.length!==1)continue;const f=fs[0],s=refs[0],g=gt.get(f.id);records.push({bundleId:f.id,sourceId:s.id,oracle:g?.nonTarget?'wrong':!g?.sourceId?'unassessed':g.sourceId===s.id?'correct':'wrong'})}
 const correct=records.filter(r=>r.oracle==='correct').length,wrong=records.filter(r=>r.oracle==='wrong').length,known=[...gt.values()].filter(g=>g.build===b.build&&g.sourceId).length;
 builds.push({build:b.build,predictions:records.length,correct,wrong,unassessed:records.length-correct-wrong,conditionalPrecision:correct+wrong?100*correct/(correct+wrong):null,correctRecovery:100*correct/known,records});
}
write(path.join(output,'ast-baseline.json'),{created:now(),method:'Auxiliary static baseline: exact normalized own-function AST hash, unique in all reference and bundle functions. Normalization erases identifier spelling except selected builtins and parameter roles; preserves properties/operators/literals and replaces nested bodies. Free-binding equivalence is not proved. No model calls or source-map-guided prediction.',builds});
console.log(builds.map(({records,...b})=>b));
