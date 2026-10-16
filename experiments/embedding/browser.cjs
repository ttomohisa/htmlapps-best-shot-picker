/* Actual inference, isolated from the application. Never uses user photographs. */
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'test-results/embedding');
(async()=>{const browser=await chromium.launch({headless:true});const results=[];try{
 for(const item of [{file:'index.html',mode:'simd'},{file:'index.html',mode:'scalar'},{file:'index.html',mode:'broken'},{file:'index.self-extract.html',mode:'simd'}]){
  const context=await browser.newContext(),page=await context.newPage(),requests=[],errors=[];
  page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
  await context.route(/^https?:/,route=>route.abort());
  await page.goto('file://'+path.join(out,item.file)+'#'+item.mode,{timeout:60000});
  await page.waitForFunction(()=>window.embeddingExperiment?.done,{},{timeout:120000});
  await page.waitForTimeout(150);const report=await page.evaluate(()=>window.embeddingExperiment.report);report.file=item.file;report.mode=item.mode;report.httpRequests=requests;report.pageErrors=errors;await fs.writeFile(path.join(out,item.file+'.'+item.mode+'.json'),JSON.stringify(report,null,2)+'\n');
  assert.notEqual(report.status,'harness-error',JSON.stringify(report));assert.equal(report.fallbackPreserved,true);assert.deepEqual(requests,[]);assert.deepEqual(report.attempts,[]);assert.deepEqual(errors,[]);assert(!report.violations.some(v=>v.directive==='connect-src'||/^https?:/.test(v.blocked)),JSON.stringify(report.violations));
  if(item.file==='index.html'&&item.mode!=='broken'){assert.equal(report.status,'inference-completed',JSON.stringify(report));assert.equal(report.embeddings.length,4);assert.equal(report.pairs.length,6);assert(report.pairs.every(pair=>Number.isFinite(pair.cosine)&&pair.cosine>=-1.00001&&pair.cosine<=1.00001));assert.deepEqual(report.violations,[]);assert.equal(report.backend,item.mode);}
  if(item.mode==='broken'){assert.equal(report.status,'model-unavailable');assert.equal(report.phase,'initializing-model');assert.equal(report.injectedFault,'invalid-model');assert.match(report.error.message,/model|flatbuffer|buffer/i);assert.deepEqual(report.violations,[]);}
  // The canonical wrapper has its own restrictive CSP. A WASM restriction is a
  // recorded adoption blocker, not a claim that wrapped model inference passed.
  if(item.file.endsWith('self-extract.html')&&report.status!=='inference-completed'){assert.equal(report.phase,'initializing-model');assert.match(report.error.message,/WebAssembly|wasm|Content Security Policy/i);assert(report.violations.length>0);assert(report.violations.every(v=>v.directive==='script-src'&&v.blocked==='wasm-eval'),JSON.stringify(report.violations));report.adoptionBlocker='Observed canonical-wrapper CSP WASM compilation restriction';}else if(item.file.endsWith('self-extract.html'))assert.deepEqual(report.violations,[]);
  await fs.writeFile(path.join(out,item.file+'.'+item.mode+'.json'),JSON.stringify(report,null,2)+'\n');
  await page.screenshot({path:path.join(out,item.file+'.'+item.mode+'.png'),fullPage:true});results.push(report);await context.close();
 }
 const simd=results.find(r=>r.file==='index.html'&&r.mode==='simd'),scalar=results.find(r=>r.file==='index.html'&&r.mode==='scalar');
 const backendMaxCosineDifference=Math.max(...simd.pairs.map((pair,index)=>{assert.equal(pair.a,scalar.pairs[index].a);assert.equal(pair.b,scalar.pairs[index].b);return Math.abs(pair.cosine-scalar.pairs[index].cosine);}));assert(backendMaxCosineDifference<0.0001);
 for(const report of results){assert(Number.isFinite(report.baselinePreparationMs)&&report.baselinePreparationMs>=0);assert(Number.isFinite(report.baselineGroupingMs)&&report.baselineGroupingMs>=0);}
 const summary={backendMaxCosineDifference,kind:'development-only-embedding-feasibility',browser:browser.version(),platform:process.platform,architecture:process.arch,realPhotoAccuracy:'NOT MEASURED',realDevicePerformance:'NOT MEASURED',adoption:'NOT APPROVED',productionModelIncluded:false,results};
 await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));console.log('PASS isolated embedding feasibility checks; photographic and real-device adoption gates remain unmet');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
