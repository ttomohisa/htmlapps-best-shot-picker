'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),clientPath=path.join(root,'src/face-worker-client.js');
function harness(options={}) {
 assert(fs.existsSync(clientPath),'product FaceWorkerClient must exist');
 const {FaceWorkerClient}=require(clientPath),workers=[],timers=new Map(),blobs=[];let timerId=0;
 class Worker {
  constructor(){this.sent=[];this.terminated=0;workers.push(this);}
  postMessage(message,transfer){this.sent.push({message,transfer});if(options.postFails)throw new Error('post failed');}
  terminate(){this.terminated++;}
  reply(data){const m=this.sent.at(-1).message;this.onmessage?.({data:{generation:m.generation,jobId:m.jobId,...data}});}
 }
 const urls={made:0,revoked:0,createObjectURL(blob){blobs.push(blob);this.made++;return 'blob:face-'+this.made;},revokeObjectURL(){this.revoked++;}};
 const client=new FaceWorkerClient({runtimeSource:'/* shared tfjs and detector */',workerSource:'/* face worker */',modelJson:{},weightData:new ArrayBuffer(4),WorkerCtor:Worker,URLApi:urls,setTimeoutFn:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeoutFn:id=>timers.delete(id),...options});
 return {client,workers,worker:workers[0],urls,timers,blobs};
}
function clean(h){const d=h.client.diagnostics();assert.equal(d.createdWorkers,d.terminatedWorkers);assert.equal(d.createdURLs,d.revokedURLs);assert.equal(d.pendingRequests,0);assert.equal(d.closed,true);assert.equal(h.timers.size,0);}
const pixels=()=>({rgb:new Uint8Array(12),width:2,height:2});
const face=()=>({box:{xMin:.2,xMax:1.8,yMin:.1,yMax:1.9,width:1.6,height:1.8},keypoints:Array.from({length:6},()=>({x:1,y:1}))});
async function ready(h){h.worker.reply({type:'ready'});await h.client.ready;}
async function replyInfer(h,response){const result=h.client.infer(pixels());await Promise.resolve();h.worker.reply(response);return result;}
test('bounded successful inference transfers once, exposes geometry only, then closes all resources',async()=>{
 const h=harness();assert.equal(h.worker.sent[0].transfer[0],h.worker.sent[0].message.weightData);
 assert.equal('modelType' in h.worker.sent[0].message,false);assert.equal('probeFailure' in h.worker.sent[0].message,false);
 await ready(h);assert.equal(h.urls.revoked,1);const input=pixels(),pending=h.client.infer(input);await Promise.resolve();
 assert.deepEqual(h.worker.sent[1].transfer,[input.rgb.buffer]);const output=face();output.score=.9;output.identity='not permitted';output.keypoints[0].name='leftEye';
 h.worker.reply({type:'result',faces:[output]});assert.deepEqual((await pending).faces,[face()]);
 const closing=h.client.close();await Promise.resolve();h.worker.reply({type:'disposed',remainingTensors:0});assert.equal((await closing).remainingTensors,0);h.client.dispose();clean(h);
 const source=await h.blobs[0].text();assert.match(source,/function\(WebAssembly\)/);assert.match(source,/call\(self,undefined\)/);
});
test('stale generation/job responses cannot settle active work or revive cancelled work',async()=>{
 const h=harness(),init=h.worker.sent[0].message;
 h.worker.reply({type:'ready',generation:init.generation-1});h.worker.reply({type:'ready',jobId:init.jobId+1});assert.equal(h.client.diagnostics().pendingRequests,1);await ready(h);
 const pending=h.client.infer(pixels());await Promise.resolve();const job=h.worker.sent[1].message,callback=h.worker.onmessage;
 h.worker.reply({type:'result',faces:[],jobId:init.jobId});h.worker.reply({type:'result',faces:[],generation:job.generation-1});assert.equal(h.client.diagnostics().pendingRequests,1);
 h.client.cancel();await assert.rejects(pending,{name:'AbortError'});callback({data:{...job,type:'result',faces:[face()]}});clean(h);
});
test('abort during initialization, waiting inference, active inference and pre-abort terminates without reuse',async()=>{
 for(const phase of ['init','waiting','infer','pre']){
  const h=harness(),controller=new AbortController();if(phase==='infer'||phase==='pre')await ready(h);if(phase==='pre')controller.abort();
  const pending=phase==='init'?h.client.ready:h.client.infer(pixels(),{signal:controller.signal});if(phase==='infer')await Promise.resolve();
  if(phase==='init')h.client.cancel();else controller.abort();await assert.rejects(pending,{name:'AbortError'});
  await assert.rejects(h.client.infer(pixels()),{name:'AbortError'});if(phase==='pre')assert.equal(h.worker.sent.length,1);clean(h);
 }
});
test('each worker operation timeout fails closed, and a fresh client gets a new generation',async()=>{
 for(const phase of ['init','infer','dispose']){
  const h=harness();let pending=h.client.ready;if(phase!=='init'){await ready(h);pending=phase==='infer'?h.client.infer(pixels()):h.client.close();await Promise.resolve();}
  [...h.timers.values()][0]();await assert.rejects(pending,/timed out/);await assert.rejects(h.client.infer(pixels()),/timed out/);clean(h);
  const next=harness();assert.notEqual(next.client.generation,h.client.generation);next.client.cancel();await assert.rejects(next.client.ready,{name:'AbortError'});clean(next);
 }
});
test('construction, transfer, worker event and reported failure release resources',async()=>{
 const failed=harness({WorkerCtor:class{constructor(){throw new Error('worker blocked');}}});await assert.rejects(failed.client.ready,/worker blocked/);clean(failed);
 for(const mode of ['post','error','messageerror','reported']){
  const h=harness();await ready(h);if(mode==='post')h.worker.postMessage=()=>{throw new Error('clone failed');};
  const pending=h.client.infer(pixels());await Promise.resolve();
  if(mode==='error')h.worker.onerror({message:'worker failed',preventDefault(){}});
  if(mode==='messageerror')h.worker.onmessageerror({});
  if(mode==='reported')h.worker.reply({type:'error',error:{name:'Error',message:'model failed'}});
  await assert.rejects(pending);clean(h);
 }
 const init=harness({postFails:true});await assert.rejects(init.client.ready,/post failed/);clean(init);
});
test('backpressure bounds queued RGB data while initializing and while inferring',async()=>{
 for(const initialized of [false,true]){const h=harness();if(initialized)await ready(h);const p=h.client.infer(pixels());await assert.rejects(h.client.infer(pixels()),/already in progress/);h.client.cancel();await assert.rejects(p,{name:'AbortError'});clean(h);}
});
test('invalid RGB geometry or non-owned buffer rejects before transfer without poisoning client',async()=>{
 const h=harness();await ready(h);
 for(const input of [null,{}, {rgb:new Uint8Array(12),width:0,height:2},{rgb:new Uint8Array(12),width:2.5,height:2},{rgb:new Uint8Array(12),width:1025,height:1},{rgb:new Uint8Array(3),width:2,height:2},{rgb:new Uint8Array(15).subarray(3),width:2,height:2},{rgb:new Uint8Array(15).subarray(0,12),width:2,height:2}])await assert.rejects(h.client.infer(input),/Invalid face pixels/);
 assert.equal(h.worker.sent.length,1);assert.equal(h.worker.terminated,0);
 const valid={rgb:new Uint8Array(1024*3),width:1024,height:1},p=h.client.infer(valid);await Promise.resolve();h.worker.reply({type:'result',faces:[]});await p;h.client.dispose();clean(h);
});
test('nonfinite, inverted, zero, out-of-bounds or inconsistent face geometry fails closed',async()=>{
 const bad=[];for(const [key,value] of [['xMin',NaN],['xMin',-.01],['xMax',2.01],['yMax',2.01],['width',0],['height',-1],['width',.4],['xMin',1.9]]){const f=face();f.box[key]=value;bad.push(f);}
 for(const point of [{x:Infinity,y:1},{x:1,y:-.01},{x:2.01,y:1}]){const f=face();f.keypoints[0]=point;bad.push(f);}
 const missing=face();missing.keypoints.pop();bad.push(missing);
 for(const faces of [...bad.map(f=>[f]),Array.from({length:7},face),null]){const h=harness();await ready(h);await assert.rejects(replyInfer(h,{type:'result',faces}),/Invalid face geometry/);clean(h);}
 const h=harness();await ready(h);await assert.rejects(replyInfer(h,{type:'ready'}),/Invalid face worker response/);clean(h);
});
function workerHarness({faces=[face()],failure=false}={}){
 const workerPath=path.join(root,'src/face-worker.js');assert(fs.existsSync(workerPath),'product face worker must exist');
 const sent=[],calls={inputDisposed:0,detectorDisposed:0};const detector={estimateFaces:async()=>{if(failure)throw new Error('inference failed');return faces;},dispose(){calls.detectorDisposed++;}};
 const tf={setBackend:async name=>{calls.backend=name;return true;},ready:async()=>{},getBackend:()=>calls.backend,memory:()=>({numTensors:0,numBytes:0}),io:{fromMemory:args=>{calls.memory=args;return {inMemory:true};}},tensor3d:(rgb,shape,dtype)=>{calls.tensor={rgb,shape,dtype};return {dispose(){calls.inputDisposed++;}};}};
 const self={addEventListener(){},postMessage:m=>sent.push(m)};self.self=self;
 const context=vm.createContext({self,tf,faceDetection:{SupportedModels:{MediaPipeFaceDetector:'face'},createDetector:async(name,options)=>{calls.options=options;return detector;}},Uint8Array,ArrayBuffer,performance});vm.runInContext(fs.readFileSync(workerPath,'utf8'),context);
 let jobId=0;const request=data=>self.onmessage({data:{generation:1,jobId:++jobId,...data}});
 return {calls,sent,request,self};
}
test('worker fixes short/CPU/in-memory loading, filters unsafe faces and strips non-geometry fields',async()=>{
 const valid=face();valid.score=.99;valid.identity='discard';valid.keypoints[0].name='leftEye';const unsafe=face();unsafe.box.xMin=-1;
 const h=workerHarness({faces:[unsafe,valid]});await h.request({type:'init',modelJson:{modelTopology:{},weightsManifest:[{weights:[]}]},weightData:new ArrayBuffer(4),modelType:'full',probeFailure:true});
 assert.equal(h.calls.backend,'cpu');assert.equal(h.calls.options.modelType,'short');assert.equal(h.calls.options.maxFaces,6);assert.equal(h.calls.options.runtime,'tfjs');assert.equal(h.calls.options.detectorModelUrl.inMemory,true);
 await h.request({type:'infer',...pixels()});assert.deepEqual(JSON.parse(JSON.stringify(h.sent.at(-1).faces)),[face()]);assert.equal(h.calls.inputDisposed,1);
 await h.request({type:'dispose'});assert.equal(h.calls.detectorDisposed,1);assert.equal(h.sent.at(-1).type,'disposed');
 await assert.rejects(h.self.fetch('https://example.invalid'),/Network disabled/);assert.throws(()=>h.self.importScripts('https://example.invalid'),/External scripts disabled/);
});
test('worker inference exceptions dispose the input and detector and reject subsequent reuse',async()=>{
 const h=workerHarness({failure:true});await h.request({type:'init',modelJson:{modelTopology:{},weightsManifest:[{weights:[]}]},weightData:new ArrayBuffer(4)});
 await h.request({type:'infer',...pixels()});assert.equal(h.sent.at(-1).type,'error');assert.equal(h.calls.inputDisposed,1);assert.equal(h.calls.detectorDisposed,1);
 await h.request({type:'infer',...pixels()});assert.equal(h.sent.at(-1).type,'error');assert.match(h.sent.at(-1).error.message,/initialized|failed/);
});
