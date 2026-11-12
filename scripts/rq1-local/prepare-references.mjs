// Reconstruct independent packages from source-only collection provenance.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {execFileSync} from 'node:child_process';
import {fetchReference} from '../../../ReCall/src/workflow/inputs.mjs';
const base=path.resolve(import.meta.dirname,'../../..'),data=path.join(base,'ReCall Dataset/qualified-dataset'),out=path.resolve(process.argv[2]);
const read=p=>JSON.parse(fs.readFileSync(p)),index=read(path.join(data,'index.json')),receiptsFile=path.join(out,'receipts.json'),receipts=fs.existsSync(receiptsFile)?read(receiptsFile):[];
fs.mkdirSync(out,{recursive:true});
const selected=process.argv[3];if(selected&&!index.subjects.some(s=>s.subject===selected))throw Error('Unknown subject '+selected);
for(const subject of index.subjects.filter(s=>!selected||s.subject===selected)){
 const q=read(path.join(data,subject.subject,'qualification.json')),folder=path.join(out,'subjects',subject.subject);fs.mkdirSync(folder,{recursive:true});
 for(const name of subject.selectedLibraries){
  const origin=q.libraries.find(x=>x.library===name)?.origin;if(!origin)throw Error('Missing provenance '+name);
  const key=crypto.createHash('sha256').update(JSON.stringify(origin)).digest('hex');let source;
  if(origin.kind==='npm-package'){
   for(let attempt=1;attempt<=4;attempt++){
    try{source=await fetchReference({name:origin.name,version:origin.version},{cacheDir:path.join(out,'npm-cache')});break}
    catch(error){if(attempt===4)throw error;console.error('Reference fetch retry',attempt,name,origin.version,error.message);await new Promise(resolve=>setTimeout(resolve,attempt*2000));}
   }
   const archive=fs.readFileSync(path.join(source,'../package.tgz'));
   if(origin.tarballSHA256&&crypto.createHash('sha256').update(archive).digest('hex')!==origin.tarballSHA256)throw Error('Collection tarball mismatch '+name);
   if(origin.integrity&&!origin.integrity.split(/\s+/).some(token=>{const m=/^(sha512|sha384|sha256|sha1)-(.+)$/.exec(token);return m&&crypto.createHash(m[1]).update(archive).digest('base64')===m[2]}))throw Error('Collection integrity mismatch '+name);
  }else if(origin.kind==='pinned-repository-source'){
   const checkout=path.join(out,'git-cache',key);if(!fs.existsSync(path.join(checkout,'.git'))){fs.mkdirSync(checkout,{recursive:true});execFileSync('git',['init',checkout]);execFileSync('git',['-C',checkout,'remote','add','origin','https://github.com/'+subject.repo+'.git']);execFileSync('git',['-C',checkout,'fetch','--depth=1','origin',origin.commit],{stdio:'inherit'});execFileSync('git',['-C',checkout,'checkout','--detach','FETCH_HEAD'],{stdio:'inherit'});}
   if(execFileSync('git',['-C',checkout,'rev-parse','HEAD'],{encoding:'utf8'}).trim()!==origin.commit)throw Error('Pinned commit mismatch');
   source=path.join(checkout,origin.path);const pkg=read(path.join(source,'package.json'));if(pkg.name!==name||pkg.version!==origin.version)throw Error('Pinned package identity mismatch');
  }else throw Error('Unsupported provenance '+origin.kind);
  const link=path.join(folder,key);if(!fs.existsSync(link))fs.cpSync(source,link,{recursive:true,dereference:true});
  const prior=receipts.findIndex(x=>x.subject===subject.subject&&x.name===name);if(prior>=0)receipts.splice(prior,1);
  receipts.push({subject:subject.subject,name,origin,source});fs.writeFileSync(path.join(out,'receipts.json'),JSON.stringify(receipts,null,2));console.log(subject.subject,name,origin.version);
 }
}
