import fs from 'node:fs';
const out='results/real-app/vue-admin-template-all-libraries',d=JSON.parse(fs.readFileSync(out+'/detector-input.json'));
const refs=d.sources.flatMap(s=>s.functions),edges=[];let offset=0;for(const s of d.sources){edges.push(...s.edges.map(e=>({...e,from:e.from+offset,to:e.to+offset})));offset+=s.functions.length}
function graph(functions,edges){const a=functions.map(()=>new Set());for(const e of edges){a[e.from].add(e.to);a[e.to].add(e.from)}const groups=new Map();for(let i=0;i<functions.length;i++){const k=functions[i].parent??'root';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i)}for(const g of groups.values())for(let i=0;i<g.length;i++)for(let k=1;k<=2;k++)if(g[i+k]!=null){a[g[i]].add(g[i+k]);a[g[i+k]].add(g[i])}return a}
const sg=graph(refs,edges),pogs=new Map();for(let i=0;i<refs.length;i++){const f=refs[i];if(f.propertyOperations<10||!f.pogHash)continue;if(!pogs.has(f.pogHash))pogs.set(f.pogHash,[]);pogs.get(f.pogHash).push(i)}
const rows=[];
for(const b of d.bundles){const bg=graph(b.functions,b.edges),bp=new Map();for(let i=0;i<b.functions.length;i++){const f=b.functions[i];if(f.propertyOperations<10||!f.pogHash)continue;if(!bp.has(f.pogHash))bp.set(f.pogHash,[]);bp.get(f.pogHash).push(i)}
 const accepted=new Map();for(const [h,v] of bp)if(v.length===1&&pogs.get(h)?.length===1)accepted.set(v[0],pogs.get(h)[0]);const used=new Set(accepted.values());let n=0;
 for(let bi=0;bi<b.functions.length;bi++){if(accepted.has(bi)||b.functions[bi].code.length>18000)continue;const candidates=new Set();for(const p of bg[bi])if(accepted.has(p))for(const si of sg[accepted.get(p)])if(!used.has(si)&&refs[si].code.length<=18000)candidates.add(si);if(candidates.size)n++}
 rows.push({build:b.build,initialAnchors:accepted.size,firstRoundQueries:n})
}
fs.writeFileSync(out+'/first-round-workload.json',JSON.stringify({policy:'Static workload count from the frozen radius-one graph and initial anchors, without oracle labels or model calls. Counts queries, not pair checks; each query evaluates up to five candidates until its first positive.',builds:rows},null,2)+'\n');console.log(rows);
