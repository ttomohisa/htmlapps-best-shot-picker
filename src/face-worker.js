/* Runs exclusively inside the optional face-position Blob worker. */
'use strict';
let detector=null,busy=false,activeGeneration=null,failed=false;
const attempts=[],violations=[];
self.addEventListener('securitypolicyviolation',e=>violations.push({directive:e.effectiveDirective,blocked:e.blockedURI}));
const deny=(kind,url)=>{attempts.push({kind,url:String(url)});throw new Error('Network disabled by local face worker');};
self.fetch=url=>Promise.reject((()=>{try{deny('fetch',url);}catch(e){return e;}})());
if(self.XMLHttpRequest)self.XMLHttpRequest.prototype.open=function(method,url){deny('XHR',url);};
self.WebSocket=function(url){deny('WebSocket',url);};
self.importScripts=()=>{throw new Error('External scripts disabled');};
function faceGeometry(face,width,height){
 const b=face?.box,points=face?.keypoints;
 if(!b||!['xMin','xMax','yMin','yMax','width','height'].every(k=>Number.isFinite(b[k]))||b.width<=0||b.height<=0||b.xMin<0||b.yMin<0||b.xMax>width||b.yMax>height||b.xMax<=b.xMin||b.yMax<=b.yMin)return null;
 const tolerance=1e-5*Math.max(1,width,height);
 if(Math.abs(b.width-(b.xMax-b.xMin))>tolerance||Math.abs(b.height-(b.yMax-b.yMin))>tolerance)return null;
 if(!Array.isArray(points)||points.length!==6||!points.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.y>=0&&p.x<=width&&p.y<=height))return null;
 return {box:{xMin:b.xMin,xMax:b.xMax,yMin:b.yMin,yMax:b.yMax,width:b.width,height:b.height},keypoints:points.map(p=>({x:p.x,y:p.y}))};
}
self.onmessage=async({data:m})=>{
 const reply=data=>self.postMessage({generation:m.generation,jobId:m.jobId,...data});
 try{
  if(failed)throw new Error('Face worker failed and cannot be reused');
  if(busy)throw new Error('Worker operation already in progress');busy=true;
  if(m.type==='init'){
   if(detector||activeGeneration!==null)throw new Error('Worker already initialized');activeGeneration=m.generation;
   const t=performance.now();if(!await tf.setBackend('cpu'))throw new Error('CPU backend unavailable');await tf.ready();
   detector=await faceDetection.createDetector(faceDetection.SupportedModels.MediaPipeFaceDetector,{runtime:'tfjs',modelType:'short',maxFaces:6,
    detectorModelUrl:tf.io.fromMemory({modelTopology:m.modelJson.modelTopology,weightSpecs:m.modelJson.weightsManifest.flatMap(g=>g.weights),weightData:m.weightData})});
   reply({type:'ready',diagnostics:{actualBackend:tf.getBackend(),initializationMs:performance.now()-t}});
  }else{
   if(m.generation!==activeGeneration||!detector)throw new Error('Worker not initialized');
   if(m.type==='infer'){
    if(!(m.rgb instanceof Uint8Array)||!Number.isInteger(m.width)||!Number.isInteger(m.height)||m.width<1||m.height<1||m.width>1024||m.height>1024||m.rgb.length!==m.width*m.height*3||m.rgb.byteOffset!==0||m.rgb.byteLength!==m.rgb.buffer.byteLength)throw new Error('Invalid face pixels');
    const t=performance.now(),input=tf.tensor3d(m.rgb,[m.height,m.width,3],'int32');let raw;
    try{raw=await detector.estimateFaces(input,{flipHorizontal:false});}finally{input.dispose();}
    if(!Array.isArray(raw)||raw.length>6)throw new Error('Invalid face output');
    // A partial/off-image candidate is unavailable, never clamped into an
    // apparently valid crop. Filtering cannot change Keep or the original file.
    const faces=raw.map(f=>faceGeometry(f,m.width,m.height)).filter(Boolean);
    reply({type:'result',faces,metrics:{inferenceMs:performance.now()-t}});
   }else if(m.type==='dispose'){
    detector.dispose();detector=null;reply({type:'disposed',remainingTensors:tf.memory().numTensors,attempts,violations});
   }else throw new Error('Unknown worker request');
  }
 }catch(error){
  failed=true;
  try{detector?.dispose();}catch(_){}finally{detector=null;}
  // Upstream estimateFaces can retain preprocessing tensors after an error.
  // The client terminates this worker on every failure; never retry inside it.
  reply({type:'error',error:{name:error.name,message:error.message},attempts,violations});
 }finally{busy=false;}
};
