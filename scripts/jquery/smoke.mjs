import path from 'node:path';
import {pathToFileURL} from 'node:url';
import puppeteer from 'puppeteer-core';
import {root,output,read,write,now} from './common.mjs';
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-first-run','--no-default-browser-check','--disable-background-networking']});
const results=[];
try{for(const build of read(path.join(output,'build-manifest.json')).builds){const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.goto(pathToFileURL(path.join(root,path.dirname(build.bundle),'index.html')).href);const result=await page.evaluate(()=>window.fixtureResult||null);results.push({build:build.id,result,errors,passed:!!result?.passed&&errors.length===0});await page.close();console.log(build.id,results.at(-1).passed)}}finally{await browser.close()}
write(path.join(output,'browser-smoke.json'),{created:now(),browser:'Locally installed Chrome, headless, file:// fixture',results,passed:results.every(r=>r.passed)});
if(!results.every(r=>r.passed))process.exitCode=1;
