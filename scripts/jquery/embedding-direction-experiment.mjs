import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const base='results/jquery-4.0.0/minified-no-tree-shaking-mapping-v8';
const dest='results/jquery-4.0.0/embedding-direction-v1';
const model='qwen3-embedding:0.6b',server=process.env.OLLAMA_URL||'http://127.0.0.1:11434';
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,x)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n')};
async function api(endpoint,body){const start=performance.now();const r=await fetch(server+'/api/'+endpoint,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(300000)});if(!r.ok)throw Error(await r.text());return {response:await r.json(),wallMs:performance.now()-start}}
const builds=['esbuild-min-keep','rollup-min-keep','webpack-min-keep'];
const files=['detector-input.json','ground-truth.json',...builds.map(b=>'recovery/'+b+'.json')];
const inputHashes=Object.fromEntries(files.map(f=>[f,hash(fs.readFileSync(path.join(base,f)))]));
const data=read(base+'/detector-input.json'),oracle=read(base+'/ground-truth.json');
const refs=data.sources.flatMap(s=>s.functions),refMap=new Map(refs.map((f,i)=>[f.id,{...f,index:i}]));
const gt=new Map(oracle.records.map(r=>[r.build+'|'+r.bundleId,r]));
const sample=[],eligibleCounts={};
for(const build of builds){const run=read(base+'/recovery/'+build+'.json'),seen=new Set(),eligible=[];for(const q of run.queries){if(seen.has(q.bundleId))continue;seen.add(q.bundleId);const g=gt.get(build+'|'+q.bundleId);if(g?.status==='supported'&&q.candidates.length>3&&q.candidates.some(c=>c.sourceId===g.sourceId))eligible.push({build,queryId:q.id,bundleId:q.bundleId,sourceId:g.sourceId,candidates:q.candidates.map(c=>c.sourceId).sort((a,b)=>refMap.get(a).index-refMap.get(b).index),selectionHash:hash('embedding-direction-v1|'+build+'|'+q.bundleId)});}eligibleCounts[build]=eligible.length;eligible.sort((a,b)=>a.selectionHash.localeCompare(b.selectionHash));if(eligible.length<50)throw Error('Insufficient cases');sample.push(...eligible.slice(0,50));}
const manifest={version:'embedding-direction-v1',inputHashes,eligibleCounts,sample};
const manifestFile=dest+'/sample.json';if(fs.existsSync(manifestFile)&&JSON.stringify(read(manifestFile))!==JSON.stringify(manifest))throw Error('Frozen sample changed');write(manifestFile,manifest);
console.log('Frozen sample',sample.length,'eligible',eligibleCounts);
const bundleMap=new Map(data.bundles.flatMap(b=>b.functions.map(f=>[b.build+'|'+f.id,f])));
const inputs=new Map();const add=(kind,text)=>{const id=hash(text);if(!inputs.has(id))inputs.set(id,{id,kind,text});return id};
const bundlePrefix='Instruct: Retrieve the original JavaScript source function corresponding to this bundled function, preserving its behavior despite minification and identifier renaming.\nQuery:';
const sourcePrefix='Instruct: Retrieve the bundled JavaScript function corresponding to this source function, preserving its behavior despite minification and identifier renaming.\nQuery:';
const sourceInputs=new Map(),bundleInputs=new Map();
for(const q of sample){const key=q.build+'|'+q.bundleId,code=bundleMap.get(key).code;bundleInputs.set(key,{plain:add('bundle-plain',code),instruct:add('bundle-instruct',bundlePrefix+code)});for(const id of q.candidates)if(!sourceInputs.has(id)){const c=refMap.get(id).code;sourceInputs.set(id,{plain:add('source-plain',c),instruct:add('source-instruct',sourcePrefix+c)})}}
const tags=(await api('tags')).response;const tag=tags.models.find(m=>m.name===model);if(!tag)throw Error('Model not available');
const show=(await api('show',{model})).response,version=(await api('version')).response;
const metadata={model,digest:tag.digest,tag,show,version,server,batchSize:12,truncate:false,inputHashes,conditions:{A:'Instruction on bundle; source code only',B:'Instruction on source; bundle code only',C:'Code only'}};
if(fs.existsSync(dest+'/model-manifest.json')&&read(dest+'/model-manifest.json').digest!==tag.digest)throw Error('Model digest changed');write(dest+'/model-manifest.json',metadata);
write(dest+'/inputs.json',[...inputs.values()]);
const vectors=new Map(),timings=[];let newCalls=0;
function status(state,error){write(dest+'/status.json',{state,updated:new Date().toISOString(),totalInputs:inputs.size,completedInputs:vectors.size,newCalls,error})}
status('warming');
const warmup=await api('embed',{model,input:['function(x){return x;}'],truncate:false,keep_alive:'60m'});write(dest+'/warmup.json',warmup);
// Interleave four input formats using balanced batches of up to three per format.
const kinds=['source-plain','source-instruct','bundle-plain','bundle-instruct'];
const queues=kinds.map(k=>[...inputs.values()].filter(x=>x.kind===k));
try{
while(queues.some(q=>q.length)){
 const batch=[];for(const q of queues)batch.push(...q.splice(0,3));
 const key=hash(JSON.stringify({digest:tag.digest,texts:batch.map(x=>x.text)})),file=dest+'/requests/'+key+'.json';let r,cached=false;
 if(fs.existsSync(file)){r=read(file);cached=true}else{status('running');console.log('Embedding',vectors.size,'/',inputs.size);r={key,inputIds:batch.map(x=>x.id),request:{model,input:batch.map(x=>x.text),truncate:false,keep_alive:'60m'},...await api('embed',{model,input:batch.map(x=>x.text),truncate:false,keep_alive:'60m'})};write(file,r);newCalls++;}
 if(r.response.embeddings?.length!==batch.length)throw Error('Missing embedding vectors');
 r.response.embeddings.forEach((v,i)=>{if(!v.length||v.some(x=>!Number.isFinite(x)))throw Error('Invalid embedding');vectors.set(batch[i].id,v)});
 timings.push({key,inputIds:r.inputIds,wallMs:r.wallMs,totalDuration:r.response.total_duration??null,loadDuration:r.response.load_duration??null,promptEvalCount:r.response.prompt_eval_count??null,cachedThisExecution:cached});status('running');
}
const cosine=(a,b)=>{let d=0,aa=0,bb=0;for(let i=0;i<a.length;i++){d+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i]}return d/Math.sqrt(aa*bb)};
const rows=[];for(const q of sample){const bk=bundleInputs.get(q.build+'|'+q.bundleId);const conditions={};for(const c of ['A','B','C']){const start=performance.now(),bv=vectors.get(c==='A'?bk.instruct:bk.plain);const ranked=q.candidates.map(sourceId=>({sourceId,score:cosine(bv,vectors.get(sourceInputs.get(sourceId)[c==='B'?'instruct':'plain']))})).sort((a,b)=>b.score-a.score||refMap.get(a.sourceId).index-refMap.get(b.sourceId).index);const rank=ranked.findIndex(r=>r.sourceId===q.sourceId)+1;if(!rank)throw Error('Ground truth absent');conditions[c]={rank,rankingMs:performance.now()-start,ranked};}rows.push({...q,conditions});}
const metric=rs=>Object.fromEntries(['A','B','C'].map(c=>[c,{n:rs.length,top1:rs.filter(r=>r.conditions[c].rank===1).length,top3:rs.filter(r=>r.conditions[c].rank<=3).length,mrr:rs.reduce((s,r)=>s+1/r.conditions[c].rank,0)/rs.length,rankingMs:rs.reduce((s,r)=>s+r.conditions[c].rankingMs,0)}]));
const comparisons=Object.fromEntries(['B','C'].map(c=>[c,{rankImproved:rows.filter(r=>r.conditions[c].rank<r.conditions.A.rank).length,rankTied:rows.filter(r=>r.conditions[c].rank===r.conditions.A.rank).length,rankWorsened:rows.filter(r=>r.conditions[c].rank>r.conditions.A.rank).length,top3Gains:rows.filter(r=>r.conditions[c].rank<=3&&r.conditions.A.rank>3).map(r=>r.queryId),top3Losses:rows.filter(r=>r.conditions[c].rank>3&&r.conditions.A.rank<=3).map(r=>r.queryId)}]));
const clusters=new Map();for(const r of rows){if(!clusters.has(r.sourceId))clusters.set(r.sourceId,[]);clusters.get(r.sourceId).push(r)}
let seed=20261020;const rand=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296};const groups=[...clusters.values()],deltas=[];for(let i=0;i<5000;i++){let n=0,d=0;for(let j=0;j<groups.length;j++)for(const r of groups[Math.floor(rand()*groups.length)]){n++;d+=Number(r.conditions.B.rank<=3)-Number(r.conditions.A.rank<=3)}deltas.push(100*d/n)}deltas.sort((a,b)=>a-b);
const summary={status:'complete',created:new Date().toISOString(),n:rows.length,distinctGroundTruthSources:clusters.size,eligibleCounts,pooled:metric(rows),perBuild:Object.fromEntries(builds.map(b=>[b,metric(rows.filter(r=>r.build===b))])),comparisons,bootstrap:{grouping:'ground-truth source ID',replicates:5000,seed:20261020,deltaTop3BMinusAPercentagePoints:100*(metric(rows).B.top3-metric(rows).A.top3)/rows.length,percentile95:[deltas[125],deltas[4874]]},embedding:{uniqueInputs:inputs.size,dimensions:[...new Set([...vectors.values()].map(v=>v.length))],requests:timings.length,totalRequestWallMs:timings.reduce((s,t)=>s+t.wallMs,0),reportedLoadMs:timings.reduce((s,t)=>s+(t.loadDuration||0)/1e6,0),promptTokens:timings.reduce((s,t)=>s+(t.promptEvalCount||0),0),warmupWallMs:warmup.wallMs,byFormat:Object.fromEntries(kinds.map(k=>[k,[...inputs.values()].filter(x=>x.kind===k).length]))},scope:'Fixed saved neighborhoods containing oracle counterpart; ranking only; no validators or recovery iterations.'};
write(dest+'/rankings.json',rows);write(dest+'/timings.json',timings);write(dest+'/summary.json',summary);
let md='# Embedding direction experiment\n\nCompleted. Model: `'+model+'`. Fixed sample: 150 queries (50 per bundler), '+clusters.size+' distinct ground-truth source functions.\n\n| Condition | Top-1 | Top-3 | MRR |\n|---|---:|---:|---:|\n';for(const [c,m]of Object.entries(summary.pooled))md+='| '+c+' | '+m.top1+'/150 ('+(100*m.top1/150).toFixed(2)+'%) | '+m.top3+'/150 ('+(100*m.top3/150).toFixed(2)+'%) | '+m.mrr.toFixed(4)+' |\n';
md+='\nA: instruction on bundled function; B: instruction on source function; C: code only on both sides.\n\nB minus A top-three recall: '+summary.bootstrap.deltaTop3BMinusAPercentagePoints.toFixed(2)+' percentage points; source-grouped bootstrap 95% interval ['+summary.bootstrap.percentile95.map(x=>x.toFixed(2)).join(', ')+'].\n\n## By build\n\n| Build | Condition | Top-1 / 50 | Top-3 / 50 | MRR |\n|---|---|---:|---:|---:|\n';for(const [b,ms]of Object.entries(summary.perBuild))for(const [c,m]of Object.entries(ms))md+='| '+b+' | '+c+' | '+m.top1+' | '+m.top3+' | '+m.mrr.toFixed(4)+' |\n';
md+='\n## Paired changes versus A\n\n';for(const c of ['B','C']){const x=comparisons[c];md+=c+': rank improved '+x.rankImproved+', tied '+x.rankTied+', worsened '+x.rankWorsened+'; top-three gains '+x.top3Gains.length+', losses '+x.top3Losses.length+'.\n\n'}
md+='## Time and limits\n\nEmbedded '+inputs.size+' unique exact input strings in '+timings.length+' interleaved requests, '+(summary.embedding.totalRequestWallMs/1000).toFixed(2)+' seconds of saved request wall time. Warm-up: '+(warmup.wallMs/1000).toFixed(2)+' seconds, excluded. Timings include mixed-format batches, so they do not provide separate measured per-condition latency. Shared code-only vectors are reused. No validator calls were made.\n\nThis conditional sample excludes missing-ground-truth candidates and candidate sets of size three or fewer. Candidate neighborhoods came from a prior recovery run; this is not overall recovery accuracy. Cross-build cases share source functions.\n';
fs.writeFileSync(dest+'/REPORT.md',md);status('complete');console.log(JSON.stringify(summary,null,2));
}catch(e){status('failed',String(e));throw e}
