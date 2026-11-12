// Ground-truth-only ownership. This module must never be imported by recovery.
export function sourceLibrary(source,selection){
 const explicit=selection.sourceOwnership?.[source];
 const matches=[...source.replaceAll('\\','/').matchAll(/(?:^|\/)(?:node_modules|~)\/((?:@[^/]+\/)?[^/]+)/g)];
 const match=matches.at(-1),name=explicit?.library||match?.[1];
 if(!selection.selected.includes(name))return null;
 const root=explicit?.packageRoot||explicit?.instance||(match?source.slice(0,match.index+match[0].length):'declared:'+name);
 const version=explicit?.version||null;
 return {name,version,root,id:JSON.stringify([name,version,root])};
}
