'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const app=()=>fs.readFileSync(path.join(root,'src/app.js'),'utf8');
function fn(name){const match=app().match(new RegExp('  (?:async )?function '+name+'\\([^]*?\\n  }'));assert(match,`Missing ${name}`);return match[0];}
test('optional model capability checks require both APIs without constructing or loading anything',()=>{
 const probe=()=>{throw Error('Capability checks must not instantiate APIs');};
 for(const [Worker,DecompressionStream,expected] of [[probe,probe,true],[undefined,probe,false],[probe,undefined,false],[{},probe,false],[probe,null,false]]){
  const check=vm.runInNewContext(fn('canRunOptionalModels')+';canRunOptionalModels',{window:{Worker,DecompressionStream}});assert.equal(check(),expected);
 }
});
test('unsupported optional actions return before expanding assets or interrupting the other job',async()=>{
 for(const [name,render,other] of [['findFaces','renderFaces','similarity'],['findSimilarPhotos','renderSimilarity','faceJob']]){
  let renders=0;const active={id:'preserved'},state={load:null,analysis:null,faceJob:null,similarity:null};state[other]=active;
  const context={state,$:()=>({open:false}),canRunOptionalModels:()=>false,[render]:()=>renders++};
  const handler=vm.runInNewContext(fn(name)+';'+name,context);await handler();assert.equal(renders,1);assert.equal(state[other],active);
 }
});
function licenseHarness(reader){const nodes=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:false,disabled:false,attrs:{},setAttribute(k,v){this.attrs[k]=String(v);}});return nodes.get(id);};
 const context={state:{modelLicenses:{phase:'idle',text:''}},window:{StandaloneAssets:{textAsync:reader}},$,language:'en',translate:key=>context.language+':'+key};
 const handlers=vm.runInNewContext(fn('renderModelLicenses')+'\n'+fn('loadModelLicenses')+'\n({renderModelLicenses,loadModelLicenses})',context);return{...handlers,context,$};
}
test('license failures stay retryable and relocalize without being cached as successful text',async()=>{
 let fail=true,calls=0;const h=licenseHarness(async(id,key)=>{calls++;if(fail)throw Error('temporary local inflate failure');return id+'/'+key;});
 await h.loadModelLicenses();assert.equal(h.context.state.modelLicenses.phase,'failed');assert.equal(h.$('#modelLicenseText').textContent,'');assert.equal(h.$('#modelLicenseStatus').textContent,'en:licenseFailed');assert.equal(h.$('#retryModelLicensesButton').hidden,false);
 h.context.language='ja';h.renderModelLicenses();assert.equal(h.$('#modelLicenseStatus').textContent,'ja:licenseFailed');
 fail=false;await h.loadModelLicenses();assert.equal(h.context.state.modelLicenses.phase,'loaded');assert.match(h.$('#modelLicenseText').textContent,/mobilenet-v1\/license/);assert.match(h.$('#modelLicenseText').textContent,/face-detection\/license/);assert.equal(h.$('#retryModelLicensesButton').hidden,true);const completed=calls;await h.loadModelLicenses();assert.equal(calls,completed);
});
test('repeated license opens share pending work and publish only the completed license text',async()=>{
 const pending=[];let calls=0;const h=licenseHarness((id,key)=>{calls++;return new Promise(resolve=>pending.push(()=>resolve(id+'/'+key)));});
 const first=h.loadModelLicenses();await h.loadModelLicenses();assert.equal(calls,4);assert.equal(h.context.state.modelLicenses.phase,'loading');assert.equal(h.$('#modelLicenseText').textContent,'');assert.equal(h.$('#modelLicenseStatus').textContent,'en:licenseLoading');pending.forEach(resolve=>resolve());await first;assert.equal(h.context.state.modelLicenses.phase,'loaded');
});
test('asset cache evicts rejected reads, preserves successful bytes and shares concurrent requests',async()=>{
 const source=fs.readFileSync(path.join(root,'src/index.template.html'),'utf8');const start=source.indexOf('        async bytesAsync('),end=source.indexOf('        text(',start);assert(start>=0&&end>start);
 let fail=true,calls=0;const cache=new Map();const api=vm.runInNewContext('({'+source.slice(start,end)+'})',{assetByteCache:cache,getAsset:(id,key)=>id+'/'+key,inflateAsset:async()=>{calls++;if(fail)throw Error('first read');return new Uint8Array([3,7]);},Uint8Array});
 const failed=await Promise.allSettled([api.bytesAsync('a','b'),api.bytesAsync('a','b')]);assert(failed.every(r=>r.status==='rejected'));assert.equal(calls,1);assert.equal(cache.size,0);
 fail=false;const bytes=await api.bytesAsync('a','b');assert.deepEqual([...bytes],[3,7]);bytes[0]=99;assert.deepEqual([...await api.bytesAsync('a','b')],[3,7]);assert.equal(calls,2);assert.equal(cache.size,1);
});
