import {fileURLToPath} from 'node:url'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {SourceMapGenerator} from 'source-map'
import {functionInventory} from './function-inventory.mjs'
const sha=x=>createHash('sha256').update(x).digest('hex')
function collect(source,bundle,positions){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'recall-relations-test-'))
 try{
  const url='webpack:///node_modules/fixture/index.js',map=new SourceMapGenerator({file:'bundle.js'})
  map.setSourceContent(url,source)
  for(const [g,s]of positions)map.addMapping({generated:{line:1,column:g},original:{line:1,column:s},source:url})
  const bytes=map.toString(),jsHash=sha(bundle),mapHash=sha(bytes)
  fs.writeFileSync(path.join(dir,jsHash+'.js'),bundle);fs.writeFileSync(path.join(dir,mapHash+'.map'),bytes)
  fs.writeFileSync(path.join(dir,'selection.json'),JSON.stringify({selected:['fixture']}))
  fs.writeFileSync(path.join(dir,'capture.json'),JSON.stringify({assets:[{url:'bundle.js',sha256:jsHash,map:{status:'map-found',sha256:mapHash}}]}))
  execFileSync(process.execPath,[fileURLToPath(new URL('./relations.mjs',import.meta.url)),dir,dir])
  execFileSync(process.execPath,[fileURLToPath(new URL('./verify_pairs.mjs',import.meta.url)),dir,dir])
  return JSON.parse(fs.readFileSync(path.join(dir,'relations.json')))
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
}
test('assignment boundary does not veto independently supported body',()=>{
 const s='exports.ref=function(){return {current:null}};',g='x.ref=function(){return {current:null}};'
 const r=collect(s,g,[[g.indexOf('function'),s.indexOf('=')],[g.indexOf('return'),s.indexOf('return')],[g.indexOf('current'),s.indexOf('current')],[g.indexOf('null'),s.indexOf('null')]])
 assert.equal(r.pairs.length,1);assert.equal(r.evidence.ignoredBoundaryPoints,1)
 assert.equal(r.pairDefinition,'reciprocal-body-mapped-v2')
})
test('nested callback header is not a second body relationship',()=>{
 const s='function f(a){setTimeout(function(){throw a;});return a;}',g='function h(b){setTimeout(function(){throw b});return b}'
 const at=(x,token,last=false)=>last?x.lastIndexOf(token):x.indexOf(token)
 const r=collect(s,g,[[at(g,'setTimeout'),at(s,'setTimeout')],[g.indexOf('function',1),at(s,'setTimeout')],[at(g,'throw'),at(s,'throw')],[g.indexOf('b}',g.indexOf('throw')),s.indexOf('a;',s.indexOf('throw'))],[at(g,'return'),at(s,'return')],[at(g,'b}',true),at(s,'a;',true)]])
 assert.equal(r.pairs.length,2);assert.equal(r.observedSplit.count,0);assert.equal(r.observedCombine.count,0)
})
test('substantive competing body provenance remains ambiguous',()=>{
 const s='function a(){return left()}function b(){return right()}',g='function c(){return left()+right()}'
 const r=collect(s,g,[[g.indexOf('return'),s.indexOf('return')],[g.indexOf('left'),s.indexOf('left')],[g.indexOf('right'),s.indexOf('right')]])
 assert.equal(r.pairs.length,0);assert.equal(r.observedCombine.count,1)
})
test('empty functions and one-token evidence are not promoted',()=>{
 assert.equal(collect('function a(){}','function b(){}',[[0,0]]).pairs.length,0)
 const s='function a(){return value}',g='function b(){return value}'
 assert.equal(collect(s,g,[[g.indexOf('value'),s.indexOf('value')]]).pairs.length,0)
})
test('a body point mapped outside a source function still blocks acceptance',()=>{
 const s='const external=1;function a(){return value}',g='function b(){return value+external}'
 const r=collect(s,g,[[g.indexOf('return'),s.indexOf('return')],[g.indexOf('value'),s.indexOf('value')],[g.indexOf('external'),s.indexOf('external')]])
 assert.equal(r.pairs.length,0);assert.equal(r.evidence.unresolvedBodyPoints,1)
})
test('method headers and expression arrows have explicit ownership',()=>{
 const code='const obj={m(x){return x}};const f=x=>x+1;'
 const inv=functionInventory(code,'fixture')
 assert.equal(inv.point(1,code.indexOf('m(')).kind,'boundary')
 assert.equal(inv.point(1,code.indexOf('return')).kind,'body')
 assert.equal(inv.point(1,code.lastIndexOf('x+')).kind,'body')
})
test('short outer function uses its own header only as corroboration',()=>{
 const s='function If(a){setTimeout(function(){throw a;})}',g='function so(e){setTimeout(function(){throw e})}'
 const r=collect(s,g,[[0,0],[g.indexOf('setTimeout'),s.indexOf('setTimeout')],[g.indexOf('function',1),s.indexOf('setTimeout')],[g.indexOf('throw'),s.indexOf('throw')],[g.indexOf('e}',g.indexOf('throw')),s.indexOf('a;',s.indexOf('throw'))]])
 assert.equal(r.pairs.length,2)
 const outer=r.pairs.find(p=>p.source.endsWith('@0-'+s.length))
 assert.equal(outer.bodyOriginalPositions,1);assert.equal(outer.distinctOriginalPositions,2)
})
test('clean full-span evidence is retained for a sparse body',()=>{
 const s='function a(){return value}',g='function b(){return value}'
 const r=collect(s,g,[[0,0],[g.indexOf('return'),s.indexOf('return')]])
 assert.equal(r.pairs.length,1)
})
test('true competing body targets are not hidden by header filtering',()=>{
 const s='function a(){return left()+right()}',g='function b(){return left()}function c(){return right()}'
 const r=collect(s,g,[[g.indexOf('return'),s.indexOf('return')],[g.indexOf('left'),s.indexOf('left')],[g.indexOf('right'),s.indexOf('right')]])
 assert.equal(r.pairs.length,0);assert.equal(r.observedSplit.count,1)
})
