'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');
const Core = require('../src/core.js');

const ZIP32_MAX = 0xfffffffe;
const CHUNK_BYTES = 1024 * 1024;
const file = (name, data = 'original bytes') => new File([data], name, { lastModified: 1700000000000 });
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const key = name => name.normalize('NFC').toUpperCase().toLowerCase().normalize('NFC');
const entryBytes = (name, size) => 76 + Buffer.byteLength(name, 'utf8') * 2 + size;
const crc = bytes => {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
};

// Independent reader: every part has its own ordinary STORE records, directory and EOCD.
function unzip(bytes) {
  const data = Buffer.from(bytes), end = data.length - 22;
  assert.equal(data.readUInt32LE(end), 0x06054b50);
  assert.equal(data.readUInt16LE(end + 4), 0, 'single-disk ZIP');
  assert.equal(data.readUInt16LE(end + 6), 0, 'directory on same disk');
  assert.equal(data.readUInt16LE(end + 20), 0, 'no archive comment');
  const count = data.readUInt16LE(end + 10), entries = [];
  assert.equal(count, data.readUInt16LE(end + 8));
  assert.ok(count > 0 && count <= 65534);
  let cursor = data.readUInt32LE(end + 16), nextLocal = 0;
  const centralStart = cursor;
  for (let index = 0; index < count; index++) {
    assert.equal(data.readUInt32LE(cursor), 0x02014b50);
    assert.equal(data.readUInt16LE(cursor + 8), 0x800, 'UTF-8, no encryption/descriptor');
    assert.equal(data.readUInt16LE(cursor + 10), 0, 'STORE');
    assert.equal(data.readUInt16LE(cursor + 30), 0, 'no ZIP64 extra');
    assert.equal(data.readUInt16LE(cursor + 32), 0, 'no entry comment');
    assert.equal(data.readUInt16LE(cursor + 34), 0, 'single-disk entry');
    const checksum = data.readUInt32LE(cursor + 16), size = data.readUInt32LE(cursor + 20);
    assert.equal(data.readUInt32LE(cursor + 24), size);
    const nameSize = data.readUInt16LE(cursor + 28);
    const name = data.subarray(cursor + 46, cursor + 46 + nameSize).toString('utf8');
    const local = data.readUInt32LE(cursor + 42);
    assert.equal(local, nextLocal, 'ordered, contiguous local records');
    assert.equal(data.readUInt32LE(local), 0x04034b50);
    assert.equal(data.readUInt16LE(local + 6), 0x800);
    assert.equal(data.readUInt16LE(local + 8), 0);
    assert.equal(data.readUInt32LE(local + 14), checksum);
    assert.equal(data.readUInt32LE(local + 18), size);
    assert.equal(data.readUInt32LE(local + 22), size);
    assert.equal(data.readUInt16LE(local + 26), nameSize);
    assert.equal(data.readUInt16LE(local + 28), 0);
    assert.equal(data.subarray(local + 30, local + 30 + nameSize).toString('utf8'), name);
    const start = local + 30 + nameSize, content = data.subarray(start, start + size);
    assert.equal(crc(content), checksum);
    entries.push({ name, content });
    nextLocal = start + size;
    cursor += 46 + nameSize;
  }
  assert.equal(nextLocal, centralStart);
  assert.equal(cursor, end);
  assert.equal(cursor - centralStart, data.readUInt32LE(end + 12));
  return entries;
}

function metadata(name, size, read) {
  return { name, size, lastModified: 1700000000000, slice() { if (read) read(); throw new Error('metadata-only input must not be read'); } };
}

function assertFrozen(plan) {
  for (const object of [plan, plan.names, plan.batches, ...plan.batches, ...plan.batches.map(batch => batch.names)]) {
    assert.ok(Object.isFrozen(object));
  }
}

