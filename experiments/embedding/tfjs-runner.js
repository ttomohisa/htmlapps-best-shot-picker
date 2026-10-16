/* Isolated runtime adapter: all inputs are embedded and no app state is touched. */
(async () => {
  'use strict';
  const data = JSON.parse(document.querySelector('#experiment-data').textContent);
  const violations = [], attempts = [], started = performance.now();
  const hash = location.hash;
  const report = {kind:data.kind, runtime:data.manifest.runtime.version, model:data.manifest.model.name,
    productionModelIncluded:false, adoption:'NOT APPROVED', consumerBurstAccuracy:'NOT MEASURED',
    realDevicePerformance:'NOT MEASURED', attempts, violations};
  window.tfjsExperiment = {done:false,report};
  const finish = () => { window.tfjsExperiment.done=true; document.querySelector('#result').textContent=JSON.stringify(report,null,2); };
  document.addEventListener('securitypolicyviolation',event=>violations.push({directive:event.effectiveDirective,blocked:event.blockedURI}));
  if (hash.includes('security')) {
    report.kind='negative-CSP-controls';report.controls={};
    for (const [name,probe] of [
      ['eval',()=>eval('2 + 2')],
      ['Function',()=>new Function('return 4')()],
      ['WASM',()=>new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0]))]
    ]) {try {probe();report.controls[name]='ALLOWED';} catch(error) {report.controls[name]={blocked:true,name:error.name};}}
    try {await fetch('https://r1421645194-pr-4-bk-previews.ttomohisa.workers.dev/__csp_probe__');report.controls.network='ALLOWED';}
    catch(error) {report.controls.network={blocked:true,name:error.name};}
    await new Promise(resolve=>setTimeout(resolve,100));report.status='security-controls-completed';finish();return;
  }
  const deny = (kind,url) => {attempts.push({kind,url:String(url)});throw new Error('Network disabled by isolated experiment');};
  window.fetch=url=>Promise.reject((()=>{try {deny('fetch',url);}catch(error){return error;}})());
  XMLHttpRequest.prototype.open=function(method,url){deny('XHR',url);};
  navigator.sendBeacon=url=>deny('beacon',url);
  window.WebSocket=function(url){deny('WebSocket',url);};
  async function unpack(key) {
    const compressed=Uint8Array.from(atob(data.assets[key]),character=>character.charCodeAt(0));
    return new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  }
  const samples=[],baselineStart=performance.now();
  for (const fixture of data.fixtures) {
    const img=new Image();img.src=`data:${fixture.mime};base64,${fixture.base64}`;await img.decode();
    const canvas=document.createElement('canvas');canvas.width=9;canvas.height=8;
    const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,9,8);
    const features=BestShotGrouping.features(ctx.getImageData(0,0,9,8).data,9,8,img.naturalWidth/img.naturalHeight);
    canvas.width=canvas.height=0;
    // Public photos have no trusted capture-time labels. Never invent burst timing.
    samples.push({id:fixture.id,scene:fixture.scene,split:fixture.split,img,features,captureTime:null});
  }
  report.baselinePreparationMs=performance.now()-baselineStart;
  const groupStart=performance.now();report.baselineGroups=(await BestShotGrouping.groupPhotos(samples)).map(group=>group.ids);
  report.baselineGroupingMs=performance.now()-groupStart;
  let model;
  const nativeWebAssembly=window.WebAssembly;
  try {
    report.phase='loading-runtime';
    const runtime=new TextDecoder().decode(await unpack('runtime'));
    const script=document.createElement('script');
    // long.js's optional tiny WASM arithmetic accelerator has an equivalent JS path.
    // Shadow only this UMD invocation, leaving global WebAssembly and CSP untouched.
    script.textContent='(function(WebAssembly){\n'+runtime+'\n}).call(window, undefined);';
    document.head.append(script);script.remove();
    report.globalWebAssemblyUnchanged=window.WebAssembly===nativeWebAssembly;
    report.backend=hash.includes('webgl')?'webgl':'cpu';
    if (!await tf.setBackend(report.backend)) throw new Error('Requested backend unavailable: '+report.backend);
    await tf.ready();report.actualBackend=tf.getBackend();report.phase='initializing-model';
    const json=JSON.parse(new TextDecoder().decode(await unpack('modelJson')));
    const bytes=hash.includes('broken')?new Uint8Array(1):await unpack('weights');
    const weightData=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
    const init=performance.now();
    model=await tf.loadGraphModel(tf.io.fromMemory({modelTopology:json.modelTopology,
      weightSpecs:json.weightsManifest.flatMap(group=>group.weights),weightData}));
    report.initializationMs=performance.now()-init;report.phase='embedding';report.embeddings=[];
    const infer = img => tf.tidy(() => {
      const input=tf.image.resizeBilinear(tf.browser.fromPixels(img).toFloat(),[224,224],false).div(255).expandDims(0);
      const output=model.execute(input,data.manifest.model.output.name);
      const vector=Array.from(output.dataSync());
      if(vector.length!==256||!vector.every(Number.isFinite))throw new Error('Invalid feature vector');
      const norm=Math.sqrt(vector.reduce((sum,value)=>sum+value*value,0));
      if(!Number.isFinite(norm)||norm<=0)throw new Error('Empty feature vector');
      return vector.map(value=>value/norm);
    });
    const timings=[];
    for(const sample of samples){const t=performance.now();sample.embedding=infer(sample.img);timings.push(performance.now()-t);
      report.embeddings.push({id:sample.id,dimensions:sample.embedding.length});await new Promise(resolve=>setTimeout(resolve,0));}
    report.inferenceMs=timings;report.pairs=[];
    for(let a=0;a<samples.length;a++)for(let b=a+1;b<samples.length;b++){
      const x=samples[a],y=samples[b],fa=x.features,fb=y.features;
      const cosine=x.embedding.reduce((sum,value,index)=>sum+value*y.embedding[index],0);
      const hashDistance=BestShotGrouping.hamming(fa.hash,fb.hash);
      const rgbDistance=fa.rgb.reduce((sum,value,index)=>sum+Math.abs(value-fb.rgb[index]),0)/fa.rgb.length;
      const aspectDelta=Math.max(fa.aspect,fb.aspect)/Math.min(fa.aspect,fb.aspect)-1;
      const visualGuard=hashDistance<=12&&rgbDistance<=48&&aspectDelta<=0.025&&Math.min(fa.deviation,fb.deviation)>=12;
      report.pairs.push({a:x.id,b:y.id,baseline:BestShotGrouping.pairDecision(x,y),cosine,hashDistance,rgbDistance,visualGuard});
    }
    if(data.kind==='photo-pilot')report.evaluation=EmbeddingPilotEvaluation.evaluate(samples,report.pairs);
    const warm=[];for(let i=0;i<10;i++){const t=performance.now();infer(samples[i%samples.length].img);warm.push(performance.now()-t);}
    warm.sort((a,b)=>a-b);report.warmP50Ms=warm[4];report.warmP95Ms=warm[9];report.status='inference-completed';report.phase='complete';
  }catch(error){report.status='model-unavailable';report.error={name:error.name,message:error.message};}
  finally{model?.dispose();report.globalWebAssemblyUnchanged=window.WebAssembly===nativeWebAssembly;
    if(window.tf)report.remainingTensors=tf.memory().numTensors;}
  report.fallbackGroups=(await BestShotGrouping.groupPhotos(samples)).map(group=>group.ids);
  report.fallbackPreserved=JSON.stringify(report.fallbackGroups)===JSON.stringify(report.baselineGroups);
  for(const sample of samples)sample.img.removeAttribute('src');
  report.totalMs=performance.now()-started;finish();
})().catch(error=>{window.tfjsExperiment={done:true,report:{status:'harness-error',error:{name:error.name,message:error.message}}};document.querySelector('#result').textContent=error.stack;});
