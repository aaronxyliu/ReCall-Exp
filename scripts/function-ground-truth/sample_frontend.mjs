// Select from declared libraries with actual source-map points in a captured frontend.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {SourceMapConsumer} from 'source-map'
const [folder,raw,checkout]=process.argv.slice(2)
const read=name=>JSON.parse(fs.readFileSync(path.join(folder,name)))
const save=(name,data)=>fs.writeFileSync(path.join(folder,name),JSON.stringify(data,null,2)+'\n')
const capture=read('capture.json'), sample=read('selection.json')
const original='selection-before-frontend.json'
if(!fs.existsSync(path.join(folder,original)))save(original,sample)
const base=read(original)
if(base.commit!==capture.commit)throw Error('Commit mismatch')
const manifest=JSON.parse(execFileSync('git',['-C',checkout,'show',base.commit+':'+base.manifest]))
const sha=value=>crypto.createHash('sha256').update(value).digest('hex')
const evidence=new Map()
for(const asset of capture.assets){
 if(!asset.map.sha256)continue
 const bytes=fs.readFileSync(path.join(raw,asset.map.sha256+'.map'))
 if(sha(bytes)!==asset.map.sha256)throw Error('Map hash mismatch')
 const map=JSON.parse(bytes)
 // Decode each section independently; positions in the generated file are not needed for membership.
 function visit(m){
  if(m.sections){for(const s of m.sections)visit(s.map);return}
  const consumer=new SourceMapConsumer(m),sources=new Set()
  consumer.eachMapping(point=>{if(point.originalLine!=null&&point.source)sources.add(point.source)})
  for(const source of sources){
   const names=[...source.replaceAll('\\','/').matchAll(/(?:^|\/)(?:node_modules|~)\/((?:@[^/]+\/)?[^/]+)/g)]
   const name=names.at(-1)?.[1]
   if(!name||name.startsWith('@types/'))continue
   if(!evidence.has(name))evidence.set(name,new Set())
   evidence.get(name).add(asset.sha256)
  }
 }
 visit(map)
}
const pool=Object.keys(base.eligible).filter(name=>evidence.has(name))
let field='dependencies'
if(!pool.length){
 field='devDependencies'
 pool.push(...Object.entries(manifest.devDependencies||{}).filter(([name,spec])=>evidence.has(name)&&!/^(workspace:|link:|file:|portal:)/.test(spec)).map(([name])=>name))
}
const seed='recall-frontend-visible-v1',rank=name=>sha([seed,base.commit,name].join('\0'))
pool.sort((a,b)=>rank(a).localeCompare(rank(b)))
save('selection.json',{...base,seed,selected:pool.slice(0,10),samplingRule:'frontend-visible-v1',frontendPoolField:field,frontendPool:pool,frontendImageID:capture.imageID,
 frontendEvidence:Object.fromEntries(pool.map(name=>[name,[...evidence.get(name)].sort()]))})
console.log(base.repo,field,pool.length,pool.slice(0,10))
