const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {createHash}=require('node:crypto'),{chromium}=require('playwright');
const {FROZEN_PROTOCOL,evaluateFrozen}=require('./evaluate.js');
const photos=require('./burst-holdout.json');
const out=path.resolve(__dirname,'../../test-results/embedding-worker');
(async()=>{
 const browser=await chromium.launch({headless:true}),results=[];
 try{
  for(const [file,rate,mode] of [['index.html',1,'cpu'],['index.self-extract.html',1,'cpu'],['index.html',4,'cpu'],['index.self-extract.html',1,'broken']]){
   const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),requests=[],errors=[],consoleDiagnostics=[];
   page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
   page.on('console',m=>{if(m.type()==='error')consoleDiagnostics.push(m.text());});
   await context.route(/^https?:/,r=>r.abort());
   const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate});
   await page.goto('file://'+path.join(out,file)+'#'+mode,{timeout:60000});
   await page.waitForFunction(()=>window.burstExperiment?.done,{},{timeout:240000});
   const report=await page.evaluate(()=>window.burstExperiment.report);
   Object.assign(report,{file,cpuThrottleRate:rate,mode,httpRequests:requests,pageErrors:errors,consoleErrors:consoleDiagnostics,
    environment:'Headless Linux Chromium; 390x844 CSS viewport. CPU throttling is a synthetic stress condition, not phone emulation or a phone-speed estimate.',
    throttleScope:'CDP Emulation.setCPUThrottlingRate requested on the page; effective throttling of the separate worker thread is not independently calibrated.'});
   await fs.writeFile(path.join(out,`${file}.${rate}x.${mode}.json`),JSON.stringify(report,null,2)+'\n');
   assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);assert.deepEqual(report.attempts,[]);assert.deepEqual(report.violations,[]);
   assert.equal(report.globalWebAssemblyUnchanged,true);assert.equal(report.fallbackPreserved,true);assert.equal(report.mainThreadRuntimeAbsent,true);
   assert.equal(report.workerCleanup.createdWorkers,report.workerCleanup.terminatedWorkers);
   assert.equal(report.workerCleanup.createdURLs,report.workerCleanup.revokedURLs);
   assert.equal(report.workerCleanup.pendingRequests,0);
   assert.equal(report.maxDecodedImages,1);assert.equal(report.realDevicePerformance,'NOT MEASURED');
   if(mode==='broken'){assert.equal(report.status,'model-unavailable');assert.equal(report.phase,'initializing-model');}
   else{
    assert.equal(report.status,'inference-completed',JSON.stringify(report.error));assert.equal(report.actualBackend,'cpu');assert.equal(report.remainingTensors,0);assert.deepEqual(report.workerAttempts,[]);assert.deepEqual(report.workerViolations,[]);
    const reference=require('./burst-results-2026-10-16.json');
    assert.deepEqual(report.evaluation,reference.evaluation);
    assert(report.pairs.every((p,i)=>p.a===reference.photoPairs[i].a&&p.b===reference.photoPairs[i].b&&Math.abs(p.cosine-reference.photoPairs[i].cosine)<1e-5),'Worker preprocessing must match frozen main-thread CPU evidence');
    assert.equal(report.inferenceMs.length,photos.images.length);assert.equal(report.pairs.length,photos.images.length*(photos.images.length-1)/2);
    assert.deepEqual(report.protocol,FROZEN_PROTOCOL);assert.deepEqual(report.evaluation,evaluateFrozen(photos.images,report.pairs,FROZEN_PROTOCOL));
    assert(report.inferenceMs.every(n=>Number.isFinite(n)&&n>=0));assert(report.sampledTensorBytesAfterInferenceMax>0);
   }
   // Text evidence only. Do not publish corpus pixels as CI screenshots.
   if(mode==='cpu'&&rate===1){
    report.lifecycle=await page.evaluate(async()=>{
     const expectAbort=async p=>{try{await p;throw new Error('Cancellation unexpectedly resolved');}catch(e){if(e.name!=='AbortError')throw e;}};
     const init=window.createResearchWorker();init.cancel();await expectAbort(init.ready);
     const inference=window.createResearchWorker();await inference.ready;
     const abort=new AbortController();const pending=inference.infer({rgb:new Uint8Array(512*512*3),width:512,height:512},{signal:abort.signal});
     await new Promise(r=>setTimeout(r,10));const before=performance.now();abort.abort();await expectAbort(pending);const cancelSettlementMs=performance.now()-before;
     const restart=window.createResearchWorker();await restart.ready;const result=await restart.infer({rgb:new Uint8Array(12).fill(127),width:2,height:2});const disposed=await restart.close();
     return {initialization:init.diagnostics(),inference:inference.diagnostics(),restart:restart.diagnostics(),cancelSettlementMs,restartedVectorLength:result.vector.length,remainingTensors:disposed.remainingTensors};
    });
    report.workerSecurityControls=await page.evaluate(async()=>{
     const source=`self.onmessage=async()=>{const result={violations:[]};self.addEventListener('securitypolicyviolation',e=>result.violations.push(e.effectiveDirective));try{new Function('return 1')();result.evalBlocked=false;}catch(e){result.evalBlocked=true;}try{new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0]));result.wasmBlocked=false;}catch(e){result.wasmBlocked=true;}try{await fetch('https://example.com/embedding-worker-csp-negative-control');result.fetchBlocked=false;}catch(e){result.fetchBlocked=true;}setTimeout(()=>postMessage(result),30);};`;
     const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));let worker,timer;
     try{return await new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(new Error('Worker security probe timed out')),5000);worker=new Worker(url);worker.onmessage=e=>resolve(e.data);worker.onerror=e=>reject(new Error(e.message));worker.postMessage({});});}
     finally{clearTimeout(timer);worker?.terminate();URL.revokeObjectURL(url);}
    });
    assert.equal(report.workerSecurityControls.evalBlocked,true);assert.equal(report.workerSecurityControls.wasmBlocked,true);assert.equal(report.workerSecurityControls.fetchBlocked,true);assert.deepEqual(requests,[]);
    for(const key of ['initialization','inference','restart']){const d=report.lifecycle[key];assert.equal(d.createdWorkers,d.terminatedWorkers);assert.equal(d.createdURLs,d.revokedURLs);assert.equal(d.pendingRequests,0);}
    assert.equal(report.lifecycle.restartedVectorLength,256);assert.equal(report.lifecycle.remainingTensors,0);
   }
   results.push(report);await context.close();
  }
  const normal=results[0],wrapped=results[1],stress=results[2];
  for(const other of [wrapped,stress]){
   assert.deepEqual(normal.evaluation,other.evaluation);
   assert(normal.pairs.every((p,i)=>p.a===other.pairs[i].a&&p.b===other.pairs[i].b&&Math.abs(p.cosine-other.pairs[i].cosine)<1e-5));
  }
  const files=await Promise.all(['index.html','index.self-extract.html'].map(async file=>{const bytes=await fs.readFile(path.join(out,file));return{file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}));
  const mainThread=JSON.parse(await fs.readFile(path.resolve(out,'../embedding-burst/browser-report.json'),'utf8'));
  const responsivenessComparison=results.filter(r=>r.mode==='cpu').map(r=>{
   const baseline=mainThread.results.find(b=>b.file===r.file&&b.cpuThrottleRate===r.cpuThrottleRate&&b.mode==='cpu');
   assert.deepEqual(r.evaluation,baseline.evaluation);
   return {file:r.file,rate:r.cpuThrottleRate,mainThread:{heartbeatP95Ms:baseline.heartbeatLatenessP95Ms,heartbeatMaxMs:baseline.heartbeatLatenessMaxMs,passMs:baseline.embeddingPassIncludingDecodeAndYieldMs},worker:{heartbeatP95Ms:r.heartbeatLatenessP95Ms,heartbeatMaxMs:r.heartbeatLatenessMaxMs,passMs:r.embeddingPassIncludingDecodeAndYieldMs},caution:'Sequential synthetic runs; not a phone or controlled benchmark. Worker throughput and main-thread responsiveness are separate quantities.'};
  });
  const report={responsivenessComparison,browser:browser.version(),platform:process.platform,architecture:process.arch,files,protocol:FROZEN_PROTOCOL,
   productionModelIncluded:false,adoption:'NOT APPROVED',realDevicePerformance:'NOT MEASURED',results};
  await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({evaluation:normal.evaluation,costs:results.map(r=>({file:r.file,rate:r.cpuThrottleRate,status:r.status,totalMs:r.totalMs,p50:r.inferenceP50Ms,p95:r.inferenceP95Ms,longTaskMaxMs:r.longTaskMaxMs,sampledTensorBytes:r.sampledTensorBytesAfterInferenceMax}))},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