test('batch API is available in the browser and creates a deeply frozen metadata-only plan', () => {
  const context = { window: {}, TextEncoder, Blob, setTimeout, Uint8Array, DataView, ArrayBuffer };
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/core.js'), 'utf8'), context);
  assert.equal(typeof context.window.BestShotCore.planZipBatches, 'function');
  assert.equal(typeof context.window.BestShotCore.createZipBatch, 'function');
  assert.equal(typeof context.window.BestShotCore.zipBatchFilename, 'function');
  let reads = 0;
  const inputs = [metadata('a.jpg', 10, () => reads++), metadata('写真.png', 20, () => reads++)];
  const names = Core.uniqueNames(inputs), expected = 22 + names.reduce((sum, name, index) => sum + entryBytes(name, inputs[index].size), 0);
  const plan = Core.planZipBatches(inputs, { maxBytes: expected });
  assert.equal(reads, 0);
  assertFrozen(plan);
  assert.equal(plan.maxBytes, expected);
  assert.equal(plan.totalFiles, 2);
  assert.equal(plan.totalBytes, 30);
  assert.equal(plan.estimatedBytes, expected);
  assert.deepEqual(plan.names, names);
  assert.deepEqual(plan.batches, [{ index: 0, startIndex: 0, endIndex: 2, totalFiles: 2, totalBytes: 30, estimatedBytes: expected, names }]);
  assert.throws(() => { plan.names[0] = 'changed'; }, TypeError);
  assert.throws(() => { plan.batches[0].totalFiles = 0; }, TypeError);
});

test('part output filenames reserve UTF-8 suffix space and keep each part distinct', () => {
  assert.equal(Core.zipBatchFilename('../旅行.ZIP.zip', 0, 3), '旅行-part-001-of-003.zip');
  assert.equal(Core.zipBatchFilename('../旅行.ZIP.zip', 2, 3), '旅行-part-003-of-003.zip');
  assert.equal(Core.zipBatchFilename('one.zip.zip', 0, 1), Core.zipFilename('one.zip.zip'));
  assert.equal(Core.zipBatchFilename('...', 0, 2), 'best-shot-picker-part-001-of-002.zip');
  assert.equal(Core.zipBatchFilename('photos', 0, 1000), 'photos-part-0001-of-1000.zip');
  assert.equal(Core.zipBatchFilename('photos', 999, 1000), 'photos-part-1000-of-1000.zip');
  for (const base of ['写真'.repeat(200), 'x'.repeat(500) + '.zip', 'CON.ZIP', '\u202E../a:b?.ZIP']) {
    const names = Array.from({ length: 3 }, (_, index) => Core.zipBatchFilename(base, index, 3));
    assert.equal(new Set(names).size, 3);
    for (const [index, name] of names.entries()) {
      assert.ok(Buffer.byteLength(name) <= 240);
      assert.ok(!/[\\/\ufffd]/.test(name));
      assert.ok(name.endsWith(`-part-00${index + 1}-of-003.zip`));
    }
  }
  for (const [index, total] of [[-1, 2], [2, 2], [0.5, 2], [0, 0], [0, 1.5], ['0', 2], [0, '2'], [0, NaN], [0, Infinity]]) {
    assert.throws(() => Core.zipBatchFilename('x', index, total), { code: 'INVALID_ZIP_BATCH' });
  }
});

test('the byte budget is snapshotted once and never changes while planning', () => {
  let reads = 0;
  const plan = Core.planZipBatches([metadata('x', 1)], { get maxBytes() { return ++reads === 1 ? 101 : ZIP32_MAX + 1; } });
  assert.equal(reads, 1);
  assert.equal(plan.maxBytes, 101);
  assert.equal(plan.batches[0].estimatedBytes, 101);
});

