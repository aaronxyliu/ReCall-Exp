import {sourceLibrary} from './library-scope.mjs'
// Independently resolve each recorded span from the captured script and its exact map.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import {SourceMapConsumer} from 'source-map'
import {parse} from '@babel/parser'
const [folder,scratch]=process.argv.slice(2)
const artifactPath=(hash,extension)=>fs.existsSync(path.join(scratch,hash+'.'+extension)) ? path.join(scratch,hash+'.'+extension) : path.join(scratch,extension==='js'?'runtime-js':'source-maps',hash+'.'+extension)
const json=file=>JSON.parse(fs.readFileSync(file))
const report=json(path.join(folder,'relations.json')), capture=json(path.join(folder,'capture.json'))
assert.equal(report.imageID,capture.imageID)
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex')
const selection=json(path.join(folder,'selection.json'))
const maps=new Map(),codes=new Map(),trees=new Map(),sourceContents=new Map()
function identify(id){
 const match=/^(.*)#([a-f0-9]{64})@(\d+)-(\d+)$/s.exec(id)
 assert(match)
 return {url:match[1],hash:match[2],start:Number(match[3]),end:Number(match[4])}
}
function tree(code,id){
 if(!trees.has(id.hash)){
   let ast
   for(const plugins of [['jsx','decorators-legacy'],['jsx','typescript','decorators-legacy']]){
     try{ast=parse(code,{sourceType:'unambiguous',allowReturnOutsideFunction:true,plugins});break}catch{}
   }
   assert(ast)
   const funcs=new Map(),stack=[ast.program]
   while(stack.length){
     const n=stack.pop()
     if(!n||typeof n!=='object')continue
     if(n.body&&/^(?:ArrowFunctionExpression|Function(?:Expression|Declaration)|(?:ClassPrivate|Object|Class)Method)$/.test(n.type))funcs.set(n.start+'-'+n.end,n)
     for(const value of Object.values(n))if(value&&typeof value==='object')stack.push(value)
   }
   trees.set(id.hash,funcs)
 }
 const n=trees.get(id.hash).get(id.start+'-'+id.end)
 assert(n)
 // Check the whole function, including flags and any type annotations.
 return JSON.stringify(n,(k,v)=>['start','end','loc','extra','leadingComments','innerComments','trailingComments','comments'].includes(k)?undefined:v)
}
for(const pair of report.pairs){
 const g=identify(pair.bundled),s=identify(pair.source)
 const owner=sourceLibrary(s.url,selection);assert(owner,'Source is outside selected libraries');assert.equal(owner.name,pair.library)
 if(report.scopePolicy){assert.equal(report.scopePolicy,'per-library-source/full-bundle-v1');assert.equal(owner.id,pair.libraryScope);assert(report.libraryReports.some(r=>r.libraryUnit.id===owner.id&&r.pairs.some(p=>p.source===pair.source&&p.bundled===pair.bundled)))}
 const asset=capture.assets.find(a=>a.url===g.url&&a.sha256===g.hash)
 assert(asset)
 if(selection.moduleScope)assert(selection.moduleScope.assets.some(a=>a.role==='module-build-output'&&a.url===asset.url&&a.sha256===asset.sha256&&a.mapSHA256===asset.map.sha256),'Pair comes from an unapproved module asset')
 if(!codes.has(g.hash)){
   const code=fs.readFileSync(artifactPath(g.hash,'js'),'utf8')
   assert.equal(sha(code),g.hash)
   codes.set(g.hash,code)
 }
 if(!maps.has(asset.map.sha256)){
   const bytes=fs.readFileSync(artifactPath(asset.map.sha256,'map'))
   assert.equal(sha(bytes),asset.map.sha256)
   maps.set(asset.map.sha256,new SourceMapConsumer(JSON.parse(bytes.toString().replace(/^\)\]\}'[^\n]*\n/,''))))
 }
 const sourceKey=asset.map.sha256+'\0'+s.url
 if(!sourceContents.has(sourceKey)){
   const content=maps.get(asset.map.sha256).sourceContentFor(s.url)
   sourceContents.set(sourceKey,{content,hash:sha(content)})
 }
 const original=sourceContents.get(sourceKey).content
 assert.equal(sourceContents.get(sourceKey).hash,s.hash)
 if(selection.sourceOwnership?.[s.url]){assert.equal(selection.sourceOwnership[s.url].sha256,s.hash);assert.equal(selection.sourceOwnership[s.url].library,pair.library)}
 tree(original,s);tree(codes.get(g.hash),g)
 // Legacy files may contain this field; new collections store relationships only.
 if('syntaxIdentical' in pair)assert.equal(tree(original,s)===tree(codes.get(g.hash),g),pair.syntaxIdentical)
}
fs.writeFileSync(path.join(folder,'pair-audit.json'),JSON.stringify({commit:report.commit,imageID:capture.imageID,verifiedPairs:report.pairs.length,checks:['script and map SHA-256','mapped source SHA-256','both function spans']},null,2)+'\n')
