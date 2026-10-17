'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync(require('node:path').join(__dirname,'../src/app.js'),'utf8');
function fn(name){const m=app.match(new RegExp('  (?:async )?function '+name+'\\([^]*?\\n  }'));assert(m,name);return m[0];}
function harness(){
 const nodes=new Map(),urls=new Set(),revoked=[],downloads=[],timers=[],files=[{name:'one',size:1},{name:'two',size:2}],selected=files.map(file=>({file,name:file.name}));
 const state={zipBatches:null,zipPlanning:false,zipPlanError:null,exporting:null,generation:1,downloadUrls:new Set()};
 const document={activeElement:null,body:{append(){}},createElement(){return{click(){downloads.push(this.download);},remove(){}};}};
 const $=id=>{if(!nodes.has(id))nodes.set(id,{value:'',hidden:false,disabled:false,dataset:{},focus(){document.activeElement=this;}});return nodes.get(id);};
 $('#zipBatchSize').value='32';const outputFilename={value:'frozen-name'};let n=0;
 const context={state,$,document,outputFilename,AbortController,zipPlanSequence:0,defaultZipName:()=> 'default',kept:()=>selected,translate:k=>k,renderSave(){},setExportMessage(k,failure){context.message=k;context.failure=failure;},setTimeout:f=>timers.push(f),AppConfirm:{ask:async()=>true},URL:{createObjectURL(){const u='blob:'+(++n);urls.add(u);return u;},revokeObjectURL(u){urls.delete(u);revoked.push(u);}},Core:{zipFilename:x=>x,zipBatchFilename:(x,i,t)=>x+'-'+i+'-'+t,planZipBatches(inputs){return{inputs:inputs.slice(),batches:[{},{}]};},createZipBatch:async()=>({bytes:1}),createZip:async()=>({bytes:1})},assertCurrent(g,s){if(g!==state.generation||s.aborted){const e=Error('cancelled');e.name='AbortError';throw e;}}};
 const names=['exportZip','zipFailureDetails','zipFailureMessage','releaseZipBatch','disposeZipBatches','planZipBatches','prepareZipBatch','downloadZipBatch','advanceZipBatch','closeZipBatches'];
 const handlers=vm.runInNewContext(names.map(fn).join('\n')+'\n({'+names.join(',')+'})',context);
 return{...handlers,context,state,$,files,selected,urls,revoked,downloads,timers};
}
test('batch plan freezes starting Keep/file/name snapshot; no output is prepared or downloaded',async()=>{
 const h=harness();await h.planZipBatches();const b=h.state.zipBatches;h.selected.splice(0,1);h.context.outputFilename.value='later';assert.equal(b.plan.inputs.length,2);assert.equal(b.name,'frozen-name');assert.equal(b.phase,'planned');assert.equal(h.urls.size,0);assert.equal(h.downloads.length,0);
});
test('one explicit preparation and download per phase; repeated clicks never advance or multiply archives',async()=>{
 const h=harness();await h.planZipBatches();let resolve,calls=0;h.context.Core.createZipBatch=()=>{calls++;return new Promise(r=>resolve=r);};const pending=h.prepareZipBatch();await h.prepareZipBatch();assert.equal(calls,1);resolve({bytes:1});await pending;assert.equal(h.urls.size,1);assert.equal(h.downloads.length,0);
 h.downloadZipBatch();h.downloadZipBatch();assert.equal(h.downloads.length,1);assert.equal(h.state.zipBatches.index,0);h.advanceZipBatch();h.advanceZipBatch();assert.equal(h.state.zipBatches.index,1);assert.equal(h.state.zipBatches.phase,'planned');assert.equal(h.urls.size,0);assert.equal(h.state.zipBatches.blob,null);assert.equal(calls,1);
});
test('failed or cancelled preparation retries same part and never repeats previous parts',async()=>{
 const h=harness();await h.planZipBatches();h.state.zipBatches.index=1;let calls=[];h.context.Core.createZipBatch=async(p,i)=>{calls.push(i);throw Error('read failed');};await h.prepareZipBatch();assert.equal(h.state.zipBatches.phase,'failed');assert.equal(h.urls.size,0);h.context.Core.createZipBatch=async(p,i)=>{calls.push(i);return{};};await h.prepareZipBatch();assert.deepEqual(calls,[1,1]);assert.equal(h.state.zipBatches.phase,'ready');assert.equal(h.selected.length,2);
});
test('dispose/reset invalidates late prepare completion and cannot clear a newer export job',async()=>{
 const h=harness();await h.planZipBatches();let resolve;h.context.Core.createZipBatch=()=>new Promise(r=>resolve=r);const old=h.prepareZipBatch();h.disposeZipBatches();h.state.generation++;await h.planZipBatches();const next=h.state.zipBatches;const newer={id:'newer'};h.state.exporting=newer;resolve({});await old;assert.equal(h.state.zipBatches,next);assert.equal(h.state.exporting,newer);assert.equal(h.urls.size,0);assert.equal(h.downloads.length,0);
});
test('close keeps ready link when declined, then releases it exactly on explicit acceptance',async()=>{
 const h=harness();await h.planZipBatches();await h.prepareZipBatch();const batch=h.state.zipBatches;h.context.AppConfirm.ask=async()=>false;await h.closeZipBatches();assert.equal(h.state.zipBatches,batch);assert.equal(h.urls.size,1);h.context.AppConfirm.ask=async()=>true;await h.closeZipBatches();assert.equal(h.state.zipBatches,null);assert.equal(h.urls.size,0);assert.equal(h.selected.length,2);
});
test('final saved confirmation is explicit; finishing releases archive and never changes Keep',async()=>{
 const h=harness();await h.planZipBatches();h.state.zipBatches.index=1;await h.prepareZipBatch();h.advanceZipBatch();assert(h.state.zipBatches);h.downloadZipBatch();assert(h.state.zipBatches);h.advanceZipBatch();assert.equal(h.state.zipBatches,null);assert.equal(h.context.message,'zipConfirmed');assert.equal(h.urls.size,0);assert.equal(h.selected.length,2);
});
test('previous ordinary download needs acknowledgement before its lease can be released',async()=>{
 const h=harness();h.state.downloadUrls.add('existing');h.urls.add('existing');h.context.AppConfirm.ask=async()=>false;await h.planZipBatches();assert.equal(h.state.zipBatches,null);assert(h.urls.has('existing'));h.context.AppConfirm.ask=async()=>true;await h.planZipBatches();assert(h.state.zipBatches);assert(!h.urls.has('existing'));
});
test('async completion does not steal focus after the user moves elsewhere',async()=>{
 const h=harness();await h.planZipBatches();let resolve;h.context.Core.createZipBatch=()=>new Promise(r=>resolve=r);const pending=h.prepareZipBatch();h.$('#elsewhere').focus();resolve({});await pending;assert.equal(h.context.document.activeElement,h.$('#elsewhere'));
});

