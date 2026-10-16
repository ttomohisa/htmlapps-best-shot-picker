/* Development-only, hash-pinned candidate. No app, Pages or preview build imports it. */
const fs = require('node:fs/promises');
const path = require('node:path');
const zlib = require('node:zlib');
const {spawnSync} = require('node:child_process');
const {sha, verify} = require('./build.cjs');
const manifest = require('./tfjs.dependencies.json');
const photos = require('./photo-pilot.json');
const root = path.resolve(__dirname, '../..');
const cache = path.join(root, '.cache/embedding-tfjs');
const out = path.join(root, 'test-results/embedding-tfjs');
async function download(url, name, hash, expectedBytes) {
  const file = path.join(cache,name); let bytes;
  try { bytes = await fs.readFile(file); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const response = await fetch(url,{signal:AbortSignal.timeout(90000)});
    if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
    bytes = Buffer.from(await response.arrayBuffer());
    verify(bytes,hash,name);
    if (expectedBytes && bytes.length !== expectedBytes) throw new Error('Size mismatch: '+name);
    await fs.writeFile(file,bytes);
  }
  verify(bytes,hash,name);
  if (expectedBytes && bytes.length !== expectedBytes) throw new Error('Size mismatch: '+name);
  return bytes;
}
function extract(archive, names) {
  const result = spawnSync('tar',['-xzf',path.join(cache,archive),'-C',cache,...names],{encoding:'utf8'});
  if (result.status !== 0) throw new Error(result.stderr || 'Extraction failed');
}
const encode = bytes => zlib.gzipSync(bytes).toString('base64');
async function build() {
  await fs.mkdir(cache,{recursive:true}); await fs.mkdir(out,{recursive:true});
  await download(manifest.runtime.url,'tfjs-4.22.0.tgz',manifest.runtime.sha256,manifest.runtime.bytes);
  await download(manifest.model.url,'mobilenet-v1-025-v2.tar.gz',manifest.model.sha256,manifest.model.bytes);
  extract('tfjs-4.22.0.tgz',[manifest.runtime.asset]);
  extract('mobilenet-v1-025-v2.tar.gz',['model.json','group1-shard1of1.bin']);
  const assets = {}, sizes = {};
  for (const [key,file,hash] of [['runtime',manifest.runtime.asset,manifest.runtime.assetSha256],['modelJson','model.json',manifest.model.jsonSha256],['weights','group1-shard1of1.bin',manifest.model.weightsSha256]]) {
    const bytes = verify(await fs.readFile(path.join(cache,file)),hash,key);
    assets[key] = encode(bytes); sizes[key] = {bytes:bytes.length,gzipBytes:Buffer.from(assets[key],'base64').length,sha256:hash};
  }
  const license = verify(await fs.readFile(path.join(__dirname,'LICENSE.TensorFlow.js.txt')),manifest.licenseText.sha256,'TFJS license').toString('utf8');
  const thirdParty = await fs.readFile(path.join(__dirname,'THIRD_PARTY.TFJS.txt'),'utf8');
  const sources = await Promise.all(['src/grouping.js','experiments/embedding/evaluate.js','experiments/embedding/tfjs-runner.js'].map(file=>fs.readFile(path.join(root,file),'utf8')));
  if (sources.some(source=>/<\/script/i.test(source))) throw new Error('Closing script tag in source');
  const favicon = (await fs.readFile(path.join(root,'assets/favicon.svg'))).toString('base64');
  const reports = [];
  for (const kind of ['synthetic','photo-pilot']) {
    const fixtures = [];
    if (kind === 'synthetic') {
      for (const [index,name] of ['landscape.jpg','landscape-2.jpg','quality-detail.png','quality-soft.png'].entries()) {
        const bytes = await fs.readFile(path.join(root,'tests/fixtures',name));
        fixtures.push({id:name,scene:index<2?'landscape':'texture',mime:name.endsWith('.jpg')?'image/jpeg':'image/png',base64:bytes.toString('base64'),sha256:sha(bytes)});
      }
    } else for (const item of photos.images) {
      const bytes = await download(item.url,item.id+'.jpg',item.sha256,item.bytes);
      fixtures.push({...item,base64:bytes.toString('base64')});
    }
    const data = JSON.stringify({kind,assets,fixtures,manifest,provenance:kind==='photo-pilot'?photos:null}).replace(/</g,'\\u003c');
    const notices = (license+'\n\n'+thirdParty).replace(/&/g,'&amp;').replace(/</g,'&lt;');
    const photoCredit = kind==='photo-pilot' ? '<p>Photos: Lukas Murmann, Michael Gharbi, Miika Aittala, Fredo Durand (2019), A Multi-Illumination Dataset of Indoor Object Appearance. CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Source: https://projects.csail.mit.edu/illumination/ . Unmodified published mip3 JPEGs; model input is resized only in memory. These staged lighting scenes are not consumer-burst or human-preference validation.</p>' : '';
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'"><link rel="icon" href="data:image/svg+xml;base64,${favicon}"><title>Offline TFJS embedding experiment</title><style>body{font:16px system-ui;max-width:900px;margin:2rem auto;padding:0 1rem}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body><h1>Offline TFJS embedding experiment</h1><p>Isolated evidence only. No model is included in Best Shot Picker. No broad JavaScript eval or WASM permission is enabled.</p>${photoCredit}<pre id="result">Preparing local assets…</pre><details><summary>Licenses and notices</summary><pre>${notices}</pre></details><script id="experiment-data" type="application/json">${data}</script>${sources.map(source=>'<script>'+source+'</script>').join('')}</body></html>`;
    const file = kind==='synthetic'?'index.html':'photo-pilot.html';
    await fs.writeFile(path.join(out,file),html);
    reports.push({kind,file,bytes:Buffer.byteLength(html),sha256:sha(Buffer.from(html)),photos:fixtures.length});
  }
  const report={runtime:manifest.runtime.version,model:manifest.model.name,assets:sizes,outputs:reports,productionModelIncluded:false};
  await fs.writeFile(path.join(out,'build-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));return report;
}
module.exports={build,encode};
if(require.main===module)build().catch(error=>{console.error(error);process.exitCode=1;});
