'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const modulePath=path.join(__dirname,'../src/face-geometry.js');
const Geometry=fs.existsSync(modulePath)?require(modulePath):{};
const box=(xMin,yMin,xMax,yMax)=>({box:{xMin,yMin,xMax,yMax,width:xMax-xMin,height:yMax-yMin}});

test('face boxes normalize valid in-bounds processing pixels',()=>{
 assert.equal(typeof Geometry.normalizeFaces,'function');
 assert.deepEqual(Geometry.normalizeFaces([box(128,64,384,320)],1024,512),[{xMin:.125,yMin:.125,xMax:.375,yMax:.625,width:.25,height:.5}]);
 assert.throws(()=>Geometry.normalizeFaces([box(-10,20,80,120)],100,100));
 assert.deepEqual(Geometry.normalizeFaces([],100,100),[]);
});
test('malformed, nonfinite, reversed, nonintersecting and excessive detections fail closed',()=>{
 assert.equal(typeof Geometry.normalizeFaces,'function');
 for(const faces of [null,{},[{}],new Array(1),[box(-1,0,10,10)],[box(0,0,101,10)],[box(0,0,10,101)],[box(NaN,0,10,20)],[box(0,0,Infinity,20)],[box(10,0,0,20)],[box(-30,0,-10,20)],[box(0,0,10,0)],Array.from({length:7},()=>box(0,0,10,10)),[{box:{xMin:'0',yMin:0,xMax:10,yMax:10}}]])assert.throws(()=>Geometry.normalizeFaces(faces,100,100));
 for(const dims of [[0,100],[-1,100],[100,NaN],[Infinity,100],[1.5,100]])assert.throws(()=>Geometry.normalizeFaces([], ...dims));
});
test('oriented portrait coordinates map independently of encoded landscape dimensions',()=>{
 assert.equal(typeof Geometry.faceView,'function');
 const face=Geometry.normalizeFaces([box(192,256,384,512)],576,1024)[0];
 const view=Geometry.faceView(face,1800,3200,320,420);
 const centerX=(face.xMin+face.xMax)*.5*view.width+view.insetX-view.left;
 const centerY=(face.yMin+face.yMax)*.5*view.height+view.insetY-view.top;
 assert(Math.abs(centerX-160)<1e-8);assert(Math.abs(centerY-210)<1e-8);
 assert.equal(view.width/view.height,1800/3200);
});
test('face view stays finite and scrollable in portrait, landscape, edges and resized panels',()=>{
 assert.equal(typeof Geometry.faceView,'function');
 for(const [width,height] of [[4000,3000],[1800,3200],[32,32]])for(const [vw,vh] of [[120,245],[320,420],[760,200]])for(const values of [[0,0,.1,.1],[.9,.9,1,1],[.2,.15,.6,.8]]){
  const normalized=Geometry.normalizeFaces([box(...values)],1,1)[0];
  const view=Geometry.faceView(normalized,width,height,vw,vh);
  assert(Object.values(view).every(Number.isFinite));assert(view.width>0&&view.height>0&&view.scale<=4);
  assert(view.left>=0&&view.top>=0);assert(view.left<=Math.max(0,view.width-vw));assert(view.top<=Math.max(0,view.height-vh));
 }
 for(const args of [[null,100,100,200,200],[{xMin:0,yMin:0,xMax:0,yMax:1,width:0,height:1},100,100,200,200],[{xMin:0,yMin:0,xMax:1,yMax:1,width:1,height:1},100,100,0,200]])assert.throws(()=>Geometry.faceView(...args));
});
test('face controls and help are explicit, pair-scoped and independently return to whole image',()=>{
 const app=fs.readFileSync('src/app.js','utf8'),html=fs.readFileSync('src/index.template.html','utf8');
 for(const id of ['findFacesButton','cancelFacesButton','faceStatus','faceControlsA','faceControlsB','wholeImageA','wholeImageB','faceChoicesA','faceChoicesB'])assert(html.includes(`id="${id}"`),id);
 for(const marker of ['__BEST_SHOT_FACE_CLIENT_JS__','__BEST_SHOT_FACE_GEOMETRY_JS__'])assert(html.includes(marker),marker);
 assert(html.includes('data-i18n="helpFaces"'));assert(app.includes('Find faces · Experimental'));assert(app.includes('顔を探す・試験的機能'));
 assert(!app.includes('Face detection is not included.'));assert(!app.includes('顔検出はありません。'));
 assert.match(app,/async function findFaces\(/);assert.match(app,/function invalidateFaces\(/);assert.match(app,/function assertFaceCurrent\(/);
});

const vm=require('node:vm');
function uiFunction(name){
 const source=fs.readFileSync('src/app.js','utf8').match(new RegExp('  (?:async )?function '+name+'\\([^]*?\\n  }'));
 assert(source,`Missing ${name}`);return source[0];
}
function faceHarness(){
 const photos=[{id:'a',file:{name:'a.jpg'},width:800,height:600},{id:'b',file:{name:'b.jpg'},width:600,height:800}];
 const state={generation:2,inputRevision:3,faceRevision:1,pair:['a','b'],facePair:['a','b'],faceJob:null,faceResults:new Map(),faceSelected:[null,null],faceWhole:[false,false],faceMessage:'',fullUrls:new Map([['a','blob:a'],['b','blob:b']]),similarity:null};
 const nodes=new Map(),frames=[],calls={cancel:0,dispose:0,close:0,infer:[],renders:0};
 const $=selector=>{if(!nodes.has(selector))nodes.set(selector,{dataset:{},style:{},src:selector==='#imageA'?'blob:a':'blob:b',isConnected:true,clientWidth:300,clientHeight:240,open:false,classList:{add(){},remove(){}},scrollTo(left,top){this.left=left;this.top=top;}});return nodes.get(selector);};
 let pendingPixels=null,pixelFailure=null;
 class Client{
  constructor(){this.ready=Promise.resolve();}
  async infer(pixels){calls.infer.push(pixels);return{faces:[box(40,30,100,100)]};}
  async close(){calls.close++;}
  cancel(){calls.cancel++;}
  dispose(){calls.dispose++;}
 }
 const context={state,$,FaceGeometry:Geometry,byId:id=>photos.find(photo=>photo.id===id),assertCurrent:(generation,signal)=>{if(generation!==state.generation||signal.aborted)throw new DOMException('Cancelled','AbortError');},requestAnimationFrame:callback=>frames.push(callback),DOMException,AbortController,Map,Set,clearTimeout,setTimeout,renderCompare:()=>calls.renders++,renderSimilarity(){},renderFaces(){},invalidateSimilarity(){state.similarity=null;},facePixels:async photo=>{if(pendingPixels)await pendingPixels;if(pixelFailure)throw pixelFailure;return{rgb:new Uint8Array(200*200*3),width:200,height:200,originalWidth:photo.width,originalHeight:photo.height};},window:{FaceWorkerClient:Client,StandaloneAssets:{textAsync:async(id,key)=>key==='model'?'{}':'source',bytesAsync:async()=>new Uint8Array([1,2,3])}}};
 const names=['invalidateFaces','syncFacePair','assertFaceCurrent','scheduleFaceView','findFaces'];
 const handlers=vm.runInNewContext(names.map(uiFunction).join('\n')+'\n({'+names.join(',')+'})',context);
 return{state,photos,$,frames,calls,...handlers,holdPixels(){let release;pendingPixels=new Promise(resolve=>{release=resolve;});return release;},failPixels(error){pixelFailure=error;}};
}
test('pair invalidation cancels only derived work; unchanged pairs preserve selection and face results',()=>{
 const h=faceHarness(),controller=new AbortController();let cancel=0;
 h.state.faceJob={controller,client:{cancel(){cancel++;}}};h.state.faceResults.set('a',{faces:[{}]});h.state.faceSelected=[0,0];h.state.faceWhole=[false,true];
 const beforeFiles=h.photos.map(photo=>photo.file);
 h.syncFacePair();assert.equal(h.state.faceSelected[0],0);assert.equal(cancel,0);
 h.state.pair=['b','a'];h.syncFacePair();assert.equal(cancel,1);assert(controller.signal.aborted);assert.equal(h.state.faceJob,null);assert.equal(h.state.faceResults.size,0);assert.equal(h.state.faceRevision,2);assert.deepEqual(h.photos.map(photo=>photo.file),beforeFiles);
});
test('face async boundary binds generation, input, pair revision, pair IDs and original File identity',()=>{
 const h=faceHarness();const make=()=>({controller:new AbortController(),generation:h.state.generation,input:h.state.inputRevision,revision:h.state.faceRevision,pair:[...h.state.pair],photos:[...h.photos],files:new Map(h.photos.map(p=>[p.id,p.file]))});
 const job=make();h.state.faceJob=job;assert.doesNotThrow(()=>h.assertFaceCurrent(job));
 for(const change of [()=>h.state.generation++,()=>h.state.inputRevision++,()=>h.state.faceRevision++,()=>h.state.pair.reverse(),()=>h.photos[0].file={}]){
  const current=make();h.state.faceJob=current;change();assert.throws(()=>h.assertFaceCurrent(current),error=>error.name==='AbortError');
 }
});
test('late face layout never touches a replacement pair and repeated Keep rendering preserves scroll',()=>{
 const h=faceHarness(),face=Geometry.normalizeFaces([box(40,30,100,100)],200,200)[0];
 h.state.faceResults.set('a',{faces:[face],width:800,height:600});h.state.faceSelected[0]=0;
 h.scheduleFaceView(0);h.state.pair[0]='b';h.frames.shift()();assert.equal(h.$('#imageA').style.width,undefined);
 h.state.pair[0]='a';h.scheduleFaceView(0);h.frames.shift()();assert(h.$('#imageA').style.width.endsWith('px'));
 h.$('#viewportA').left=123;h.scheduleFaceView(0);h.frames.shift()();assert.equal(h.$('#viewportA').left,123);
 h.$('#viewportA').clientWidth=200;h.scheduleFaceView(0);h.frames.shift()();assert.notEqual(h.$('#viewportA').left,123);
});
test('explicit face search commits both current photos atomically and closes resources without changing files',async()=>{
 const h=faceHarness(),before=h.photos.map(photo=>photo.file);assert.equal(h.calls.infer.length,0);
 await h.findFaces();assert.equal(h.calls.infer.length,2);assert.equal(h.state.faceResults.size,2);assert.equal(h.state.faceResults.get('b').height,800);assert.equal(h.state.faceMessage,'faceReady');assert.equal(h.state.faceJob,null);assert.equal(h.calls.close,1);assert.equal(h.calls.dispose,1);assert.deepEqual(h.photos.map(photo=>photo.file),before);
});
test('cancelled decoding cannot start inference or publish stale results; retry succeeds',async()=>{
 const h=faceHarness(),release=h.holdPixels(),search=h.findFaces();
 await new Promise(resolve=>setImmediate(resolve));h.invalidateFaces('faceCancelled');release();await search;
 assert.equal(h.calls.infer.length,0);assert.equal(h.state.faceResults.size,0);assert.equal(h.state.faceMessage,'faceCancelled');assert.equal(h.state.faceJob,null);
 await h.findFaces();assert.equal(h.calls.infer.length,2);assert.equal(h.state.faceResults.size,2);
});
test('decode failure leaves no partial detections and a retryable failure message',async()=>{
 const h=faceHarness();h.failPixels(new Error('invalid image'));await h.findFaces();assert.equal(h.calls.infer.length,0);assert.equal(h.state.faceResults.size,0);assert.equal(h.state.faceMessage,'faceFailed');assert.equal(h.state.faceJob,null);assert.equal(h.calls.dispose,1);
});
