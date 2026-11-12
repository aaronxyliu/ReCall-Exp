// Shared ownership rules for source and generated code. These classify evidence;
// they never move a mapping to the nearest function or infer a semantic identity.
import {parse} from '@babel/parser'

const functionTypes = new Set(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression','ObjectMethod','ClassMethod','ClassPrivateMethod'])
const metadata = new Set(['loc','extra','tokens','comments','leadingComments','innerComments','trailingComments'])
const structural = new Set(['{','}','(',')','[',']',',',';',':','.','?.','eof'])

export function functionInventory(code, prefix, pkg = null) {
  const options = {sourceType:'unambiguous', allowReturnOutsideFunction:true, tokens:true}
  let ast
  try { ast = parse(code,{...options,plugins:['jsx','decorators-legacy']}) }
  catch { ast = parse(code,{...options,plugins:['jsx','decorators-legacy','typescript']}) }
  const functions = [], lines = [0]
  for(let i=0;i<code.length;i++)if(code[i]==='\n')lines.push(i+1)
  function visit(node,parent=null) {
    if(!node||typeof node!=='object')return
    if(functionTypes.has(node.type)&&node.body) {
      parent={id:prefix+'@'+node.start+'-'+node.end,start:node.start,end:node.end,
        bodyStart:node.body.start+(node.body.type==='BlockStatement'?1:0),
        bodyEnd:node.body.end-(node.body.type==='BlockStatement'?1:0),parent,pkg}
      functions.push(parent)
    }
    for(const [key,value]of Object.entries(node))if(!metadata.has(key)&&value&&typeof value==='object') {
      if(Array.isArray(value))for(const child of value)visit(child,parent)
      else visit(value,parent)
    }
  }
  visit(ast.program)
  functions.sort((a,b)=>a.start-b.start||b.end-a.end)
  const tokens=ast.tokens.filter(t=>typeof t.type==='object')
  function preceding(items,offset) {
    let lo=0,hi=items.length
    while(lo<hi){const mid=(lo+hi)>>1;if(items[mid].start<=offset)lo=mid+1;else hi=mid}
    return items[lo-1]
  }
  function point(line,column) {
    if(line<1||line>lines.length||column<0||lines[line-1]+column>(lines[line]??code.length+1)-1)throw Error('map position outside artifact')
    const offset=lines[line-1]+column
    let fn=preceding(functions,offset)
    while(fn&&offset>=fn.end)fn=fn.parent
    const token=preceding(tokens,offset)
    // Header and punctuation points are weak evidence. In particular a nested
    // function's header is NOT assigned to its enclosing function's body.
    const informative=token&&offset<token.end&&!structural.has(token.type.label)
    const kind=!fn?'outside':offset<fn.bodyStart||offset>=fn.bodyEnd?'boundary':!informative?'structural':'body'
    return {fn,kind,offset,tokenStart:token?.start}
  }
  return {functions,point}
}
