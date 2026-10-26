import path from 'node:path';
import {pathToFileURL} from 'node:url';
import puppeteer from 'puppeteer-core';
import {root,output,read,write,now,selectedBuilds} from './common.mjs';
// Supplemental tests of the unmodified built libraries, not model inference.
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-first-run','--no-default-browser-check','--disable-background-networking']});
const results=[];
try{for(const b of selectedBuilds(read(path.join(output,'build-manifest.json')).builds)){
 const page=await browser.newPage();await page.goto(pathToFileURL(path.join(root,path.dirname(b.bundle),'index.html')).href);
 const observations=await page.evaluate(()=>{
  const $=window.fixtureJQuery;
  const storageOwner={};$.data(storageOwner,'audit-key','public');$._data(storageOwner,'audit-key','private');
  const stores={public:$.data(storageOwner,'audit-key'),private:$._data(storageOwner,'audit-key')};
  function removal(privateStore){const owner={};$.data(owner,'audit-key','public');$._data(owner,'audit-key','private');(privateStore?$._removeData:$.removeData)(owner,'audit-key');return {public:$.data(owner,'audit-key')??'<absent>',private:$._data(owner,'audit-key')??'<absent>'}}
  const node=document.createElement('div');document.body.append(node);node.style.display='block';$(node).hide();const hidden=node.style.display;node.style.display='block';$(node).show();const shown=node.style.display;node.remove();
  function delegation(asOn){const parent=document.createElement('div'),child=document.createElement('button');child.className='audit-child';parent.append(child);document.body.append(parent);let count=0;(asOn?$.fn.on:$.fn.delegate).call($(parent),'.audit-child','click',null,()=>count++);$(child).trigger('click');$(parent).remove();return count}
  function domRemoval(asPrivate){const parent=document.createElement('div'),child=document.createElement('div');child.className='audit-child';parent.append(child);document.body.append(parent);const collection=$(child),result=(asPrivate?$._removeData:$.fn.remove).call(collection,'.audit-child','key'),out={childStillAttached:child.parentNode===parent,returnsCollection:result===collection,returnType:typeof result};$(parent).remove();return out}
  const values=[undefined,null,false,0,-0,NaN,1,'text',{},[]];
  return {fixturePassed:window.fixtureResult.passed,stores,removePublic:removal(false),removePrivate:removal(true),visibility:{hide:hidden,show:shown},eventArgumentOrder:{delegate:delegation(false),onWithDelegateArguments:delegation(true)},domVersusPrivateRemoval:{dom:domRemoval(false),private:domRemoval(true)},identityBodies:{values:values.length,bothReturnInput:values.every(x=>Object.is($.easing.linear(x),x)&&Object.is($.htmlPrefilter(x),x))}};
 });
 results.push({build:b.id,observations});await page.close();
}}finally{await browser.close()}
write(path.join(output,'wrong-identity-audit/browser-behavior.json'),{created:now(),policy:'Supplemental actual-browser observations of unmodified prebuilt libraries. No model calls, no oracle updates, no source rewriting.',results});
console.log(JSON.stringify(results,null,2));
