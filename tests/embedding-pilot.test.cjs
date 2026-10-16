const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const E=require('../experiments/embedding/evaluate.js');
function fixture(){
 const samples=['a','b','c','d'].flatMap((scene,i)=>[0,1].map(n=>({id:scene+n,scene,split:i<2?'development':'holdout'})));
 const pairs=[];for(let a=0;a<samples.length;a++)for(let b=a+1;b<samples.length;b++)pairs.push({a:samples[a].id,b:samples[b].id,baseline:{match:false},cosine:samples[a].scene===samples[b].scene ? .98 : .1,visualGuard:true});
 return {samples,pairs};
}
test('complete-link pilot partition prevents similarity bridges and uses stable order',()=>{
 const samples=[{id:'c'},{id:'b'},{id:'a'}];const match=(a,b)=>E.pairKey(a.id,b.id)!=='a|c';
 assert.deepEqual(E.partition(samples,match).map(g=>g.map(s=>s.id)),[['a','b'],['c']]);
});
test('pilot reports group false joins, pair recall, and small-sample uncertainty separately',()=>{
 const samples=[{id:'a',scene:'one'},{id:'b',scene:'one'},{id:'c',scene:'two'}];
 const m=E.metrics(samples,[[samples[0],samples[2]],[samples[1]]]);
 assert.equal(m.falseGroups,1);assert.equal(m.falseGroupRate,.5);assert.equal(m.recall,0);assert.equal(m.falseJoinedPairs,1);assert(m.descriptiveWilson95[1]>.5);
});
test('holdout labels and scores never choose the development threshold',()=>{
 const f=fixture(),before=E.evaluate(f.samples,f.pairs);assert.equal(before.strategies['guarded-hybrid'].selectedThreshold,.98);
 for(const p of f.pairs)if(p.a.startsWith('c')||p.a.startsWith('d'))p.cosine=1;
 const after=E.evaluate(f.samples,f.pairs);assert.equal(after.strategies['guarded-hybrid'].selectedThreshold,.98);assert(after.strategies['guarded-hybrid'].holdout.falseGroups>0);
 assert.equal(before.baseline.holdout.recall,0);assert.equal(before.strategies['guarded-hybrid'].holdout.recall,1);
});
test('pilot rejects missing, duplicate, nonfinite and split-leaking evidence',()=>{
 for(const modify of [f=>f.pairs.pop(),f=>f.pairs[0].cosine=NaN,f=>f.pairs[0]=f.pairs[1],f=>f.samples[0].split='holdout']){const f=fixture();modify(f);assert.throws(()=>E.evaluate(f.samples,f.pairs));}
});
test('public-photo manifest is bounded, scene-disjoint, licensed and byte-pinned',()=>{
 const p=require('../experiments/embedding/photo-pilot.json');assert.equal(p.license,'CC-BY-4.0');assert.equal(p.images.length,51);
 assert.equal(new Set(p.images.map(i=>i.id)).size,51);assert.equal(new Set(p.images.map(i=>i.scene)).size,17);
 for(const scene of new Set(p.images.map(i=>i.scene))){const images=p.images.filter(i=>i.scene===scene);assert.deepEqual(images.map(i=>i.light),[0,12,24]);assert.equal(new Set(images.map(i=>i.split)).size,1);}
 for(const item of p.images){assert.match(item.sha256,/^[a-f0-9]{64}$/);assert(item.bytes>0&&item.bytes<2000000);assert(item.url.startsWith('https://projects.csail.mit.edu/illumination/databrowser/'));}
});
test('TFJS candidate has exact model-license evidence and does not relax canonical CSP',()=>{
 const p=require('../experiments/embedding/tfjs.dependencies.json');assert.equal(p.model.licenseEvidence.licenseName,'Apache 2.0');assert.equal(p.model.licenseEvidence.versionNumber,2);assert.equal(p.runtime.version,'4.22.0');
 const wrapper=fs.readFileSync('scripts/build-self-extract.ps1','utf8');assert(!wrapper.includes("'wasm-unsafe-eval'"));assert(!wrapper.includes("'unsafe-eval'"));
 const runner=fs.readFileSync('experiments/embedding/tfjs-runner.js','utf8');assert(runner.includes('(function(WebAssembly)'));assert(!/window\.WebAssembly\s*=([^=]|$)/.test(runner));assert(runner.includes('tf.io.fromMemory'));
 const builder=fs.readFileSync('build-standalone.ps1','utf8');assert(!builder.includes('tfjs'));
});
