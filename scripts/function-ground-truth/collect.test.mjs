// Real-browser integration test. Requires Chrome or CHROME_BIN.
import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import {execFileSync,execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {fileURLToPath} from 'node:url'
import {build} from 'esbuild'
const exec=promisify(execFile), collector=fileURLToPath(new URL('./collect.mjs',import.meta.url))
test('capture and map a production library; reject undeclared inputs',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'recall-fixture-'))
 const put=(name,text)=>fs.writeFile(path.join(root,name),text)
 const server=http.createServer(async(req,res)=>{
  try{const name=req.url==='/'?'index.html':req.url.slice(1);res.setHeader('Content-Type',name.endsWith('.js')?'application/javascript':'text/html');res.end(await fs.readFile(path.join(root,name)))}catch{res.statusCode=404;res.end()}
 })
 try{
  await fs.mkdir(path.join(root,'node_modules/fixture-lib'),{recursive:true})
  await put('package.json',JSON.stringify({name:'fixture-app',dependencies:{'fixture-lib':'1.0.0'}}))
  await put('node_modules/fixture-lib/package.json','{"name":"fixture-lib","main":"index.js"}')
  await put('node_modules/fixture-lib/index.js','export function greet(name) { const label = "Hello " + name; return label.toUpperCase(); }')
  await put('entry.js','import {greet} from "fixture-lib"; document.body.textContent = greet("world");')
  await put('index.html','<body><script src="/bundle.js"></script></body>')
  await build({entryPoints:[path.join(root,'entry.js')],bundle:true,minify:true,sourcemap:true,outfile:path.join(root,'bundle.js')})
  execFileSync('git',['init',root]);execFileSync('git',['-C',root,'add','package.json']);execFileSync('git',['-C',root,'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','fixture'])
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  await put('HOST.md','```recall-capture\n'+JSON.stringify({url:`http://127.0.0.1:${server.address().port}/`,manifest:'package.json'})+'\n```')
  await put('libraries.json','["fixture-lib"]')
  const args=[collector,root,path.join(root,'libraries.json'),path.join(root,'HOST.md'),path.join(root,'output')]
  await exec(process.execPath,args,{timeout:90000})
  assert.deepEqual((await fs.readdir(path.join(root,'output'))).sort(),['func-mapping.json','runtime-js','source-maps'])
  const report=JSON.parse(await fs.readFile(path.join(root,'output/func-mapping.json')))
  assert(report.pairs.length>0);assert(report.pairs.every(p=>p.library==='fixture-lib'&&!('syntaxIdentical'in p)))
  assert(report.capture.assets.some(a=>a.map.status==='map-found'))
  await put('libraries.json','["undeclared-library"]')
  await assert.rejects(exec(process.execPath,args),/not a production dependency/)
 }finally{await new Promise(resolve=>server.close(resolve));await fs.rm(root,{recursive:true,force:true})}
})
