'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const {extractSelected, verify, sha} = require('./acquire.cjs');
function tar(entries) {
  const blocks = [];
  for (const {name, type = '0', data = Buffer.from('test')} of entries) {
    const header = Buffer.alloc(512);
    header.write(name, 0, 100); header.write('0000644\0', 100);
    header.write(data.length.toString(8).padStart(11, '0') + '\0', 124);
    header.fill(32, 148, 156); header.write(type, 156);
    const sum = header.reduce((a, b) => a + b, 0);
    header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
    blocks.push(header, data, Buffer.alloc((512 - data.length % 512) % 512));
  }
  return zlib.gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)]));
}
test('selected regular files only, no archive-controlled filesystem writes', () => {
  const result = extractSelected(tar([{name:'package/a.js'}, {name:'package/ignored.txt'}]), ['package/a.js']);
  assert.deepEqual([...result.keys()], ['package/a.js']); assert.equal(result.get('package/a.js').toString(), 'test');
});
for (const name of ['../escape','/absolute','C:/drive','package/../../escape','package\\escape']) {
  test('reject unsafe archive path ' + name, () => assert.throws(() => extractSelected(tar([{name}]), [name]), /Unsafe/));
}
for (const type of ['1','2','3','4','6','x','L']) {
  test('reject links, special files and extended headers: ' + type, () => assert.throws(() => extractSelected(tar([{name:'a',type}]), ['a']), /Unsupported/));
}
test('reject duplicate and missing members', () => {
  assert.throws(() => extractSelected(tar([{name:'a'},{name:'a'}]), ['a']), /Duplicate/);
  assert.throws(() => extractSelected(tar([{name:'a'}]), ['b']), /Missing/);
});
test('reject corrupted tar checksum and truncated archive', () => {
  const body = zlib.gunzipSync(tar([{name:'a'}])); body[0] = 98;
  assert.throws(() => extractSelected(zlib.gzipSync(body), ['a']), /checksum/);
  assert.throws(() => extractSelected(zlib.gzipSync(body.subarray(0, 100)), ['a']), /Truncated/);
});
test('require exact size and both digest forms when supplied', () => {
  const bytes = Buffer.from('test'); assert.equal(verify(bytes,{bytes:4,sha256:sha(bytes)},'x'),bytes);
  assert.throws(() => verify(bytes,{bytes:3,sha256:sha(bytes)},'x'), /Size/);
  assert.throws(() => verify(bytes,{bytes:4,sha256:'0'.repeat(64)},'x'), /SHA-256/);
  assert.throws(() => verify(bytes,{bytes:4,sha256:sha(bytes),integrity:'sha512-no'},'x'), /SHA-512/);
});
module.exports = {tar};
