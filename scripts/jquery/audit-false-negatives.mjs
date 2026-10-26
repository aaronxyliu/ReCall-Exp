import fs from 'node:fs';
import path from 'node:path';
import {analyze} from './analysis.mjs';
import {children,fnTypes} from './measure.mjs';
import {read,write,output,now} from './common.mjs';
const base=path.join(output,'recovery-bottlenecks'),dest=path.join(base,'false-negatives');
const selected=read(path.join(base,'summary.json')).functions.filter(r=>r.reason==='correct_top3_but_never_accepted');
const data=read(path.join(output,'detector-input.json'));
const refs=new Map(data.sources.flatMap(s=>s.functions).map(f=>[f.id,f]));
const bundles=new Map(data.bundles.flatMap(b=>b.functions).map(f=>[f.id,f]));
const truth=new Map(read(path.join(output,'ground-truth.json')).records.map(g=>[g.bundleId,g]));
const intrinsic=new Set(['undefined','NaN','Infinity','Object','Array','String','Number','Boolean','Math','JSON','Promise','Symbol','Reflect','Date','Error','TypeError','RegExp','Map','Set','WeakMap','WeakSet','parseInt','parseFloat','isNaN','isFinite','encodeURIComponent','decodeURIComponent','encodeURI','decodeURI']);
function freeVariables(code){
 const a=analyze('const __candidate = ('+code+');');const root=a.functions.find(f=>f.node.range[0]===21)?.node||a.functions[0].node;
 const declarations=new WeakSet();
 function pattern(n){if(!n)return;if(n.type==='Identifier'){declarations.add(n);return}if(n.type==='AssignmentPattern'){pattern(n.left);return}if(n.type==='RestElement'){pattern(n.argument);return}if(n.type==='Property'){pattern(n.value);return}for(const c of children(n))pattern(c)}
 function mark(n){if(fnTypes.has(n.type)){if(n.id)declarations.add(n.id);n.params.forEach(pattern)}if(n.type==='VariableDeclarator')pattern(n.id);if(n.type==='CatchClause')pattern(n.param);for(const c of children(n))mark(c)}mark(root);
 const own=new Set(),nested=new Set(),globals=new Set();
 function walk(n,parent=null,depth=0,fns=[root]){
  if(n.type==='Identifier'&&!declarations.has(n)){
   const property=parent?.type==='MemberExpression'&&!parent.computed&&parent.property===n;
   const key=parent?.type==='Property'&&!parent.computed&&parent.key===n&&parent.value!==n;
   const label=['LabeledStatement','BreakStatement','ContinueStatement'].includes(parent?.type);
   const implicitArguments=n.name==='arguments'&&fns.some(f=>f.type!=='ArrowFunctionExpression');
   if(!property&&!key&&!label&&!implicitArguments&&!a.lookup(n)){
    if(intrinsic.has(n.name))globals.add(n.name);else(depth? nested:own).add(n.name);
   }
  }
  for(const c of children(n))walk(c,n,depth+(fnTypes.has(c.type)?1:0),fnTypes.has(c.type)?[...fns,c]:fns);
 }
 // Root itself is not a nested function. Declarations are already marked.
 for(const c of children(root))walk(c,root,0);
 return {own:[...own].sort(),nested:[...nested].sort(),intrinsics:[...globals].sort(),all:[...new Set([...own,...nested])].sort()};
}
function localSyntax(code,foldBoolean=false){
 const root=analyze('const __candidate = ('+code+');').functions[0].node;
 const parameters=new Map(root.params.filter(p=>p.type==='Identifier').map((p,i)=>[p.name,'parameter'+i]));
 function canon(n){
  if(!n)return null;
  if(foldBoolean&&n.type==='UnaryExpression'&&n.operator==='!'&&n.argument.type==='Literal'&&[0,1].includes(n.argument.value))return {type:'Literal',value:!n.argument.value};
  if(n.type==='Identifier')return {type:n.type,name:parameters.get(n.name)||n.name};
  if(n.type==='MemberExpression')return {type:n.type,computed:n.computed,object:canon(n.object),property:n.computed?canon(n.property):{type:'Identifier',name:n.property.name},optional:n.optional};
  const out={};for(const [k,v] of Object.entries(n)){
   if(['range','loc','raw','start','end'].includes(k)||(n===root&&k==='id'))continue;
   out[k]=Array.isArray(v)?v.map(x=>x?.type?canon(x):x):v?.type?canon(v):v;
  }return out;
 }
 return JSON.stringify(canon(root));
}
const rows=[],requests=new Map();
for(const build of new Set(selected.map(r=>r.build))){
 const run=read(path.join(output,'recovery',build+'.json'));
 const queries=new Map(run.queries.map(q=>[q.id,q]));const promotions=new Map(run.promotions.map(p=>[p.bundleId,p]));
 for(const r of selected.filter(r=>r.build===build)){
  const source=refs.get(r.sourceId),bundle=bundles.get(r.bundleId);
  const pairs=run.pairs.filter(p=>p.bundleId===r.bundleId&&p.sourceId===r.sourceId);
  const records=[...new Set(pairs.map(p=>p.requestKey))].map(key=>{
   const record=read(path.join(output,'model-cache/validations',key+'.json'));const u=JSON.parse(record.request.messages[1].content);requests.set(key,record);
   const qs=pairs.filter(p=>p.requestKey===key).map(p=>queries.get(p.queryId));
   const wrongParents=[...new Set(qs.flatMap(q=>q.parentBundleIds.filter(id=>{const p=promotions.get(id),g=truth.get(id);return g?.sourceId&&p?.sourceId!==g.sourceId})))];
   return {key,verdict:record.verdict,content:record.response?.message?.content??null,thinkingCharacters:record.response?.message?.thinking?.length||0,sourceCodeExact:u.reference_source===source.code,bundleCodeExact:u.bundled_function===bundle.code,wrongParentIds:wrongParents,queryIds:qs.map(q=>q.id)};
  });
  const sourceFree=freeVariables(source.code),bundleFree=freeVariables(bundle.code);
  r.localComparison=sourceFree.all.length||bundleFree.all.length?'external-dependency':localSyntax(source.code)===localSyntax(bundle.code)?'same-AST-after-parameter-renaming':localSyntax(source.code,true)===localSyntax(bundle.code,true)?'same-AST-after-boolean-folding':'other-syntax-transformations';
  rows.push({...r,sourceFree,bundleFree,externalLibraryBindings:sourceFree.all.length>0||bundleFree.all.length>0,ownBodyCaptureMetadata:source.captures.length>0||bundle.captures.length>0,queryPairChecks:pairs.length,requests:records,oracle:{mappedOwnPoints:truth.get(r.bundleId).mappedOwnPoints,purity:truth.get(r.bundleId).purity,votes:truth.get(r.bundleId).votes}});
 }
}
const counter=items=>Object.fromEntries([...new Set(items)].map(k=>[k,items.filter(x=>x===k).length]));
const summary={created:now(),policy:'Offline saved requests from the selected experiment output. Includes nested function bodies when checking free variables. Intrinsic names are separated. A free variable is an observed dependency, not a proven cause of rejection. Globals/host dependencies not in intrinsic whitelist remain in external bindings. Source-map identity is not a proof of unrestricted JavaScript behavioral equivalence. No model calls.',functions:rows.length,distinctSourceDefinitions:new Set(rows.map(r=>r.sourceId)).size,withOuterBindingsInOwnBody:rows.filter(r=>r.ownBodyCaptureMetadata).length,withExternalBindingsIncludingNested:rows.filter(r=>r.externalLibraryBindings).length,withoutExternalLibraryBindings:rows.filter(r=>!r.externalLibraryBindings).length,distinctRequests:requests.size,requestVerdicts:counter([...requests.values()].map(r=>r.verdict)),pairChecks:rows.reduce((n,r)=>n+r.queryPairChecks,0),codeTruncationOrMismatch:rows.filter(r=>r.requests.some(q=>!q.sourceCodeExact||!q.bundleCodeExact)).length,withAtLeastOneWrongNeighbor:rows.filter(r=>r.requests.some(q=>q.wrongParentIds.length)).length,rows};
write(path.join(dest,'summary.json'),summary);
let md='# Rejected ground-truth counterparts\n\n'+summary.policy+'\n\n';
md+=`${summary.functions} bundled function occurrences represent ${summary.distinctSourceDefinitions} distinct source definitions. ${summary.withExternalBindingsIncludingNested} have external non-intrinsic bindings somewhere in the complete supplied snippet; ${summary.withoutExternalLibraryBindings} do not. The earlier own-body-only metadata found ${summary.withOuterBindingsInOwnBody}; nested bodies account for the difference.\n\n`;
md+=`There are ${summary.distinctRequests} distinct saved requests across ${summary.pairChecks} checks; verdicts: ${JSON.stringify(summary.requestVerdicts)}. Code mismatches/truncation: ${summary.codeTruncationOrMismatch}. Cases with at least one independently source-map-identified wrong neighboring match in candidate-generation provenance: ${summary.withAtLeastOneWrongNeighbor}. Repeated checks often reuse cached judgments and are not independent trials.\n\n`;
md+='| # | Build | Source function | Source free variables | Bundle free variables |\n|---|---|---|---|---|\n';
rows.forEach((r,i)=>{md+=`| [${i+1}](cases/FN${String(i+1).padStart(3,'0')}.md) | ${r.build} | ${r.sourceName} | ${r.sourceFree.all.join(', ')} | ${r.bundleFree.all.join(', ')} |\n`;let text=`# FN${String(i+1).padStart(3,'0')}: ${r.sourceName}\n\nBuild: ${r.build}. External bindings: source ${r.sourceFree.all.join(', ')||'none'}, bundle ${r.bundleFree.all.join(', ')||'none'}.\n\n## Ground-truth source\n\n\`\`\`javascript\n${r.correctSourceCode}\n\`\`\`\n\n## Bundled function\n\n\`\`\`javascript\n${r.bundleCode}\n\`\`\`\n\n## Saved decisions\n\n`;
 for(const q of r.requests)text+=`- ${q.verdict}; final output ${JSON.stringify(q.content)}; request ${q.key}; thinking characters ${q.thinkingCharacters}.\n`;
 text+='\nThese saved runs had thinking disabled; the boolean does not establish the model\'s reason for rejection. Full request keys and map evidence are in the parent summary.json.\n';fs.mkdirSync(path.join(dest,'cases'),{recursive:true});fs.writeFileSync(path.join(dest,'cases',`FN${String(i+1).padStart(3,'0')}.md`),text)});
if(fs.existsSync(path.join(dest,'INTERPRETATION.md')))md+='\n[Reason analysis and evidence limits](INTERPRETATION.md).\n';
fs.writeFileSync(path.join(dest,'REPORT.md'),md);
console.log(JSON.stringify({...summary,rows:undefined},null,2));
console.log('No external library bindings:',rows.filter(r=>!r.externalLibraryBindings).map(r=>[r.build,r.sourceName]));
