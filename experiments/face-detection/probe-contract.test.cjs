'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib');
const {productCsp}=require('./probe-build.cjs');
const {out,sha}=require('./acquire.cjs');
const manifest=require('./dependencies.json'),runtime=require('../embedding/tfjs.dependencies.json').runtime;
test('both generated probes preserve exact product CSP and pinned embedded assets',()=>{
  for(const type of ['short','full']){
    const html=fs.readFileSync(path.join(out,'probe-'+type+'.html'),'utf8');
    assert.equal(html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1],productCsp());
    assert.match(html,/Copyright \(c\) Microsoft Corporation/);assert.match(html,/Apache License/);
    const data=JSON.parse(html.match(/<script id="experiment-data" type="application\/json">([^<]+)<\/script>/)[1]);
    assert.deepEqual(Object.keys(data).sort(),['assets','modelType','workerSource']);
    const hashes={runtime:runtime.assetSha256,detector:manifest.package.assetSha256,modelJson:manifest.models[type].assets[0].sha256,weights:manifest.models[type].assets[1].sha256};
    assert.deepEqual(Object.keys(data.assets).sort(),Object.keys(hashes).sort());
    for(const [key,value]of Object.entries(data.assets))assert.equal(sha(zlib.gunzipSync(Buffer.from(value,'base64'))),hashes[key]);
    new vm.Script(data.workerSource);
    for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
    const raw=zlib.gunzipSync(Buffer.from(data.assets.runtime,'base64')).toString()+'\n'+zlib.gunzipSync(Buffer.from(data.assets.detector,'base64')).toString();
    new vm.Script(data.workerSource+'\n;(function(WebAssembly){\n'+raw+'\n}).call(self,undefined);');
    assert.doesNotMatch(html,/<(?:img|script)\b[^>]*(?:src)="https?:/i);
  }
});
