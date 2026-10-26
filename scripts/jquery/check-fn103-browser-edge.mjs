import path from 'node:path';
import {pathToFileURL} from 'node:url';
import puppeteer from 'puppeteer-core';
import {root,output,read,write,now,selectedBuilds} from './common.mjs';
const dest=path.join(output,'recovery-bottlenecks/false-negatives/short-variable-mapping-replay');
const record=read(path.join(dest,'requests/FN103.json'));
const pair=JSON.parse(record.request.messages[1].content);
const source=pair.reference_source;
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-first-run','--no-default-browser-check','--disable-background-networking']});
const results=[];
try{for(const b of selectedBuilds(read(path.join(output,'build-manifest.json')).builds)){
 const page=await browser.newPage();await page.goto(pathToFileURL(path.join(root,path.dirname(b.bundle),'index.html')).href);
 const observed=await page.evaluate(({source,expectedBundle})=>{
  const $=window.fixtureJQuery,original=new Function('jQuery','return ('+source+');')($);
  const element=document.createElement('div');element.value=document.all;
  const referenceValue=original.call($(element)),bundledValue=$.fn.val.call($(element));
  return {fixturePassed:window.fixtureResult.passed,matchesSavedFN103Body:$.fn.val.toString()===expectedBundle,elementTag:element.tagName,propertyIsDocumentAll:element.value===document.all,referenceReturnsEmptyString:referenceValue==='',bundledReturnsEmptyString:bundledValue==='',bundledReturnsDocumentAll:bundledValue===document.all,resultsStrictlyEqual:referenceValue===bundledValue,looseNullCheck:element.value==null,nullishCoalescingReturnsDocumentAll:(element.value??'')===document.all};
 },{source,expectedBundle:pair.bundled_function});results.push({build:b.id,...observed});await page.close();
}}finally{await browser.close()}
write(path.join(dest,'fn103-browser-edge.json'),{created:now(),scope:'Additional browser edge-case check of FN103 return normalization. Reference is the exact saved source body instantiated against the same fixture jQuery object; bundle is the actual unmodified fixture implementation. The model did not identify this edge case. This is not a correction to source-map origin labels.',results});console.log(JSON.stringify(results,null,2));
