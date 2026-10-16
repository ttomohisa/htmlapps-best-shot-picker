/* CI-only browser runner. This task must not launch local Chromium. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {chromium}=require('playwright');
const {out}=require('./acquire.cjs');
const {pathToFileURL}=require('node:url');
const {productCsp}=require('./probe-build.cjs');
const clean=d=>{assert(d);assert.equal(d.createdWorkers,d.terminatedWorkers);assert.equal(d.createdURLs,d.revokedURLs);assert.equal(d.pendingRequests,0);assert.equal(d.closed,true);};
(async()=>{
 const browser=await chromium.launch({headless:true}),results=[];
 try{
  for(const variant of ['readable','self-extract'])for(const modelType of ['short','full'])for(const mode of ['normal','broken','injected']){
   const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),requests=[],errors=[],consoleErrors=[];
   page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
   page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
   await context.route(/^https?:/,r=>r.abort());
   const file='probe-'+modelType+(variant==='self-extract'?'.self-extract':'')+'.html';
   await page.goto(pathToFileURL(path.join(out,file)).href+'#'+mode,{timeout:60000});
   await page.waitForFunction(()=>window.faceProbe?.done,{},{timeout:240000});
   const report=await page.evaluate(()=>window.faceProbe.report);
   assert.equal(await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content'),productCsp());
   Object.assign(report,{variant,candidate:modelType==='short'?'candidate with upstream default minScore 0.5 and maxFaces 6':'diagnostic only',browser:browser.version(),environment:'Headless Chromium in CI, 390x844 CSS viewport. Not a phone or a physical-device performance measurement.',requests:[...requests],pageErrors:[...errors],consoleErrors:[...consoleErrors]});
   const filename='probe-browser-'+variant+'-'+modelType+'-'+mode+'-results.json';
   await fs.writeFile(path.join(out,filename),JSON.stringify(report,null,2)+'\n');
   assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(report.attempts,[]);assert.deepEqual(report.violations,[]);
   assert.equal(report.mainThreadRuntimeAbsent,true);assert.equal(report.globalWebAssemblyUnchanged,true);clean(report.workerCleanup);
   if(mode==='normal'){
    assert.equal(report.status,'inference-completed',JSON.stringify(report.error));assert.equal(report.initialization.actualBackend,'cpu');
    assert.equal(report.dispose.remainingTensors,0);assert.deepEqual(report.dispose.attempts,[]);assert.deepEqual(report.dispose.violations,[]);assert.equal(report.runs.length,7);
    assert(report.runs.every(r=>r.memory.numTensors===report.initialization.loadedMemory.numTensors&&r.memory.numBytes===report.initialization.loadedMemory.numBytes));
    report.lifecycle=await page.evaluate(async()=>{
     const expectAbort=async p=>{try{await p;throw new Error('Cancellation unexpectedly resolved');}catch(e){if(e.name!=='AbortError')throw e;}};
     const initializing=window.createFaceProbeWorker();const initPending=initializing.pending;
     initializing.receive({generation:initializing.generation-1,jobId:initPending.jobId,type:'ready'});
     initializing.receive({generation:initializing.generation,jobId:initPending.jobId+1,type:'ready'});
     if(initializing.pending!==initPending)throw new Error('Stale init settled a current request');
     initializing.cancel();await expectAbort(initializing.ready);
     const running=window.createFaceProbeWorker();await running.ready;
     const controller=new AbortController();const pending=running.infer({rgb:new Uint8Array(1024*768*3),width:1024,height:768},{signal:controller.signal});
     const aborted=expectAbort(pending);await Promise.resolve();const active=running.pending;
     if(active?.type!=='infer')throw new Error('Inference was not dispatched');
     running.receive({generation:running.generation-1,jobId:active.jobId,type:'result',faces:[]});
     running.receive({generation:running.generation,jobId:active.jobId-1,type:'result',faces:[]});
     if(running.pending!==active)throw new Error('Stale result settled a current request');
     const start=performance.now();controller.abort();await aborted;
     const cancelSettlementMs=performance.now()-start;
     const restart=window.createFaceProbeWorker();await restart.ready;const result=await restart.infer({rgb:new Uint8Array(12).fill(127),width:2,height:2});const disposed=await restart.close();
     return {staleGenerationAndJobIgnored:true,initialization:initializing.diagnostics(),inference:running.diagnostics(),restart:restart.diagnostics(),cancelSettlementMs,
      cancellationMeasurement:'Promise rejection latency after abort and Worker.terminate call; native memory reclamation is not measured.',restartedFaceCount:result.faces.length,remainingTensors:disposed.remainingTensors};
    });
    for(const key of ['initialization','inference','restart'])clean(report.lifecycle[key]);assert.equal(report.lifecycle.remainingTensors,0);
   }else{
    assert.equal(report.status,'model-unavailable');assert(report.workerFailure);assert.deepEqual(report.workerFailure.attempts,[]);assert.deepEqual(report.workerFailure.violations,[]);
    if(mode==='broken'){assert.equal(report.phase,'initializing');assert.equal(report.workerFailure.memoryBeforeTermination.numTensors,0);}
    else{assert.equal(report.phase,'inference');assert.match(report.error.message,/Injected execute failure/);assert.equal(report.workerFailure.memoryBeforeTermination.numTensors,2);}
   }
   assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
   await fs.writeFile(path.join(out,filename),JSON.stringify(report,null,2)+'\n');results.push(report);await context.close();
  }
  await securityControls(browser);
  await fs.writeFile(path.join(out,'probe-browser-results.json'),JSON.stringify({scope:'Synthetic browser technical evidence only',browser:browser.version(),results},null,2)+'\n');
  console.log(JSON.stringify(results.map(r=>({variant:r.variant,modelType:r.modelType,mode:r.mode,status:r.status,runs:r.runs.length,totalMs:r.totalMs})),null,2));
 }finally{await browser.close();}
})().catch(async error=>{console.error(error);await fs.writeFile(path.join(out,'probe-browser-failure-results.json'),JSON.stringify({status:'failed',error:{name:error.name,message:error.message,stack:error.stack}},null,2)+'\n');process.exitCode=1;});

// Deliberately forbidden operations run in a fresh context, never in an inference
// context. Their console/CSP events and attempted URL are a separate artifact.
async function securityControls(browser){
 const context=await browser.newContext(),page=await context.newPage(),requests=[],errors=[],consoleErrors=[];
 const report={scope:'Intentional CSP failures only; excluded from inference no-network evidence',requests,errors,consoleErrors};
 try{
  page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  await context.route(/^https?:/,r=>r.abort());
  await page.goto(pathToFileURL(path.join(out,'security-controls.html')).href);
  assert.equal(await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content'),productCsp());
  report.controls=await page.evaluate(async()=>{
   const source=`self.onmessage=async()=>{const result={violations:[]};self.addEventListener('securitypolicyviolation',e=>result.violations.push(e.effectiveDirective));try{new Function('return 1')();result.evalBlocked=false;}catch(e){result.evalBlocked=true;}try{new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0]));result.wasmBlocked=false;}catch(e){result.wasmBlocked=true;}try{await fetch('https://example.invalid/face-probe-security-negative-control');result.fetchBlocked=false;}catch(e){result.fetchBlocked=true;}setTimeout(()=>postMessage(result),100);};`;
   const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));let worker,timer;
   try{return await new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(new Error('Security control timed out')),5000);worker=new Worker(url);worker.onmessage=e=>resolve(e.data);worker.onerror=e=>reject(new Error(e.message));worker.postMessage({});});}
   finally{clearTimeout(timer);worker?.terminate();URL.revokeObjectURL(url);}
  });
  assert.equal(report.controls.evalBlocked,true);assert.equal(report.controls.wasmBlocked,true);assert.equal(report.controls.fetchBlocked,true);
  assert(report.controls.violations.includes('connect-src'));
  assert(report.controls.violations.some(d=>d.startsWith('script-src')));
  assert(requests.every(url=>url==='https://example.invalid/face-probe-security-negative-control'));
  assert.deepEqual(errors,[]);report.status='passed';
 }catch(error){report.status='failed';report.error=error.message;throw error;}
 finally{await fs.writeFile(path.join(out,'probe-security-results.json'),JSON.stringify(report,null,2)+'\n');await context.close();}
}
