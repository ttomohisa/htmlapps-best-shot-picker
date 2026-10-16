(function(root){
'use strict';
let generationCounter=0;
const abortError=()=>Object.assign(new Error('Embedding worker cancelled'),{name:'AbortError'});
class EmbeddingWorkerClient {
 constructor(options){
  this.options=options;this.generation=++generationCounter;this.job=0;this.pending=null;this.closed=false;this.failure=null;this.worker=null;this.url=null;
  this.counts={createdWorkers:0,terminatedWorkers:0,createdURLs:0,revokedURLs:0};
  this.URL=options.URLApi||URL;this.setTimer=options.setTimeoutFn||((fn,ms)=>globalThis.setTimeout(fn,ms));this.clearTimer=options.clearTimeoutFn||(id=>globalThis.clearTimeout(id));
  try {
   const BlobClass=options.BlobCtor||Blob,WorkerClass=options.WorkerCtor||Worker;
   this.url=this.URL.createObjectURL(new BlobClass([options.workerSource,'\n;(function(WebAssembly){\n',options.runtimeSource,'\n}).call(self,undefined);'],{type:'text/javascript'}));this.counts.createdURLs++;
   this.worker=new WorkerClass(this.url);this.counts.createdWorkers++;
   this.worker.onmessage=e=>this.receive(e.data);
   this.worker.onerror=e=>{e.preventDefault?.();this.fail(new Error(e.message||'Embedding worker failed'));};
   this.worker.onmessageerror=()=>this.fail(new Error('Embedding worker message could not be decoded'));
   this.ready=this.request('init',{modelJson:options.modelJson,weightData:options.weightData},[options.weightData],options.initTimeoutMs||30000).then(result=>{this.revoke();return result;});
  } catch(error){this.fail(error);this.ready=Promise.reject(error);}
  // Callers can cancel before awaiting ready without creating an unhandled rejection.
  this.ready.catch(()=>{});
 }
 revoke(){if(this.url!==null){this.URL.revokeObjectURL(this.url);this.url=null;this.counts.revokedURLs++;}}
 cleanup(){if(this.worker){this.worker.onmessage=null;this.worker.onerror=null;this.worker.onmessageerror=null;this.worker.terminate();this.worker=null;this.counts.terminatedWorkers++;}this.revoke();}
 settle(error,value){const p=this.pending;if(!p)return;this.pending=null;this.clearTimer(p.timer);p.signal?.removeEventListener('abort',p.abort);error?p.reject(error):p.resolve(value);}
 fail(error){if(this.closed)return;this.closed=true;this.failure=error;this.settle(error);this.cleanup();}
 receive(data){const p=this.pending;if(this.closed||!p||!data||data.generation!==this.generation||data.jobId!==p.jobId)return;
  if(data.type==='error'){this.fail(Object.assign(new Error(data.error?.message||'Embedding worker failed'),{name:data.error?.name||'Error'}));return;}
  const expected={init:'ready',infer:'result',dispose:'disposed'}[p.type];
  if(data.type!==expected){this.fail(new Error('Invalid embedding worker response'));return;}
  if(p.type==='infer'&&(!(data.vector instanceof Float64Array)||data.vector.length!==256||!data.vector.every(Number.isFinite))){this.fail(new Error('Invalid embedding vector'));return;}
  this.settle(null,data);
 }
 request(type,data,transfer,timeout,signal){
  if(this.closed)return Promise.reject(this.failure||abortError());
  if(this.pending)return Promise.reject(new Error('Embedding operation already in progress'));
  if(signal?.aborted){this.cancel();return Promise.reject(this.failure);}
  return new Promise((resolve,reject)=>{
   const jobId=++this.job,abort=()=>this.cancel();
   const pending={type,jobId,resolve,reject,signal,abort,timer:null};this.pending=pending;
   pending.timer=this.setTimer(()=>this.fail(new Error('Embedding worker '+type+' timed out')),timeout);
   signal?.addEventListener('abort',abort,{once:true});
   try{this.worker.postMessage({type,generation:this.generation,jobId,...data},transfer);}catch(error){this.fail(error);}
  });
 }
 async infer({rgb,width,height},{signal}={}){
  if(this.inferencePending)throw new Error('Embedding operation already in progress');
  if(!(rgb instanceof Uint8Array)||!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>512||height>512||rgb.length!==width*height*3||rgb.byteOffset!==0||rgb.byteLength!==rgb.buffer.byteLength)throw new Error('Invalid embedding pixels');
  this.inferencePending=true;
  const abort=()=>this.cancel();
  try{
   if(signal?.aborted)this.cancel();
   signal?.addEventListener('abort',abort,{once:true});
   try{await this.ready;}finally{signal?.removeEventListener('abort',abort);}
   if(this.closed)throw this.failure||abortError();
   return await this.request('infer',{rgb,width,height},[rgb.buffer],this.options.inferenceTimeoutMs||10000,signal);
  }finally{this.inferencePending=false;}
 }

 cancel(){this.fail(abortError());}
 dispose(){this.cancel();}
 async close(){await this.ready;const result=await this.request('dispose',{},[],this.options.disposeTimeoutMs||5000);this.closed=true;this.cleanup();return result;}
 diagnostics(){return {...this.counts,generation:this.generation,closed:this.closed,pendingRequests:this.pending?1:0};}
}
if(typeof module!=='undefined'&&module.exports)module.exports={EmbeddingWorkerClient};else root.EmbeddingWorkerClient=EmbeddingWorkerClient;
})(typeof globalThis!=='undefined'?globalThis:this);
