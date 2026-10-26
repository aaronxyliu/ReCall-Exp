// Handwritten mechanism probes, NOT outputs of commercial or OSS obfuscators.
// Run from any directory: node /absolute/path/to/pog-mechanism-probe.mjs
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {extractFeatures, identifyAnchors} from '../../../ReCall/components/pog/index.mjs';

const keys = ['alpha','beta','gamma','delta','epsilon','zeta','eta','theta','iota','kappa'];
const body = (names, access, extra='') =>
  `const o={${names.map((k,i)=>`${k}:x+${i}`).join(',')}};${extra}return ${names.map(access).join('+')};`;
const originalBody = body(keys,k=>`o.${k}`);
const original = `function target(x){${originalBody}}`;
const cases = [
  {id:'unchanged', code:original},
  {id:'local-renaming', code:original.replaceAll('target','renamed').replaceAll(/\bx\b/g,'a').replaceAll(/\bo\b/g,'b'), entry:'renamed'},
  {id:'literal-bracket-properties', code:`function target(x){${body(keys,k=>`o[${JSON.stringify(k)}]`)}}`},
  {id:'table-indexed-properties', code:`const keys=${JSON.stringify(keys)};function target(x){${body(keys,k=>`o[keys[${keys.indexOf(k)}]]`)}}`},
  {id:'private-property-renaming', code:`function target(x){${body(keys.map((_,i)=>`p${i}`),k=>`o.${k}`)}}`},
  {id:'unreachable-property-noise', code:`function target(x){${body(keys,k=>`o.${k}`,'if(x<0 && x>=0){o.noise;}')}}`},
  {id:'runtime-generated-body', code:`const target=new Function('x',${JSON.stringify(originalBody)});`}
];
const inventory = code => extractFeatures({files:[{id:'probe',path:'inline-probe.js',code}]});
const source = inventory(original);
const ref = source.functions.find(f=>f.name==='target');
if(!ref) throw Error('Reference function missing');
const inputs = [-2,0,3,100];
const baseline = inputs.map(x=>runInNewContext(`${original};target(${x})`,{}, {timeout:1000}));
const rows = cases.map(c=>{
  const target = inventory(c.code);
  const fn = target.functions.find(f=>f.name===(c.entry||'target'));
  const observed = inputs.map(x=>runInNewContext(`${c.code};${c.entry||'target'}(${x})`,{}, {timeout:1000}));
  if(JSON.stringify(observed)!==JSON.stringify(baseline)) throw Error(`Behavior check failed: ${c.id}`);
  return {id:c.id,code:c.code,codeSha256:createHash('sha256').update(c.code).digest('hex'),
    sampledOutputs:observed,sampledBehaviorMatches:true,parsedFunctions:target.functions.length,
    targetEnumerated:!!fn,propertyOperations:fn?.propertyOperations??null,pogHash:fn?.pogHash??null,
    samePogAsReference:fn?fn.pogHash===ref.pogHash:null,
    anchorsAtDefaultFeatureThreshold:identifyAnchors(source,target).matches.length,
    diagnostics:target.diagnostics};
});
const toolRoot = fileURLToPath(new URL('../../../ReCall/',import.meta.url));
const evidencePaths = ['components/pog/index.mjs','src/analysis/measure.mjs',
  'vendor/debun/fingerprint-collector/pog-generator.js','vendor/debun/fingerprint-collector/hash-function.js'];
const report = {
  schema:'recall.obfuscation-mechanism-probe/v1',
  status:'completed-handwritten-mechanism-probe-only',
  toolCommit:execFileSync('git',['-C',toolRoot,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  nodeVersion:process.version,
  sourceFiles:evidencePaths.map(path=>({path,sha256:createHash('sha256').update(fs.readFileSync(new URL(path,new URL('../../../ReCall/',import.meta.url)))).digest('hex')})),
  scope:'One synthetic function; seven handwritten forms; four numeric inputs per form; no obfuscator, models, or full recovery run. Sampled behavior is not an equivalence proof.',
  inputs,referencePogHash:ref.pogHash,rows
};
fs.writeFileSync(new URL('./pog-mechanism-probe.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(rows.map(({id,parsedFunctions,samePogAsReference,anchorsAtDefaultFeatureThreshold})=>
  ({id,parsedFunctions,samePogAsReference,anchorsAtDefaultFeatureThreshold})),null,2));