test('greedy ordered boundaries count UTF-8 local/directory headers and exactly one EOCD per part', async () => {
  const inputs = [file('é.jpg', 'a'), file('写真.jpg', 'bb'), file('end.jpg', 'ccc')];
  const names = Core.uniqueNames(inputs), limit = 22 + entryBytes(names[0], 1) + entryBytes(names[1], 2);
  const exact = Core.planZipBatches(inputs, { maxBytes: limit });
  assert.deepEqual(exact.batches.map(batch => [batch.startIndex, batch.endIndex]), [[0, 2], [2, 3]]);
  assert.equal(exact.batches[0].estimatedBytes, limit);
  const smaller = Core.planZipBatches(inputs, { maxBytes: limit - 1 });
  assert.deepEqual(smaller.batches.map(batch => [batch.startIndex, batch.endIndex]), [[0, 1], [1, 2], [2, 3]]);
  assert.deepEqual(Core.planZipBatches(inputs, { maxBytes: limit }), exact);
  for (const plan of [exact, smaller]) {
    let archiveBytes = 0;
    for (const batch of plan.batches) {
      const archive = await Core.createZipBatch(plan, batch.index);
      assert.equal(archive.size, batch.estimatedBytes);
      assert.ok(archive.size <= plan.maxBytes);
      assert.equal(archive.type, 'application/zip');
      assert.deepEqual(unzip(await archive.arrayBuffer()).map(entry => entry.name), batch.names);
      archiveBytes += archive.size;
    }
    assert.equal(plan.estimatedBytes, archiveBytes);
  }
});

test('all independently extracted parts preserve every SHA-256 exactly once with globally collision-safe names', async () => {
  const rawNames = ['../photo.jpg', 'PHOTO.JPG', 'photo-2.jpg', 'é.png', 'e\u0301.png', 'nested\\é.png', 'straße.jpg', 'STRASSE.jpg', 'σ.jpg', 'ς.JPG', 'CON.png', 'con.PNG', '写真'.repeat(100) + '.jpg', '写真'.repeat(100) + '.jpg', 'empty.bin'];
  const inputs = rawNames.map((name, index) => file(name, index === rawNames.length - 1 ? '' : Buffer.from(`unique-original-${index}\0\xff`, 'utf8')));
  const names = Core.uniqueNames(inputs), limit = Math.max(...names.map((name, index) => 22 + entryBytes(name, inputs[index].size)));
  const plan = Core.planZipBatches(inputs, { maxBytes: limit });
  assert.ok(plan.batches.length > 1);
  assert.equal(new Set(names.map(key)).size, inputs.length);
  assert.deepEqual(plan.names, names);
  const extractedNames = [], digests = [];
  for (const batch of plan.batches) {
    const archive = await Core.createZipBatch(plan, batch.index);
    assert.equal(archive.size, batch.estimatedBytes);
    const entries = unzip(await archive.arrayBuffer());
    for (const entry of entries) {
      assert.ok(!/[\\/]/.test(entry.name));
      extractedNames.push(entry.name);
      digests.push(sha(entry.content));
    }
  }
  assert.deepEqual(extractedNames, names);
  assert.equal(new Set(extractedNames.map(key)).size, inputs.length);
  assert.deepEqual(digests, await Promise.all(inputs.map(async input => sha(Buffer.from(await input.arrayBuffer())))));
  assert.deepEqual(inputs.map(input => input.name), rawNames);
});

test('plan snapshots order, names, sizes and timestamps; retries are byte-identical without caching output Blobs', async () => {
  const first = new Blob(['first']), second = new Blob(['second']);
  first.name = 'a.jpg'; first.lastModified = 1700000000000;
  second.name = 'A.JPG'; second.lastModified = 1700000000000;
  const inputs = [first, second], names = Core.uniqueNames(inputs);
  const limit = Math.max(...names.map((name, index) => 22 + entryBytes(name, inputs[index].size)));
  const plan = Core.planZipBatches(inputs, { maxBytes: limit });
  const initial = await Core.createZipBatch(plan, 1);
  inputs.reverse(); inputs.push(file('new.jpg'));
  first.name = 'changed'; second.name = 'changed'; second.lastModified = 0;
  const retry = await Core.createZipBatch(plan, 1);
  assert.notEqual(retry, initial, 'the core retains no cached archive');
  assert.deepEqual(Buffer.from(await retry.arrayBuffer()), Buffer.from(await initial.arrayBuffer()));
  assert.deepEqual(unzip(await (await Core.createZipBatch(plan, 0)).arrayBuffer()).map(entry => [entry.name, entry.content.toString()]), [['a.jpg', 'first']]);
  assert.deepEqual(unzip(await retry.arrayBuffer()).map(entry => [entry.name, entry.content.toString()]), [['A-2.JPG', 'second']]);
  assert.equal(plan.totalFiles, 2);
});

