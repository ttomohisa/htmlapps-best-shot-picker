/* External held-out research only. Never imported by the photo-selection app. */
(async () => {
  'use strict';
  const data = JSON.parse(document.querySelector('#experiment-data').textContent);
  const started = performance.now(), attempts = [], violations = [], longTasks = [];
  const report = {kind:'external-burst-holdout', runtime:data.manifest.runtime.version,
    model:data.manifest.model.name, protocol:data.protocol, productionModelIncluded:false,
    adoption:'NOT APPROVED', realDevicePerformance:'NOT MEASURED', attempts, violations,
    fallbackOrdering:'Fixture order used by groupPhotos; separate from ID-sorted predicate evaluation.',
    resourceMeasurement:'Logical decoded-image accounting and live tensors sampled after execute/dataSync but before outer tf.tidy cleanup (including preprocessing/output tensors), not peak or total process memory. Embedded fixture bytes, transient model activations, browser decode caches, and native allocations are excluded.',
    fixtureBytes:data.fixtures.reduce((sum, f)=>sum+f.bytes,0), maxDecodedImages:0,
    maxDecodedPixels:0, sampledTensorBytesAfterInferenceMax:0, longTasks, decodeMs:[], featureMs:[], inferenceMs:[]};
  window.burstExperiment={done:false,report};
  document.addEventListener('securitypolicyviolation',e=>violations.push({directive:e.effectiveDirective,blocked:e.blockedURI}));
  const deny=(kind,url)=>{attempts.push({kind,url:String(url)});throw new Error('Network disabled by experiment');};
  window.fetch=url=>Promise.reject((()=>{try{deny('fetch',url);}catch(e){return e;}})());
  XMLHttpRequest.prototype.open=function(method,url){deny('XHR',url);};
  navigator.sendBeacon=url=>deny('beacon',url);
  window.WebSocket=function(url){deny('WebSocket',url);};
  let observer;
  if(PerformanceObserver.supportedEntryTypes.includes('longtask')){
    observer=new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>({startTime:e.startTime,duration:e.duration}))));
    observer.observe({type:'longtask',buffered:false});
  }
  const yieldUI=()=>new Promise(resolve=>setTimeout(resolve,0));
  async function unpack(key){
    const compressed=Uint8Array.from(atob(data.assets[key]),c=>c.charCodeAt(0));
    return new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  }
  async function decode(fixture){
    const t=performance.now(),img=new Image();
    img.src=`data:${fixture.mime};base64,${fixture.base64}`;
    try{await img.decode();}catch(error){img.removeAttribute('src');throw error;}
    report.decodeMs.push(performance.now()-t);
    report.maxDecodedImages=Math.max(report.maxDecodedImages,1);
    report.maxDecodedPixels=Math.max(report.maxDecodedPixels,img.naturalWidth*img.naturalHeight);
    return img;
  }
  const nativeWebAssembly=window.WebAssembly;
  let model;const samples=[];
  try{
    // Decode one photograph at a time; release before the next decode. No fabricated EXIF.
    const baselineStart=performance.now();
    for(const fixture of data.fixtures){
      const img=await decode(fixture),canvas=document.createElement('canvas');
      try{
        const t=performance.now();canvas.width=9;canvas.height=8;
        const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,9,8);
        const features=BestShotGrouping.features(ctx.getImageData(0,0,9,8).data,9,8,img.naturalWidth/img.naturalHeight);
        report.featureMs.push(performance.now()-t);
        samples.push({id:fixture.id,scene:fixture.scene,split:fixture.split,features,captureTime:null});
      }finally{canvas.width=canvas.height=0;img.removeAttribute('src');}
      await yieldUI();
    }
    report.baselinePreparationMs=performance.now()-baselineStart;
    const groupStart=performance.now();report.baselineGroups=(await BestShotGrouping.groupPhotos(samples)).map(g=>g.ids);
    report.baselineGroupingMs=performance.now()-groupStart;
    report.phase='loading-runtime';const loadStart=performance.now();
    const runtime=new TextDecoder().decode(await unpack('runtime')),script=document.createElement('script');
    script.textContent='(function(WebAssembly){\n'+runtime+'\n}).call(window, undefined);';document.head.append(script);script.remove();
    if(!await tf.setBackend('cpu'))throw new Error('CPU backend unavailable');await tf.ready();
    report.runtimeLoadMs=performance.now()-loadStart;report.actualBackend=tf.getBackend();
    report.phase='initializing-model';const init=performance.now();
    const json=JSON.parse(new TextDecoder().decode(await unpack('modelJson')));
    const bytes=location.hash.includes('broken')?new Uint8Array(1):await unpack('weights');
    model=await tf.loadGraphModel(tf.io.fromMemory({modelTopology:json.modelTopology,
      weightSpecs:json.weightsManifest.flatMap(g=>g.weights),weightData:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}));
    report.initializationMs=performance.now()-init;report.phase='embedding';
    const inferenceStart=performance.now();
    for(let i=0;i<samples.length;i++){
      const img=await decode(data.fixtures[i]);
      try{
        const t=performance.now();
        samples[i].embedding=tf.tidy(()=>{
          const input=tf.image.resizeBilinear(tf.browser.fromPixels(img).toFloat(),[224,224],false).div(255).expandDims(0);
          const output=model.execute(input,data.manifest.model.output.name),vector=Array.from(output.dataSync());
          report.sampledTensorBytesAfterInferenceMax=Math.max(report.sampledTensorBytesAfterInferenceMax,tf.memory().numBytes);
          if(vector.length!==256||!vector.every(Number.isFinite))throw new Error('Invalid embedding');
          const norm=Math.sqrt(vector.reduce((s,v)=>s+v*v,0));if(!Number.isFinite(norm)||norm<=0)throw new Error('Empty embedding');
          return vector.map(v=>v/norm);
        });
        report.inferenceMs.push(performance.now()-t);
      }finally{img.removeAttribute('src');}
      document.querySelector('#progress').textContent=`${i+1} / ${samples.length}`;await yieldUI();
    }
    report.embeddingPassIncludingDecodeAndYieldMs=performance.now()-inferenceStart;
    const pairStart=performance.now();report.pairs=[];
    for(let a=0;a<samples.length;a++)for(let b=a+1;b<samples.length;b++){
      const x=samples[a],y=samples[b],fa=x.features,fb=y.features;
      const cosine=x.embedding.reduce((s,v,i)=>s+v*y.embedding[i],0);
      const hashDistance=BestShotGrouping.hamming(fa.hash,fb.hash);
      const rgbDistance=fa.rgb.reduce((s,v,i)=>s+Math.abs(v-fb.rgb[i]),0)/fa.rgb.length;
      const aspectDelta=Math.max(fa.aspect,fb.aspect)/Math.min(fa.aspect,fb.aspect)-1;
      report.pairs.push({a:x.id,b:y.id,baseline:BestShotGrouping.pairDecision(x,y),cosine,hashDistance,rgbDistance,
        visualGuard:hashDistance<=12&&rgbDistance<=48&&aspectDelta<=0.025&&Math.min(fa.deviation,fb.deviation)>=12});
    }
    report.evaluation=EmbeddingPilotEvaluation.evaluateFrozen(samples,report.pairs,data.protocol);
    report.pairEvaluationMs=performance.now()-pairStart;
    const sorted=[...report.inferenceMs].sort((a,b)=>a-b);
    report.inferenceP50Ms=sorted[Math.floor((sorted.length-1)*.5)];report.inferenceP95Ms=sorted[Math.floor((sorted.length-1)*.95)];
    report.status='inference-completed';report.phase='complete';
  }catch(error){report.status='model-unavailable';report.error={name:error.name,message:error.message};}
  finally{
    model?.dispose();report.remainingTensors=window.tf?tf.memory().numTensors:null;
    report.globalWebAssemblyUnchanged=window.WebAssembly===nativeWebAssembly;
  }
  report.fallbackGroups=(await BestShotGrouping.groupPhotos(samples)).map(g=>g.ids);
  report.fallbackPreserved=JSON.stringify(report.baselineGroups)===JSON.stringify(report.fallbackGroups);
  await yieldUI();observer?.disconnect();report.totalMs=performance.now()-started;
  report.longTaskTotalMs=longTasks.reduce((s,t)=>s+t.duration,0);
  report.longTaskMaxMs=Math.max(0,...longTasks.map(t=>t.duration));
  document.querySelector('#result').textContent=JSON.stringify(report,null,2);window.burstExperiment.done=true;
})().catch(error=>{window.burstExperiment={done:true,report:{status:'harness-error',error:{name:error.name,message:error.message}}};document.querySelector('#result').textContent=error.stack;});
