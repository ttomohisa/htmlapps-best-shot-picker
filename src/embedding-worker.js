/* Runs exclusively inside the opt-in product Blob worker. */
'use strict';
let model=null,busy=false,activeGeneration=null;
const attempts=[],violations=[];
self.addEventListener('securitypolicyviolation',e=>violations.push({directive:e.effectiveDirective,blocked:e.blockedURI}));
const deny=(kind,url)=>{attempts.push({kind,url:String(url)});throw new Error('Network disabled by local embedding worker');};
self.fetch=url=>Promise.reject((()=>{try{deny('fetch',url);}catch(e){return e;}})());
if(self.XMLHttpRequest)XMLHttpRequest.prototype.open=function(method,url){deny('XHR',url);};
self.WebSocket=function(url){deny('WebSocket',url);};
self.importScripts=()=>{throw new Error('External scripts disabled');};
self.onmessage=async({data:m})=>{
 const reply=data=>self.postMessage({generation:m.generation,jobId:m.jobId,...data},data.vector?[data.vector.buffer]:[]);
 try{
  if(busy)throw new Error('Worker operation already in progress');busy=true;
  if(m.type==='init'){
   if(model||activeGeneration!==null)throw new Error('Worker already initialized');activeGeneration=m.generation;
   const t=performance.now();if(!await tf.setBackend('cpu'))throw new Error('CPU backend unavailable');await tf.ready();
   model=await tf.loadGraphModel(tf.io.fromMemory({modelTopology:m.modelJson.modelTopology,weightSpecs:m.modelJson.weightsManifest.flatMap(g=>g.weights),weightData:m.weightData}));
   reply({type:'ready',diagnostics:{actualBackend:tf.getBackend(),initializationMs:performance.now()-t}});
  }else{
   if(m.generation!==activeGeneration||!model)throw new Error('Worker not initialized');
   if(m.type==='infer'){
    if(!(m.rgb instanceof Uint8Array)||!Number.isInteger(m.width)||!Number.isInteger(m.height)||m.width<1||m.height<1||m.width>512||m.height>512||m.rgb.length!==m.width*m.height*3)throw new Error('Invalid embedding pixels');
    const t=performance.now();let sampledBytes;
    const vector=tf.tidy(()=>{
     const input=tf.image.resizeBilinear(tf.tensor3d(m.rgb,[m.height,m.width,3],'int32').toFloat(),[224,224],false).div(255).expandDims(0);
     const values=Array.from(model.execute(input,'module_apply_default/hub_output/feature_vector/SpatialSqueeze').dataSync());sampledBytes=tf.memory().numBytes;
     if(values.length!==256||!values.every(Number.isFinite))throw new Error('Invalid embedding');
     const norm=Math.sqrt(values.reduce((s,v)=>s+v*v,0));if(!Number.isFinite(norm)||norm<=0)throw new Error('Empty embedding');
     return Float64Array.from(values,v=>v/norm);
    });
    reply({type:'result',vector,metrics:{inferenceMs:performance.now()-t,sampledTensorBytes:sampledBytes}});
   }else if(m.type==='dispose'){
    model.dispose();model=null;reply({type:'disposed',remainingTensors:tf.memory().numTensors,attempts,violations});
   }else throw new Error('Unknown worker request');
  }
 }catch(error){model?.dispose();model=null;reply({type:'error',error:{name:error.name,message:error.message},attempts,violations});}
 finally{busy=false;}
};