test('one planned part is byte-identical to the existing single-ZIP API', async () => {
  const inputs = [file('../a.jpg'), file('A.JPG', 'other'), file('日本語.png', '')];
  const plan = Core.planZipBatches(inputs, { maxBytes: 10000 });
  assert.equal(plan.batches.length, 1);
  assert.deepEqual(Buffer.from(await (await Core.createZipBatch(plan, 0)).arrayBuffer()), Buffer.from(await (await Core.createZip(inputs)).arrayBuffer()));
});

test('repeated originals and unnamed Blobs retain complete ordered coverage across part boundaries', async () => {
  const same = file('same.bin', 'identical bytes'), unnamed = new Blob(['unnamed bytes']);
  const inputs = [same, same, unnamed, same];
  const names = Core.uniqueNames(inputs), maxBytes = Math.max(...names.map((name, index) => 22 + entryBytes(name, inputs[index].size)));
  const plan = Core.planZipBatches(inputs, { maxBytes });
  assert.deepEqual(plan.names, ['same.bin', 'same-2.bin', 'image-3', 'same-3.bin']);
  assert.equal(plan.batches.length, 4);
  for (const batch of plan.batches) {
    const [entry] = unzip(await (await Core.createZipBatch(plan, batch.index)).arrayBuffer());
    assert.equal(entry.name, names[batch.index]);
    assert.equal(sha(entry.content), sha(Buffer.from(await inputs[batch.index].arrayBuffer())));
  }
});

test('oversized originals fail during planning with the exact safe-name overhead and useful metadata', () => {
  let reads = 0;
  const inputs = [metadata('a.jpg', 1, () => reads++), metadata('A.JPG', 10, () => reads++)];
  const name = 'A-2.JPG', requiredBytes = 22 + entryBytes(name, 10), maxBytes = requiredBytes - 1;
  assert.throws(() => Core.planZipBatches(inputs, { maxBytes }), error => {
    assert.equal(error.code, 'ZIP_FILE_TOO_LARGE');
    assert.equal(error.fileIndex, 1);
    assert.equal(error.name, 'Error');
    assert.equal(error.fileName, name);
    assert.equal(error.size, 10);
    assert.equal(error.requiredBytes, requiredBytes);
    assert.equal(error.maxBytes, maxBytes);
    assert.match(error.message, /larger|smaller|individual|separately/i);
    return true;
  });
  assert.equal(reads, 0);
});

test('invalid budgets, empty selections and invalid file metadata fail without reading', () => {
  const valid = metadata('x', 0), options = [undefined, null, {}, [], { maxBytes: 0 }, { maxBytes: 21 }, { maxBytes: -1 }, { maxBytes: 1.5 }, { maxBytes: NaN }, { maxBytes: Infinity }, { maxBytes: '1000' }, { maxBytes: ZIP32_MAX + 1 }, { maxBytes: Number.MAX_SAFE_INTEGER }];
  for (const option of options) assert.throws(() => Core.planZipBatches([valid], option), { code: 'INVALID_ZIP_OPTIONS' });
  for (const empty of [[], null, undefined]) assert.throws(() => Core.planZipBatches(empty, { maxBytes: 1000 }), { code: 'EMPTY_SELECTION' });
  for (const bad of [null, {}, { size: 0 }, { size: NaN, slice() {} }, { size: Infinity, slice() {} }, { size: -1, slice() {} }, { size: 1.5, slice() {} }, { size: '1', slice() {} }]) {
    assert.throws(() => Core.planZipBatches([valid, bad], { maxBytes: 1000 }), { code: 'INVALID_FILE' });
  }
});

