const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {chromium} = require('playwright');
const out = path.resolve(__dirname,'../../test-results/embedding-tfjs');
(async()=>{
  const browser=await chromium.launch({headless:true});const results=[];
  try {
    const cases=[
      ['index.html','cpu'],['index.html','webgl'],['index.html','webgl-software'],['index.html','broken'],
      ['index.self-extract.html','cpu'],['index.self-extract.html','webgl'],['index.self-extract.html','webgl-software'],
      ['index.html','security'],['index.self-extract.html','security'],
      ['photo-pilot.html','cpu'],['photo-pilot.self-extract.html','cpu']
    ];
    for(const [file,mode] of cases){
      const context=await browser.newContext(),page=await context.newPage(),requests=[],routed=[],errors=[],consoleDiagnostics=[];
      page.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url());});
      page.on('pageerror',error=>errors.push(error.message));
      page.on('console',message=>{consoleDiagnostics.push({type:message.type(),text:message.text()});});
      await context.route(/^https?:/,route=>{routed.push(route.request().url());return route.abort();});
      await page.goto('file://'+path.join(out,file)+'#'+mode,{timeout:60000});
      await page.waitForFunction(()=>window.tfjsExperiment?.done,{},{timeout:180000});
      await page.waitForTimeout(150);
      const report=await page.evaluate(()=>window.tfjsExperiment.report);
      Object.assign(report,{file,mode,httpRequests:requests,routedRequests:routed,pageErrors:errors,consoleDiagnostics});
      await fs.writeFile(path.join(out,file+'.'+mode+'.json'),JSON.stringify(report,null,2)+'\n');
      assert.notEqual(report.status,'harness-error',JSON.stringify(report));assert.deepEqual(errors,[]);assert.deepEqual(routed,[]);
      if(mode==='security'){
        assert.equal(report.status,'security-controls-completed');
        for(const key of ['eval','Function','WASM','network'])assert.equal(report.controls[key].blocked,true,key);
        assert(report.violations.some(v=>v.directive==='script-src'&&v.blocked==='eval'));
        assert(report.violations.some(v=>v.directive==='script-src'&&v.blocked==='wasm-eval'));
        assert(report.violations.some(v=>v.directive==='connect-src'));
      }else{
        assert.deepEqual(requests,[]);assert.deepEqual(report.attempts,[]);assert.deepEqual(report.violations,[]);
        assert.equal(report.globalWebAssemblyUnchanged,true);assert.equal(report.fallbackPreserved,true);
        assert.equal(report.remainingTensors,0);
        if(mode==='broken'){
          assert.equal(report.status,'model-unavailable');assert.equal(report.phase,'initializing-model');
          assert.match(report.error.message,/weight|buffer|byte|length|size|array/i);
        }else if(mode.startsWith('webgl')&&report.backendUnavailable===true){
          assert.equal(report.status,'model-unavailable');assert.equal(report.phase,'selecting-backend');
          assert.equal(report.error.message,'Requested backend unavailable: webgl');
          assert.equal(report.embeddings,undefined);report.backendCoverage='UNAVAILABLE; no WebGL inference claim';
        }else{
          assert.equal(report.status,'inference-completed',JSON.stringify(report));assert.equal(report.actualBackend,mode.startsWith('webgl')?'webgl':mode);
          assert.equal(report.embeddings.length,file.startsWith('photo-pilot')?51:4);
          assert(report.embeddings.every(item=>item.dimensions===256));
          assert(report.pairs.every(pair=>Number.isFinite(pair.cosine)&&pair.cosine>=-1.00001&&pair.cosine<=1.00001));
          if(file.startsWith('photo-pilot')){
            assert.equal(report.evaluation.baseline.development.expectedScenes,8);
            assert.equal(report.evaluation.baseline.holdout.expectedScenes,9);
            assert.equal(report.evaluation.baseline.holdout.positivePairs,27);
          }
        }
      }
      await fs.writeFile(path.join(out,file+'.'+mode+'.json'),JSON.stringify(report,null,2)+'\n');
      // Compact screenshots keep CI artifacts small; complete evidence is in JSON.
      await page.screenshot({path:path.join(out,file+'.'+mode+'.png'),fullPage:false});
      results.push(report);await context.close();
    }
    const readable=results.find(r=>r.file==='index.html'&&r.mode==='cpu');
    const wrapped=results.find(r=>r.file==='index.self-extract.html'&&r.mode==='cpu');
    const webgl=results.find(r=>r.file==='index.html'&&r.mode==='webgl');
    const compare=(a,b)=>Math.max(...a.pairs.map((pair,index)=>{assert.equal(pair.a,b.pairs[index].a);assert.equal(pair.b,b.pairs[index].b);return Math.abs(pair.cosine-b.pairs[index].cosine);}));
    const wrapperMaxCosineDifference=compare(readable,wrapped);
    const backendMaxCosineDifference=webgl.status==='inference-completed'?compare(readable,webgl):null;
    const availableWebglComparisons=results.filter(r=>r.backend==='webgl'&&r.status==='inference-completed').map(r=>({file:r.file,mode:r.mode,maxCosineDifference:compare(readable,r)}));
    for(const comparison of availableWebglComparisons)assert(comparison.maxCosineDifference<0.01);
    assert(wrapperMaxCosineDifference<0.00001);if(backendMaxCosineDifference!==null)assert(backendMaxCosineDifference<0.01);
    const pilot=results.find(r=>r.file==='photo-pilot.html'),pilotWrapped=results.find(r=>r.file==='photo-pilot.self-extract.html');
    assert(compare(pilot,pilotWrapped)<0.00001);assert.deepEqual(pilot.evaluation,pilotWrapped.evaluation);
    const summary={kind:'isolated-TFJS-alternative',browser:browser.version(),platform:process.platform,
      architecture:process.arch,productionModelIncluded:false,adoption:'NOT APPROVED',consumerBurstAccuracy:'NOT MEASURED',
      wrapperMaxCosineDifference,backendMaxCosineDifference,availableWebglComparisons,
      unavailableBackends:results.filter(r=>r.backendUnavailable).map(r=>({file:r.file,mode:r.mode,backend:r.backend,reason:r.error.message,diagnostics:r.webglDiagnostics})),results};
    await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify(summary,null,2)+'\n');
    console.log(JSON.stringify({browser:summary.browser,wrapperMaxCosineDifference,backendMaxCosineDifference,pilot:pilot.evaluation},null,2));
    console.log('PASS isolated TFJS assertions; unavailable backend modes: '+summary.unavailableBackends.length+'; consumer-photo and device adoption gates remain open');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
