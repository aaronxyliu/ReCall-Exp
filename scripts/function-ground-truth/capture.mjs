// Capture bodies in scratch storage. The permanent manifest contains only identities and coverage.
import fs from 'node:fs'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import { createHash } from 'node:crypto'
import puppeteer from 'puppeteer-core'

const [start, scratch, manifestPath] = process.argv.slice(2)
const origin = new URL(start).origin
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const stable = u => u?.startsWith(origin + '/') ? '<local>' + u.slice(origin.length) : u
fs.mkdirSync(scratch, { recursive: true })
const pageErrors=[], requestFailures=[]
const assets = new Map(), failures = [], tasks = new Set(), sessions = new Set()
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args:process.env.RECALL_BROWSER_PROXY?["--proxy-server="+process.env.RECALL_BROWSER_PROXY]:[], protocolTimeout:20000 })
function watch(promise, where) {
  const task = promise.catch(error => failures.push({ where, reason: String(error).slice(0, 400) })).finally(() => tasks.delete(task))
  tasks.add(task)
  return task
}
function add(url, code, kind, hints = {}) {
  if (!code || url?.startsWith('pptr:') || url?.startsWith('node:')) return
  const hash = sha(code)
  const location = url || '<anonymous>'
  const key = location + '\0' + hash
  if (!assets.has(key)) {
    fs.writeFileSync(path.join(scratch, hash + '.js'), code)
    assets.set(key, { url: location, sha256: hash, bytes: Buffer.byteLength(code), channels: [], hints: {} })
  }
  const asset = assets.get(key)
  if (!asset.channels.includes(kind)) asset.channels.push(kind)
  for (const [name, value] of Object.entries(hints)) if (value) asset.hints[name] = value
}
const attached = new WeakSet()
async function attach(target) {
  if (attached.has(target)) return
  attached.add(target)
  const session = await target.createCDPSession()
  sessions.add(session)
  session.on('Debugger.scriptParsed', event => {
    if (!event.scriptId || event.scriptLanguage === 'WebAssembly' || event.url.startsWith('pptr:')) return
    watch(session.send('Debugger.getScriptSource', {scriptId:event.scriptId}).then(({scriptSource}) => {
      add(event.url, scriptSource, 'parsed:'+target.type(), {map:event.sourceMapURL})
    }), 'getScriptSource')
  })
  await session.send('Debugger.enable')
}
async function getMap(asset) {
  const code = fs.readFileSync(path.join(scratch, asset.sha256+'.js'), 'utf8')
  const directives = [...code.matchAll(/(?:\/\/[#@]\s*sourceMappingURL=([^\s]+)|\/\*[#@]\s*sourceMappingURL=([^\s*]+)\s*\*\/)/g)]
  const last = directives.at(-1)
  const ref = asset.hints.header || asset.hints.map || last?.[1] || last?.[2]
  let address
  if (ref?.startsWith('data:')) {
    const comma = ref.indexOf(',')
    const bytes = ref.slice(0, comma).includes(';base64') ? Buffer.from(ref.slice(comma+1),'base64') : Buffer.from(decodeURIComponent(ref.slice(comma+1)))
    return retainMap(bytes, 'inline', 'inline')
  }
  if (!/^https?:\/\//.test(asset.url)) return {status:'no-map-reference'}
  const u = new URL(asset.url)
  if (!ref && (u.origin !== origin || !/\.(?:js|mjs|cjs)$/.test(u.pathname))) return {status:'no-map-reference'}
  address = ref ? new URL(ref, u) : new URL(u.pathname+'.map', u.origin)
  if (address.origin !== u.origin || (!ref && address.origin!==origin)) return {status:'cross-origin-map-not-fetched'}
  const response = await fetch(address, { signal:AbortSignal.timeout(10000), redirect:'error' })
  if (!response.ok) return {status:'http-'+response.status, url:stable(address.href)}
  return retainMap(Buffer.from(await response.arrayBuffer()), stable(address.href), ref ? 'referenced' : 'adjacent')
}
function retainMap(bytes,url,link) {
  let parsed
  try { parsed = JSON.parse(bytes.toString('utf8').replace(/^\)\]\}'[^\n]*\n/,'') ) } catch {return {status:'not-json',url}}
  if (+parsed.version!==3 || (!Array.isArray(parsed.sections) && (typeof parsed.mappings!=='string'||!Array.isArray(parsed.sources)))) return {status:'invalid-map',url}
  const hash=sha(bytes)
  fs.writeFileSync(path.join(scratch,hash+'.map'),bytes)
  return {status:'map-found',sha256:hash,url,link,file:parsed.file||null}
}
let pageStatus=null, title='', finalURL='', bodyTextLength=0
try {
  const page = await browser.newPage()
  page.on("pageerror",error=>pageErrors.push({message:String(error)}))
  page.on("requestfailed",request=>requestFailures.push({url:stable(request.url()),reason:request.failure()?.errorText}))
  await attach(page.target())
  browser.on('targetcreated',target=>{
    if (['worker','service_worker','shared_worker','other'].includes(target.type())) watch(attach(target),'attach:'+target.type())
  })
  page.on('response',response=>{
    const url=response.url(), headers=response.headers()
    if (!response.ok() || !(response.request().resourceType()==='script' || /(?:javascript|ecmascript)/i.test(headers['content-type']||'') || /\.[cm]?js(?:[?#]|$)/i.test(url))) return
    watch(response.text().then(code=>add(url,code,'http',{header:headers.sourcemap||headers['x-sourcemap']})),'response:'+stable(url))
  })
  const response=await page.goto(start,{waitUntil:'domcontentloaded',timeout:60000})
  pageStatus=response?.status()??null
  // Optional application-specific interaction/readiness check; export async default(page).
  // The hook runs while script interception is active. Keep default capture entry-route-only.
  if (process.env.RECALL_PREPARE_PAGE) {
    const {default:prepare} = await import(pathToFileURL(process.env.RECALL_PREPARE_PAGE).href)
    await prepare(page)
  }
  await page.waitForNetworkIdle({idleTime:700,timeout:10000}).catch(()=>{})
  await new Promise(resolve=>setTimeout(resolve,2500))
  title=await page.title(); finalURL=stable(page.url())
  bodyTextLength=await page.evaluate(()=>document.body?.innerText?.trim().length||0)
  for (const session of sessions) await session.send('Debugger.disable').catch(()=>{})
  await Promise.race([Promise.allSettled([...tasks]),new Promise(resolve=>{const timer=setTimeout(resolve,15000);timer.unref()})])
  if(tasks.size)failures.push({where:'capture',reason:'Pending CDP or HTTP reads at capture deadline: '+tasks.size})
} catch(error){failures.push({where:'navigation',reason:String(error)})}
finally {await browser.close()}
const queue = [...assets.values()]
async function resolveMaps() {
 while(queue.length){
  const a=queue.pop()
  // Reuse bytes only for identical code with the same URL and map hint.
  try {a.map=await getMap(a)}
  catch(error){a.map={status:'unavailable',reason:String(error).slice(0,180)}}
  a.url=stable(a.url);delete a.hints
  if (a.url.startsWith('data:')) a.url='data:sha256:'+sha(a.url)
}
}
await Promise.all(Array.from({length:6},resolveMaps))
fs.mkdirSync(path.dirname(manifestPath),{recursive:true})
fs.writeFileSync(manifestPath,JSON.stringify({entry:stable(start),pageStatus,title,finalURL,bodyTextLength,pageErrors,requestFailures,failures,assets:[...assets.values()]},null,2)+'\n')