test('ZIP32 boundaries are enforced with metadata fakes, not 4 GiB allocations', () => {
  const name = 'x', largest = ZIP32_MAX - 22 - entryBytes(name, 0);
  const exact = Core.planZipBatches([metadata(name, largest)], { maxBytes: ZIP32_MAX });
  assert.equal(exact.batches[0].estimatedBytes, ZIP32_MAX);
  assert.equal(exact.totalBytes, largest);
  for (const size of [largest + 1, ZIP32_MAX, 0xffffffff, 0x100000000]) {
    assert.throws(() => Core.planZipBatches([metadata(name, size)], { maxBytes: ZIP32_MAX }), { code: 'ZIP_FILE_TOO_LARGE' });
  }
  const mixed = Core.planZipBatches([metadata('x', largest), metadata('y', 1)], { maxBytes: ZIP32_MAX });
  assert.equal(mixed.batches.length, 2);
  assert.equal(mixed.estimatedBytes, ZIP32_MAX + 101);
  assert.ok(mixed.batches.every(batch => batch.estimatedBytes <= ZIP32_MAX));
  assert.throws(() => Core.planZipBatches([metadata('x', Number.MAX_SAFE_INTEGER)], { maxBytes: ZIP32_MAX }), error => {
    assert.equal(error.code, 'ZIP_FILE_TOO_LARGE');
    assert.equal(error.requiredBytes, null, 'do not expose an inexact unsafe-integer estimate');
    return true;
  });
});

test('65,535 metadata entries become independent 65,534 and one-entry parts', () => {
  const inputs = Array.from({ length: 65535 }, (_, index) => metadata(`p${index}.jpg`, 0));
  const plan = Core.planZipBatches(inputs, { maxBytes: ZIP32_MAX });
  assert.deepEqual(plan.batches.map(batch => batch.totalFiles), [65534, 1]);
  assert.deepEqual(plan.batches.map(batch => [batch.startIndex, batch.endIndex]), [[0, 65534], [65534, 65535]]);
  assert.equal(plan.totalFiles, 65535);
  assert.equal(plan.totalBytes, 0);
  assert.equal(plan.estimatedBytes, 44 + plan.names.reduce((sum, name) => sum + entryBytes(name, 0), 0));
});

test('forged plans and invalid indexes are rejected before reads', async () => {
  let reads = 0;
  const plan = Core.planZipBatches([metadata('x', 1, () => reads++)], { maxBytes: 1000 });
  for (const fake of [null, {}, { ...plan }, JSON.parse(JSON.stringify(plan))]) {
    await assert.rejects(Core.createZipBatch(fake, 0), { code: 'INVALID_ZIP_PLAN' });
  }
  for (const index of [undefined, null, -1, 1, 0.5, NaN, '0', Infinity]) {
    await assert.rejects(Core.createZipBatch(plan, index), { code: 'INVALID_ZIP_BATCH' });
  }
  assert.equal(reads, 0);
});

test('only the requested part is read in bounded chunks with monotone part-local progress', async () => {
  const inputs = [file('before', 'untouched'), file('large', new Uint8Array(2 * CHUNK_BYTES + 17).fill(93)), file('after', 'untouched')];
  const limit = 22 + entryBytes('large', inputs[1].size), plan = Core.planZipBatches(inputs, { maxBytes: limit });
  assert.equal(plan.batches.length, 3);
  inputs[0].slice = inputs[2].slice = () => { throw new Error('another part was read'); };
  inputs[1].arrayBuffer = () => { throw new Error('whole-file read'); };
  const slice = inputs[1].slice.bind(inputs[1]), sizes = [], progress = [];
  inputs[1].slice = (start, end) => { sizes.push(end - start); return slice(start, end); };
  let yielded = false;
  setTimeout(() => { yielded = true; }, 0);
  const archive = await Core.createZipBatch(plan, 1, { onProgress: value => progress.push(value) });
  assert.ok(yielded);
  assert.deepEqual(sizes, [CHUNK_BYTES, CHUNK_BYTES, 17]);
  assert.equal(unzip(await archive.arrayBuffer())[0].content.length, inputs[1].size);
  for (const report of progress) { assert.equal(report.totalFiles, 1); assert.equal(report.totalBytes, inputs[1].size); }
  for (let index = 1; index < progress.length; index++) assert.ok(progress[index].processedBytes >= progress[index - 1].processedBytes);
  assert.deepEqual(progress.at(-1), { phase: 'complete', processedBytes: inputs[1].size, totalBytes: inputs[1].size, completedFiles: 1, totalFiles: 1, currentName: '' });
});

