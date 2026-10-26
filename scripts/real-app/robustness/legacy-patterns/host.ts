// Minimal host for the authors' unchanged pattern matcher on plain JavaScript.
// Not the authors' Babel desugaring pipeline: no TS/JSX/code transformations are performed.
import {parse} from '@babel/parser';
const texts=new Map<string,string>();
export function parseAndDesugar(code:string,file:string){
 texts.set(file,code);
 try{return parse(code,{sourceFilename:file,sourceType:'unambiguous',allowReturnOutsideFunction:true,allowAwaitOutsideFunction:true,allowUndeclaredExports:true,createParenthesizedExpressions:true,attachComment:false})}catch{return null}
}
export function codeFromLocation(loc:any){
 const code=texts.get(loc?.filename);if(code==null)throw Error('Missing source text for matcher location');
 const starts=[0];for(let i=0;i<code.length;i++)if(code[i]==='\n')starts.push(i+1);
 return code.slice(starts[loc.start.line-1]+loc.start.column,starts[loc.end.line-1]+loc.end.column);
}
export default {info:()=>{},error:()=>{},warn:()=>{},debug:()=>{},verbose:()=>{}};
