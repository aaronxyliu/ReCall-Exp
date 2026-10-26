// Offline checks of specific claims, not a proof that all function pairs are equivalent.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base='results/jquery-4.0.0/experiment-3-first-positive-27b/recovery-bottlenecks/false-negatives/external-mapping-tf-replay-27b';
const rows=JSON.parse(fs.readFileSync(base+'/results.json')).records;
const byId=new Map(rows.map(r=>[r.id,r]));
const pair=id=>JSON.parse(byId.get(id).request.messages[1].content);
const compile=(code,bindings={})=>Function(...Object.keys(bindings),'return ('+code+');')(...Object.values(bindings));
const results=[];function add(id,claim,evidence,checks){results.push({id,claim,evidence,checks,status:'checked: claimed difference not observed',scope:'Targeted checks under explicitly corresponding dependencies, not unrestricted equivalence proof.'})}
// FN014: comma sequence returns its final function, not the guard's boolean.
{
 const u=pair('FN014');let checks=0;const error=x=>{throw Error(x)},expr=/^[a-zA-Z][a-zA-Z-]*$/;
 const a=compile(u.source_function,{ridentifier:expr,selectorError:error,unescapeSelector:x=>x,documentIsHTML:true});
 const b=compile(u.bundled_function,{Gn:expr,Ce:error,Y:x=>x,z:true});
 for(const lang of ['en','EN','fr']){const x=a(lang),y=b(lang);assert.equal(typeof x,'function');assert.equal(typeof y,'function');for(const value of ['en','en-US','fr','']){const e={lang:value,nodeType:1,parentNode:null};assert.equal(x(e),y(e));checks++;}}
 for(const lang of ['', '[bad]']){let x,y;try{a(lang)}catch(e){x=e.message}try{b(lang)}catch(e){y=e.message}assert.equal(x,y);assert.ok(x);checks++;}add('FN014','Guard returns early/inverts error handling','Both factories return callbacks for valid language strings and throw matching errors for invalid strings. The comma sequence continues after the guard.',checks);
}
// FN050: captured props remains the first argument; three parameters retain position.
{
 const u=pair('FN050'),props={opacity:0};const a=compile(u.source_function,{props}),b=compile(u.bundled_function,{t:props});const context={animate(...args){return args}};let checks=0;
 for(const args of [[],[100],[100,'linear'],[100,'linear',()=>{}]]){assert.deepEqual(a.apply(context,args),b.apply(context,args));checks++;}add('FN050','Bundled first animate argument is not props','Under t=props, both pass props, speed, easing, callback in the same positions.',checks);
}
// FN058: nullish coalescing is the same null/undefined test as val != null.
{
 const u=pair('FN058'),jq={text:e=>e.text},collapse=x=>String(x).trim().replace(/\s+/g,' ');const a=compile(u.source_function,{jQuery:jq,stripAndCollapse:collapse}),b=compile(u.bundled_function,{i:jq,ie:collapse});let checks=0;
 for(const val of [undefined,null,'',0,false,'abc']){const elem={getAttribute:()=>val,text:' a   b '};assert.deepEqual(a(elem),b(elem));checks++;}add('FN058','?? handles empty strings or zero differently from != null ternary','Both preserve zero, false, and empty strings and evaluate the fallback only for null/undefined.',checks);
}
// FN079: reversing a ternary guard and swapping arms preserves branch selection.
{
 const u=pair('FN079');let checks=0;
 for(const top of [false,true]){const make=()=>{const calls=[];const win={window:null,pageXOffset:23,pageYOffset:47,scrollTo:(...args)=>calls.push(args)};win.window=win;return {calls,win}};const a=compile(u.source_function,{isWindow:e=>e.window===e,prop:'pageYOffset',top}),b=compile(u.bundled_function,{me:e=>e.window===e,t:'pageYOffset',n:top});const x=make(),y=make();assert.equal(a(x.win,'scrollTop',11),b(y.win,'scrollTop',11));assert.deepEqual(x.calls,y.calls);checks++;}add('FN079','Missing !top in bundled scrollTo reverses the x coordinate','Source !top ? val : pageXOffset equals bundled top ? pageXOffset : val for both guards.',checks);
}
// FN118: nested boolean encoding still returns true/false/null for corresponding strings.
{
 const u=pair('FN118'),brace=/^(?:\{[\w\W]*\}|\[[\w\W]*\])$/;const a=compile(u.source_function,{rbrace:brace}),b=compile(u.bundled_function,{st:brace});let checks=0;
 for(const value of ['true','false','null','0','1','001','-0','NaN','abc','[1]','{}']){assert.deepEqual(a(value),b(value));checks++;}add('FN118','Boolean short-circuit encoding changes parsed values','Matching outputs for boolean/null strings, numeric conversion edge cases, plain strings, arrays and objects.',checks);
}
// FN205: nested guards rewritten to && and || still select identical elements.
{
 const u=pair('FN205'),a=compile(u.source_function),b=compile(u.bundled_function);let checks=0;
 for(const values of [[],[0,1,2,false,3],[null,'a','','b']])for(const filter of [null,x=>typeof x==='number',()=>false])for(const mapped of [false,true]){const x=mapped?[]:null,y=mapped?[]:null;assert.deepEqual(a(values,x,filter,{},false),b(values,y,filter,{},false));assert.deepEqual(x,y);checks++;}add('FN205','Short-circuit loop guards change filtering or map writes','Both return the same selected elements and write the same source indices under the checked filters.',checks);
}
// FN103: comma expression returns the final strict selected comparison.
{
 const u=pair('FN103');let checks=0;
 for(const flag of [false,true])for(const selected of [false,true,0,1,undefined]){let left=0,right=0;const a=compile(u.source_function,{isIE:flag}),b=compile(u.bundled_function,{E:flag});const x={selected,parentNode:{get selectedIndex(){left++;return 3}}},y={selected,parentNode:{get selectedIndex(){right++;return 3}}};assert.equal(a(x),b(y));assert.equal(left,right);checks++;}add('FN103','Bundled function returns a short-circuit value instead of selected state','The comma-expression right operand is the selected Boolean; getter side effects also agree for both IE flags.',checks);
}
// FN108: unique&&has || push equals if(!unique||!has) push.
{
 const u=pair('FN108');let checks=0;
 for(const unique of [false,true])for(const has of [false,true]){const x=[],y=[],fn=()=>{};const a=compile(u.source_function,{options:{unique},self:{has:()=>has},list:x,toType:v=>typeof v,add:()=>{}}),b=compile(u.bundled_function,{e:{unique},c:{has:()=>has},o:y,h:v=>typeof v,t:()=>{}});assert.equal(a(null,fn),b(null,fn));assert.deepEqual(x,y);checks++;}add('FN108','Unique-option guard is inverted','All four unique/has combinations produce identical push decisions.',checks);
}
// FN132: && guard followed by || assignment implements a positive OR type check.
{
 let checks=0;for(const type of [1,3,8,9,11]){const source=type===1||type===11||type===9,bundled=!(type!==1&&type!==11&&type!==9);assert.equal(source,bundled);checks++;}add('FN132','Bundled nodeType condition sets text only on excluded node types','The disjunction after the negative conjunction runs the write exactly for node types 1, 11, and 9.',checks);
}
// FN141: only showHide is conditional; removal and for-in loop always run.
{
 const u=pair('FN141');let checks=0;
 for(const hidden of [false,true]){const left=[],right=[],elem={},orig={width:10,height:20};const bindings=log=>({show:xs=>log.push(['show',xs]),store:{remove:(...x)=>log.push(['remove',...x])},jq:{style:(...x)=>log.push(['style',...x])}});const x=bindings(left),y=bindings(right);const a=compile(u.source_function,{hidden,showHide:x.show,dataPriv:x.store,elem,orig,prop:undefined,jQuery:x.jq}),b=compile(u.bundled_function,{g:hidden,Tt:y.show,ot:y.store,e:elem,d:orig,r:undefined,T:y.jq});assert.equal(a(),b());assert.deepEqual(left,right);assert.ok(left.some(x=>x[0]==='remove'));checks++;}add('FN141','Bundled removal/style calls became unconditional and showHide is extra','Only showHide is conditional in both versions. Removal and style writes occur for hidden=true as well as hidden=false.',checks);
}
// FN168: comma-separated guard still returns the first response value.
{
 const u=pair('FN168');let checks=0;const jq={error:x=>{throw Error(x)}};
 for(const container of [[17],[],null,undefined,false]){const a=compile(u.source_function,{responseContainer:container,jQuery:jq,callbackName:'cb'}),b=compile(u.bundled_function,{a:container,T:jq,i:'cb'});const outcome=fn=>{try{return {value:fn()}}catch(e){return {error:e.message}}};assert.deepEqual(outcome(a),outcome(b));checks++;}add('FN168','Bundle returns error helper result instead of response[0]','The guard throws matching errors for falsy containers; otherwise both return container[0].',checks);
}
// FN178: the final undefined literal is a test operand, not the returned value.
{
 const u=pair('FN178');let checks=0;
 for(const elem of [{nodeType:1},{isWindow:true,innerWidth:120,document:{documentElement:{clientWidth:100}}},{nodeType:9,body:{scrollWidth:300,offsetWidth:250},documentElement:{scrollWidth:280,offsetWidth:260,clientWidth:240}}])for(const args of [[],[12],[12,13]]){const make=()=>({fn:{},css:(e,t,x)=>['css',t,x],style:(e,t,v,x)=>['style',t,v,x]});const x=make(),y=make(),access=(obj,fn,type,value)=>fn(obj.elem,type,value),isWindow=e=>e.isWindow;compile(u.source_function,{jQuery:x,access,isWindow,name:'Width',type:'width'})('border','outerWidth');compile(u.bundled_function,{T:y,V:access,g:isWindow,e:'Width',t:'width'})('border','outerWidth');assert.deepEqual(x.fn.outerWidth.apply({elem},args),y.fn.outerWidth.apply({elem},args));checks++;}add('FN178','Bundled else branch returns undefined instead of css/style result','Both call the corresponding css/style helpers on ordinary elements and return the same window/document measurements.',checks);
}
// FN230: an early false return is equivalent to the source else branch.
{
 const u=pair('FN230');let checks=0;
 for(const flag of [false,true]){const x=[],y=[],handler=()=>{},a=compile(u.source_function,{isIE:flag,delegateType:'focus',focusMappedHandler:handler}),b=compile(u.bundled_function,{j:flag,t:'focus',n:handler});assert.equal(a.call({removeEventListener:(...a)=>x.push(a)}),b.call({removeEventListener:(...a)=>y.push(a)}));assert.deepEqual(x,y);checks++;}add('FN230','Bundled early false branch changes teardown','Both return false when IE is false; otherwise both remove the same listener and return undefined.',checks);
}
// FN254: inverted else guard preserves recursive object/array serialization.
{
 const u=pair('FN254'),jq={each:(xs,fn)=>xs.forEach((x,i)=>fn(i,x))},toType=x=>x===null?'null':Array.isArray(x)?'array':typeof x,rbracket=/\[\]$/;const a=compile(u.source_function,{jQuery:jq,toType,rbracket}),b=compile(u.bundled_function,{w:jq,d:toType,Sn:rbracket});let checks=0;
 for(const prefix of ['x','x[]'])for(const traditional of [false,true])for(const obj of [3,'hello',null,{a:1,b:[2,3]},[1,{a:2},null,[3]]]){const x=[],y=[];a(prefix,obj,traditional,(...args)=>x.push(args));b(prefix,obj,traditional,(...args)=>y.push(args));assert.deepEqual(x,y);checks++;}add('FN254','Bundled traditional/type branch changes parameter serialization','Corresponding helpers produce identical key/value additions across scalar, object and nested-array fixtures.',checks);
}
// Callee evidence explains the optimizer replacing elem with 0 in setPositiveNumber.
const data=JSON.parse(fs.readFileSync('results/jquery-4.0.0/experiment-3-first-positive-27b/detector-input.json'));
const positive=data.sources.flatMap(s=>s.functions).find(f=>f.name==='setPositiveNumber');
results.push({id:'FN136/FN237/FN236',claim:'Passing 0 instead of elem changes helper behavior',status:'requires callee context; first formal parameter is unused',evidence:positive.code,scope:'The real source helper does not use _elem or arguments. Function-pair-only prompts omit this supporting definition.'});
const dest=base+'/explanation-replay/checked-claims.json';fs.writeFileSync(dest,JSON.stringify({policy:'Offline targeted checks; no model calls or changes to predictions.',results},null,2)+'\n');console.log(JSON.stringify(results.map(r=>({id:r.id,status:r.status,checks:r.checks})),null,2));
