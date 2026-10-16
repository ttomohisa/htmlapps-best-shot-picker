'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {FaceProbeClient} = require('./probe-client.js');
function harness(options = {}) {
  const workers = [], timers = new Map(); let next = 0;
  class Worker {
    constructor() {this.sent=[];this.terminated=0;workers.push(this);}
    postMessage(message, transfer) {this.sent.push({message,transfer});if(options.postFails)throw new Error('post failed');}
    terminate() {this.terminated++;}
    reply(data) {const m=this.sent.at(-1).message;this.onmessage?.({data:{generation:m.generation,jobId:m.jobId,...data}});}
  }
  const urls = {made:0,revoked:0,createObjectURL(){this.made++;return 'blob:test';},revokeObjectURL(){this.revoked++;}};
  const client = new FaceProbeClient({runtimeSource:'',workerSource:'',modelJson:{},weightData:new ArrayBuffer(4),modelType:'short',WorkerCtor:Worker,URLApi:urls,setTimeoutFn:fn=>{timers.set(++next,fn);return next;},clearTimeoutFn:id=>timers.delete(id),...options});
  return {client,workers,urls,timers,worker:workers[0]};
}
function clean(h) {
  const d=h.client.diagnostics();assert.equal(d.createdWorkers,d.terminatedWorkers);assert.equal(d.createdURLs,d.revokedURLs);assert.equal(d.pendingRequests,0);assert.equal(d.closed,true);assert.equal(h.timers.size,0);
}
const pixels=()=>({rgb:new Uint8Array(12),width:2,height:2});
async function ready(h) {h.worker.reply({type:'ready'});await h.client.ready;}
test('success disposes worker, URL and timer', async()=>{const h=harness();await ready(h);const p=h.client.infer(pixels());await Promise.resolve();h.worker.reply({type:'result',faces:[]});assert.deepEqual((await p).faces,[]);const closing=h.client.close();await Promise.resolve();h.worker.reply({type:'disposed'});await closing;clean(h);});
test('late generation and job responses cannot settle pending init or inference', async()=>{
  const h=harness();const init=h.client.pending;
  h.client.receive({generation:h.client.generation-1,jobId:init.jobId,type:'ready'});
  h.client.receive({generation:h.client.generation,jobId:init.jobId+1,type:'ready'});
  assert.equal(h.client.pending,init);await ready(h);
  const p=h.client.infer(pixels());await Promise.resolve();const infer=h.client.pending;
  h.client.receive({generation:h.client.generation-1,jobId:infer.jobId,type:'result',faces:[]});
  h.client.receive({generation:h.client.generation,jobId:init.jobId,type:'result',faces:[]});assert.equal(h.client.pending,infer);
  h.worker.reply({type:'result',faces:[]});await p;h.client.dispose();clean(h);
});
test('cancel during initialization then late ready is harmless',async()=>{const h=harness();const m=h.worker.sent[0].message;h.client.cancel();await assert.rejects(h.client.ready,{name:'AbortError'});h.client.receive({...m,type:'ready'});h.client.cancel();clean(h);});
test('abort during inference terminates immediately and refuses reuse',async()=>{const h=harness();await ready(h);const signal=new AbortController();const p=h.client.infer(pixels(),{signal:signal.signal});await Promise.resolve();signal.abort();await assert.rejects(p,{name:'AbortError'});await assert.rejects(h.client.infer(pixels()),{name:'AbortError'});clean(h);});
test('pre-aborted signal terminates without an inference post',async()=>{const h=harness();await ready(h);const controller=new AbortController();controller.abort();await assert.rejects(h.client.infer(pixels(),{signal:controller.signal}),{name:'AbortError'});assert.equal(h.worker.sent.length,1);clean(h);});
test('timeout is fail-closed',async()=>{const h=harness();[...h.timers.values()][0]();await assert.rejects(h.client.ready,/timed out/);clean(h);});
test('synchronous transfer failure cleans up',async()=>{const h=harness({postFails:true});await assert.rejects(h.client.ready,/post failed/);clean(h);});
test('worker construction failure revokes URL',async()=>{const h=harness({WorkerCtor:class{constructor(){throw new Error('blocked worker');}}});await assert.rejects(h.client.ready,/blocked worker/);clean(h);});
test('model failure preserves diagnostics and prevents reuse',async()=>{const h=harness();h.worker.reply({type:'error',error:{name:'Error',message:'broken model'},attempts:[]});await assert.rejects(h.client.ready,/broken model/);assert.deepEqual(h.client.lastFailure.attempts,[]);clean(h);});
for (const event of ['onerror','onmessageerror']) test(event+' terminates and revokes',async()=>{const h=harness();h.worker[event]({message:'worker error',preventDefault(){}});await assert.rejects(h.client.ready);clean(h);});
for (const response of [{type:'bogus'},{type:'result',faces:[{box:{xMin:NaN},keypoints:[]}]}]) test('invalid response fails closed: '+response.type,async()=>{const h=harness();await ready(h);const p=h.client.infer(pixels());await Promise.resolve();h.worker.reply(response);await assert.rejects(p,/Invalid/);clean(h);});
test('reject malformed pixels without dispatch',async()=>{const h=harness();await ready(h);await assert.rejects(h.client.infer({rgb:new Uint8Array(3),width:1025,height:1}),/Invalid/);await assert.rejects(h.client.infer({rgb:new Uint8Array(15).subarray(3),width:2,height:2}),/Invalid/);assert.equal(h.worker.sent.length,1);h.client.dispose();clean(h);});
test('reject concurrent inference without disturbing active operation',async()=>{const h=harness();await ready(h);const p=h.client.infer(pixels());await assert.rejects(h.client.infer(pixels()),/already in progress/);h.worker.reply({type:'result',faces:[]});await p;h.client.dispose();clean(h);});
