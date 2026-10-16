/* Isolated external holdout. No production build imports this file. */
const fs=require('node:fs/promises'),path=require('node:path'),zlib=require('node:zlib');
const {spawnSync}=require('node:child_process');
const {verify,sha}=require('./build.cjs');
const manifest=require('./tfjs.dependencies.json');
const {FROZEN_PROTOCOL}=require('./evaluate.js');
const root=path.resolve(__dirname,'../..'),cache=path.join(root,'.cache/embedding-tfjs');
const out=path.join(root,'test-results/embedding-burst');
async function pinned(url,name,hash,size){
 const file=path.join(cache,name);let bytes;
 try{bytes=await fs.readFile(file);}catch(e){
  if(e.code!=='ENOENT')throw e;
  const response=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw new Error('Download failed: '+response.status);
  bytes=Buffer.from(await response.arrayBuffer());verify(bytes,hash,name);
  if(bytes.length!==size)throw new Error('Unexpected byte length: '+name);await fs.writeFile(file,bytes);
 }
 verify(bytes,hash,name);if(bytes.length!==size)throw new Error('Unexpected byte length: '+name);return bytes;
}
async function build(){
 await fs.mkdir(cache,{recursive:true});await fs.mkdir(out,{recursive:true});
 const photos=require('./burst-holdout.json');
 await pinned(manifest.runtime.url,'tfjs-4.22.0.tgz',manifest.runtime.sha256,manifest.runtime.bytes);
 await pinned(manifest.model.url,'mobilenet-v1-025-v2.tar.gz',manifest.model.sha256,manifest.model.bytes);
 for(const [file,names] of [['tfjs-4.22.0.tgz',[manifest.runtime.asset]],['mobilenet-v1-025-v2.tar.gz',['model.json','group1-shard1of1.bin']]]){
  const result=spawnSync('tar',['-xzf',path.join(cache,file),'-C',cache,...names],{encoding:'utf8'});if(result.status!==0)throw new Error(result.stderr||'Extraction failed');
 }
 const assets={};
 for(const [key,name,hash] of [['runtime',manifest.runtime.asset,manifest.runtime.assetSha256],['modelJson','model.json',manifest.model.jsonSha256],['weights','group1-shard1of1.bin',manifest.model.weightsSha256]])assets[key]=zlib.gzipSync(verify(await fs.readFile(path.join(cache,name)),hash,key)).toString('base64');
 const fixtures=[];
 for(const item of photos.images){
  const bytes=verify(await fs.readFile(path.join(root,'.cache/embedding-burst',item.id+'.png')),item.sha256,item.id);
  if(bytes.length!==item.bytes)throw new Error('Unexpected rendered fixture bytes');fixtures.push({...item,base64:bytes.toString('base64')});
 }
 const sources=await Promise.all(['src/grouping.js','experiments/embedding/evaluate.js','experiments/embedding/burst-runner.js'].map(name=>fs.readFile(path.join(root,name),'utf8')));
 if(sources.some(s=>/<\/script/i.test(s)))throw new Error('Closing script tag in source');
 const runtimeLicense=verify(await fs.readFile(path.join(__dirname,'LICENSE.TensorFlow.js.txt')),manifest.licenseText.sha256,'runtime license');
 const notices=runtimeLicense+'\n'+await fs.readFile(path.join(__dirname,'THIRD_PARTY.TFJS.txt'),'utf8');
 const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 const favicon=(await fs.readFile(path.join(root,'assets/favicon.svg'))).toString('base64');
 const data=JSON.stringify({assets,fixtures,manifest,protocol:FROZEN_PROTOCOL,provenance:photos}).replace(/</g,'\\u003c');
 const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'"><link rel="icon" href="data:image/svg+xml;base64,${favicon}"><title>Frozen external burst evaluation</title><style>body{font:16px system-ui;max-width:900px;margin:2rem auto;padding:0 1rem}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body><h1>Frozen external burst evaluation</h1><p>No production model. No physical-device claim.</p><p>${escape(photos.attribution)} Derived preview images: ${escape(photos.license)} (${escape(photos.licenseUrl)}). Source: ${escape(photos.source)}. ${escape(photos.rendering.description)}</p><p id="progress">Preparing offline data</p><pre id="result">Running…</pre><details><summary>Runtime notices</summary><pre>${escape(notices)}</pre></details><script id="experiment-data" type="application/json">${data}</script>${sources.map(s=>'<script>'+s+'</script>').join('')}</body></html>`;
 await fs.writeFile(path.join(out,'index.html'),html);
 const report={photos:fixtures.length,bytes:Buffer.byteLength(html),sha256:sha(Buffer.from(html)),productionModelIncluded:false};
 await fs.writeFile(path.join(out,'build-report.json'),JSON.stringify(report,null,2)+'\n');console.log(report);
}
module.exports={build,pinned};if(require.main===module)build().catch(e=>{console.error(e);process.exitCode=1;});
