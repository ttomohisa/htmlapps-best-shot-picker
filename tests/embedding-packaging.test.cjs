const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file));
const json=file=>JSON.parse(read(file));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const manifestPath='assets/embedding/manifest.json';

test('approved product runtime uses the canonical exact npm lock',()=>{
 const approved=json('experiments/embedding/tfjs.dependencies.json'),deps=json('dependencies.json').dependencies,lock=json('dependencies.lock.json').dependencies;
 const runtime=deps.find(d=>d.id==='tfjs');assert(runtime,'approved TFJS dependency must be declared');
 assert.equal(runtime.package,approved.runtime.package);assert.equal(runtime.version,approved.runtime.version);
 assert.equal(runtime.license,'Apache-2.0');assert.equal(runtime.updates.policy,'manual');
 assert.deepEqual(runtime.assets,[{key:'runtime',path:'dist/tf.es2017.min.js',mime:'text/javascript',compression:'gzip'}]);
 assert.equal(lock.find(d=>d.id==='tfjs').tarballSha256,approved.runtime.sha256);
});
test('checked-in model and notices match reviewed SHA-256 declarations',()=>{
 assert(fs.existsSync(path.join(root,manifestPath)),'model asset manifest must exist');
 const m=json(manifestPath),approved=json('experiments/embedding/tfjs.dependencies.json');
 assert.equal(m.schemaVersion,1);assert.equal(m.id,'mobilenet-v1');assert.equal(m.version,'2');assert.equal(m.license,'Apache-2.0');
 assert.equal(m.runtime.sha256,approved.runtime.assetSha256);assert.equal(m.runtime.bytes,approved.runtime.assetBytes);
 assert.equal(m.assets.find(a=>a.key==='model').sha256,approved.model.jsonSha256);
 assert.equal(m.assets.find(a=>a.key==='weights').sha256,approved.model.weightsSha256);
 assert.equal(m.assets.find(a=>a.key==='weights').bytes,841360);
 assert.deepEqual(m.assets.map(a=>a.key).sort(),['license','model','notices','weights']);
 for(const a of m.assets){const bytes=read('assets/embedding/'+a.path);assert.equal(bytes.length,a.bytes,a.key);assert.equal(sha(bytes),a.sha256,a.key);assert.equal(a.compression,'gzip');assert(!a.path.includes('..'));}
 const model=JSON.parse(read('assets/embedding/model.json'));
 assert.deepEqual(model.weightsManifest.map(g=>g.paths),[['group1-shard1of1.bin']]);
});
test('builder embeds worker as data and includes counted client/similarity placeholders',()=>{
 const b=read('build-standalone.ps1').toString();
 assert(b.includes('assets/embedding/manifest.json'),'builder must consume exact local declarations');
 assert(b.includes('src/embedding-worker.js'));assert(b.includes('embedding-worker'));
 for(const placeholder of ['__BEST_SHOT_SIMILARITY_JS__','__BEST_SHOT_EMBEDDING_CLIENT_JS__'])assert(b.includes(placeholder));
 assert(!/experiments[\\/]embedding/.test(b));assert(!/[^\x00-\x7f]/.test(b),'PowerShell remains ASCII-only');
 const worker=read('src/embedding-worker.js').toString();assert(worker.includes("tf.setBackend('cpu')"));assert(worker.includes('tf.io.fromMemory'));
 assert(!/loadGraphModel\s*\(\s*['"]https?:|importScripts\s*\(\s*['"]https?:/.test(worker));
});

test('canonical build embeds exact lazy assets and refuses corrupted or absent local bytes',{skip:process.env.BSP_PACKAGING_BUILD_TESTS!=='1',timeout:240000},()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'bsp-packaging-'));
 try{
  for(const name of ['src','scripts','assets','app.config.json','dependencies.json','dependencies.lock.json','build-standalone.ps1'])fs.cpSync(path.join(root,name),path.join(temp,name),{recursive:true});
  const archiveCandidates=['.cache/-tensorflow-tfjs-4.22.0/package.tgz','.cache/embedding-tfjs/tfjs-4.22.0.tgz'];
  const archive=archiveCandidates.map(p=>path.join(root,p)).find(p=>fs.existsSync(p));assert(archive,'first cache the reviewed npm tarball for offline packaging tests');
  const cached=path.join(temp,'.cache/-tensorflow-tfjs-4.22.0');fs.mkdirSync(cached,{recursive:true});fs.copyFileSync(archive,path.join(cached,'package.tgz'));
  function run(file,...args){return spawnSync(process.env.PWSH||'pwsh',['-NoLogo','-NoProfile','-File',path.join(temp,file),...args],{cwd:temp,encoding:'utf8',timeout:60000});}
  const preflight=run('scripts/check-powershell-syntax.ps1');assert.equal(preflight.status,0,preflight.stdout+preflight.stderr);
  const built=run('build-standalone.ps1');assert.equal(built.status,0,built.stdout+built.stderr);
  const html=fs.readFileSync(path.join(temp,'dist/index.html'),'utf8');
  const match=html.match(/const assetBundle = (.+);/);assert(match,'embedded bundle exists');
  const bundle=JSON.parse(match[1]);
  const decode=(id,key)=>{const a=bundle.dependencies[id].assets[key];assert.equal(a.compression,'gzip');const bytes=zlib.gunzipSync(Buffer.from(a.base64,'base64'));assert.equal(bytes.length,a.originalBytes);return bytes;};
  const m=json(manifestPath);assert.equal(sha(decode('tfjs','runtime')),m.runtime.sha256);
  for(const a of m.assets)assert.equal(sha(decode('mobilenet-v1',a.key)),a.sha256);
  assert.equal(sha(decode('embedding-worker','worker')),sha(read('src/embedding-worker.js')));
  assert.equal(fs.readFileSync(path.join(temp,'best-shot-picker.html'),'utf8'),html);
  assert(fs.statSync(path.join(temp,'dist/index.self-extract.html')).size>0);
  const original=fs.readFileSync(path.join(temp,'assets/embedding/group1-shard1of1.bin'));
  const corrupted=Buffer.from(original);corrupted[0]^=1;fs.writeFileSync(path.join(temp,'assets/embedding/group1-shard1of1.bin'),corrupted);
  let failed=run('build-standalone.ps1');assert.notEqual(failed.status,0);assert.match(failed.stdout+failed.stderr,/SHA-256 mismatch/);
  fs.writeFileSync(path.join(temp,'assets/embedding/group1-shard1of1.bin'),original);fs.rmSync(path.join(temp,'assets/embedding/model.json'));
  failed=run('build-standalone.ps1');assert.notEqual(failed.status,0);assert.match(failed.stdout+failed.stderr,/asset not found/i);
  // The npm tarball and cached extracted runtime are independently pinned.
  fs.copyFileSync(path.join(root,'assets/embedding/model.json'),path.join(temp,'assets/embedding/model.json'));
  const runtimePath=path.join(cached,'extracted/package/dist/tf.es2017.min.js');fs.appendFileSync(runtimePath,'\n/* changed */');
  failed=run('build-standalone.ps1');assert.notEqual(failed.status,0);assert.match(failed.stdout+failed.stderr,/runtime.*(?:SHA-256|size) mismatch/i);
  fs.writeFileSync(path.join(cached,'package.tgz'),'invalid');
  failed=run('build-standalone.ps1');assert.notEqual(failed.status,0);assert.match(failed.stdout+failed.stderr,/tarball SHA-256 mismatch/);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
