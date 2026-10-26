import {Analyzer} from '../analyzer.mjs';import {moduleGraph} from '../module-graph.mjs';
const [family,count]=process.argv.slice(2),n=Number(count);if(!['rspack','rolldown','turbopack','parcel'].includes(family)||!Number.isInteger(n))throw Error('Pass family and module count');const a=new Analyzer(),start=Date.now();let codeBytes=0;
for(let off=0;off<n;off+=1000){const items=[];for(let i=off;i<Math.min(off+1000,n);i++){
 const call=i?family==='rspack'?`r(${i-1}).go();`:family==='turbopack'?`e.i(${i-1}).go();`:family==='parcel'?`loader('${i-1}').go();`:`req${i-1}().go();`:'';
 const f=`function f${i}(){${call}return ${i}}`;
 if(family==='rspack')items.push(`${i}:(m,x,r)=>{${f};x.go=f${i}}`);
 if(family==='turbopack')items.push(`${i},e=>{${f};e.s(['go',0,f${i}])}`);
 if(family==='parcel')items.push(`loader.register('${i}',(m,x)=>{${f};x.go=f${i}});`);
 // Lazy factories share a top-level scope within a chunk. Link chunk boundaries through ESM.
 if(family==='rolldown')items.push(`export const req${i}=lazy((x,m)=>{${f};m.exports={go:f${i}}});`);
 }
 let code=family==='rspack'?`(self['rspackChunkScale']=[]).push([[${off}],{${items.join(',')}}]);`:family==='turbopack'?`(globalThis.TURBOPACK||=[]).push([0,${items.join(',')}]);`:family==='parcel'?`const loader=globalThis.parcelRequireScale;${items.join('')}`:`${off?`import {req${off-1}} from './chunk${off-1000}.js';`:''}const lazy=(cb,m)=>()=>((m||cb((m={exports:{}}).exports,m)),m.exports);${items.join('')}`;
 codeBytes+=Buffer.byteLength(code);a.addUnit({id:'chunk'+off,path:'/scale/chunk'+off+'.js',code});if(global.gc)global.gc();
}
const r=a.solve(),g=moduleGraph(a),elapsedMs=Date.now()-start,callEdges=r.edges.filter(e=>e.kind==='call').length;if(callEdges!==n-1)throw Error(`Expected ${n-1} call edges, got ${callEdges}`);console.log(JSON.stringify({family,modules:n,units:Math.ceil(n/1000),codeBytes,expectedCallEdges:n-1,observedCallEdges:callEdges,elapsedMs,rssEndMiB:Math.round(process.memoryUsage().rss/1048576),stats:r.stats,moduleGraphDependencies:g.dependencies.length}));
