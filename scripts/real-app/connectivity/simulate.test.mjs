import {test} from 'node:test';
import assert from 'node:assert/strict';
import {simulate} from './simulate.mjs';
const adj=(n,edges)=>{const g=Array.from({length:n},()=>new Set());for(const [u,v]of edges){g[u].add(v);g[v].add(u)}return g};
test('synchronous oracle propagation needs multiple rounds and terminates after an empty round',()=>{
 const g=adj(4,[[0,1],[1,2],[2,3]]),r=simulate({sourceGraph:g,bundleGraph:g,anchors:[{si:0,bi:0}],targets:[{si:0,bi:0},{si:1,bi:1},{si:2,bi:2},{si:3,bi:3}]});assert.deepEqual(r.rounds.map(r=>r.newAnchors),[1,1,1,0]);assert.deepEqual(r.promotions.map(p=>p.round),[0,1,2,3]);
});
test('one-sided connectivity never substitutes for a paired neighborhood witness',()=>{
 const g=adj(2,[[0,1]]),empty=adj(2,[]);for(const [sg,bg]of [[g,empty],[empty,g]]){const r=simulate({sourceGraph:sg,bundleGraph:bg,anchors:[{si:0,bi:0}],targets:[{si:1,bi:1}]});assert.equal(r.accepted.size,1)}
});
test('oracle selects true source anywhere in pool without top-five truncation or distractor acceptance',()=>{
 const sg=adj(9,Array.from({length:8},(_,i)=>[0,i+1])),bg=adj(2,[[0,1]]),r=simulate({sourceGraph:sg,bundleGraph:bg,anchors:[{si:0,bi:0}],targets:[{si:8,bi:1}]});assert.equal(r.accepted.get(1),8);assert.equal(r.accepted.size,2);
});
test('a missing intermediate target cannot be silently promoted as a bridge',()=>{
 const g=adj(3,[[0,1],[1,2]]),r=simulate({sourceGraph:g,bundleGraph:g,anchors:[{si:0,bi:0}],targets:[{si:2,bi:2}]});assert.equal(r.accepted.size,1);
});
test('code eligibility still gates propagation, with an explicit terminal reason',()=>{
 const g=adj(2,[[0,1]]),r=simulate({sourceGraph:g,bundleGraph:g,anchors:[{si:0,bi:0}],targets:[{si:1,bi:1}],sourceEligible:i=>i!==1});assert.equal(r.accepted.size,1);assert.equal(r.snapshots.at(-1)[0].reason,'source_size_limit');
});
test('duplicate source identities fail rather than quietly weakening one-to-one matching',()=>{
 const g=adj(3,[[0,1],[0,2]]);assert.throws(()=>simulate({sourceGraph:g,bundleGraph:g,anchors:[{si:0,bi:0}],targets:[{si:1,bi:1},{si:1,bi:2}]}),/Oracle source aliasing/);
});
