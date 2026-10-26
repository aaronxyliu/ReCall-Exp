import {createRequire} from 'node:module';
const req=createRequire(import.meta.url),{webpackChunk,isSubTree,MATCHED_NODE,parseAndDesugar}=req('./recognizer.cjs');
export function recognize(spec){
 const ast=parseAndDesugar(spec.code,spec.id+'.js');if(!ast)throw Error('Original-pattern host could not parse '+spec.id);
 for(const [patternName,pattern]of Object.entries(webpackChunk)){
  const [matched,map]=isSubTree(pattern,ast,4);if(!matched)continue;
  const node=map.get(MATCHED_NODE),table=map.get('RETURN'),ns=map.get('NAMESPACE'),namespace=ns?.name??ns?.value;
  // Same whole-file position gate as authors' checkFileIsChunk.
  if(!node.loc?.start.line||node.loc.start.line-20>0||!ast.loc?.end.line||!node.loc.end.line||ast.loc.end.line-node.loc.end.line>20)continue;
  if(!namespace||!table||!['ArrayExpression','ObjectExpression'].includes(table.type))throw Error('Unsupported module table from matched original pattern '+patternName);
  const entries=table.type==='ArrayExpression'?table.elements.flatMap((f,i)=>f?[{moduleId:String(i),node:f}]:[]):table.properties.map(p=>({moduleId:String(p.key.name??p.key.value),node:p.value}));
  const factories=entries.filter(e=>['FunctionExpression','ArrowFunctionExpression'].includes(e.node?.type)).map(e=>({moduleId:e.moduleId,factorySpan:[e.node.start,e.node.end],namespace,patternName}));
  return {kind:'chunk',patternName,pattern,namespace,tableType:table.type,tableSpan:[table.start,table.end],matchedSpan:[node.start,node.end],factories};
 }
 return {kind:'unrecognized',factories:[]};
}
