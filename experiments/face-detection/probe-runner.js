/* Research only: synthetic pixels, no accuracy claim. */
(async()=>{
 'use strict';
 const data=JSON.parse(document.querySelector('#experiment-data').textContent),attempts=[],violations=[];
 const mode=location.hash.slice(1)||'normal';
 const report={scope:'Isolated synthetic technical worker probe. No photo accuracy or physical-device performance claim.',modelType:data.modelType,mode,
  adoption:'TECHNICAL GATE ONLY; PRODUCT INTEGRATION NOT PERFORMED',productionModelIncluded:false,realDevicePerformance:'NOT MEASURED',attempts,violations,runs:[],
  memoryMeasurement:'TFJS logical live tensor accounting after each estimateFaces and caller input disposal, not peak or total memory.'};
 window.faceProbe={done:false,report};
 document.addEventListener('securitypolicyviolation',e=>violations.push({directive:e.effectiveDirective,blocked:e.blockedURI}));
 const deny=(kind,url)=>{attempts.push({kind,url:String(url)});throw new Error('Network disabled by face probe');};
 window.fetch=url=>Promise.reject((()=>{try{deny('fetch',url);}catch(e){return e;}})());
 XMLHttpRequest.prototype.open=function(method,url){deny('XHR',url);};
 navigator.sendBeacon=url=>deny('beacon',url);window.WebSocket=function(url){deny('WebSocket',url);};
 async function unpack(key){const compressed=Uint8Array.from(atob(data.assets[key]),c=>c.charCodeAt(0));return new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());}
 const wasm=window.WebAssembly,start=performance.now();let client;
 const beats=[];let last=performance.now();const timer=setInterval(()=>{const now=performance.now();beats.push(Math.max(0,now-last-16));last=now;},16);
 try{
  const runtime=new TextDecoder().decode(await unpack('runtime'))+'\n'+new TextDecoder().decode(await unpack('detector'));
  const json=JSON.parse(new TextDecoder().decode(await unpack('modelJson'))),weights=await unpack('weights');
  window.createFaceProbeWorker=(options={})=>new FaceProbeClient({runtimeSource:runtime,workerSource:data.workerSource,modelType:data.modelType,modelJson:json,
   weightData:options.broken?new Uint8Array(1).buffer:weights.buffer.slice(weights.byteOffset,weights.byteOffset+weights.byteLength),probeFailure:options.injected===true,...options});
  client=window.createFaceProbeWorker({broken:mode==='broken',injected:mode==='injected'});
  report.phase='initializing';const ready=await client.ready;report.initialization=ready.diagnostics;report.phase='inference';
  const fixtures=[['black-square',128,128,'black'],['gray-landscape',256,128,'gray'],['gradient-portrait',128,256,'gradient'],['checker-large',512,512,'checker'],['gradient-1024',1024,768,'gradient'],['black-repeat-1',128,128,'black'],['black-repeat-2',128,128,'black']];
  for(const [name,width,height,pattern] of fixtures){
   const rgb=new Uint8Array(width*height*3);
   for(let y=0;y<height;y++)for(let x=0;x<width;x++)for(let c=0;c<3;c++)rgb[(y*width+x)*3+c]=pattern==='gray'?127:pattern==='gradient'?Math.round((c===0?x/(width-1):c===1?y/(height-1):0.5)*255):pattern==='checker'?(((x>>4)+(y>>4))%2)*255:0;
   const result=await client.infer({rgb,width,height});report.runs.push({name,width,height,...result.metrics,faces:result.faces});
   document.querySelector('#result').textContent=JSON.stringify(report,null,2);
  }
  report.dispose=await client.close();report.status='inference-completed';report.phase='complete';
 }catch(error){report.status='model-unavailable';report.error={name:error.name,message:error.message};}
 finally{
  client?.dispose();report.workerCleanup=client?.diagnostics();report.workerFailure=client?.lastFailure;
  clearInterval(timer);report.heartbeatSamples=beats.length;report.heartbeatLatenessMaxMs=Math.max(0,...beats);
  report.mainThreadRuntimeAbsent=typeof window.tf==='undefined'&&typeof window.faceDetection==='undefined';
  report.globalWebAssemblyUnchanged=window.WebAssembly===wasm;report.totalMs=performance.now()-start;
 }
 await new Promise(resolve=>setTimeout(resolve,50));
 document.querySelector('#result').textContent=JSON.stringify(report,null,2);window.faceProbe.done=true;
})().catch(error=>{window.faceProbe={done:true,report:{status:'harness-error',error:{name:error.name,message:error.message,stack:error.stack}}};document.querySelector('#result').textContent=error.stack;});
