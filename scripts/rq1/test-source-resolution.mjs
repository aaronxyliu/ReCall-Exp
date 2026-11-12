// Local-only source-graph replay. Oracle-labelled cases are evaluation only;
// resolver/graph construction receives ordinary prepared JS manifests alone.
import fs from 'node:fs';import path from 'node:path';import {performance} from 'node:perf_hooks';
import {createProject} from '../../../ReCall/src/project.mjs';import {resolveModules} from '../../../ReCall/components/modules/index.mjs';import {buildGraph} from '../../../ReCall/components/graph/index.mjs';import {minifySourceFunction} from '../../../ReCall/src/analysis/minify.mjs';
const out=path.resolve('results/source-resolution-local'),read=p=>JSON.parse(fs.readFileSync(p)),frozen=read(out+'/frozen-neighborhoods.json'),rows=[],repositories=[];
for(const [repo,cases] of Object.entries(frozen.groups)){
 const start=performance.now();let project,map,graph;
 try{
  const file=path.resolve('results/rq1-autodl-ast-multimatch-26',repo,'input/sourceManifest.json');project=createProject(read(file));map=resolveModules(project);graph=buildGraph(project,{moduleMap:map,siblingWindow:2,includeContainment:true});
  const byId=new Map(project.functions.map(f=>[f.id,f])),adj=new Map(graph.functions.map(f=>[f.id,new Map()]));for(const e of graph.edges)for(const [a,b] of [[e.from,e.to],[e.to,e.from]]){if(!adj.get(a).has(b))adj.get(a).set(b,[]);adj.get(a).get(b).push(e.kind)}
  for(const [target,parentIndexes,oldDistance,library] of cases.cases){const sourceId=cases.sourceIds[target],f=byId.get(sourceId),parents=parentIndexes.map(i=>cases.sourceIds[i]),witnesses=parents.filter(id=>adj.get(id)?.has(sourceId)),r={repo,library,sourceId,oldDistance,sourcePresent:!!f,parentCount:parents.length,missingParentIds:parents.filter(id=>!byId.has(id)),newOneHop:witnesses.length>0,witnesses:witnesses.map(id=>({sourceId:id,kinds:adj.get(id).get(sourceId)})),eligible:false};
   if(f)try{minifySourceFunction(f.code);r.eligible=f.code.length<=18000;if(!r.eligible)r.error='code-size-limit'}catch(e){r.error=e.message}
   r.entersCandidatePool=r.newOneHop&&r.eligible;rows.push(r);
  }
  repositories.push({repo,cases:cases.cases.length,sourceFunctions:project.functions.length,edges:graph.edges.length,coverage:map.coverage,diagnosticCounts:Object.fromEntries([...new Set(map.diagnostics.map(d=>d.kind))].map(k=>[k,map.diagnostics.filter(d=>d.kind===k).length])),milliseconds:performance.now()-start});
 }catch(e){repositories.push({repo,cases:cases.cases.length,error:e.stack});for(const [target,,oldDistance,library]of cases.cases)rows.push({repo,library,sourceId:cases.sourceIds[target],oldDistance,error:e.message,entersCandidatePool:false,graphFailed:true})}
 console.log(JSON.stringify(repositories.at(-1)));fs.writeFileSync(out+'/pairs.json',JSON.stringify(rows,null,2));fs.writeFileSync(out+'/repositories.json',JSON.stringify(repositories,null,2));project=map=graph=null;if(global.gc)global.gc();
}
const summarize=rs=>({cases:rs.length,nowEnterCandidatePool:rs.filter(r=>r.entersCandidatePool).length,stillExcluded:rs.filter(r=>!r.entersCandidatePool).length,graphFailures:rs.filter(r=>r.graphFailed).length});
const summary={at:new Date().toISOString(),frozenAuditAt:frozen.at,scope:'Fixed first-query source parents; same one-hop radius, sibling window 2, containment, code-size limit and candidate eligibility. Source graph rebuilt locally from prepared JS alone. No embeddings, ranking, validation, promotions or remote changes.',...summarize(rows),byLibrary:Object.fromEntries([...new Set(rows.map(r=>r.library))].map(l=>[l,summarize(rows.filter(r=>r.library===l))])),byRepository:Object.fromEntries(repositories.map(r=>[r.repo,summarize(rows.filter(x=>x.repo===r.repo))])),repositories};fs.writeFileSync(out+'/summary.json',JSON.stringify(summary,null,2));console.log('SUMMARY',JSON.stringify({...summarize(rows),byLibrary:summary.byLibrary},null,2));
