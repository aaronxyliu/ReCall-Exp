// Code-only ESM/flattened-code relation probe. No oracle or source-map labels.
import path from 'node:path';import {parseModule} from '../bundling-dataset/parse.mjs';import * as eslintScope from 'eslint-scope';
const fn=n=>['FunctionExpression','FunctionDeclaration','ArrowFunctionExpression'].includes(n?.type);
const children=n=>Object.entries(n).filter(([k])=>!['loc','range'].includes(k)).flatMap(([,v])=>Array.isArray(v)?v.filter(x=>x?.type):v?.type?[v]:[]);
const key=n=>n?.type==='Identifier'?n.name:n?.type==='Literal'?String(n.value):null;
export function buildRelations(specs,{maxRounds=60,classDispatch=false,iifeAliases=false,objectProperties=false}={}){
 const units=[],byPath=new Map(),bind=new WeakMap(),declared=new WeakMap(),vars=new Map(),nodeFn=new WeakMap(),nodeClass=new WeakMap(),nodeObject=new WeakMap(),objects=[],owner=new WeakMap(),receiver=new WeakMap(),parent=new WeakMap(),values=new Map(),funcs=new Map(),classes=new Map(),decls=[],assigns=[],calls=[],identifiers=[],imports=[],exports=[],returns=[],unresolved=[];
 const slot=(map,k)=>{if(!map.has(k))map.set(k,new Set());return map.get(k)};let changed=false;
 const add=(set,xs)=>{for(const x of xs)if(!set.has(x)){set.add(x);changed=true}};const union=(...xs)=>new Set(xs.flatMap(x=>[...x]));
 for(const s of specs){const ast=parseModule(s.code,{next:true,ranges:true,loc:true}),u={...s,ast,exports:new Map()};units.push(u);byPath.set(s.path,u);for(const p of s.aliasPaths||[])byPath.set(p,u);
  const scopes=eslintScope.analyze(ast,{ecmaVersion:2022,sourceType:'module',optimistic:true,ignoreEval:true});
  for(const scope of scopes.scopes)for(const v of scope.variables){vars.set(v,new Set());for(const n of v.identifiers){bind.set(n,v);if(!declared.has(n))declared.set(n,new Set());declared.get(n).add(v);}for(const r of v.references)bind.set(r.identifier,v)}
  const inv=new Map(s.functions.map(f=>[f.span.join(':'),f]));
  function walk(n,p=null,o=null,c=null,r=null){if(p)parent.set(n,p);
   if(['ClassDeclaration','ClassExpression'].includes(n.type)){c='c:'+s.id+':'+n.range[0];nodeClass.set(n,c);classes.set(c,{node:n,unit:u,members:new Map(),staticMembers:new Map(),base:new Set()});r='i:'+c}
   if(fn(n)){const t='f:'+s.id+':'+n.range[0],isMethod=p?.type==='MethodDefinition';nodeFn.set(n,t);funcs.set(t,{node:n,unit:u,inventory:inv.get(n.range.join(':')),classId:isMethod?c:null});o=t;if(isMethod)r=(p.static?'s:':'i:')+c;if(n.type!=='ArrowFunctionExpression'&&!isMethod)r=null}
   if(n.type==='ObjectExpression'){const token='o:'+s.id+':'+n.range[0];nodeObject.set(n,token);objects.push(n)}
   owner.set(n,o);receiver.set(n,r);if(n.type==='VariableDeclarator')decls.push(n);if(n.type==='AssignmentExpression'&&n.operator==='=')assigns.push(n);if(n.type==='CallExpression'||n.type==='NewExpression')calls.push({node:n,unit:u});if(n.type==='Identifier')identifiers.push({node:n,unit:u});
   if(n.type==='ImportDeclaration')imports.push({node:n,unit:u});if(['ExportNamedDeclaration','ExportDefaultDeclaration','ExportAllDeclaration'].includes(n.type))exports.push({node:n,unit:u});
   if(n.type==='ReturnStatement')returns.push(n);
   for(const x of children(n))walk(x,n,o,c,r);
   if(n.type==='MethodDefinition'){const t=nodeFn.get(n.value),k=n.computed?n.key.type==='Literal'?String(n.key.value):null:key(n.key);if(t&&k!==null)slot(n.static?classes.get(c).staticMembers:classes.get(c).members,k).add(t)}
  }walk(ast);
 }
 function resolve(u,request){if(!request.startsWith('.'))return null;const p=path.posix.normalize(path.posix.join(path.posix.dirname(u.path),request));for(const v of [p,p+'.js',p+'.mjs',p+'/index.js'])if(byPath.has(v))return byPath.get(v);return null}
 function lookupMethod(c,k,stat=false,seen=new Set()){if(seen.has(c))return new Set();seen=new Set(seen).add(c);const info=classes.get(c);if(!info)return new Set();const own=(stat?info.staticMembers:info.members).get(k);if(own?.size)return own;return union(...[...info.base].map(b=>lookupMethod(b,k,stat,seen)))}
 function val(n,seen=new Set()){
  if(!n||seen.has(n))return new Set();seen=new Set(seen).add(n);
  if(nodeFn.has(n))return new Set([nodeFn.get(n)]);if(nodeClass.has(n))return new Set([nodeClass.get(n)]);
  if(objectProperties&&nodeObject.has(n))return new Set([nodeObject.get(n)]);
  if(n.type==='Identifier')return bind.has(n)?vars.get(bind.get(n)):new Set();
  if(n.type==='ThisExpression')return classDispatch&&receiver.get(n)?new Set([receiver.get(n)]):new Set();
  if(n.type==='Super')return classDispatch?union(...[...(classes.get(receiver.get(n)?.slice(2))?.base||[])].map(c=>new Set([(receiver.get(n)?.startsWith('s:')?'s:':'i:')+c]))):new Set();
  if(n.type==='MemberExpression'){const k=n.computed?n.property.type==='Literal'?String(n.property.value):null:key(n.property);if(k===null)return new Set();return union(...[...val(n.object,seen)].map(t=>t.startsWith('i:')?union(lookupMethod(t.slice(2),k),objectProperties?slot(values,t+':'+k):new Set()):t.startsWith('s:')?lookupMethod(t.slice(2),k,true):classes.has(t)&&classDispatch?lookupMethod(t,k,true):t.startsWith('ns:')?slot(units.find(u=>u.id===t.slice(3)).exports,k):slot(values,t+':'+k)))}
  if(n.type==='NewExpression')return new Set([...val(n.callee,seen)].filter(t=>classes.has(t)).map(t=>'i:'+t));
  if(n.type==='SequenceExpression')return val(n.expressions.at(-1),seen);if(n.type==='AssignmentExpression')return val(n.right,seen);
  if(n.type==='ConditionalExpression')return union(val(n.consequent,seen),val(n.alternate,seen));if(n.type==='LogicalExpression')return union(val(n.left,seen),val(n.right,seen));
  // Only syntactically immediate function invocations, not general call returns.
  if(iifeAliases&&n.type==='CallExpression'&&fn(n.callee)){const t=nodeFn.get(n.callee);return union(...returns.filter(r=>owner.get(r)===t).map(r=>val(r.argument,seen)))}
  return new Set();
 }
 function assign(n,xs){if(n?.type==='Identifier'&&bind.has(n))add(vars.get(bind.get(n)),xs);else if(n?.type==='MemberExpression'){const k=n.computed?n.property.type==='Literal'?String(n.property.value):null:key(n.property);if(k!==null)for(const t of val(n.object))add(slot(values,t+':'+k),xs)}}
 function assignDeclaration(n,xs){for(const v of declared.get(n)||[])add(vars.get(v),xs)}
 function names(d){if(!d)return[];if(d.type==='VariableDeclaration')return d.declarations.flatMap(x=>x.id.type==='Identifier'?[x.id]:[]);return d.id?[d.id]:[]}
 let rounds=0;for(;rounds<maxRounds;rounds++){changed=false;
  for(const [t,f]of funcs)if(f.node.id)assignDeclaration(f.node.id,[t]);for(const [t,c]of classes){if(c.node.id)assignDeclaration(c.node.id,[t]);add(c.base,[...val(c.node.superClass)].filter(t=>classes.has(t)))}
  if(objectProperties)for(const o of objects)for(const p of o.properties){if(p.type!=='Property'||p.kind==='get'||p.kind==='set'||p.computed&&p.key.type!=='Literal')continue;const k=key(p.key);if(k!==null)add(slot(values,nodeObject.get(o)+':'+k),val(p.value))}
  for(const d of decls)if(d.init)assign(d.id,val(d.init));for(const a of assigns)assign(a.left,val(a.right));
  for(const {node:n,unit:u}of imports){const target=resolve(u,n.source.value);if(!target)continue;for(const p of n.specifiers){if(p.type==='ImportNamespaceSpecifier')assign(p.local,['ns:'+target.id]);else assign(p.local,slot(target.exports,p.type==='ImportDefaultSpecifier'?'default':key(p.imported)))}}
  for(const {node:n,unit:u}of exports){if(n.type==='ExportDefaultDeclaration')add(slot(u.exports,'default'),val(n.declaration));else if(n.type==='ExportAllDeclaration'){const target=resolve(u,n.source.value);if(target)for(const [k,xs]of target.exports)if(k!=='default')add(slot(u.exports,k),xs)}else{for(const id of names(n.declaration))add(slot(u.exports,id.name),val(id));const target=n.source?resolve(u,n.source.value):null;for(const p of n.specifiers)add(slot(u.exports,key(p.exported)),target?slot(target.exports,key(p.local)):n.source?[]:val(p.local))}}
  if(!changed){rounds++;break}
 }
 if(changed)throw Error('ESM relation probe did not converge');
 const edges=[],seen=new Set();function edge(from,to,kind,u,n){const a=funcs.get(from),b=funcs.get(to);if(!a?.inventory||!b?.inventory||from===to)return;const k=[a.inventory.id,b.inventory.id,kind].join('|');if(seen.has(k))return;seen.add(k);edges.push({from:a.inventory.id,to:b.inventory.id,fromUnit:a.unit.id,toUnit:b.unit.id,kind,span:n.range,text:u.code.slice(...n.range).slice(0,240)})}
 function targets(v){return union(...[...v].map(t=>funcs.has(t)?new Set([t]):classes.has(t)&&classDispatch?lookupMethod(t,'constructor'):new Set()))}
 for(const {node:n,unit:u}of calls){const o=owner.get(n),vs=targets(n.callee.type==='Super'?new Set([...val(n.callee)].map(t=>t.startsWith('i:')?t.slice(2):t)):val(n.callee));if(vs.size===1&&o)edge(o,[...vs][0],'call',u,n);
  for(const arg of n.arguments){const as=targets(val(arg));if(as.size===1){if(o)edge(o,[...as][0],'argument-reference',u,n);if(vs.size===1)edge([...vs][0],[...as][0],'callee-callback',u,n)}}
 }
 for(const {node:n,unit:u}of identifiers){const p=parent.get(n);if(!p)continue;if((p.type==='MemberExpression'&&!p.computed&&p.property===n)||(p.type==='Property'&&!p.computed&&p.key===n&&!p.shorthand)||p.type.startsWith('Import')||p.type==='ExportSpecifier'||(p.type==='VariableDeclarator'&&p.id===n)||((fn(p)||p.type.startsWith('Class'))&&p.id===n))continue;const xs=targets(val(n));if(xs.size===1&&owner.get(n))edge(owner.get(n),[...xs][0],'binding-reference',u,n)}
 for(const {node:n,unit:u}of imports)if(!resolve(u,n.source.value))unresolved.push({unit:u.id,request:n.source.value});
 return {configuration:{classDispatch,iifeAliases,objectProperties},policy:'Scope-resolved ESM import/export and flattened declaration analysis; no oracle, source-map identities or models. Relative imports only. Singleton modeled targets; this/super class dispatch and direct syntactic IIFE return aliases. No general argument/return points-to flow.',rounds,units:units.length,classes:classes.size,edges,unresolvedImports:unresolved};
}
