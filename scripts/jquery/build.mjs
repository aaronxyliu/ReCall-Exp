import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import * as esbuild from 'esbuild';
import {rollup} from 'rollup';
import {nodeResolve} from '@rollup/plugin-node-resolve';
import webpack from 'webpack';
import {minify} from 'terser';
import {root, output, write, hash, now, read} from './common.mjs';

const require=createRequire(import.meta.url);
const entry=path.join(root,'experiments/jquery/app/main.js');
const configs=[];
for(const bundler of ['esbuild','rollup','webpack']) configs.push({id:`${bundler}-min-keep`,bundler,minified:true,treeShaking:false});
const builds=[];
for(const cfg of configs){
 const dir=path.join(output,'builds',cfg.id);fs.mkdirSync(dir,{recursive:true});
 const dest=path.join(dir,'bundle.js');
 if(cfg.bundler==='esbuild') await esbuild.build({entryPoints:[entry],bundle:true,write:true,outfile:dest,platform:'browser',format:'iife',target:'es2020',sourcemap:true,sourcesContent:true,minify:cfg.minified,treeShaking:cfg.treeShaking,legalComments:'none',logLevel:'silent'});
 if(cfg.bundler==='rollup'){
  const bundle=await rollup({input:entry,plugins:[nodeResolve({browser:true})],treeshake:cfg.treeShaking,onwarn:warning=>{if(warning.code!=='CIRCULAR_DEPENDENCY')console.error(warning.message)}});
  const result=await bundle.generate({format:'iife',sourcemap:true,sourcemapExcludeSources:false});
  const chunk=result.output.find(item=>item.type==='chunk');
  if(cfg.minified){const min=await minify(chunk.code,{compress:true,mangle:true,format:{comments:false},sourceMap:{content:chunk.map.toString(),filename:'bundle.js',url:'bundle.js.map',includeSources:true}});fs.writeFileSync(dest,min.code);fs.writeFileSync(dest+'.map',min.map)}
  else {fs.writeFileSync(dest,chunk.code+'\n//# sourceMappingURL=bundle.js.map\n');fs.writeFileSync(dest+'.map',chunk.map.toString())}
  await bundle.close();
 }
 if(cfg.bundler==='webpack') await new Promise((resolve,reject)=>{
  const compiler=webpack({mode:'none',entry,target:['web','es2020'],devtool:'source-map',output:{path:dir,filename:'bundle.js',iife:true,clean:false},optimization:{minimize:cfg.minified,usedExports:cfg.treeShaking,sideEffects:cfg.treeShaking,concatenateModules:cfg.treeShaking},performance:{hints:false}});
  compiler.run((error,stats)=>compiler.close(closeError=>{if(error||closeError||stats.hasErrors())reject(error||closeError||new Error(stats.toString({all:false,errors:true})));else resolve()}));
 });
 fs.copyFileSync(path.join(root,'experiments/jquery/app/index.html'),path.join(dir,'index.html'));
 const map=read(dest+'.map');const code=fs.readFileSync(dest);
 builds.push({...cfg,scopeHoisting:cfg.bundler==='webpack'?cfg.treeShaking:null,bundle:path.relative(root,dest),map:path.relative(root,dest+'.map'),bytes:code.length,sha256:hash(code),mapSha256:hash(fs.readFileSync(dest+'.map')),mapSources:map.sources,hasSourcesContent:Array.isArray(map.sourcesContent)});
 console.log('built',cfg.id,code.length);
}
const versions={};for(const name of ['jquery','esbuild','rollup','webpack','terser','meriyah','source-map','@rollup/plugin-node-resolve']){let p=require.resolve(name);while(!fs.existsSync(path.join(p,'package.json'))||read(path.join(p,'package.json')).name!==name){const up=path.dirname(p);if(up===p)throw new Error(name);p=up}versions[name]=read(path.join(p,'package.json')).version}
write(path.join(output,'build-manifest.json'),{created:now(),node:process.version,versions,entry,entrySha256:hash(fs.readFileSync(entry)),settingsNote:'Tree-shaking off does not disable all minifier dead-code elimination. Webpack toggles usedExports, sideEffects, and concatenateModules together, so its keep/shake contrast is an optimization-profile contrast, not an isolated tree-shaking effect. All builds import the same jQuery package entry; the fixture exposes the complete library object for inspection.',builds});
