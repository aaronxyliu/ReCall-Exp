import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {prepare} from './prepare.mjs';
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
test('reference preparation retains whole source texts and deduplicates map URL aliases',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'recall-prep-test-'));
 try{
  for(const dir of ['runtime-js','source-maps'])fs.mkdirSync(path.join(root,dir));
  const code='export function a(){return 1} export function unused(){return 2}',script='function a(){return 1}',sh=hash(script);
  fs.writeFileSync(path.join(root,'runtime-js',sh+'.js'),script);
  const assets=['node_modules/lib/src/a.js','../../node_modules/lib/src/a.js'].map((source,i)=>{
   const text=JSON.stringify({version:3,sources:[source],sourcesContent:[code],names:[],mappings:'AAAA'}),mh=hash(text);
   fs.writeFileSync(path.join(root,'source-maps',mh+'.map'),text);
   return {url:`<local>/${i}.js`,sha256:sh,channels:['http'],map:{status:'map-found',sha256:mh}};
  });
  const record=JSON.stringify({pairs:[],capture:{assets}});fs.writeFileSync(path.join(root,'record.json'),record);
  const output=path.join(root,'prepared'),m=prepare(root,{records:'record.json',recordsSHA256:hash(record),selectedLibraries:['lib']},output);
  assert.equal(m.sourceManifest.files.length,1);assert.equal(m.bundleManifest.files.length,2);
  assert.equal(fs.readFileSync(m.sourceManifest.files[0].path,'utf8'),code);
  assert(m.sourceManifest.files[0].path.endsWith('/src/a.js'));
  const ids=JSON.parse(fs.readFileSync(path.join(output,'identities.json'))).source;
  assert.equal(Object.keys(ids).length,2);assert.equal(new Set(Object.values(ids)).size,1);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
