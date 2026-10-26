// Bounded D-Bundlr-inspired static module analysis. No oracle or model access.
import fs from 'node:fs';
import {recognize} from '../robustness/legacy-patterns/recognize.mjs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parseModule} from './parse.mjs';
import * as eslintScope from 'eslint-scope';
import {fileURLToPath} from 'node:url';
const isFn=n=>n&&['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(n.type);
const children=n=>Object.entries(n).filter(([k])=>!['range','loc'].includes(k)).flatMap(([,v])=>Array.isArray(v)?v.filter(x=>x?.type):v?.type?[v]:[]);
const union=(...sets)=>new Set(sets.flatMap(s=>[...s]));
const staticKey=n=>n?.type==='Identifier'?n.name:n?.type==='Literal'?String(n.value):null;
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
export function analyzeModules(specs,{maxRounds=60}={}) {
 const modules=new Map(),units=[],nodes=[],variables=new Map(),props=new Map(),functionInfo=new Map(),declarations=[],assignments=[],calls=[],objects=[],exportsHelpers=[];
 const nodeScope=new WeakMap(),nodeModule=new WeakMap(),nodeOwner=new WeakMap(),nodeUnit=new WeakMap(),nodeFunction=new WeakMap();
 let changed=false;
 const add=(set,values)=>{for(const x of values)if(!set.has(x)){set.add(x);changed=true}};
 const slot=(map,k)=>{if(!map.has(k))map.set(k,new Set());return map.get(k)};
 const field=(t,k)=>slot(props,JSON.stringify([t,k]));
 const constToken=v=>'c:'+JSON.stringify(v);
 const moduleToken=m=>'m:'+m.id;
 const exportToken=m=>'e:'+m.id;
 const requireToken=m=>'r:'+m.id;
 function loadUnit(spec){
  const ast=parseModule(spec.code,{next:true,ranges:true}),u={...spec,ast};units.push(u);
  const sm=eslintScope.analyze(ast,{ecmaVersion:2022,sourceType:'module',optimistic:true,ignoreEval:true});
  for(const scope of sm.scopes){for(const v of scope.variables){variables.set(v,new Set());for(const id of v.identifiers)nodeScope.set(id,v);for(const r of v.references)nodeScope.set(r.identifier,v)}for(const r of scope.references)if(r.resolved)nodeScope.set(r.identifier,r.resolved)}
  const roots=new Map();
  if(spec.kind==='source'){
   const m={id:'source:'+spec.key,kind:'source',file:spec.file,library:spec.library,packageInstance:spec.packageInstance,unit:spec.id,node:ast,requireName:'require'};modules.set(m.id,m);roots.set(ast,m);
  }else{
   const recognized=recognize(spec),bySpan=new Map();
   function collect(n){if(isFn(n))bySpan.set(n.range.join(':'),n);for(const c of children(n))collect(c)}collect(ast);
   for(const f of recognized.factories){
    const node=bySpan.get(f.factorySpan.join(':'));if(!node)throw Error('Babel/Meriyah factory spans disagree');
    const id='bundle:'+f.namespace+':'+f.moduleId;if(modules.has(id))throw Error('Duplicate module ID: '+id);
    const m={id,kind:'bundle',moduleId:f.moduleId,namespace:f.namespace,unit:spec.id,build:spec.build,node,requireName:node.params[2]?.name};
    modules.set(id,m);roots.set(node,m);
   }
  }
  function index(n,m=null,owner=null){
   if(roots.has(n)){m=roots.get(n);owner=null}
   if(!m){for(const c of children(n))index(c,m,owner);return}
   nodeModule.set(n,m);nodeUnit.set(n,u);nodes.push(n);
   if(isFn(n)&&n!==m.node){
    const tok=`f:${spec.id}:${n.range.join(':')}`,match=spec.functions?.find(f=>f.span[0]===n.range[0]&&f.span[1]===n.range[1]);
    functionInfo.set(tok,{token:tok,module:m.id,functionId:match?.id??null,span:n.range,node:n});nodeFunction.set(n,tok);owner=tok;
   }
   nodeOwner.set(n,owner);
   if(n.type==='VariableDeclarator')declarations.push(n);
   if(n.type==='AssignmentExpression'&&n.operator==='=')assignments.push(n);
   if(n.type==='ObjectExpression')objects.push(n);
   if(n.type==='CallExpression')calls.push(n);
   for(const c of children(n))index(c,m,owner);
  }index(ast);
  for(const [n,m]of roots){
   add(field(moduleToken(m),'exports'),[exportToken(m)]);
   if(m.kind==='bundle')for(const [i,token]of [moduleToken(m),exportToken(m),requireToken(m)].entries()){
    const param=n.params[i];if(param?.type==='Identifier'&&nodeScope.has(param))add(variables.get(nodeScope.get(param)),[token]);
   }
  }
 }
 for(const spec of specs)loadUnit(spec);
 const sourceByFile=new Map([...modules.values()].filter(m=>m.kind==='source').map(m=>[m.file,m]));
 function dependency(m,request){
  if(m.kind==='bundle')return modules.get('bundle:'+m.namespace+':'+String(request));
  if(typeof request!=='string'||!request.startsWith('.'))return null;
  const prefix=m.file.startsWith('webpack:///')?'webpack:///':'',stem=path.posix.normalize(path.posix.join(path.posix.dirname(m.file.slice(prefix.length)),request));
  for(const s of [stem,stem+'.js',stem+'/index.js'])for(const f of [prefix+s,prefix+'./'+s])if(sourceByFile.has(f))return sourceByFile.get(f);
  return null;
 }
 function val(n,seen=new Set()){
  if(!n||seen.has(n))return new Set();seen=new Set(seen).add(n);
  const m=nodeModule.get(n);
  if(n.type==='Literal')return new Set([constToken(n.value)]);
  if(n.type==='Identifier'){
   const v=nodeScope.get(n);if(v)return variables.get(v)||new Set();
   if(m?.kind==='source')return new Set(n.name==='require'?[requireToken(m)]:n.name==='module'?[moduleToken(m)]:n.name==='exports'?[exportToken(m)]:[]);
   return new Set();
  }
  if(nodeFunction.has(n))return new Set([nodeFunction.get(n)]);
  if(n.type==='ObjectExpression'||n.type==='ArrayExpression')return new Set(['o:'+nodeUnit.get(n).id+':'+n.range[0]]);
  if(n.type==='MemberExpression'){const ks=keys(n,seen);return union(...[...val(n.object,seen)].flatMap(t=>ks.map(k=>field(t,k))))}
  if(n.type==='SequenceExpression')return val(n.expressions.at(-1),seen);
  if(n.type==='AssignmentExpression')return val(n.right,seen);
  if(n.type==='ConditionalExpression')return union(val(n.consequent,seen),val(n.alternate,seen));
  if(n.type==='LogicalExpression')return union(val(n.left,seen),val(n.right,seen));
  if(n.type==='CallExpression'){
   const out=new Set();for(const t of val(n.callee,seen))if(t.startsWith('r:'))for(const a of constants(val(n.arguments[0],seen))){const target=dependency(modules.get(t.slice(2)),a);if(target)for(const v of field(moduleToken(target),'exports'))out.add(v)}
   return out;
  }
  return new Set();
 }
 function constants(v){return [...v].filter(t=>t.startsWith('c:')).map(t=>JSON.parse(t.slice(2))).filter(v=>['string','number'].includes(typeof v))}
 function keys(n,seen){return n.computed?constants(val(n.property,seen)).map(String):[staticKey(n.property)].filter(x=>x!==null)}
 function assign(n,values){if(n?.type==='Identifier'){const v=nodeScope.get(n);if(v)add(variables.get(v),values)}else if(n?.type==='MemberExpression')for(const t of val(n.object))for(const k of keys(n))add(field(t,k),values)}
 // Only getter returns are modeled. Ordinary function return/argument flow is deliberately unresolved.
 function getterValues(n){const out=new Set();for(const t of val(n)){const f=functionInfo.get(t);if(!f)continue;const body=f.node.body;if(body.type!=='BlockStatement'){for(const v of val(body))out.add(v);continue}function returns(x){if(x!==body&&isFn(x))return;if(x.type==='ReturnStatement')for(const v of val(x.argument))out.add(v);for(const c of children(x))returns(c)}returns(body)}return out}
 let round=0,converged=false;
 for(;round<maxRounds;round++){
  changed=false;
  for(const [t,f]of functionInfo)if(f.node.type==='FunctionDeclaration'&&f.node.id)assign(f.node.id,[t]);
  for(const o of objects)for(const p of o.properties){if(p.type==='SpreadElement'||p.computed)continue;const k=staticKey(p.key);if(k!==null)for(const t of val(o))add(field(t,k),p.kind==='get'?getterValues(p.value):val(p.value))}
  for(const n of declarations)if(n.init)assign(n.id,val(n.init));
  for(const n of assignments)assign(n.left,val(n.right));
  for(const n of calls){
   const c=n.callee;if(c.type!=='MemberExpression')continue;
   if(staticKey(c.property)==='d'&&[...val(c.object)].some(t=>t.startsWith('r:'))){
    const target=val(n.arguments[0]),name=n.arguments[1];
    if(name?.type==='ObjectExpression')for(const p of name.properties){if(p.computed||p.type==='SpreadElement')continue;for(const t of target)add(field(t,staticKey(p.key)),getterValues(p.value))}
    else for(const k of constants(val(name)))for(const t of target)add(field(t,String(k)),getterValues(n.arguments[2]));
   }
  }
  if(!changed){converged=true;round++;break}
 }
 const imports=[],functionEdges=[],ambiguousCalls=[];
 for(const n of calls){const m=nodeModule.get(n),owner=nodeOwner.get(n),callees=[...val(n.callee)];
  for(const t of callees)if(t.startsWith('r:')){
   const reqs=constants(val(n.arguments[0]));
   if(!reqs.length)imports.push({from:m.id,to:null,request:null,span:n.range,ownerFunction:owner?functionInfo.get(owner).functionId:null,reason:'nonconstant-require'});
   for(const req of reqs){const to=dependency(modules.get(t.slice(2)),req);imports.push({from:m.id,to:to?.id??null,request:req,span:n.range,ownerFunction:owner?functionInfo.get(owner).functionId:null,reason:to?'resolved':'outside-input-or-unresolved'})}
  }
  const fs=callees.filter(t=>functionInfo.has(t));
  if(owner&&fs.length){
   const from=functionInfo.get(owner);for(const t of fs){const to=functionInfo.get(t);if(to.module===from.module||!from.functionId||!to.functionId)continue;const edge={from:from.functionId,to:to.functionId,fromModule:from.module,toModule:to.module,callSpan:n.range,calleeText:nodeUnit.get(n).code.slice(...n.callee.range),kind:'import-export-resolved-call',calleeFunctionTargets:fs.length};if(fs.length===1)functionEdges.push(edge);else ambiguousCalls.push(edge)}
  }
 }
 const resultModules=[...modules.values()].map(m=>{
  const ex=field(moduleToken(m),'exports'),slots=Object.create(null);for(const token of ex)for(const [key,values]of props){const [obj,k]=JSON.parse(key);if(obj!==token)continue;const ids=[...values].map(t=>functionInfo.get(t)?.functionId).filter(Boolean);if(ids.length)slots[k]=[...new Set([...(slots[k]||[]),...ids])]}
  const direct=[...ex].map(t=>functionInfo.get(t)?.functionId).filter(Boolean);if(direct.length)slots['<module.exports>']=[...new Set(direct)];
  const exportKeys=[...new Set([...ex].flatMap(token=>[...props.keys()].map(k=>JSON.parse(k)).filter(([o])=>o===token).map(([,k])=>k)))].sort();
  return {id:m.id,kind:m.kind,file:m.file,library:m.library,packageInstance:m.packageInstance,moduleId:m.moduleId,namespace:m.namespace,unit:m.unit,factorySpan:m.kind==='bundle'?m.node.range:null,functionIds:[...functionInfo.values()].filter(f=>f.module===m.id&&f.functionId).map(f=>f.functionId),exportKeys,functionExports:slots};
 });
 return {policy:'Code-only bounded static analysis inspired by D-Bundlr sections 3.2/3.3. No oracle, source-map correspondence labels, model predictions, or dynamic execution. Scope-aware monotone alias/property propagation; singleton modeled function-call targets only. Not a full Jelly/D-Bundlr reproduction.',solver:{rounds:round,converged,maxRounds},modules:resultModules,imports,functionEdges,ambiguousCalls};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
 const base=path.resolve(process.argv[2]||'results/real-app/vue-admin-template-all-libraries'),out=path.resolve(process.argv[3]||path.join(base,'diagnostics/d-bundlr-module-graph'));fs.mkdirSync(out,{recursive:true});
 const raw=fs.readFileSync(path.join(base,'detector-input.json')),d=JSON.parse(raw),specs=[];
 for(const s of d.sources.filter(s=>['axios','core-js'].includes(s.library)))specs.push({id:s.key,kind:'source',key:s.key,file:s.file,library:s.library,packageInstance:s.packageInstance,code:fs.readFileSync(path.join(base,s.sourceFile),'utf8'),functions:s.functions});
 for(const b of d.bundles.filter(b=>b.build==='webpack-vendor-real'))specs.push({id:b.build,build:b.build,kind:'bundle',code:fs.readFileSync(path.join(base,b.file),'utf8'),functions:b.functions});
 const graph=analyzeModules(specs);if(!graph.solver.converged)throw Error('Solver did not converge; do not present partial output as fixed point');
 graph.provenance={detectorInputSha256:digest(raw),scriptSha256:digest(fs.readFileSync(fileURLToPath(import.meta.url))),paper:'https://reallytg.github.io/files/papers/debundling_icse.pdf',artifact:'https://github.com/Anemone95/D-Bundlr',inspectedArtifactCommit:'c28a5d62efeecc46cc146c3548c71b8071ba2e89'};
 fs.writeFileSync(path.join(out,'module-graph.json'),JSON.stringify(graph,null,2)+'\n');
 console.log(JSON.stringify({solver:graph.solver,sourceModules:graph.modules.filter(m=>m.kind==='source').length,bundleModules:graph.modules.filter(m=>m.kind==='bundle').length,imports:graph.imports.length,resolvedImports:graph.imports.filter(e=>e.to).length,singletonCrossModuleCallEdges:graph.functionEdges.length,ambiguousCrossModuleCalls:graph.ambiguousCalls.length},null,2));
}
