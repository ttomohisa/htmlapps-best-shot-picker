/* Manual-only synthetic 12MP diagnostic. No product hooks, mocked APIs or models.
 * Linux /proc is required for the sampled resource stop lines; fail closed otherwise.
 * Run after canonical build: node experiments/resource-probe/browser.cjs
 * Explicit expansion: BSP_RESOURCE_MAX_COUNT=100 node experiments/resource-probe/browser.cjs
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { config, limits, stopReason, sampleResources, validateManifest } = require('./support.cjs');
const { readStoredZip } = require('../../tests/performance.browser.cjs');
const ROOT=path.resolve(__dirname,'../..'), OUT=path.join(ROOT,'test-results/resource-probe');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const run=promisify(execFile), variants=['index.html','index.self-extract.html'];
const ms=start=>Math.round(performance.now()-start);
async function bounded(promise,milliseconds){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Browser cleanup deadline exceeded')),milliseconds);})]);}finally{clearTimeout(timer);}}
async function idle(page,count) {
 await page.waitForFunction(n=>document.querySelector('#loadProgress').hidden&&document.querySelector('#analysisProgress').hidden&&document.querySelectorAll('.photo-card').length===n&&/finished|解析が終わりました。/.test(document.querySelector('#analysisResult').textContent),count,{timeout:limits.caseMs});
 assert.equal(await page.locator('#errorList li').count(),0);
}
async function clear(page) {
 await page.locator('#clearButton').click(); await page.locator('#appConfirmOk').click();
 await page.waitForFunction(()=>document.querySelectorAll('.photo-card').length===0);
 assert.equal(await page.locator('#downloadButton').isEnabled(),false);
}
async function download(page,selector,destination) {
 const [file]=await Promise.all([page.waitForEvent('download'),page.locator(selector).click()]); await file.saveAs(destination); return readStoredZip(await fs.readFile(destination));
}
function observe() {
 // Read-only timing observations; this adds overhead. No browser/app APIs replaced.
 const result={heartbeats:0,maxHeartbeatGapMs:0,longTasks:0,longTaskMaxMs:0,violations:[]};
 let previous=performance.now();
 const interval=setInterval(()=>{const now=performance.now();result.heartbeats++;result.maxHeartbeatGapMs=Math.max(result.maxHeartbeatGapMs,now-previous);previous=now;},50);
 let observer;
 try { observer=new PerformanceObserver(list=>{for(const entry of list.getEntries()){result.longTasks++;result.longTaskMaxMs=Math.max(result.longTaskMaxMs,entry.duration);}});observer.observe({entryTypes:['longtask']});result.longTaskSupported=true; }catch{result.longTaskSupported=false;}
 document.addEventListener('securitypolicyviolation',event=>result.violations.push(event.violatedDirective));
 window.__resourceObservation={result,finish(){clearInterval(interval);observer?.disconnect();return result;}};
}
async function caseRun(artifact,manifest,fixtureDir) {
 const result={variant:path.basename(artifact),count:manifest.count,status:'running',phase:'launch',timingsMs:{},resources:{samples:0,maxSampledRssBytes:0,minSampledAvailableBytes:null},errors:[],externalRequests:[]};
 let server,browser,page,timer,poll,stopping=false,monitoring=true,stopMessage=null,watchPromise=Promise.resolve();
 const stop=reason=>{if(stopping)return;stopping=true;stopMessage=reason;void server?.kill().catch(()=>{});};
 try {
  timer=setTimeout(()=>stop('Case exceeded diagnostic time budget'),limits.caseMs);
  server=await chromium.launchServer({headless:true,timeout:30000});
  browser=await chromium.connect(server.wsEndpoint(),{timeout:30000}); result.chromium=browser.version();
  const sample=async()=>{const value=await sampleResources(server.process().pid);result.resources.samples++;result.resources.maxSampledRssBytes=Math.max(result.resources.maxSampledRssBytes,value.rss);result.resources.minSampledAvailableBytes=Math.min(result.resources.minSampledAvailableBytes??Infinity,value.available);const reason=stopReason(value);if(reason)throw Error(reason);};
  await sample();
  // Schedule the next sample only after the previous sample resolves.
  const monitor=()=>{watchPromise=sample().catch(error=>stop(error.message));void watchPromise.then(()=>{if(monitoring&&!stopping)poll=setTimeout(monitor,limits.sampleMs);});};
  poll=setTimeout(monitor,limits.sampleMs);
  const context=await browser.newContext({viewport:{width:1360,height:900},acceptDownloads:true});
  await context.route(/^https?:\/\//,route=>{result.externalRequests.push(route.request().url());return route.abort();});
  await context.addInitScript(observe); page=await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror',error=>result.errors.push(error.message));
  await page.goto(pathToFileURL(artifact).href); await page.locator('#fileInput').waitFor({state:'attached'});
  if(await page.locator('html').getAttribute('lang')!=='en')await page.locator('#languageButton').click();
  const paths=manifest.files.map(file=>path.join(fixtureDir,file.name));
  if(manifest.count===4){
   result.phase='cancel partial import';
   await page.locator('#fileInput').setInputFiles(paths);
   await page.waitForFunction(()=>document.querySelectorAll('.photo-card').length>0&&!document.querySelector('#loadProgress').hidden);
   await page.locator('#cancelLoadButton').click();
   await page.locator('#loadProgress').waitFor({state:'hidden'});
   result.cancelledImportRetained=await page.locator('.photo-card').count();
   assert(result.cancelledImportRetained>0&&result.cancelledImportRetained<4,'Partial cancellation must be observed, not assumed after completion');
   await clear(page);
  }
  result.phase='import and default analysis'; const start=performance.now();
  await page.locator('#fileInput').setInputFiles(paths); await idle(page,manifest.count);
  result.timingsMs.setInputFilesThroughAnalysis=ms(start);
  assert.equal(await page.locator('.photo-card.kept').count(),0,'Analysis never sets Keep');
  assert.equal(await page.locator('#selectA option').count(),manifest.count);
  result.phase='12MP comparison';
  for(let i=0;i<3;i++){
   const file=manifest.files[i];
   // IDs are session-owned and can increase after reset; take actual option order.
   const value=await page.locator('#selectA option').nth(i).getAttribute('value');
   await page.locator('#selectA').selectOption(value);
   await page.waitForFunction(f=>{const im=document.querySelector('#imageA');return im.complete&&im.alt===f.name&&im.naturalWidth===f.width&&im.naturalHeight===f.height;},file);
  }
  result.phase='Keep and Undo';
  for(let i=0;i<3;i++)await page.locator('.photo-card .keep-button').nth(i).click();
  await page.locator('#appToastAction').click(); assert.equal(await page.locator('.photo-card.kept').count(),2);
  await page.locator('.photo-card .keep-button').nth(2).click(); assert.equal(await page.locator('.photo-card.kept').count(),3);
  const expected=manifest.files.slice(0,3).map(f=>({name:f.name,sha256:f.sha256,bytes:f.bytes}));
  result.phase='single original ZIP';
  await page.locator('#outputFilename').fill(`resource-${manifest.count}`);
  result.singleZip=await download(page,'#downloadButton',path.join(OUT,`${result.variant}-${manifest.count}-single.zip`));
  assert.deepEqual(result.singleZip,expected);
  result.phase='one-part independent batch ZIP';
  await page.locator('#zipMode').selectOption('batches'); await page.locator('#zipBatchSize').selectOption('32');
  await page.locator('#planZipBatchesButton').click();
  // A real single-ZIP download is pending: acknowledge it only after extraction.
  await page.locator('#appConfirmOk').click();
  await page.locator('#prepareZipBatchButton').click();
  result.batchZip=await download(page,'#downloadZipBatchButton',path.join(OUT,`${result.variant}-${manifest.count}-batch.zip`));
  assert.deepEqual(result.batchZip,expected); await page.locator('#finishZipBatchesButton').click();
  result.phase='reset and later input'; await clear(page);
  await page.locator('#fileInput').setInputFiles([paths[2]]);await idle(page,1);
  assert.equal(await page.locator('.photo-card.kept').count(),0);await clear(page);
  result.observations=await page.evaluate(()=>window.__resourceObservation.finish());
  assert.deepEqual(result.errors,[]);assert.deepEqual(result.externalRequests,[]);assert.deepEqual(result.observations.violations,[]);
  assert.equal(await page.evaluate(()=>typeof window.tf),'undefined');
  monitoring=false;clearTimeout(poll);await watchPromise;await sample();
  assert(!stopMessage,stopMessage);result.phase='complete';result.status='passed';
 }catch(error){result.status='failed';result.failure=stopMessage||error.message;if(page&&!page.isClosed())await page.screenshot({path:path.join(OUT,`${result.variant}-${manifest.count}-failure.png`)}).catch(()=>{});}
 finally{
  monitoring=false;stopping=true;clearTimeout(timer);clearTimeout(poll);
  if(server)try{await bounded(server.close(),5000);}catch(error){
   result.status='failed';result.teardownError=error.message;
   await bounded(server.kill(),5000).catch(killError=>{result.teardownError+='; '+killError.message;});
  }
 }
 console.log(JSON.stringify({variant:result.variant,count:result.count,status:result.status,phase:result.phase,failure:result.failure,resources:result.resources}));return result;
}
async function main(){
 const options=config(process.env);await fs.mkdir(OUT,{recursive:true});
 const report={schemaVersion:1,profile:'synthetic-geometric-12mp-v1',status:'running',generatedAt:new Date().toISOString(),limits,counts:options.counts,artifacts:[],stages:[],environment:{platform:process.platform,node:process.version,cpu:os.cpus()[0]?.model,totalMemoryBytes:os.totalmem()},ci:{sha:process.env.GITHUB_SHA||null,runId:process.env.GITHUB_RUN_ID||null},claims:{physicalDevice:false,realPhotoThroughput:false,photographicAccuracy:false,optionalModels:false,hardMemoryCap:false,peakUniqueProcessMemory:false,synthetic12MPDecode:true},harnessSha256:sha(await fs.readFile(__filename))};
 try{
  assert.equal(process.platform,'linux','Manual probe requires Linux /proc resource sampling');
  for(const variant of variants){const bytes=await fs.readFile(path.join(options.distDir,variant));report.artifacts.push({variant,bytes:bytes.length,sha256:sha(bytes)});}
  for(const count of options.counts){
   const dir=path.join(OUT,`fixtures-${count}`);
   const generated=await run('python3',[path.join(__dirname,'fixtures.py'),'--count',String(count),'--output',dir],{timeout:180000,maxBuffer:1024*1024});console.log(generated.stdout.trim());
   const manifestBytes=await fs.readFile(path.join(dir,'manifest.json')),manifest=JSON.parse(manifestBytes);
   const stage={count,totalInputBytes:validateManifest(manifest,count),manifestSha256:sha(manifestBytes),cases:[]};report.stages.push(stage);
   for(const file of manifest.files){const bytes=await fs.readFile(path.join(dir,file.name));assert.equal(bytes.length,file.bytes);assert.equal(sha(bytes),file.sha256);}
   for(const variant of variants){const result=await caseRun(path.join(options.distDir,variant),manifest,dir);stage.cases.push(result);assert.equal(result.status,'passed',`${count}/${variant}: ${result.failure}`);}
   // Larger corpus is not generated, imported or claimed until both 4-photo cases pass.
  }
  report.status='passed';
 }catch(error){report.status='failed';report.failure=error.message;process.exitCode=1;}
 finally{await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(`Resource report: ${path.join(OUT,'report.json')}`);}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
