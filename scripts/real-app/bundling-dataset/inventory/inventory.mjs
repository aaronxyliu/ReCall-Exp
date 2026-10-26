import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SourceMapConsumer} from 'source-map';
import {analyze} from './analysis.mjs';
import {measure, own, fnTypes} from './measure.mjs';
import {root, output, write, read, hash, now} from '../../../jquery/common.mjs';

export function offsets(code){const out=[0];for(let i=0;i<code.length;i++)if(code[i]==='\n')out.push(i+1);return out}
export function containing(functions,pos){let lo=0,hi=functions.length;while(lo<hi){const mid=(lo+hi)>>1;if(functions[mid].span[0]<=pos)lo=mid+1;else hi=mid}for(let i=lo-1;i>=0;i--)if(pos<functions[i].span[1])return functions[i];return null}
export function inventory(code,key,file){
 const analysis=analyze(code);
 const byNode=new Map(analysis.functions.map((f,i)=>[f.node,i]));
 const functions=analysis.functions.map((f,i)=>{
  let parent=analysis.parents.get(f.node);while(parent&&!fnTypes.has(parent.type))parent=analysis.parents.get(parent);
  const captures=new Map();
  own(f.node.body,(n,p)=>{if(n.type!=='Identifier')return;if((p?.type==='MemberExpression'&&!p.computed&&p.property===n)||(p?.type==='Property'&&!p.computed&&p.key===n))return;
   const binding=analysis.lookup(n);if(!binding||binding.ambiguous||!binding.scope)return;
   let scope=binding.scope;while(scope&&!scope.fn)scope=scope.parent;
   if(scope?.fn===f.node)return;
   const init=binding.init||binding.target;
   captures.set(n.name,{name:n.name,bindingKind:binding.parameter!=null?'enclosing-parameter':'lexically-resolved-enclosing-binding',enclosingFunction:scope?.fn?(analysis.functions[byNode.get(scope.fn)]?.name||'<anonymous>'):'module',parameterIndex:binding.parameter??null,writes:binding.writes||0,initializer:init?code.slice(...init.range).slice(0,320):null,initializerTruncated:init?init.range[1]-init.range[0]>320:false});
  });
  const feature=measure(f.node);
  return {id:`${key}:${f.node.range[0]}:${f.node.range[1]}`,index:i,file,name:f.name,span:f.node.range,loc:f.node.loc,type:f.node.type,parent:parent?byNode.get(parent):null,...feature,code:code.slice(...f.node.range),codeSha256:hash(code.slice(...f.node.range)),captures:[...captures.values()],astHash:analysis.features[i].fullHash};
 });
 const edges=analysis.edges.map(e=>({from:e.from,to:e.to,kind:e.kind}));
 for(const f of functions)if(f.parent!=null)edges.push({from:f.parent,to:f.index,kind:'contains'});
 const seen=new Set();const uniqueEdges=edges.filter(e=>{const k=JSON.stringify(e);if(seen.has(k))return false;seen.add(k);return true});
 return {file,sha256:hash(code),parser:analysis.parser,functions,edges:uniqueEdges,unresolvedCalls:analysis.features.reduce((n,f)=>n+f.unresolvedCalls,0)};
}

