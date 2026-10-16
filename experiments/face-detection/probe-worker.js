/* Isolated technical probe. Never imported by the product build. */
'use strict';
let detector=null,busy=false,activeGeneration=null,probeFailure=false;
const attempts=[],violations=[];
self.addEventListener('securitypolicyviolation',e=>violations.push({directive:e.effectiveDirective,blocked:e.blockedURI}));
const deny=(kind,url)=>{attempts.push({kind,url:String(url)});throw new Error('Network disabled by face probe');};
self.fetch=url=>Promise.reject((()=>{try{deny('fetch',url);}catch(e){return e;}})());
if(self.XMLHttpRequest)XMLHttpRequest.prototype.open=function(method,url){deny('XHR',url);};
self.WebSocket=function(url){deny('WebSocket',url);};
self.importScripts=()=>{throw new Error('External scripts disabled');};
const memory=()=>{const m=tf.memory();return{numTensors:m.numTensors,numDataBuffers:m.numDataBuffers,numBytes:m.numBytes,unreliable:m.unreliable,reasons:m.reasons};};
self.onmessage=async({data:m})=>{
 const reply=data=>self.postMessage({generation:m.generation,jobId:m.jobId,...data});
 try{
  if(busy)throw new Error('Worker operation already in progress');busy=true;
  if(m.type==='init'){
   if(detector||activeGeneration!==null)throw new Error('Worker already initialized');
   if(!['short','full'].includes(m.modelType))throw new Error('Invalid model type');
   activeGeneration=m.generation;probeFailure=m.probeFailure===true;
   const t=performance.now();if(!await tf.setBackend('cpu'))throw new Error('CPU backend unavailable');await tf.ready();
   const baseline=memory();
   detector=await faceDetection.createDetector(faceDetection.SupportedModels.MediaPipeFaceDetector,{runtime:'tfjs',modelType:m.modelType,maxFaces:6,
    detectorModelUrl:tf.io.fromMemory({modelTopology:m.modelJson.modelTopology,weightSpecs:m.modelJson.weightsManifest.flatMap(g=>g.weights),weightData:m.weightData})});
   reply({type:'ready',diagnostics:{actualBackend:tf.getBackend(),initializationMs:performance.now()-t,baselineMemory:baseline,loadedMemory:memory()}});
  }else{
   if(m.generation!==activeGeneration||!detector)throw new Error('Worker not initialized');
   if(m.type==='infer'){
    if(!(m.rgb instanceof Uint8Array)||!Number.isInteger(m.width)||!Number.isInteger(m.height)||m.width<1||m.height<1||m.width>1024||m.height>1024||m.rgb.length!==m.width*m.height*3)throw new Error('Invalid face pixels');
    const t=performance.now(),input=tf.tensor3d(m.rgb,[m.height,m.width,3],'int32');let faces;
    // Fault injection is confined to this harness and separately labelled in reports.
    if(probeFailure)detector.detectorModel.execute=()=>{throw new Error('Injected execute failure');};
    try{faces=await detector.estimateFaces(input,{flipHorizontal:false});}finally{input.dispose();}
    reply({type:'result',faces,metrics:{inferenceMs:performance.now()-t,memory:memory()}});
   }else if(m.type==='dispose'){
    detector.dispose();detector=null;reply({type:'disposed',remainingTensors:tf.memory().numTensors,memory:memory(),attempts,violations});
   }else throw new Error('Unknown worker request');
  }
 }catch(error){
  detector?.dispose();detector=null;
  // Upstream estimateFaces may leak preprocessing tensors on errors. The copied
  // client fails closed and terminates this worker; it must never be reused.
  reply({type:'error',error:{name:error.name,message:error.message},memoryBeforeTermination:typeof tf==='undefined'?null:memory(),attempts,violations});
 }finally{busy=false;}
};
