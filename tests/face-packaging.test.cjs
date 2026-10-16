'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),os=require('node:os');
const {spawnSync}=require('node:child_process'),root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file)),json=file=>JSON.parse(read(file));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
test('product face assets retain short-only reviewed byte pins and reuse the single TFJS runtime',()=>{
 const file='assets/face-detection/manifest.json';assert(fs.existsSync(path.join(root,file)),'face asset manifest must exist');
 const m=json(file),probe=json('experiments/face-detection/dependencies.json'),embedding=json('assets/embedding/manifest.json');
 assert.equal(m.schemaVersion,1);assert.equal(m.id,'face-detection');assert.equal(m.modelType,'short');assert.equal(m.package.version,'1.0.3');assert.equal(m.package.sha256,probe.package.sha256);assert.deepEqual(m.runtime,embedding.runtime);
 assert.deepEqual(m.assets.map(a=>a.key).sort(),['detector','license','model','notices','weights']);
 assert.equal(m.assets.find(a=>a.key==='detector').sha256,probe.package.assetSha256);
 for(const key of ['model','weights']){const source=probe.models.short.assets.find(a=>a.path.endsWith(key==='model'?'model.json':'group1-shard1of1.bin')),asset=m.assets.find(a=>a.key===key);assert.equal(asset.bytes,source.bytes);assert.equal(asset.sha256,source.sha256);}
 for(const a of m.assets){assert(!a.path.includes('..'));const bytes=read('assets/face-detection/'+a.path);assert.equal(bytes.length,a.bytes,a.key);assert.equal(sha(bytes),a.sha256,a.key);assert.equal(a.compression,'gzip');}
 assert.deepEqual(json('assets/face-detection/model.json').weightsManifest.map(g=>g.paths),[['group1-shard1of1.bin']]);
 assert.equal(json('dependencies.json').dependencies.filter(d=>d.package==='@tensorflow/tfjs').length,1);
 assert.match(read('assets/face-detection/detector.min.js').toString(),/Copyright 2024 Google LLC/);
 assert.match(read('assets/face-detection/THIRD_PARTY_NOTICES.txt').toString(),/Microsoft Corporation/);
});
test('builder reads bounded face manifest and counted sources without research or network loader coupling',()=>{
 const source=read('build-standalone.ps1').toString();assert.match(source,/assets\/face-detection\/manifest\.json/);assert.match(source,/src\/face-worker\.js/);
 for(const placeholder of ['__BEST_SHOT_FACE_CLIENT_JS__','__BEST_SHOT_FACE_GEOMETRY_JS__'])assert.equal(source.split('"'+placeholder+'"').length-1,2);
 assert(!/experiments[\\/]face-detection/.test(source));assert(!/[^\x00-\x7f]/.test(source));assert(!/(^|[^\r])\n/.test(source),'canonical PowerShell source stays CRLF');
 const worker=read('src/face-worker.js').toString();assert.match(worker,/modelType:'short'/);assert.match(worker,/maxFaces:6/);assert.match(worker,/tf\.io\.fromMemory/);assert(!/probeFailure|Injected execute|modelType:m\./.test(worker));
});
test('canonical build embeds exact face assets once and rejects damaged or missing local bytes',{skip:process.env.BSP_PACKAGING_BUILD_TESTS!=='1',timeout:240000},()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'bsp-face-packaging-'));
 try{
  for(const name of ['src','scripts','assets','app.config.json','dependencies.json','dependencies.lock.json','build-standalone.ps1'])fs.cpSync(path.join(root,name),path.join(temp,name),{recursive:true});
  const archive=['.cache/-tensorflow-tfjs-4.22.0/package.tgz','.cache/embedding-tfjs/tfjs-4.22.0.tgz'].map(p=>path.join(root,p)).find(p=>fs.existsSync(p));assert(archive);
  const cache=path.join(temp,'.cache/-tensorflow-tfjs-4.22.0');fs.mkdirSync(cache,{recursive:true});fs.copyFileSync(archive,path.join(cache,'package.tgz'));
  const run=(file,...args)=>spawnSync(process.env.PWSH||'pwsh',['-NoLogo','-NoProfile','-File',path.join(temp,file),...args],{cwd:temp,encoding:'utf8',timeout:60000});
  const preflight=run('scripts/check-powershell-syntax.ps1');assert.equal(preflight.status,0,preflight.stdout+preflight.stderr);
  let built=run('build-standalone.ps1');assert.equal(built.status,0,built.stdout+built.stderr);
  const html=fs.readFileSync(path.join(temp,'dist/index.html'),'utf8'),bundle=JSON.parse(html.match(/const assetBundle = (.+);/)[1]);
  const decode=(id,key)=>{const a=bundle.dependencies[id].assets[key];assert.equal(a.compression,'gzip');return zlib.gunzipSync(Buffer.from(a.base64,'base64'));};
  const manifest=json('assets/face-detection/manifest.json');for(const asset of manifest.assets)assert.equal(sha(decode('face-detection',asset.key)),asset.sha256);
  assert.deepEqual(decode('face-detection','worker'),read('src/face-worker.js'));assert.equal(sha(decode('tfjs','runtime')),manifest.runtime.sha256);
  assert.equal(Object.values(bundle.dependencies).filter(d=>d.package==='@tensorflow/tfjs').length,1);assert.deepEqual(fs.readFileSync(path.join(temp,'best-shot-picker.html')),Buffer.from(html));
  const detector=path.join(temp,'assets/face-detection/detector.min.js');fs.appendFileSync(detector,'\n/*changed*/');built=run('build-standalone.ps1');assert.notEqual(built.status,0);assert.match(built.stdout+built.stderr,/Face asset SHA-256 mismatch/);
  fs.copyFileSync(path.join(root,'assets/face-detection/detector.min.js'),detector);fs.rmSync(path.join(temp,'assets/face-detection/model.json'));built=run('build-standalone.ps1');assert.notEqual(built.status,0);assert.match(built.stdout+built.stderr,/asset not found/i);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
