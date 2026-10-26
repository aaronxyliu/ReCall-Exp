// Independent syntax-only screen of saved added edges. Does not invoke or edit Analyzer.
import fs from 'node:fs';import path from 'node:path';
import {parseModule} from '../bundling-dataset/parse.mjs';
const base=path.resolve('results/real-app/bundle-graph-v2-holdout'),read=p=>JSON.parse(fs.readFileSync(p));
for(const subject of read(base+'/selection.json').subjects){
 const dir=base+'/subjects/'+subject.slug;if(!fs.existsSync(dir+'/summary.json')||fs.existsSync(dir+'/risk-screen.json'))continue;
 const d=read(dir+'/detector-input.json'),added=read(dir+'/added-edges.json'),flags=[];
 for(const side of ['source','bundle']){
  const getters=new Set(),writes=new Set();let parseFailures=0;
  for(const file of d[side==='source'?'sourceShards':'bundleShards']){
   const r=read(dir+'/'+file),id=side==='source'?r.key:r.build,bySpan=new Map(r.functions.map(f=>[f.span.join(':'),f.id]));
   let ast;try{ast=parseModule(fs.readFileSync(dir+'/'+(side==='source'?r.sourceFile:r.file),'utf8'),{next:true,ranges:true,loc:false})}catch{parseFailures++;continue}
   const stack=[ast];while(stack.length){const n=stack.pop();
    if(n.type==='MethodDefinition'&&n.kind==='get'&&n.value){const f=bySpan.get(n.value.range.join(':'));if(f)getters.add(f)}
    if(n.type==='AssignmentExpression'&&n.operator==='='&&n.left.type==='Identifier')writes.add(id+'|'+n.left.range.join(':'));
    for(const [k,v]of Object.entries(n)){if(['range','loc'].includes(k))continue;for(const x of Array.isArray(v)?v:[v])if(x?.type)stack.push(x)}
   }
  }
  for(const e of added[side]){
   if(['argument-reference','callee-callback'].includes(e.kind)&&getters.has(e.to))flags.push({side,reason:'class-getter-used-as-function-value',edge:e});
   if(e.kind==='binding-reference'&&writes.has(e.fromUnit+'|'+e.span.join(':')))flags.push({side,reason:'write-only-assignment-target',edge:e});
  }
  console.log(subject.slug,side,'getterFunctions',getters.size,'parseFailures',parseFailures);
 }
 const counts={};for(const f of flags){const k=f.side+':'+f.reason;counts[k]=(counts[k]||0)+1}
 fs.writeFileSync(dir+'/risk-screen.json',JSON.stringify({policy:'Exhaustive syntax screen, separate from frozen analyzer. Write-only identifier sites and class getter tokens used as function-valued arguments. Getter flags diagnose edge typing; caller/getter adjacency can still represent a real accessor dependency. Not a full precision oracle.',counts,flags})+'\n');console.log(subject.slug,counts);
}
