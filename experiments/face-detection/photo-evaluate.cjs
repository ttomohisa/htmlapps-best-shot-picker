/* Explicit local reproduction of the frozen London photo evaluation; never imported by CI or the app. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {performance}=require('node:perf_hooks'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),assetRoot=path.join(root,'.cache/face-detection'),london=path.join(root,'.cache/face-detection-photos/london');
const sha=(b,a='sha256',e='hex')=>crypto.createHash(a).update(b).digest(e);
const pins={
 acceptance:'ac2074ceff2962ac117766bf3d487597fa7a5fababd4f1c6a7c4e552ffa5fc92',
 frontalSample:'a7149304901a97c6b77c6fc1f415dcd23991871eea9a69ab053a1235a0a97f74',
 evaluationSample:'db0aac83623a858a30402f0b6d61a81dc1be4417ec5c4db69116bf06c94d5625',
 runtime:'a1f9e32fd9b373cf394905050cf0c8c66238b34925846c065db00d2a34d1c040',
 wrapper:'fd4d7802308ce764cfb9c5702885fff681537fe6b3f478de7babf12834d6d49f',
 model:'c131145fade749f714d39811f282e973760a69cb9e1a9c22f91e132bd8dcd396',
 weights:'e9b69ee1c1f8cd33c58120bcd75bf8c56bfba20c880f447e9d293ec102059d4b',
 package:'61124203f7e2ffba31197d414d48ef61949440b5b632cd39b8a9a74accf84945',
 packageSha512:'sha512-4Ld/vFF8MrdFdrMWhlLKZD4hMW0PNY9OkYeqoCPNZ+LwFyenxAqVaNaWrR8JKp37vw9Nuzp4ILbkal5zPUnA0g=='
};
const pin=(file,hash)=>{const b=fs.readFileSync(file);if(sha(b)!==hash)throw new Error('Frozen hash mismatch: '+file);return b;};
const readJson=(file,hash)=>JSON.parse(pin(file,hash));
const ensure=(condition,message)=>{if(!condition)throw new Error(message);};
const memory=tf=>{const m=tf.memory();return{numTensors:m.numTensors,numDataBuffers:m.numDataBuffers,numBytes:m.numBytes,unreliable:m.unreliable,reasons:m.reasons};};
const keys=['xMin','yMin','xMax','yMax'];
const finiteBox=b=>b&&keys.every(k=>Number.isFinite(b[k]))&&b.xMax>b.xMin&&b.yMax>b.yMin;
const inside=(b,p)=>p.x>=b.xMin&&p.x<=b.xMax&&p.y>=b.yMin&&p.y<=b.yMax;
const inImage=(b,w,h)=>finiteBox(b)&&b.xMin>=0&&b.yMin>=0&&b.xMax<=w&&b.yMax<=h;
const boxIou=(a,b)=>{
 const intersection=Math.max(0,Math.min(a.xMax,b.xMax)-Math.max(a.xMin,b.xMin))*Math.max(0,Math.min(a.yMax,b.yMax)-Math.max(a.yMin,b.yMin));
 return intersection/((a.xMax-a.xMin)*(a.yMax-a.yMin)+(b.xMax-b.xMin)*(b.yMax-b.yMin)-intersection);
};
const decoder=String.raw`
import sys,json,hashlib,io
from PIL import Image,__version__
b=open(sys.argv[1],'rb').read()
im=Image.open(io.BytesIO(b));im.load()
w,h=im.size;orientation=im.getexif().get(274)
if orientation not in (None,1):raise ValueError('Unreviewed EXIF orientation')
im=im.convert('RGB');scale=min(1.0,1024/max(w,h));nw=max(1,round(w*scale));nh=max(1,round(h*scale))
if (nw,nh)!=(w,h):im=im.resize((nw,nh),Image.Resampling.BILINEAR)
rgb=im.tobytes()
meta={'sourceSha256':hashlib.sha256(b).hexdigest(),'width':w,'height':h,'inputWidth':nw,'inputHeight':nh,'orientation':orientation,'pillowVersion':__version__,'rgbSha256':hashlib.sha256(rgb).hexdigest(),'interpolation':'Pillow RGB conversion, resize BILINEAR, longest edge at most 1024, no EXIF rotation, no color-profile conversion'}
sys.stdout.buffer.write(json.dumps(meta).encode()+bytes([10]));sys.stdout.buffer.write(rgb)
`;
function decode(file,expectedHash){
 const start=performance.now();const result=spawnSync('python',['-c',decoder,file],{maxBuffer:8*1024*1024,timeout:30000});
 if(result.error)throw result.error;if(result.status!==0)throw new Error('Pillow decode failed: '+result.stderr.toString());
 const nl=result.stdout.indexOf(10);ensure(nl>0,'Missing decoder metadata');const metadata=JSON.parse(result.stdout.subarray(0,nl).toString()),rgb=result.stdout.subarray(nl+1);
 ensure(metadata.sourceSha256===expectedHash,'Decoded source hash mismatch');ensure(rgb.length===metadata.inputWidth*metadata.inputHeight*3,'Invalid RGB length');ensure(sha(rgb)===metadata.rgbSha256,'RGB transfer hash mismatch');
 return{metadata,rgb,decodeAndResizeMs:performance.now()-start};
}
function validateFrozenSet(sample,front,labels,{verifyPhotos=true}={}){
 ensure(Array.isArray(sample)&&sample.length===24,'Expected 24 fixed evaluation images');ensure(Array.isArray(front)&&front.length===12,'Expected 12 fixed frontal images');
 ensure(new Set(sample.map(r=>r.file)).size===24,'Duplicate source file');ensure(Array.isArray(labels)&&labels.length===24,'All 24 frozen labels are required before any inference');
 ensure(new Set(labels.map(r=>r.file)).size===24,'Duplicate annotation file');
 const frontal=sample.filter(r=>r.pose==='frontal');ensure(JSON.stringify(frontal.map(r=>r.file))===JSON.stringify(front),'Frontal selection/order changed');
 ensure(new Set(frontal.map(r=>r.subject)).size===12,'Frontal subjects not independent');
 const stress=frontal.filter((_,i)=>i%2===0).map(r=>r.subject).sort();
 for(const pose of ['three-quarter','profile']){const rows=sample.filter(r=>r.pose===pose);ensure(rows.length===6,'Expected six '+pose+' rows');ensure(JSON.stringify(rows.map(r=>r.subject).sort())===JSON.stringify(stress),'Pose sample subject selection changed');}
 const byFile=new Map(labels.map(row=>[row.file,row]));
 for(const item of sample){
  ensure(/^(neutral_front|neutral_left_3quarter|neutral_left_profile)\/[0-9]{3}_[0-9]{2}\.jpg$/.test(item.file),'Unexpected source path');ensure(/^[a-f0-9]{64}$/.test(item.sha256),'Missing source hash');
  const label=byFile.get(item.file);ensure(label,'Missing annotation: '+item.file);ensure(label.width===1350&&label.height===1350,'Unexpected original annotation dimensions');
  ensure(inImage(label.box,label.width,label.height),'Invalid manual box: '+item.file);if(item.pose==='frontal')ensure(Array.isArray(label.eyeCenters)&&label.eyeCenters.length===2,'Frontal gate needs two creator eye-center labels');
  else ensure(label.eyeCenters===null||(Array.isArray(label.eyeCenters)&&label.eyeCenters.length===2),'Pose eye labels must be two real points or null');
  if(label.eyeCenters)ensure(label.eyeCenters.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=label.width&&p.y>=0&&p.y<=label.height),'Invalid eye-center label');
  if(verifyPhotos)pin(path.join(london,item.file),item.sha256);
 }
 return byFile;
}
function summary(rows){return{images:rows.length,independentSubjects:new Set(rows.map(r=>r.subject)).size,usefulCropAssessedImages:rows.filter(r=>r.usefulCrop!==null).length,usefulCropImages:rows.filter(r=>r.usefulCrop===true).length,unassessedUsefulCropImages:rows.filter(r=>r.usefulCrop===null).length,exploratoryBoxMatchImages:rows.filter(r=>r.exploratoryBoxMatch).length,
 missedUsefulCropFiles:rows.filter(r=>r.usefulCrop===false).map(r=>r.file),missedExploratoryBoxMatchFiles:rows.filter(r=>!r.exploratoryBoxMatch).map(r=>r.file),zeroCandidateImages:rows.filter(r=>r.rawFaceCount===0).length,
 unwantedCandidateCount:rows.reduce((n,r)=>n+Math.max(0,r.rawFaceCount-1),0),imagesWithExtraCandidates:rows.filter(r=>r.rawFaceCount>1).map(r=>r.file),
 rejectedInvalidCandidateCount:rows.reduce((n,r)=>n+r.candidates.filter(c=>!c.validBox).length,0)};}
const frozenLabelHash='29452e00fda41ced48018b28e4ae33ab40bae38799c7c2e015a9ca01a09175d2';
const originalResultHash='865d653aaca93552f5caf87db79c3235b85d2c8e84149e6e98c4cd431280425e';
function readFrozenInputs({verifyPhotos=false}={}){
 const acceptance=pin(path.join(__dirname,'photo-acceptance.md'),pins.acceptance);
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'photo-sample.json'),'utf8'));
 const front=manifest.selection.frontalFiles,sample=manifest.selection.images;
 ensure(sha(Buffer.from(JSON.stringify(front,null,2)))===pins.frontalSample,'Original frontal array changed');
 ensure(sha(Buffer.from(JSON.stringify(sample,null,2)))===pins.evaluationSample,'Original evaluation array changed');
 const labels=readJson(path.join(__dirname,'photo-boxes.json'),frozenLabelHash);
 const retained=readJson(path.join(__dirname,'photo-results.json'),originalResultHash);
 const byFile=validateFrozenSet(sample,front,labels,{verifyPhotos});
 ensure(retained.frozen.labelsSha256===frozenLabelHash&&retained.frozen.acceptanceSha256===pins.acceptance,'Original result provenance mismatch');
 ensure(retained.rows.length===24&&retained.rows.every((row,i)=>row.file===sample[i].file&&row.sha256===sample[i].sha256),'Retained image results changed');
 return{acceptance,manifest,front,sample,labels,byFile,retained};
}
async function main(){
 const dry=process.argv.includes('--dry-run'),run=process.argv.includes('--run-frozen-evaluation');
 ensure(dry!==run,'Choose --dry-run (no image/model reads or inference) or explicit --run-frozen-evaluation.');
 const requestedLabelHash=process.argv.find(s=>s.startsWith('--labels-sha256='))?.split('=')[1];
 ensure(!requestedLabelHash||requestedLabelHash===frozenLabelHash,'Only the original frozen label hash is accepted.');
 const {acceptance,manifest,front,sample,labels,byFile,retained}=readFrozenInputs({verifyPhotos:run});
 const labelHash=frozenLabelHash;
 if(dry){
  console.log(JSON.stringify({status:'dry-run-only',network:false,writes:false,inference:false,photosRead:false,modelLoaded:false,
   frozenImages:sample.length,frontalSubjects:new Set(sample.filter(r=>r.pose==='frontal').map(r=>r.subject)).size,
   acceptanceSha256:pins.acceptance,labelsSha256:labelHash,retainedResultSha256:originalResultHash,
   retainedFrontalUsefulCrops:retained.byPose.frontal.usefulCropImages,
   requiredModelCache:'.cache/face-detection',requiredPhotoCache:'.cache/face-detection-photos/london',
   reproductionOutput:'test-results/face-research/photo-reproduction-results.json'},null,2));return;
 }
 const runtime=pin(path.join(assetRoot,'runtime.js'),pins.runtime),wrapper=pin(path.join(assetRoot,'detector.js'),pins.wrapper);
 const model=pin(path.join(assetRoot,'short/model.json'),pins.model),weights=pin(path.join(assetRoot,'short/group1-shard1of1.bin'),pins.weights),pkg=pin(path.join(assetRoot,'face-detection-1.0.3.tgz'),pins.package);
 ensure('sha512-'+sha(pkg,'sha512','base64')===pins.packageSha512,'Official npm integrity mismatch');
 const report={observedAtUtc:new Date().toISOString(),node:process.version,status:'running',scope:'Fixed London Set v5 adult consented-photo sample, local CPU research only. No broad accuracy or human-expert ground-truth claim.',
  license:'CC BY 4.0, creator consent metadata verified by parent. No image pixels included in report or public artifacts.',
  reproduction:{retainedOriginalResultSha256:originalResultHash,pathMapping:manifest.historicalRun.pathMapping,retainedOriginalResultOverwritten:false},
  frozen:{acceptanceSha256:sha(acceptance),frontalSampleSha256:pins.frontalSample,evaluationSampleSha256:pins.evaluationSample,labelsSha256:labelHash,modelPins:pins},
  candidate:{modelType:'short',runtime:'tfjs',backend:'cpu',maxFaces:6,scoreThreshold:0.5,nmsThreshold:0.3,flipHorizontal:false,longestInputEdge:1024},
  criterion:{frontalRequiredUseful:11,frontalImages:12,boxIouMinimum:0.5,bothCreatorEyeCentersRequiredForFrontal:true,poseCriterion:'Exploratory box IoU only where creator eye labels are unavailable; no guessed eye points.',extraCandidates:'Reported as unwanted. No threshold tuning or candidate/model substitution.',invalidBoxes:'Rejected before useful-crop scoring; no clamping hides raw invalid geometry.'},
  interpretation:{independentSubjects:12,totalPhotographs:24,poseSubjects:6,poseRows:'Exploratory stress photographs of repeated frontal subjects, not independent sample additions.',annotations:'Blinded assistant visual boxes and creator eye-center landmarks, not human-expert ground truth.',preprocessing:'Pillow RGB/BILINEAR is not verified browser canvas parity.',timing:'Node VM CPU only; not browser or phone speed.',memory:'TFJS logical live tensors after input disposal; not peak or process/native memory.',overallAdoptionApproved:false},rows:[]};
 const attempts=[],deny=(kind,url)=>{attempts.push({kind,url:String(url)});throw new Error('Network disabled: '+kind);};
 const ctx=vm.createContext({console:{log(){},warn(){},error(){}},performance,setTimeout,clearTimeout,TextEncoder,TextDecoder,atob,btoa,WorkerGlobalScope:class{},
  fetch:url=>Promise.reject((()=>{try{deny('fetch',url);}catch(e){return e;}})()),XMLHttpRequest:class{open(method,url){deny('XHR',url);}},WebSocket:class{constructor(url){deny('WebSocket',url);}},importScripts:()=>deny('importScripts',''),
  jsonText:model.toString(),weight64:weights.toString('base64'),decode64:s=>Uint8Array.from(Buffer.from(s,'base64'))},{codeGeneration:{strings:false,wasm:false}});ctx.self=ctx;
 try{
  new vm.Script(';(function(WebAssembly){'+runtime.toString()+'\n}).call(self,undefined);').runInContext(ctx,{timeout:10000});new vm.Script(wrapper.toString()).runInContext(ctx,{timeout:10000});
  await new vm.Script(`(async()=>{if(!await tf.setBackend('cpu'))throw new Error('CPU backend unavailable');await tf.ready();globalThis.baseline=tf.memory();const start=performance.now(),json=JSON.parse(jsonText),w=Uint8Array.from(decode64(weight64));globalThis.detector=await faceDetection.createDetector(faceDetection.SupportedModels.MediaPipeFaceDetector,{runtime:'tfjs',modelType:'short',maxFaces:6,detectorModelUrl:tf.io.fromMemory({modelTopology:json.modelTopology,weightSpecs:json.weightsManifest.flatMap(g=>g.weights),weightData:w.buffer})});globalThis.initializationMs=performance.now()-start;})()`).runInContext(ctx,{timeout:10000});
  report.actualBackend=ctx.tf.getBackend();report.baselineMemory=JSON.parse(JSON.stringify(ctx.baseline));report.loadedMemory=memory(ctx.tf);report.initializationMs=ctx.initializationMs;
  for(const item of sample){
   const decoded=decode(path.join(london,item.file),item.sha256),meta=decoded.metadata,label=byFile.get(item.file);ensure(meta.width===label.width&&meta.height===label.height,'Annotation/image dimensions disagree');
   ctx.inputRgb=decoded.rgb;ctx.inputWidth=meta.inputWidth;ctx.inputHeight=meta.inputHeight;
   const result=await new vm.Script(`(async()=>{const input=tf.tensor3d(Uint8Array.from(inputRgb),[inputHeight,inputWidth,3],'int32'),start=performance.now();let faces;try{faces=await detector.estimateFaces(input,{flipHorizontal:false});}finally{input.dispose();}return{faces,inferenceMs:performance.now()-start,memory:tf.memory()};})()`).runInContext(ctx,{timeout:20000});
   ctx.inputRgb=null;ensure(Array.isArray(result.faces)&&result.faces.length<=6,'Invalid detector result cardinality');
   const sx=meta.width/meta.inputWidth,sy=meta.height/meta.inputHeight;
   const candidates=result.faces.map((face,index)=>{
    const raw=face.box,box={xMin:raw.xMin*sx,yMin:raw.yMin*sy,xMax:raw.xMax*sx,yMax:raw.yMax*sy},validBox=inImage(box,meta.width,meta.height);
    const iou=validBox?boxIou(box,label.box):null,eyesInside=label.eyeCenters?(validBox?label.eyeCenters.map(p=>inside(box,p)):[false,false]):null;
    return{index,rawInputBox:raw,originalBox:box,validBox,boxIou:iou,creatorEyesInside:eyesInside,iouPass:validBox&&iou>=0.5,usefulCrop:eyesInside===null?null:validBox&&iou>=0.5&&eyesInside.every(Boolean),
     originalKeypoints:face.keypoints.map(p=>({...p,x:p.x*sx,y:p.y*sy})),invalidReason:validBox?null:'Non-finite, nonpositive, or outside original image bounds'};
   });
   const row={...item,...meta,decodeAndResizeMs:decoded.decodeAndResizeMs,inferenceMs:result.inferenceMs,rawFaceCount:result.faces.length,
    usefulCrop:label.eyeCenters?candidates.some(c=>c.usefulCrop):null,exploratoryBoxMatch:candidates.some(c=>c.iouPass),eyeCriterionEvaluated:Boolean(label.eyeCenters),candidates,annotation:label,memory:JSON.parse(JSON.stringify(result.memory))};
   report.rows.push(row);console.log(JSON.stringify({file:row.file,subject:row.subject,pose:row.pose,faces:row.rawFaceCount,usefulCrop:row.usefulCrop,ious:candidates.map(c=>c.boxIou),eyes:candidates.map(c=>c.creatorEyesInside),inferenceMs:row.inferenceMs}));
  }
  report.byPose=Object.fromEntries(['frontal','three-quarter','profile'].map(pose=>[pose,summary(report.rows.filter(r=>r.pose===pose))]));
  report.bySubject=front.map(file=>{const subject=sample.find(r=>r.file===file).subject;return{subject,poses:report.rows.filter(r=>r.subject===subject).map(r=>({pose:r.pose,file:r.file,usefulCrop:r.usefulCrop,exploratoryBoxMatch:r.exploratoryBoxMatch,eyeCriterionEvaluated:r.eyeCriterionEvaluated,rawFaceCount:r.rawFaceCount}))};});
  report.frontalUsabilityCriterionMet=report.byPose.frontal.usefulCropImages>=11;
  report.tensorCountsStable=report.rows.every(r=>r.memory.numTensors===report.loadedMemory.numTensors&&r.memory.numBytes===report.loadedMemory.numBytes);
  report.status='evaluation-completed';
 }catch(error){report.status='evaluation-failed';report.error={message:error.message,stack:error.stack};process.exitCode=1;}
 finally{
  ctx.detector?.dispose();if(ctx.tf)report.afterDispose=memory(ctx.tf);report.networkAttempts=attempts;
  report.technicalLifecyclePassed=report.status==='evaluation-completed'&&report.tensorCountsStable&&report.afterDispose.numTensors===report.baselineMemory.numTensors&&report.afterDispose.numBytes===report.baselineMemory.numBytes&&attempts.length===0;
  const outputDirectory=path.join(root,'test-results/face-research');fs.mkdirSync(outputDirectory,{recursive:true});
  fs.writeFileSync(path.join(outputDirectory,'photo-reproduction-results.json'),JSON.stringify(report,null,2)+'\n');
 }
 console.log(JSON.stringify({status:report.status,byPose:report.byPose,frontalUsabilityCriterionMet:report.frontalUsabilityCriterionMet,technicalLifecyclePassed:report.technicalLifecyclePassed,overallAdoptionApproved:false},null,2));
 if(report.status!=='evaluation-completed'||!report.technicalLifecyclePassed||!report.frontalUsabilityCriterionMet)process.exitCode=1;
}
if(require.main===module)main().catch(error=>{console.error(error.stack);process.exitCode=1;});
module.exports={boxIou,inImage,inside,validateFrozenSet,summary,readFrozenInputs,pins};
