const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {createHash}=require('node:crypto'),{chromium}=require('playwright');
const {FROZEN_PROTOCOL,evaluateFrozen}=require('./evaluate.js');
const photos=require('./burst-holdout.json');
const out=path.resolve(__dirname,'../../test-results/embedding-burst');
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
    environment:'Headless Linux Chromium; 390x844 CSS viewport. CPU throttling is a synthetic stress condition, not phone emulation or a phone-speed estimate.'});
   await fs.writeFile(path.join(out,`${file}.${rate}x.${mode}.json`),JSON.stringify(report,null,2)+'\n');
   assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);assert.deepEqual(report.attempts,[]);assert.deepEqual(report.violations,[]);
   assert.equal(report.globalWebAssemblyUnchanged,true);assert.equal(report.fallbackPreserved,true);assert.equal(report.remainingTensors,0);
   assert.equal(report.maxDecodedImages,1);assert.equal(report.realDevicePerformance,'NOT MEASURED');
   if(mode==='broken'){assert.equal(report.status,'model-unavailable');assert.equal(report.phase,'initializing-model');}
   else{
    assert.equal(report.status,'inference-completed',JSON.stringify(report.error));assert.equal(report.actualBackend,'cpu');
    assert.equal(report.inferenceMs.length,photos.images.length);assert.equal(report.pairs.length,photos.images.length*(photos.images.length-1)/2);
    assert.deepEqual(report.protocol,FROZEN_PROTOCOL);assert.deepEqual(report.evaluation,evaluateFrozen(photos.images,report.pairs,FROZEN_PROTOCOL));
    assert(report.inferenceMs.every(n=>Number.isFinite(n)&&n>=0));assert(report.sampledTensorBytesAfterInferenceMax>0);
   }
   // Text evidence only. Do not publish corpus pixels as CI screenshots.
   results.push(report);await context.close();
  }
  const normal=results[0],wrapped=results[1],stress=results[2];
  for(const other of [wrapped,stress]){
   assert.deepEqual(normal.evaluation,other.evaluation);
   assert(normal.pairs.every((p,i)=>p.a===other.pairs[i].a&&p.b===other.pairs[i].b&&Math.abs(p.cosine-other.pairs[i].cosine)<1e-5));
  }
  const files=await Promise.all(['index.html','index.self-extract.html'].map(async file=>{const bytes=await fs.readFile(path.join(out,file));return{file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}));
  const report={browser:browser.version(),platform:process.platform,architecture:process.arch,files,protocol:FROZEN_PROTOCOL,
   productionModelIncluded:false,adoption:'NOT APPROVED',realDevicePerformance:'NOT MEASURED',results};
  await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({evaluation:normal.evaluation,costs:results.map(r=>({file:r.file,rate:r.cpuThrottleRate,status:r.status,totalMs:r.totalMs,p50:r.inferenceP50Ms,p95:r.inferenceP95Ms,longTaskMaxMs:r.longTaskMaxMs,sampledTensorBytes:r.sampledTensorBytesAfterInferenceMax}))},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