test('cancellation before, during, and on completion yields no archive and leaves the plan reusable', async () => {
  const input = file('large.bin', new Uint8Array(CHUNK_BYTES + 1)), plan = Core.planZipBatches([input], { maxBytes: 2 * CHUNK_BYTES });
  const before = new AbortController(); before.abort();
  await assert.rejects(Core.createZipBatch(plan, 0, { signal: before.signal }), { name: 'AbortError' });
  for (const when of ['reading', 'complete']) {
    const controller = new AbortController();
    await assert.rejects(Core.createZipBatch(plan, 0, { signal: controller.signal, onProgress(report) {
      if (report.phase === when && report.processedBytes > 0) controller.abort();
    } }), { name: 'AbortError' });
  }
  const archive = await Core.createZipBatch(plan, 0);
  assert.equal(unzip(await archive.arrayBuffer())[0].content.length, input.size);
});

test('cancel during an in-flight chunk waits for that read and never reads the next chunk', async () => {
  const input = file('large.bin', new Uint8Array(CHUNK_BYTES + 1)), plan = Core.planZipBatches([input], { maxBytes: 2 * CHUNK_BYTES });
  const controller = new AbortController(), slice = input.slice.bind(input);
  let release, entered, reads = 0;
  const started = new Promise(resolve => { entered = resolve; });
  input.slice = (start, end) => {
    reads++;
    const part = slice(start, end);
    return { size: part.size, async arrayBuffer() { entered(); await new Promise(resolve => { release = resolve; }); return part.arrayBuffer(); } };
  };
  const pending = Core.createZipBatch(plan, 0, { signal: controller.signal });
  await started; controller.abort(); release();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(reads, 1);
  input.slice = slice;
  assert.equal((await Core.createZipBatch(plan, 0)).size, plan.estimatedBytes);
});

test('read failures, short reads and invalid Blob brands cannot return an archive; successful retry keeps fixed names', async () => {
  const input = file('retry.jpg', 'original bytes'), plan = Core.planZipBatches([input], { maxBytes: 1000 }), slice = input.slice.bind(input);
  input.slice = () => { throw new Error('simulated failure'); };
  await assert.rejects(Core.createZipBatch(plan, 0), /simulated failure/);
  input.slice = () => ({ size: input.size, arrayBuffer: async () => new ArrayBuffer(1) });
  await assert.rejects(Core.createZipBatch(plan, 0), { code: 'INVALID_FILE' });
  input.slice = () => ({ size: input.size - 1, arrayBuffer: async () => new ArrayBuffer(input.size) });
  await assert.rejects(Core.createZipBatch(plan, 0), { code: 'INVALID_FILE' });
  input.slice = slice;
  const retry = unzip(await (await Core.createZipBatch(plan, 0)).arrayBuffer());
  assert.equal(retry[0].name, 'retry.jpg');
  assert.equal(retry[0].content.toString(), 'original bytes');
  const fake = { name: 'not-blob', size: 0, slice() {} };
  await assert.rejects(Core.createZipBatch(Core.planZipBatches([fake], { maxBytes: 1000 }), 0), { code: 'INVALID_FILE' });
});
