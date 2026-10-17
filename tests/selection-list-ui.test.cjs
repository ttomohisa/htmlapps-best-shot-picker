'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {File}=require('node:buffer'),Core=require('../src/core.js');
const source=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8');
function fn(name){const m=source.match(new RegExp('  (?:async )?function '+name+'\\([^]*?\\n  }'));assert(m,name);return m[0];}
function harness(){
 const nodes=new Map(),timers=[],downloads=[],blobs=new Map(),selected=[{file:new File(['first'],'=original.png')}],state={zipBatches:null,zipPlanning:false,load:null,exporting:null,selectionListDownloading:false,selectionListStatus:'',selectionListUrls:new Set(),downloadUrls:new Set(['archive']),ordinaryDownloadPending:true};
 const $=id=>{if(!nodes.has(id))nodes.set(id,{value:'',disabled:false,textContent:''});return nodes.get(id);};$('#zipMode').value='single';$('#selectionListName').value='list';let n=0;
 const context={Core,Blob,state,$,kept:()=>selected,outputFilename:{value:'photos'},defaultZipName:()=> 'default',translate:key=>key,setTimeout:(f,ms)=>timers.push({f,ms}),URL:{createObjectURL:b=>{const u='list:'+(++n);blobs.set(u,b);return u;},revokeObjectURL:u=>blobs.delete(u)},document:{body:{append(){}},createElement(){return{click(){downloads.push({url:this.href,name:this.download});},remove(){}};}}};
 const h=vm.runInNewContext(['canDownloadSelectionList','renderSelectionList','downloadSelectionList'].map(fn).join('\n')+';({canDownloadSelectionList,renderSelectionList,downloadSelectionList})',context);
 const cooldown=()=>timers.filter(x=>x.ms===500).splice(0).forEach(x=>x.f());return{...h,context,state,$,selected,downloads,blobs,timers,cooldown};
}
test('current Keep list is metadata-only, explicit and separate from archive leases',async()=>{
 const h=harness();h.selected[0].file.arrayBuffer=()=>{throw Error('must not read images');};h.renderSelectionList();assert.equal(h.downloads.length,0);h.downloadSelectionList('json');h.downloadSelectionList('json');assert.equal(h.downloads.length,1);const d=h.downloads[0],j=JSON.parse(await h.blobs.get(d.url).text());assert.equal(j.snapshotSource,'current_keep');assert.equal(j.rows[0].originalName,'=original.png');assert.equal(j.rows[0].zipArchiveName,'photos.zip');assert.equal(d.name,'list-selection.json');assert.deepEqual([...h.state.downloadUrls],['archive']);assert.equal(h.state.ordinaryDownloadPending,true);assert.equal(h.state.selectionListUrls.size,1);
 h.timers.find(x=>x.ms===60000).f();assert.equal(h.state.selectionListUrls.size,0);assert.equal(h.state.downloadUrls.size,1);
});
test('active batch source remains fixed after live Keep and requested ZIP name changes',async()=>{
 const h=harness();const file=h.selected[0].file,plan=Core.planZipBatches([file],{maxBytes:1000});h.state.zipBatches={plan,name:'frozen',closing:false};h.selected.splice(0,1,{file:new File(['later'],'later.png')});h.context.outputFilename.value='changed';h.downloadSelectionList('json');let j=JSON.parse(await h.blobs.get(h.downloads[0].url).text());assert.equal(j.snapshotSource,'zip_batch_plan');assert.equal(j.rows[0].originalName,'=original.png');assert.equal(j.rows[0].zipArchiveName,'frozen.zip');h.cooldown();h.state.zipBatches=null;h.downloadSelectionList('json');j=JSON.parse(await h.blobs.get(h.downloads[1].url).text());assert.equal(j.rows[0].originalName,'later.png');assert.equal(j.rows[0].zipArchiveName,'changed.zip');
});
test('load, planning, closing and ordinary export block list actions; fixed batch preparation does not',()=>{
 for(const field of ['load','zipPlanning','selectionListDownloading']){const h=harness();h.state[field]=true;h.downloadSelectionList('json');assert.equal(h.downloads.length,0,field);}
 const h=harness();h.$('#zipMode').value='batches';assert.equal(h.canDownloadSelectionList(),false);const batch={plan:Core.planZipBatches([h.selected[0].file],{maxBytes:1000}),name:'set',closing:true};h.state.zipBatches=batch;assert.equal(h.canDownloadSelectionList(),false);batch.closing=false;h.state.exporting={batch};assert.equal(h.canDownloadSelectionList(),true);h.state.exporting={controller:{}};assert.equal(h.canDownloadSelectionList(),false);
});
test('list failure creates no download, preserves choices and reports a recoverable limit',()=>{
 const h=harness();h.context.Core={...Core,createSelectionList(){const e=Error('over');e.code='ZIP_LIMIT';throw e;}};h.downloadSelectionList('json');assert.equal(h.downloads.length,0);assert.equal(h.state.selectionListStatus,'selectionListLimit');assert.equal(h.selected.length,1);assert.equal(h.state.downloadUrls.size,1);
});
test('summary keyboard activation is not routed into the global Enter-to-Keep shortcut',()=>{
 assert(source.includes("!event.target.closest('button,a,summary')"));
});
