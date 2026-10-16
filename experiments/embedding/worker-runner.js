/* External held-out research only. Never imported by the photo-selection app. */
(async () => {
  'use strict';
  const data = JSON.parse(document.querySelector('#experiment-data').textContent);
  const started = performance.now(), attempts = [], violations = [], longTasks = [];
  const report = {kind:'off-main-thread-burst-holdout', runtime:data.manifest.runtime.version,
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
  let client;const samples=[];
  const heartbeat=[];let lastBeat=performance.now();
  const heartbeatTimer=setInterval(()=>{const now=performance.now();heartbeat.push(Math.max(0,now-lastBeat-16));lastBeat=now;},16);
  report.heartbeatMeasurement='16ms main-thread timer lateness throughout setup and inference; synthetic CI scheduling, not physical-phone responsiveness.';
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
    const runtime=new TextDecoder().decode(await unpack('runtime'));
    const json=JSON.parse(new TextDecoder().decode(await unpack('modelJson')));
    const bytes=location.hash.includes('broken')?new Uint8Array(1):await unpack('weights');
    window.createResearchWorker=()=>new EmbeddingWorkerClient({runtimeSource:runtime,workerSource:data.workerSource,modelJson:json,weightData:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});
    client=window.createResearchWorker();
    report.phase='initializing-model';
    const initialized=await client.ready;
    report.actualBackend=initialized.diagnostics.actualBackend;
    report.initializationMs=initialized.diagnostics.initializationMs;
    report.runtimeAndWorkerSetupMs=performance.now()-loadStart;
    report.phase='embedding';
    const inferenceStart=performance.now();
    for(let i=0;i<samples.length;i++){
      const img=await decode(data.fixtures[i]);
      try{
        const t=performance.now();
        const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
        let rgb;
        try{
          const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
          const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data;rgb=new Uint8Array(canvas.width*canvas.height*3);
          for(let p=0,q=0;p<rgba.length;p+=4){rgb[q++]=rgba[p];rgb[q++]=rgba[p+1];rgb[q++]=rgba[p+2];}
        }finally{canvas.width=canvas.height=0;}
        const result=await client.infer({rgb,width:img.naturalWidth,height:img.naturalHeight});
        samples[i].embedding=Array.from(result.vector);
        (report.workerInferenceMs||=[]).push(result.metrics.inferenceMs);
        report.sampledTensorBytesAfterInferenceMax=Math.max(report.sampledTensorBytesAfterInferenceMax,result.metrics.sampledTensorBytes);
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
    if(client&&!client.diagnostics().closed){
      const disposed=await client.close();report.remainingTensors=disposed.remainingTensors;
      report.workerAttempts=disposed.attempts;report.workerViolations=disposed.violations;
    }else report.remainingTensors=null;
    client?.dispose();report.workerCleanup=client?.diagnostics();
    report.mainThreadRuntimeAbsent=typeof window.tf==='undefined';
    clearInterval(heartbeatTimer);report.heartbeatSamples=heartbeat.length;
    const beats=[...heartbeat].sort((a,b)=>a-b);report.heartbeatLatenessP95Ms=beats[Math.floor((beats.length-1)*.95)]||0;report.heartbeatLatenessMaxMs=Math.max(0,...beats);
    report.globalWebAssemblyUnchanged=window.WebAssembly===nativeWebAssembly;
  }
  report.fallbackGroups=(await BestShotGrouping.groupPhotos(samples)).map(g=>g.ids);
  report.fallbackPreserved=JSON.stringify(report.baselineGroups)===JSON.stringify(report.fallbackGroups);
  await yieldUI();observer?.disconnect();report.totalMs=performance.now()-started;
  report.longTaskTotalMs=longTasks.reduce((s,t)=>s+t.duration,0);
  report.longTaskMaxMs=Math.max(0,...longTasks.map(t=>t.duration));
  document.querySelector('#result').textContent=JSON.stringify(report,null,2);window.burstExperiment.done=true;
})().catch(error=>{window.burstExperiment={done:true,report:{status:'harness-error',error:{name:error.name,message:error.message,stack:error.stack}}};document.querySelector('#result').textContent=error.stack;});