test('ordinary download acknowledgement survives automatic URL expiry',async()=>{
 const h=harness();h.state.ordinaryDownloadPending=true;h.context.AppConfirm.ask=async()=>false;await h.planZipBatches();assert.equal(h.state.zipBatches,null);assert.equal(h.state.ordinaryDownloadPending,true);h.context.AppConfirm.ask=async()=>true;await h.planZipBatches();assert(h.state.zipBatches);assert.equal(h.state.ordinaryDownloadPending,false);
});

test('failed link preparation releases the current archive but preserves the plan, Keep and prior outputs',async()=>{
 const h=harness();await h.planZipBatches();const batch=h.state.zipBatches;batch.index=1;
 h.downloads.push('previous-part.zip');h.context.URL.createObjectURL=()=>{throw new TypeError('private detail');};
 await h.prepareZipBatch();assert.equal(batch.phase,'failed');assert.equal(batch.blob,null);assert.equal(batch.url,null);
 assert.equal(batch.failure.code,'ZIP_LINK_FAILED');assert.equal(batch.failure.reason,'TypeError');
 assert.equal(batch.index,1);assert.equal(h.selected.length,2);assert.deepEqual(h.downloads,['previous-part.zip']);assert.equal(h.urls.size,0);
 const single=harness();single.context.URL.createObjectURL=()=>{throw new TypeError('private detail');};await single.exportZip();assert.equal(single.context.failure.code,'ZIP_LINK_FAILED');assert.equal(single.context.failure.reason,'TypeError');assert.equal(single.selected.length,2);assert.equal(single.downloads.length,0);
});

test('read failure keeps safe structured details and retry clears them without advancing',async()=>{
 const h=harness();await h.planZipBatches();const batch=h.state.zipBatches;
 h.context.Core.createZipBatch=async()=>{throw Object.assign(new Error('private filename and URL'),{code:'ZIP_READ_FAILED',reason:'NotReadableError',fileIndex:1,totalFiles:2});};
 await h.prepareZipBatch();assert.equal(batch.failure.code,'ZIP_READ_FAILED');assert.equal(batch.failure.fileIndex,1);assert.equal(batch.failure.totalFiles,2);
 assert(!JSON.stringify(batch.failure).includes('private'));
 assert.equal(h.zipFailureDetails({name:'private URL',reason:'private filename',code:'untrusted'},'build').reason,'Error');
 assert.equal(h.zipFailureDetails({name:'private URL',reason:'private filename',code:'untrusted'},'build').code,'ZIP_PREPARE_FAILED');
 assert.match(h.zipFailureMessage(batch.failure),/zipReadFailed.*ZIP_READ_FAILED \/ NotReadableError.*2 \/ 2/);
 h.context.Core.createZipBatch=async()=>({bytes:1});await h.prepareZipBatch();assert.equal(batch.phase,'ready');assert.equal(batch.failure,null);assert.equal(batch.index,0);
});
