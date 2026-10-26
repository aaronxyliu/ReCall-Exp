import assert from 'node:assert/strict';
export function propagate({sourceGraph,bundleGraph,cross,pairs,seedPairs,buildOf,sourceLengths,bundleLengths}){
 const round=new Map([...seedPairs].map(([b])=>[b,0])),parent=new Map();let front=[...seedPairs.keys()],depth=0;
 while(front.length){const next=[];depth++;for(const u of front){const source=pairs.get(u);for(const v of bundleGraph[u]){if(round.has(v)||!pairs.has(v)||!cross&&buildOf[u]!==buildOf[v])continue;const s=pairs.get(v);if(bundleLengths[v]>18000||sourceLengths[s]>18000||!sourceGraph[source].has(s))continue;round.set(v,depth);parent.set(v,u);next.push(v)}}front=next}
 // Independent queue traversal verifies the fixed point, using a different scheduling order.
 const reached=new Set(seedPairs.keys()),queue=[...reached];for(let q=0;q<queue.length;q++){const u=queue[q];for(const v of bundleGraph[u]){const s=pairs.get(v);if(s==null||reached.has(v)||!cross&&buildOf[u]!==buildOf[v]||bundleLengths[v]>18000||sourceLengths[s]>18000||!sourceGraph[pairs.get(u)].has(s))continue;reached.add(v);queue.push(v)}}assert.deepEqual([...reached].sort((a,b)=>a-b),[...round.keys()].sort((a,b)=>a-b));
 return {round,parent};
}
