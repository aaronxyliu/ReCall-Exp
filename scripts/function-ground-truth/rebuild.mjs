/** Rebuild relationships from frozen captures; never recapture or overwrite inputs.
 * Shared JS/maps stay in the original folder. Capture localPath entries in the
 * revision are relative references to those immutable, hash-checked artifacts.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
const [inputArg,outputArg]=process.argv.slice(2)
if(!inputArg||!outputArg)throw Error('Usage: node rebuild.mjs EXISTING_GROUND_TRUTH NEW_OUTPUT')
const input=path.resolve(inputArg),output=path.resolve(outputArg),scripts=path.dirname(fileURLToPath(import.meta.url))
if(fs.existsSync(output))throw Error('Output already exists; choose a fresh revision')
const originalBytes=fs.readFileSync(path.join(input,'func-mapping.json')),original=JSON.parse(originalBytes)
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'recall-rebuild-')),sha=x=>createHash('sha256').update(x).digest('hex')
try{
 const selection=original.selection||{repo:original.repo,commit:original.provenance?.commit,selected:original.selectedLibraries}
 if(!selection.selected?.length||!original.capture?.assets)throw Error('Missing selected libraries or capture manifest')
 fs.writeFileSync(path.join(scratch,'selection.json'),JSON.stringify(selection))
 fs.writeFileSync(path.join(scratch,'capture.json'),JSON.stringify(original.capture))
 for(const script of ['relations.mjs','verify_pairs.mjs'])execFileSync(process.execPath,['--max-old-space-size=4096',path.join(scripts,script),scratch,input],{stdio:'inherit'})
 const relations=JSON.parse(fs.readFileSync(path.join(scratch,'relations.json'))),audit=JSON.parse(fs.readFileSync(path.join(scratch,'pair-audit.json')))
 const capture={...original.capture,assets:original.capture.assets.map(a=>({...a,
  localPath:path.relative(output,path.join(input,'runtime-js',a.sha256+'.js')),
  map:{...a.map,...(a.map?.sha256?{localPath:path.relative(output,path.join(input,'source-maps',a.map.sha256+'.map'))}:{})}}))}
 const result={...original,...relations,capture,audit,rebuild:{inputRecordSHA256:sha(originalBytes),
  sharedArtifacts:path.relative(output,input),selectionPolicy:'Frozen original selection; historical sampling counts are not recomputed.',
  collectorSHA256:Object.fromEntries(['relations.mjs','function-inventory.mjs','verify_pairs.mjs'].map(f=>[f,sha(fs.readFileSync(path.join(scripts,f)))]))}}
 fs.mkdirSync(output,{recursive:true})
 fs.writeFileSync(path.join(output,'func-mapping.json'),JSON.stringify(result,null,2)+'\n')
 console.log(JSON.stringify({oldPairs:original.pairs.length,newPairs:result.pairs.length,output}))
}finally{fs.rmSync(scratch,{recursive:true,force:true})}
