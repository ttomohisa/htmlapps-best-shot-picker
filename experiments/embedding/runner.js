/* Version-pinned internal adapter, deliberately isolated from the production app. */
(async()=>{
 'use strict';
 const data=JSON.parse(document.querySelector('#experiment-data').textContent),started=performance.now(),attempts=[],violations=[];
 const report={kind:'synthetic-offline-feasibility-only',realPhotoAccuracy:'NOT MEASURED',adoption:'NOT APPROVED',productionModelIncluded:false,runtime:data.manifest.runtime.version,model:data.manifest.model.version,mode:location.hash.includes('scalar')?'scalar':'simd',fixtureProvenance:'Project-authored synthetic landscapes and textures',attempts,violations};
 window.embeddingExperiment={done:false,report};
 document.addEventListener('securitypolicyviolation',event=>violations.push({directive:event.effectiveDirective,blocked:event.blockedURI}));
 // Even attempted telemetry is a failure; never permit it to leave this test page.
 const deny=(kind,url)=>{attempts.push({kind,url:String(url)});throw new Error('Network disabled by offline experiment');};
 window.fetch=url=>Promise.reject((()=>{try{deny('fetch',url);}catch(e){return e;}})());
 XMLHttpRequest.prototype.open=function(method,url){deny('XHR',url);};
 navigator.sendBeacon=url=>deny('beacon',url);window.WebSocket=function(url){deny('WebSocket',url);};
 async function unpack(key){const compressed=Uint8Array.from(atob(data.assets[key]),c=>c.charCodeAt(0));return new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());}
 async function image(name){const fixture=data.fixtures[name],img=new Image();img.src=`data:${fixture.mime};base64,${fixture.base64}`;await img.decode();return img;}
 function feature(img){const canvas=document.createElement('canvas');canvas.width=9;canvas.height=8;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,9,8);const result=BestShotGrouping.features(ctx.getImageData(0,0,9,8).data,9,8,img.naturalWidth/img.naturalHeight);canvas.width=canvas.height=0;return result;}
 const samples=[];for(const name of Object.keys(data.fixtures)){const img=await image(name);samples.push({id:name,img,features:feature(img),captureTime:{valueMs:0,domain:'wall'}});}
 report.baselineGroups=(await BestShotGrouping.groupPhotos(samples)).map(group=>group.ids);
 let embedder;report.phase='loading-embedded-assets';
 try{
  const moduleUrl=URL.createObjectURL(new Blob([await unpack('module')],{type:'text/javascript'}));let vision;try{vision=await import(moduleUrl);}finally{URL.revokeObjectURL(moduleUrl);}
  const useScalar=report.mode==='scalar'||!await vision.FilesetResolver.isSimdSupported();report.backend=useScalar?'scalar':'simd';
  const loader=document.createElement('script');loader.textContent=new TextDecoder().decode(await unpack(useScalar?'scalarLoader':'simdLoader'));document.head.append(loader);loader.remove();
  const wasm=await unpack(useScalar?'scalarWasm':'simdWasm');self.Module={wasmBinary:wasm};
  report.phase='initializing-model';report.injectedFault=location.hash.includes('broken')?'invalid-model':null;const init=performance.now();embedder=await vision.ImageEmbedder.createFromOptions({wasmLoaderPath:'',wasmBinaryPath:'embedded.wasm'},{baseOptions:{modelAssetBuffer:location.hash.includes('broken')?new Uint8Array([0]):await unpack('model'),delegate:'CPU'},runningMode:'IMAGE',l2Normalize:true,quantize:false});
  report.initializationMs=performance.now()-init;report.phase='embedding';report.embeddings=[];const timings=[];
  for(const sample of samples){const run=performance.now(),result=embedder.embed(sample.img).embeddings[0];const vector=result.floatEmbedding;if(vector.length!==1024||!vector.every(Number.isFinite))throw new Error('Invalid embedding');timings.push(performance.now()-run);report.embeddings.push({id:sample.id,dimensions:vector.length});sample.embedding=result;}
  report.pairs=[];for(let i=0;i<samples.length;i++)for(let j=i+1;j<samples.length;j++)report.pairs.push({a:samples[i].id,b:samples[j].id,baseline:BestShotGrouping.pairDecision(samples[i],samples[j]),cosine:vision.ImageEmbedder.cosineSimilarity(samples[i].embedding,samples[j].embedding)});
  const same=vision.ImageEmbedder.cosineSimilarity(samples[0].embedding,samples[0].embedding);if(Math.abs(same-1)>1e-5)throw new Error('Self similarity mismatch');report.selfSimilarity=same;
  const warm=[];for(let i=0;i<10;i++){const start=performance.now();embedder.embed(samples[i%samples.length].img);warm.push(performance.now()-start);await new Promise(resolve=>setTimeout(resolve,0));}warm.sort((a,b)=>a-b);report.firstInferenceMs=timings;report.warmP50Ms=warm[4];report.warmP95Ms=warm[9];report.status='inference-completed';report.phase='complete';
 }catch(error){report.status='model-unavailable';report.error={name:error.name,message:error.message};}
 finally{try{embedder?.close();}catch(error){report.closeError=error.message;}self.Module=self.ModuleFactory=undefined;}
 // A failed model never changes the deterministic fallback partition.
 report.fallbackGroups=(await BestShotGrouping.groupPhotos(samples)).map(group=>group.ids);
 report.fallbackPreserved=JSON.stringify(report.fallbackGroups)===JSON.stringify(report.baselineGroups);
 for(const sample of samples)sample.img.removeAttribute('src');report.totalMs=performance.now()-started;
 window.embeddingExperiment.done=true;document.querySelector('#result').textContent=JSON.stringify(report,null,2);
})().catch(error=>{window.embeddingExperiment={done:true,report:{status:'harness-error',error:{name:error.name,message:error.message}}};document.querySelector('#result').textContent=error.stack;});
