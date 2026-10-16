const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
test('external burst harness uses frozen evaluation and reports sequential resource costs',()=>{
 const runner=fs.readFileSync('experiments/embedding/burst-runner.js','utf8');
 assert(runner.includes('evaluateFrozen'));
 assert(runner.includes('maxDecodedImages'));
 assert(runner.includes('longTasks'));
 assert(runner.includes('remainingTensors'));
 assert(runner.includes('realDevicePerformance'));
 assert(!/unsafe-eval|wasm-unsafe-eval/.test(runner));
});
test('external burst harness stays out of production build and runtime',()=>{
 for(const name of ['build-standalone.ps1','dependencies.json','src/app.js'])assert(!fs.readFileSync(name,'utf8').includes('burst-runner'));
});
test('external corpus is fixed before inference with licensed hash-pinned real frames and reviewed scenes',()=>{
 const p=require('../experiments/embedding/burst-holdout.json');
 assert.equal(p.license,'CC-BY-SA-4.0');assert.equal(p.protocolFrozenBeforeInference,true);
 assert.equal(p.images.length,36);assert.equal(p.scenes.length,18);assert.equal(p.selection.excluded.length,2);
 assert.match(p.selection.review,/not independent human ground truth/);
 assert.equal(new Set(p.images.map(i=>i.id)).size,p.images.length);
 assert.equal(p.images.reduce((sum,i)=>sum+Number(i.source.size),0),250789472);
 for(const scene of p.scenes){const frames=p.images.filter(i=>i.scene===scene.id);assert.equal(frames.length,2);assert.equal(new Set(frames.map(i=>i.source.sha256)).size,2);}
 for(const i of p.images){
  assert.equal(i.split,'external-holdout');assert.equal(i.mime,'image/png');assert.match(i.sha256,/^[a-f0-9]{64}$/);assert.match(i.source.sha256,/^[a-f0-9]{64}$/);
  assert(i.width>0&&i.width<=512&&i.height>0&&i.height<=512);assert(i.bytes>0);
  assert.match(i.source.generation,/^\d+$/);assert.match(i.source.url,/^https:\/\/storage.googleapis.com\/hdrplusdata\/20171106_subset\/bursts\//);
  assert(!p.selection.excluded.some(e=>e.burst===i.burst));
 }
});
test('retained external evidence reproduces the frozen result and exposes synchronous costs',()=>{
 const E=require('../experiments/embedding/evaluate.js');
 const p=require('../experiments/embedding/burst-holdout.json');
 const r=require('../experiments/embedding/burst-results-2026-10-16.json');
 assert.deepEqual(E.evaluateFrozen(p.images,r.photoPairs,r.protocol),r.evaluation);
 assert.equal(r.evaluation.baseline.externalHoldout.recoveredPairs,11);
 assert.equal(r.evaluation.strategies['guarded-hybrid'].externalHoldout.recoveredPairs,17);
 assert.equal(r.evaluation.strategies['guarded-hybrid'].externalHoldout.falseJoinedPairs,0);
 assert.equal(r.realDevicePerformance,'NOT MEASURED');assert.equal(r.adoption,'NOT APPROVED');
 for(const run of r.executions){
  assert.deepEqual(run.httpRequests,[]);assert.deepEqual(run.attempts,[]);assert.deepEqual(run.violations,[]);assert.equal(run.remainingTensors,0);
  if(run.status==='inference-completed')assert.equal(run.derivedMaxSynchronousInferenceMs,Math.max(...run.inferenceMs));
 }
 assert.match(r.interpretation.longTaskCaution,/incomplete observations/);
});
