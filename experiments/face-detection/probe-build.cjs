/* Offline-only packaging: run acquire.cjs separately first. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const {verify, sha, cache, out, root} = require('./acquire.cjs');
const manifest = require('./dependencies.json');
const tfjs = require('../embedding/tfjs.dependencies.json');
const read = name => fs.readFileSync(path.join(root, name));
const local = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
function productCsp() {
  const tag = /<meta http-equiv="Content-Security-Policy" content="([^"]+)"\s*>/;
  const csp = read('src/index.template.html').toString().match(tag)?.[1];
  const wrapper = read('scripts/build-self-extract.ps1').toString().match(tag)?.[1];
  if (!csp || csp !== wrapper) throw new Error('Product and canonical self-extract CSP differ');
  if (!csp.includes("connect-src 'none'") || /unsafe-eval|wasm-unsafe-eval/.test(csp)) throw new Error('Product CSP no longer meets this probe gate');
  return csp;
}
const escape = text => text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function build() {
  fs.mkdirSync(out, {recursive: true});
  const csp = productCsp();
  const runtime = verify(fs.readFileSync(path.join(cache, 'runtime.js')), {bytes:tfjs.runtime.assetBytes,sha256:tfjs.runtime.assetSha256}, 'runtime');
  const detector = verify(fs.readFileSync(path.join(cache, 'detector.js')), {bytes:17930,sha256:manifest.package.assetSha256}, 'detector');
  const client = local('probe-client.js'), worker = local('probe-worker.js'), runner = local('probe-runner.js');
  if ([client, runner].some(source => /<\/script/i.test(source))) throw new Error('Closing script tag in harness');
  const licenseBytes = read('experiments/embedding/LICENSE.TensorFlow.js.txt');
  if (sha(licenseBytes) !== tfjs.licenseText.sha256) throw new Error('Apache license integrity mismatch');
  const notices = [local('THIRD_PARTY_NOTICES.txt'), licenseBytes.toString(), read('experiments/embedding/THIRD_PARTY.TFJS.txt').toString()].join('\n\n');
  const favicon = read('assets/favicon.svg').toString('base64');
  const head = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="' + csp + '"><link rel="icon" href="data:image/svg+xml;base64,' + favicon + '"><title>Offline face technical probe</title><style>body{font:16px system-ui;max-width:900px;margin:2rem auto;padding:0 1rem}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body>';
  const outputs = [];
  for (const modelType of ['short','full']) {
    const modelAssets = manifest.models[modelType].assets;
    const asset = name => {const pin = modelAssets.find(a => a.path.endsWith('/' + name));return verify(fs.readFileSync(path.join(cache, pin.path)), pin, pin.path);};
    const raw = {runtime, detector, modelJson: asset('model.json'), weights: asset('group1-shard1of1.bin')};
    const assets = Object.fromEntries(Object.entries(raw).map(([key, bytes]) => [key, zlib.gzipSync(bytes).toString('base64')]));
    const data = JSON.stringify({modelType, assets, workerSource: worker}).replace(/</g,'\\u003c');
    const html = head + '<h1>Offline face technical probe: ' + modelType + '</h1><p>Synthetic pixels only. Technical feasibility, not accuracy evidence or production adoption.</p><pre id="result">Preparing assets...</pre><details><summary>Licenses and provenance</summary><pre>' + escape(notices) + '</pre></details><script id="experiment-data" type="application/json">' + data + '</script><script>' + client + '</script><script>' + runner + '</script></body></html>';
    const file = 'probe-' + modelType + '.html'; fs.writeFileSync(path.join(out, file), html);
    outputs.push({file, bytes:Buffer.byteLength(html), sha256:sha(Buffer.from(html)), assets:Object.fromEntries(Object.entries(raw).map(([key, bytes])=>[key,{bytes:bytes.length,sha256:sha(bytes)}]))});
  }
  fs.writeFileSync(path.join(out, 'security-controls.html'), head + '<h1>Deliberate CSP negative controls</h1><p>This separate page contains no model or image.</p></body></html>');
  const report = {scope:'Isolated synthetic technical harness only. Build does not run a browser.',productionIntegration:false,csp,cspSource:'src/index.template.html',canonicalWrapperCspMatches:true,clientSha256:sha(Buffer.from(client)),workerSha256:sha(Buffer.from(worker)),outputs};
  fs.writeFileSync(path.join(out,'probe-build-results.json'),JSON.stringify(report,null,2)+'\n'); return report;
}
module.exports = {build, productCsp};
if (require.main === module) {try { console.log(JSON.stringify(build(),null,2)); } catch(error) { console.error(error); process.exitCode=1; }}
