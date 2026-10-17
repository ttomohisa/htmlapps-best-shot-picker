'use strict';
const assert = require('node:assert/strict');
const { config, limits, parseStatus, validateManifest, stopReason } = require('./support.cjs');
assert.deepEqual(config({}).counts, [4]);
assert.deepEqual(config({ BSP_RESOURCE_MAX_COUNT: '100' }).counts, [4, 100]);
for (const value of ['0', '5', '500', '4,100']) assert.throws(() => config({ BSP_RESOURCE_MAX_COUNT: value }));
assert.deepEqual(parseStatus('Name:\tchrome\nPPid:\t12\nVmRSS:\t2048 kB\n'), { ppid: 12, rss: 2097152 });
assert.throws(() => parseStatus('PPid:\t12\n'), /RSS/);
assert.deepEqual(parseStatus('State:\tZ (zombie)\nPPid:\t12\n'), { ppid:12, rss:0 });
assert.equal(stopReason({ rss: 100, available: limits.minAvailableBytes + 1 }), null);
assert.match(stopReason({ rss: limits.maxRssBytes + 1, available: 9e9 }), /RSS/);
assert.match(stopReason({ rss: 0, available: 1 }), /available/);
assert.match(stopReason({ rss: NaN, available: 9e9 }), /measurement/);
const item = { name: 'synthetic-001.jpg', width: 4000, height: 3000, bytes: 1024, sha256: 'a'.repeat(64), format: 'JPEG' };
const manifest = { profile: 'synthetic-geometric-12mp-v1', count: 4, files: Array.from({length:4}, (_, i) => ({...item, name:`synthetic-00${i+1}.jpg`})) };
assert.equal(validateManifest(manifest, 4), 4096);
for (const patch of [{ name: '../outside.jpg' }, { width: 4001 }, { bytes: limits.maxFileBytes + 1 }, { sha256:'x' }, { format: 'HEIC' }]) {
 assert.throws(() => validateManifest({...manifest, files: [{...item,...patch}, ...manifest.files.slice(1)]}, 4));
}
assert.throws(() => validateManifest({...manifest, files: [item,item,...manifest.files.slice(2)]},4), /Duplicate/);
assert.throws(() => validateManifest(manifest,100));
console.log('PASS manual resource-probe guards (no image generation/browser)');
(async()=>{
 const { sampleResources }=require('./support.cjs');
 const fixture={
  '/proc/100/stat':'100 (browser) S 1 0 0', '/proc/101/stat':'101 (renderer with space) S 100 0 0',
  '/proc/100/status':'PPid:\t1\nVmRSS:\t100 kB\n', '/proc/101/status':'PPid:\t100\nVmRSS:\t200 kB\n',
  '/proc/meminfo':'MemAvailable:\t2097152 kB\n'
 };
 const io={readdir:async()=>['100','101'],readFile:async name=>{if(fixture[name] instanceof Error)throw fixture[name];return fixture[name];}};
 assert.equal((await sampleResources(100,io)).browserRss,300*1024);
 fixture['/proc/101/status']='PPid:\t100\n';await assert.rejects(sampleResources(100,io),/RSS/);
 fixture['/proc/101/status']=Object.assign(Error('denied live renderer'),{code:'EACCES'});await assert.rejects(sampleResources(100,io),/denied/);
 fixture['/proc/101/status']=Object.assign(Error('exited'),{code:'ENOENT'});assert.equal((await sampleResources(100,io)).browserRss,100*1024);
 fixture['/proc/101/stat']='101 (renderer) S \n';await assert.rejects(sampleResources(100,io),/topology/);
 fixture['/proc/101/stat']=Object.assign(Error('denied topology'),{code:'EACCES'});await assert.rejects(sampleResources(100,io),/topology/);
 console.log('PASS fail-closed descendant RSS/topology sampling');
})().catch(error=>{console.error(error);process.exitCode=1;});
