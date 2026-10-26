import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {enumerate} from './measure.mjs';
import {root,output,read,write,now} from './common.mjs';
const dir=path.join(output,'wrong-identity-audit'),cases=read(path.join(dir,'cases.json')).cases;
const code=fs.readFileSync(path.join(root,'node_modules/jquery/dist-module/jquery.module.js'),'utf8');
const d=read(path.join(output,'detector-input.json')),refs=d.sources.flatMap(s=>s.functions);
const named=name=>(refs.find(f=>f.name===name&&f.type==='FunctionDeclaration')||refs.find(f=>f.name===name)).code;
const dataImplementation=code.slice(code.indexOf('function Data()'),code.indexOf('var dataPriv = new Data();'));
const dataSetup=String.raw`const jQuery={expando:'audit',isEmptyObject:${named('isEmptyObject')}};
const rdashAlpha=/-([a-z])/g, rnothtmlwhite=/[^\x20\t\r\n\f]+/g;
${named('fcamelCase')}
${named('camelCase')}
${named('acceptData')}
${dataImplementation}
const dataPriv=new Data(),dataUser=new Data();`;
function execute(text){return vm.runInNewContext(text,{}, {timeout:1000})}
const results=[];
for(const c of cases){
 let setup='',call='',observation='',type='semantic-counterexample',explanation='';
 if(['W01','W02'].includes(c.id)){
  setup=dataSetup+'\nconst O=dataUser,b=dataPriv, owner={}; dataUser.set(owner,"key","public");dataPriv.set(owner,"key","private");';
  call='const result=fn(owner,"key");';observation='({returned:result,user:dataUser.get(owner,"key"),private:dataPriv.get(owner,"key")})';
  explanation='Real source Data constructor and prototype, separate public/private allocation instances; read the same key from the same owner.';
 }else if(['W03','W08'].includes(c.id)){
  setup=dataSetup+'\nconst O=dataUser,at=dataUser, owner={}; dataUser.set(owner,"key","public");dataPriv.set(owner,"key","private");';
  call='fn(owner,"key");';observation='({user:dataUser.get(owner,"key")??"<absent>",private:dataPriv.get(owner,"key")??"<absent>"})';
  explanation='Real source Data implementation. Compare both storage namespaces after removing the same key.';
 }else if(c.id==='W04'){
  setup='const jQuery={expando:"auditMarker"}; const input=function target(){};';
  call='const result=fn(input);';observation='({returnsSame:Object.is(result,input),markerAdded:Object.hasOwn(input,"auditMarker")})';
  explanation='Both return the argument, but only markFunction adds a property to it. No helper mocking.';
 }else if(c.id==='W05'){
  setup=`const trace=[];const target={}; const jQuery={event:{add(elem,types,handler,data,selector){trace.push({types,selector})}}};\n${named('on')}\nconst collection={each(cb){cb.call(target);return this}};collection.on=(${c.predicted.code});`;
  call='fn.call(collection,".audit-child","click",null,function handler(){});';observation='trace';
  explanation='Real source on helper and public on wrapper; event.add is a trace recorder. Same invocation exposes swapped event-type/selector arguments.';
 }else if(c.id==='W07'){
  setup='const target={},qualifier=[target],not=false;const t=qualifier,n=not,s=Array.prototype.indexOf;';
  call='const result=fn(target,0);';observation='({returned:result})';
  explanation='Qualifier is an array containing the element, as required by the actual enclosing branch. Membership succeeds; the wrongly matched predicate attempts to call a non-callable array.';
 }else if(c.id==='W09'){
  setup='const cssPrefixes=["Webkit","Moz","ms"],emptyStyle={width:""},Gt=cssPrefixes,Vt=emptyStyle;';
  call='const result=fn("width");';observation='({returned:result??"<undefined>"})';
  explanation='A style object with native width but no prefixed width. The wrapper returns width; vendorPropName searches prefixes only. The DOM style object is represented by its relevant properties.';
 }else if(c.id==='W10'){
  setup=dataSetup+`\nconst ot=dataPriv; jQuery.filter=()=>[]; ${named('remove')}\nconst collection={length:0};`;
  call='const result=fn.call(collection,".audit-child","key");';observation='({returnType:typeof result,returnsCollection:result===collection})';
  explanation='Real source remove helper on an empty collection and real Data implementation. jQuery.filter returns its faithful empty-selection result. DOM remove returns the collection; private-data remove has no return value.';
 }else if(c.id==='W13'){
  setup=dataSetup+`\n${named('showHide')}\nconst wt=showHide; const element={style:{display:"block"}},collection=[element];`;
  call='const result=fn.call(collection);';observation='({display:element.style.display,returnsCollection:result===collection})';
  explanation='Real source showHide helper and Data implementation, under the already accepted helper correspondence. Starting from display:block needs no DOM-query helper: hide changes it to none while show leaves it block.';
 }else if(['W06','W11','W12'].includes(c.id)){
  type='same-call-behavior-different-source-identity';
  const check=execute(`const a=(${c.bundled.code}),b=(${c.predicted.code});const values=[undefined,null,false,true,0,-0,NaN,1,"text",{},[],function(){},Symbol("x"),1n];({tested:values.length,bothReturnArgument:values.every(x=>Object.is(a(x),x)&&Object.is(b(x),x))})`);
  results.push({id:c.id,type,explanation:'Both bodies simply return the sole parameter with no captures or other operations. Agreement concerns invocation behavior; function name/source reflection and exact source provenance are separate.',result:check});continue;
 }else throw new Error('Unhandled case '+c.id);
 const run=fnCode=>{try{return {outcome:'return',value:execute(setup+`\nconst fn=(${fnCode});\n${call}\n${observation}`)}}catch(e){return {outcome:'throw',errorName:e.name,errorMessage:e.message}}};
 const bundled=run(c.bundled.code),predicted=run(c.predicted.code);
 if(JSON.stringify(bundled)===JSON.stringify(predicted))throw new Error('Counterexample did not distinguish '+c.id);
 results.push({id:c.id,type,explanation,setup,call,observation,bundled,predicted,scope:'Targeted differential execution of extracted functions with stated capture/DOM scaffolding, not a whole-application equivalence proof.'});
}
const identityBodies=enumerate(code).functions.filter(f=>{const n=f.node;return !n.async&&!n.generator&&n.params.length===1&&n.params[0].type==='Identifier'&&n.body.type==='BlockStatement'&&n.body.body.length===1&&n.body.body[0].type==='ReturnStatement'&&n.body.body[0].argument?.type==='Identifier'&&n.body.body[0].argument.name===n.params[0].name}).map(f=>({name:f.name,span:f.node.range}));
write(path.join(dir,'counterexamples.json'),{created:now(),policy:'No model calls. Original predictions and oracle labels unchanged. Tests record their scaffolding and scope; source-map identity and invocation semantics are distinct.',identityBodySourceDefinitions:identityBodies,results});
console.log(JSON.stringify(results.map(({setup,call,observation,explanation,...r})=>r),null,2));
