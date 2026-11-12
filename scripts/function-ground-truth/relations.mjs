import {sourceLibrary} from './library-scope.mjs'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {functionInventory} from './function-inventory.mjs'
import {SourceMapConsumer} from 'source-map'

const [folder,raw]=process.argv.slice(2)
const artifactPath=(hash,extension)=>fs.existsSync(path.join(raw,hash+'.'+extension)) ? path.join(raw,hash+'.'+extension) : path.join(raw,extension==='js'?'runtime-js':'source-maps',hash+'.'+extension)
const read=name=>JSON.parse(fs.readFileSync(path.join(folder,name)))
const sample=read('selection.json'), capture=read('capture.json')
const digest=value=>crypto.createHash('sha256').update(value).digest('hex')
function collectLibrary(libraryUnit){
const nodes=new Map(), origins=new Map(), targets=new Map(), blocked=new Set(), failures=[]
const fullOrigins=new Map(),fullTargets=new Map(),fullBlocked=new Set()
const supportOrigins=new Map(),supportTargets=new Map(),supportBlocked=new Set()
function addEdges(edges,origins,targets,blocked){
 for(const [s,g,pos,generatedPos]of edges){
  if(!s||!g){if(s||g)blocked.add((s||g).id);continue}
  if(!origins.has(s.id))origins.set(s.id,new Set())
  origins.get(s.id).add(g.id)
  if(!targets.has(g.id))targets.set(g.id,new Map())
  const contributors=targets.get(g.id)
  if(!contributors.has(s.id))contributors.set(s.id,{source:new Set(),generated:new Set()})
  contributors.get(s.id).source.add(pos);contributors.get(s.id).generated.add(generatedPos)
  nodes.set(g.id,g)
 }
}
const missingSources=new Set()
const presence=new Map([[libraryUnit.name,new Set()]])
const evidence={bodyToBodyPoints:0,ignoredBoundaryPoints:0,ignoredStructuralPoints:0,unresolvedBodyPoints:0}
function inventory(code,prefix,pkg){
  const inv=functionInventory(code,prefix,pkg)
  if(pkg)for(const fn of inv.functions)nodes.set(fn.id,fn)
  return inv.point
}
function packageOf(source){const owner=sourceLibrary(source,sample);return owner?.id===libraryUnit.id?owner.name:null}

const moduleAssets=sample.moduleScope?new Set(sample.moduleScope.assets.filter(a=>a.role==='module-build-output').map(a=>JSON.stringify([a.url,a.sha256,a.mapSHA256]))):null
for(const a of capture.assets){
  if(moduleAssets&&!moduleAssets.has(JSON.stringify([a.url,a.sha256,a.map?.sha256])))continue
  if(a.map.status!=='map-found')continue
  try{
    const mapBytes=fs.readFileSync(artifactPath(a.map.sha256,'map'))
    if(digest(mapBytes)!==a.map.sha256)throw Error('map digest mismatch')
    const map=JSON.parse(mapBytes)
    const code=fs.readFileSync(artifactPath(a.sha256,'js'),'utf8')
    if(digest(code)!==a.sha256)throw Error('script digest mismatch')
    if(a.map.link==='adjacent'&&map.file&&path.basename(map.file)!==path.basename(a.url.split('?')[0]))throw Error('map file mismatch')
    const consumer=new SourceMapConsumer(map)
    if(!consumer.sources.some(source=>presence.has(packageOf(source))))continue
    const lookup=inventory(code,a.url+'#'+a.sha256,null), cache=new Map(),edges=[],fullEdges=[],supportEdges=[],found=[]
    consumer.eachMapping(m=>{
      const gp=lookup(m.generatedLine,m.generatedColumn),g=gp.fn
      let s,sp
      if(m.originalLine!=null&&m.source){
        if(!cache.has(m.source)){
          const pkg=packageOf(m.source)
          let loc=null
          if(presence.has(pkg)){
            found.push([pkg,m.source])
            const content=consumer.sourceContentFor(m.source,true)
            const explicit=sample.sourceOwnership?.[m.source]
            if(explicit&&digest(content)!==explicit.sha256)throw Error('Explicit source ownership hash mismatch')
            if(content==null)missingSources.add(m.source)
            if(content!=null){try{loc=inventory(content,m.source+'#'+digest(content),pkg)}catch{failures.push({asset:a.url,source:m.source,reason:'source parse failed'})}}
          }
          cache.set(m.source,loc)
        }
        try{sp=cache.get(m.source)?.(m.originalLine,m.originalColumn);s=sp?.fn}catch{if(!found.some(x=>x[0]==='invalid:'+m.source)){failures.push({asset:a.url,source:m.source,reason:'original coordinate out of bounds'});found.push(['invalid:'+m.source,m.source])}}
      }
      if(s||g)fullEdges.push([s,g,m.originalLine+':'+m.originalColumn,m.generatedLine+':'+m.generatedColumn])
      if(s&&g&&gp.kind!=='structural'&&sp.kind!=='structural')supportEdges.push([s,g,sp.tokenStart,gp.tokenStart])
      // Do not turn header/structural attribution into split/combine edges.
      // A substantive body point with no function counterpart remains blocking.
      if(gp.kind==='boundary'||sp?.kind==='boundary'){evidence.ignoredBoundaryPoints++;return}
      if(gp.kind==='structural'||sp?.kind==='structural'){evidence.ignoredStructuralPoints++;return}
      if(gp.kind!=='body'&&sp?.kind!=='body')return
      if(gp.kind==='body'&&sp?.kind==='body')evidence.bodyToBodyPoints++
      else evidence.unresolvedBodyPoints++
      if(s||g)edges.push([s,g,sp?.tokenStart,gp.tokenStart])
    })
    for(const [pkg,source] of found)presence.get(pkg)?.add(source)
    addEdges(fullEdges,fullOrigins,fullTargets,fullBlocked)
    addEdges(supportEdges,supportOrigins,supportTargets,supportBlocked)
    addEdges(edges,origins,targets,blocked)
  }catch(e){failures.push({asset:a.url,reason:String(e.message).slice(0,200)})}
}
const pairs=[]
for(const [sid,gs] of origins){
  if(gs.size!==1||blocked.has(sid))continue
  const gid=[...gs][0],t=targets.get(gid),support=supportTargets.get(gid)?.get(sid)
  // At least one own-body token on each side establishes the candidate; two
  // distinct supporting tokens per side (body or its own header) reject a
  // lone mapping point. Header edges never establish identity or multiplicity.
  if(t.size!==1||blocked.has(gid)||support.source.size<2||support.generated.size<2)continue
  const s=nodes.get(sid),g=nodes.get(gid)
  pairs.push({library:s.pkg,libraryScope:libraryUnit.id,source:sid,bundled:gid,distinctOriginalPositions:support.source.size,distinctGeneratedPositions:support.generated.size,bodyOriginalPositions:t.get(sid).source.size,bodyGeneratedPositions:t.get(sid).generated.size,evidenceRule:'reciprocal-body'})
}
// Sparse bodies can still have clean reciprocal full-span evidence. Preserve
// that independent rule; never accept a header-only boundary-conflicted pair.
const bodyPairs=new Map(pairs.map(p=>[p.source,p]))
for(const [sid,gs]of fullOrigins){
 if(gs.size!==1||fullBlocked.has(sid))continue
 const gid=[...gs][0],ts=fullTargets.get(gid),support=ts.get(sid)
 if(ts.size!==1||fullBlocked.has(gid)||support.source.size<2)continue
 if(bodyPairs.has(sid)){bodyPairs.get(sid).evidenceRule='reciprocal-body-and-full-span';continue}
 pairs.push({library:nodes.get(sid).pkg,libraryScope:libraryUnit.id,source:sid,bundled:gid,distinctOriginalPositions:support.source.size,distinctGeneratedPositions:support.generated.size,evidenceRule:'reciprocal-full-span'})
}
// Fail closed if complementary evidence rules ever disagree about identities.
if(new Set(pairs.map(p=>p.source)).size!==pairs.length||new Set(pairs.map(p=>p.bundled)).size!==pairs.length)throw Error('Evidence rules produced conflicting pairs')
evidence.acceptanceRules=Object.fromEntries([...new Set(pairs.map(p=>p.evidenceRule))].map(rule=>[rule,pairs.filter(p=>p.evidenceRule===rule).length]))
function rate(values){const count=values.filter(v=>v.size>1).length;return {count,denominator:values.length,percent:values.length?100*count/values.length:null}}
const report={libraryUnit,pairDefinition:'reciprocal-body-mapped-v2',evidence,repo:sample.repo,commit:sample.commit,imageID:capture.imageID,coverage:Object.fromEntries([...presence].map(([p,v])=>[p,v.size])),pairs,observedSplit:rate([...origins.values()]),observedCombine:rate([...targets.values()]),removePercent:null,createPercent:null,missingSourceContents:[...missingSources],failures}
// Account for every parsed selected source function, including sparse/unmapped ones.
const accepted=new Set(pairs.map(p=>p.source))
report.sourceFunctionAccounting={total:0,oneToOne:0,multipleTargets:0,multipleContributors:0,unresolvedBody:0,insufficientEvidence:0,noBodyEdge:0}
for(const [id,fn]of nodes)if(fn.pkg){
 const counts=report.sourceFunctionAccounting,gs=origins.get(id);counts.total++
 if(accepted.has(id)){counts.oneToOne++;continue}
 if(!gs?.size){counts[blocked.has(id)?'unresolvedBody':'noBodyEdge']++;continue}
 if(gs.size>1){counts.multipleTargets++;continue}
 const gid=[...gs][0],ts=targets.get(gid)
 if(ts.size>1){counts.multipleContributors++;continue}
 if(blocked.has(id)||blocked.has(gid)){counts.unresolvedBody++;continue}
 counts.insufficientEvidence++
}
report.relationshipCaution='Mapping multiplicity is positional provenance, not proof of semantic splitting or combining.'
return report
}
// Discover ownership partitions, then collect each independently. Other libraries'
// mapped body points remain blocking evidence, never silently discarded.
const units=new Map()
for(const asset of capture.assets){
 if(asset.map?.status!=='map-found')continue
 try{const bytes=fs.readFileSync(artifactPath(asset.map.sha256,'map'));if(digest(bytes)!==asset.map.sha256)continue
  const consumer=new SourceMapConsumer(JSON.parse(bytes));for(const source of consumer.sources){const owner=sourceLibrary(source,sample);if(owner)units.set(owner.id,owner)}
 }catch{/* Each library collector records malformed asset diagnostics. */}
}
for(const name of sample.selected)if(![...units.values()].some(u=>u.name===name)){const root='declared:'+name,id=JSON.stringify([name,null,root]);units.set(id,{name,version:null,root,id})}
const libraryReports=[...units.values()].map(collectLibrary)
const sumObjects=objects=>{const result={};for(const object of objects)for(const [key,value]of Object.entries(object))if(typeof value==='number')result[key]=(result[key]||0)+value;return result}
const multiplicity=field=>{const totals=sumObjects(libraryReports.map(r=>r[field]));return {count:totals.count||0,denominator:totals.denominator||0,percent:totals.denominator?100*totals.count/totals.denominator:null}}
const report={pairDefinition:'reciprocal-body-mapped-v2',scopePolicy:'per-library-source/full-bundle-v1',repo:sample.repo,commit:sample.commit,imageID:capture.imageID,
 libraryReports,pairs:libraryReports.flatMap(r=>r.pairs),coverage:sumObjects(libraryReports.map(r=>r.coverage)),evidence:sumObjects(libraryReports.map(r=>r.evidence)),
 sourceFunctionAccounting:sumObjects(libraryReports.map(r=>r.sourceFunctionAccounting)),observedSplit:multiplicity('observedSplit'),observedCombine:multiplicity('observedCombine'),removePercent:null,createPercent:null,
 missingSourceContents:[...new Set(libraryReports.flatMap(r=>r.missingSourceContents))],failures:libraryReports.flatMap(r=>r.failures.map(f=>({...f,libraryScope:r.libraryUnit.id}))),
 relationshipCaution:'One library instance per collection. External mapped contributors block one-to-one acceptance. Mapping multiplicity is positional provenance, not semantic splitting or combining.'}
report.evidence.acceptanceRules=sumObjects(libraryReports.map(r=>r.evidence.acceptanceRules))
if(new Set(report.pairs.map(p=>p.source)).size!==report.pairs.length||new Set(report.pairs.map(p=>p.bundled)).size!==report.pairs.length)throw Error('Cross-library evidence produced conflicting pairs')
fs.writeFileSync(path.join(folder,'relations.json'),JSON.stringify(report,null,2)+'\n')
