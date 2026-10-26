import {loadDetector} from './io.mjs';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {inventory as original} from '../../jquery/inventory.mjs';import {inventory as current} from './inventory/inventory.mjs';import {parseModule} from './parse.mjs';
const root='results/real-app/bundling-dataset',checks=[];
for(const slug of fs.readdirSync(root)){
 const p=path.join(root,slug,'prepared.json');if(!fs.existsSync(p))continue;
 const prepared=JSON.parse(fs.readFileSync(p)),d=loadDetector(path.join(root,slug));const successes=[];
 for(const s of d.sources.filter(s=>s.parseError)){try{const ast=parseModule(fs.readFileSync(path.join(root,slug,s.sourceFile),'utf8'),{next:true,ranges:true,loc:true});successes.push({file:s.file,parser:ast.__parser})}catch{}}
 checks.push({slug,previousSourceFailures:prepared.parseFailures.length,newlyParsable:successes});
}
const sample='function f(a){return a.x(a.y)} function g(b){return f(b)}';const a=original(sample,'test','test.js'),b=current(sample,'test','test.js');delete b.parser;assert.deepEqual(a,b);
fs.writeFileSync(root+'/parser-compatibility.json',JSON.stringify({frozenValidJavaScriptInventoryEqual:true,checks},null,2)+'\n');console.log(JSON.stringify(checks.map(x=>({slug:x.slug,failures:x.previousSourceFailures,newlyParsable:x.newlyParsable.length})),null,2));
