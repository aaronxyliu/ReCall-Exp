// Read-only verification before the remote driver mutates any run artifacts.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {implementationDigest} from '../../../../ReCall/src/workflow/run.mjs';
const root=path.resolve(process.argv[2]);
const read=p=>JSON.parse(fs.readFileSync(p));
const manifest=read(path.join(root,'migration-manifest.json'));
for(const [file,expected] of Object.entries(manifest.files)){
 const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
 assert.equal(actual,expected,`Transfer mismatch: ${file}`);
}
const impl=implementationDigest();
for(const file of Object.keys(manifest.files).filter(p=>p.endsWith('/run/run.json'))){
 const run=read(path.join(root,file));
 assert.equal(run.node,process.version,'Node.js version changed');
 assert.equal(run.implementationDigest,impl,'Implementation changed');
}
const models=(await (await fetch('http://127.0.0.1:11435/api/tags')).json()).models;
const expected={
 'qwen3.5:27b':'64ae5b1d651fb2709d5928ccb8dcfb4bb2cc9c2c8001ac34497e36a6cf905b59',
 'qwen3-embedding:0.6b':'ac6da0dfba84a81fdbfbaf330198c33cd77c4cdfc53e8bc50eb581914a15621d'
};
for(const [name,digest] of Object.entries(expected))assert.equal(models.find(m=>m.name===name)?.digest,digest,`Model changed: ${name}`);
const audit={at:new Date().toISOString(),verifiedFiles:Object.keys(manifest.files).length,cacheEntries:manifest.cacheEntries,node:process.version,implementationDigest:impl,modelDigests:expected};
fs.writeFileSync(path.join(root,'migration-verification.json'),JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify(audit));
