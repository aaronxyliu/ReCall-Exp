import path from 'node:path';
import {output,read,write,now,selectedBuilds} from './common.mjs';
const data=read(path.join(output,'detector-input.json')),truth=new Map(read(path.join(output,'ground-truth.json')).records.map(g=>[g.bundleId,g]));
const refs=data.sources.flatMap(s=>s.functions),sourceGroups=new Map();
for(const f of refs)if(f.propertyOperations>=10&&f.pogHash){if(!sourceGroups.has(f.pogHash))sourceGroups.set(f.pogHash,[]);sourceGroups.get(f.pogHash).push(f)}
const builds=[];
for(const b of selectedBuilds(data.bundles)){const groups=new Map();for(const f of b.functions)if(f.propertyOperations>=10&&f.pogHash){if(!groups.has(f.pogHash))groups.set(f.pogHash,[]);groups.get(f.pogHash).push(f)}
 const records=[];for(const [pog,items] of groups){const source=sourceGroups.get(pog);if(items.length!==1||source?.length!==1)continue;const target=items[0],ref=source[0],g=truth.get(target.id);records.push({bundleId:target.id,sourceId:ref.id,pogHash:pog,bundleFeatureCount:target.propertyOperations,sourceFeatureCount:ref.propertyOperations,oracle:g?.nonTarget?'wrong':!g?.sourceId?'unassessed':g.sourceId===ref.id?'correct':'wrong'})}
 builds.push({build:b.build,total:records.length,correct:records.filter(r=>r.oracle==='correct').length,wrong:records.filter(r=>r.oracle==='wrong').length,unassessed:records.filter(r=>r.oracle==='unassessed').length,records});
}
write(path.join(output,'anchor-evaluation.json'),{created:now(),policy:'Exact POG unique among eligible reference functions and eligible bundle definitions; oracle applied only after prediction.',builds});
console.log(builds.map(({records,...b})=>b));
