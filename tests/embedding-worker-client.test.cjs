const {test}=require('node:test'),assert=require('node:assert/strict');
const {EmbeddingWorkerClient}=require('../experiments/embedding/worker-client.js');
function harness(options={}){
 const workers=[],urls=[],revoked=[],timers=new Map();let timerId=0;
 class Worker {constructor(url){this.url=url;this.sent=[];this.terminated=0;workers.push(this);}postMessage(message,transfer){this.sent.push({message,transfer});}terminate(){this.terminated++;}reply(data){this.onmessage?.({data});}}
 const client=new EmbeddingWorkerClient({runtimeSource:'/* pinned runtime */',workerSource:'/* worker */',modelJson:{},weightData:new ArrayBuffer(8),WorkerCtor:Worker,
  URLApi:{createObjectURL(){const u='blob:'+urls.length;urls.push(u);return u;},revokeObjectURL(u){revoked.push(u);}},BlobCtor:Blob,
  setTimeoutFn(fn){const id=++timerId;timers.set(id,fn);return id;},clearTimeoutFn(id){timers.delete(id);},...options});
 const worker=workers[0];
 const ready=()=>{const init=worker.sent[0].message;worker.reply({generation:init.generation,jobId:init.jobId,type:'ready',diagnostics:{actualBackend:'cpu'}});return client.ready;};
 return {client,worker,workers,urls,revoked,timers,ready};
}
const pixels=()=>({rgb:new Uint8Array(12),width:2,height:2});
test('initializes once, transfers weights and pixels, accepts only current response and revokes source',async()=>{
 const h=harness();assert.equal(h.worker.sent[0].message.type,'init');assert.equal(h.worker.sent[0].transfer.length,1);await h.ready();assert.deepEqual(h.revoked,h.urls);
 const p=h.client.infer(pixels()),request=await new Promise(r=>setImmediate(()=>r(h.worker.sent[1].message)));
 h.worker.reply({generation:request.generation-1,jobId:request.jobId,type:'result',vector:new Float64Array([9])});
 h.worker.reply({generation:request.generation,jobId:request.jobId+1,type:'result',vector:new Float64Array([9])});
 assert.equal(h.client.diagnostics().pendingRequests,1);
 h.worker.reply({generation:request.generation,jobId:request.jobId,type:'result',vector:new Float64Array(256).fill(.0625),metrics:{}});
 assert.equal((await p).vector.length,256);assert.equal(h.client.diagnostics().pendingRequests,0);
 h.client.dispose();h.client.dispose();assert.equal(h.worker.terminated,1);assert.equal(h.timers.size,0);assert.deepEqual(h.revoked,h.urls);
});
test('backpressure rejects concurrent inference rather than building an unbounded queue',async()=>{
 const h=harness();await h.ready();const pending=h.client.infer(pixels());await assert.rejects(h.client.infer(pixels()),/already in progress/);
 h.client.cancel();await assert.rejects(pending,{name:'AbortError'});assert.equal(h.worker.terminated,1);
});
test('cancel initialization settles ready and cleans timers, listeners, worker and source URL',async()=>{
 const h=harness();h.client.cancel();await assert.rejects(h.client.ready,{name:'AbortError'});
 assert.equal(h.worker.onmessage,null);assert.equal(h.worker.onerror,null);assert.equal(h.worker.onmessageerror,null);
 assert.equal(h.worker.terminated,1);assert.equal(h.timers.size,0);assert.deepEqual(h.revoked,h.urls);
 await assert.rejects(h.client.infer(pixels()),{name:'AbortError'});
});
test('abort during inference terminates the worker and late callbacks cannot publish a result',async()=>{
 const h=harness();await h.ready();const c=new AbortController(),p=h.client.infer(pixels(),{signal:c.signal});await new Promise(r=>setImmediate(r));
 const listener=h.worker.onmessage,request=h.worker.sent[1].message;c.abort();await assert.rejects(p,{name:'AbortError'});
 listener({data:{generation:request.generation,jobId:request.jobId,type:'result',vector:new Float64Array(256)}});
 assert.equal(h.client.diagnostics().pendingRequests,0);assert.equal(h.worker.terminated,1);
});
test('initialization and inference timeouts fail closed and can be followed by a new client',async()=>{
 for(const initialized of [false,true]){
  const h=harness();let pending=h.client.ready;if(initialized){await h.ready();pending=h.client.infer(pixels());await new Promise(r=>setImmediate(r));}
  [...h.timers.values()][0]();await assert.rejects(pending,/timed out/);assert.equal(h.worker.terminated,1);assert.equal(h.timers.size,0);
  const fresh=harness();await fresh.ready();assert.notEqual(fresh.client.diagnostics().generation,h.client.diagnostics().generation);fresh.client.dispose();
 }
});
test('worker error, message error, protocol error and postMessage failure release resources',async()=>{
 for(const mode of ['error','messageerror','reported']){
  const h=harness();if(mode==='reported'){const m=h.worker.sent[0].message;h.worker.reply({generation:m.generation,jobId:m.jobId,type:'error',error:{name:'Error',message:'bad weights'}});}else h.worker[mode==='error'?'onerror':'onmessageerror']({message:'worker failed',preventDefault(){}});
  await assert.rejects(h.client.ready);assert.equal(h.worker.terminated,1);assert.equal(h.timers.size,0);assert.deepEqual(h.revoked,h.urls);
 }
 const h=harness();await h.ready();h.worker.postMessage=()=>{throw new Error('clone failed');};await assert.rejects(h.client.infer(pixels()),/clone failed/);assert.equal(h.worker.terminated,1);
});
test('invalid dimensions and pixel length are rejected before transfer without poisoning initialized client',async()=>{
 const h=harness();await h.ready();for(const p of [{rgb:new Uint8Array(3),width:2,height:2},{rgb:new Uint8Array(12),width:0,height:2},{rgb:new Uint8Array(12),width:2.5,height:2},{rgb:new Uint8Array(12),width:10000,height:10000}])await assert.rejects(h.client.infer(p),/pixels/);
 assert.equal(h.worker.sent.length,1);assert.equal(h.worker.terminated,0);h.client.dispose();
});
test('graceful close reports zero worker tensors then terminates and revokes everything',async()=>{
 const h=harness();await h.ready();const p=h.client.close();await new Promise(r=>setImmediate(r));const req=h.worker.sent[1].message;
 h.worker.reply({generation:req.generation,jobId:req.jobId,type:'disposed',remainingTensors:0});assert.equal((await p).remainingTensors,0);assert.equal(h.worker.terminated,1);assert.equal(h.timers.size,0);
});
test('worker constructor failure revokes the allocated source',async()=>{
 const h=harness({WorkerCtor:class{constructor(){throw new Error('Worker unsupported');}}});await assert.rejects(h.client.ready,/unsupported/);assert.deepEqual(h.revoked,h.urls);assert.equal(h.timers.size,0);
});
test('malformed matching response fails closed rather than publishing invalid results',async()=>{
 for(const vector of [new Float64Array(1),new Float64Array(256).fill(NaN),Array(256).fill(1)]){
  const h=harness();await h.ready();const p=h.client.infer(pixels());await new Promise(r=>setImmediate(r));const m=h.worker.sent[1].message;
  h.worker.reply({generation:m.generation,jobId:m.jobId,type:'result',vector});await assert.rejects(p,/Invalid embedding vector/);assert.equal(h.worker.terminated,1);
 }
});
test('already aborted inference never transfers pixels and closes the worker',async()=>{
 const h=harness();await h.ready();const c=new AbortController();c.abort();await assert.rejects(h.client.infer(pixels(),{signal:c.signal}),{name:'AbortError'});assert.equal(h.worker.sent.length,1);assert.equal(h.worker.terminated,1);
});
test('research builder retains the earlier restrictive policy and is isolated from production',()=>{
 const fs=require('node:fs');const build=fs.readFileSync('experiments/embedding/burst-build.cjs','utf8');
 assert(build.includes("connect-src 'none'"));assert(!/unsafe-eval|wasm-unsafe-eval/.test(build));
 for(const file of ['build-standalone.ps1','dependencies.json','src/app.js'])assert(!/embedding\/worker|worker-client/.test(fs.readFileSync(file,'utf8')));
});
test('inference abort while waiting for initialization immediately settles and terminates',async()=>{
 for(const preAborted of [false,true]){
  const h=harness(),c=new AbortController();if(preAborted)c.abort();const p=h.client.infer(pixels(),{signal:c.signal});if(!preAborted)c.abort();
  await assert.rejects(p,{name:'AbortError'});await assert.rejects(h.client.ready,{name:'AbortError'});assert.equal(h.worker.terminated,1);assert.equal(h.timers.size,0);assert.deepEqual(h.revoked,h.urls);
 }
});
test('backpressure also bounds callers waiting for initialization to one pixel buffer',async()=>{
 const h=harness();const pending=h.client.infer(pixels());
 await assert.rejects(h.client.infer(pixels()),/already in progress/);assert.equal(h.worker.sent.length,1);
 h.client.cancel();await assert.rejects(pending,{name:'AbortError'});assert.equal(h.worker.terminated,1);
});
test('default browser timer methods keep the global receiver during setup and cleanup',async()=>{
 const vm=require('node:vm'),fs=require('node:fs');
 const context=vm.createContext({module:{exports:{}},Blob,ArrayBuffer});
 vm.runInContext(`let timers=0;globalThis.setTimeout=function(){if(this!==globalThis)throw new TypeError('Illegal invocation');timers++;return 1;};globalThis.clearTimeout=function(){if(this!==globalThis)throw new TypeError('Illegal invocation');timers--;};globalThis.URL={createObjectURL:()=> 'blob:test',revokeObjectURL:()=>{}};globalThis.Worker=class{postMessage(){}terminate(){}};`,context);
 vm.runInContext(fs.readFileSync('experiments/embedding/worker-client.js','utf8'),context);
 const c=vm.runInContext(`new module.exports.EmbeddingWorkerClient({runtimeSource:'',workerSource:'',modelJson:{},weightData:new ArrayBuffer(1)})`,context);
 assert.equal(vm.runInContext('timers',context),1);c.cancel();await assert.rejects(c.ready,{name:'AbortError'});assert.equal(vm.runInContext('timers',context),0);
});
