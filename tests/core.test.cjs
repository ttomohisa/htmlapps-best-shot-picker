const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const Core = require('../src/core.js');

const fixtures = path.join(__dirname, 'fixtures');
const fixture = name => fs.readFileSync(path.join(fixtures, name));
const file = (name, data = 'original bytes') => new File([data], name, { lastModified: 1700000000000 });
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const crc = bytes => {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let i = 0; i < 8; i++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
};

// Independent ZIP reader verifies local records, central directory, offsets and CRC.
function unzip(bytes) {
  const data = Buffer.from(bytes), end = data.length - 22;
  assert.equal(data.readUInt32LE(end), 0x06054b50);
  assert.equal(data.readUInt16LE(end + 4), 0);
  assert.equal(data.readUInt16LE(end + 6), 0);
  const count = data.readUInt16LE(end + 10), entries = [];
  let cursor = data.readUInt32LE(end + 16);
  const centralStart = cursor;
  for (let i = 0; i < count; i++) {
    assert.equal(data.readUInt32LE(cursor), 0x02014b50);
    assert.equal(data.readUInt16LE(cursor + 8), 0x800, 'UTF-8 flag');
    assert.equal(data.readUInt16LE(cursor + 10), 0, 'STORE method');
    const checksum = data.readUInt32LE(cursor + 16);
    const size = data.readUInt32LE(cursor + 20);
    assert.equal(data.readUInt32LE(cursor + 24), size);
    const nameSize = data.readUInt16LE(cursor + 28);
    const name = data.subarray(cursor + 46, cursor + 46 + nameSize).toString('utf8');
    const local = data.readUInt32LE(cursor + 42);
    assert.equal(data.readUInt32LE(local), 0x04034b50);
    assert.equal(data.readUInt16LE(local + 6), 0x800);
    assert.equal(data.readUInt16LE(local + 8), 0);
    assert.equal(data.readUInt32LE(local + 14), checksum);
    assert.equal(data.readUInt32LE(local + 18), size);
    assert.equal(data.readUInt16LE(local + 26), nameSize);
    assert.equal(data.subarray(local + 30, local + 30 + nameSize).toString('utf8'), name);
    const start = local + 30 + nameSize;
    const content = data.subarray(start, start + size);
    assert.equal(crc(content), checksum);
    entries.push({ name, content });
    cursor += 46 + nameSize + data.readUInt16LE(cursor + 30) + data.readUInt16LE(cursor + 32);
  }
  assert.equal(cursor, end);
  assert.equal(cursor - centralStart, data.readUInt32LE(end + 12));
  assert.equal(entries.length, data.readUInt16LE(end + 8));
  return entries;
}

test('exports the same browser API without requiring a module loader', () => {
  const context = { window: {}, TextEncoder, Blob, setTimeout, DOMException, Uint8Array, DataView, ArrayBuffer };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/core.js'), 'utf8'), context);
  for (const name of ['sanitizeFilename', 'zipFilename', 'uniqueNames', 'createZip', 'inspectImageHeader']) {
    assert.equal(typeof context.window.BestShotCore[name], 'function');
    assert.equal(typeof Core[name], 'function');
  }
});

test('safe filenames flatten paths, normalize Unicode, remove unsafe characters, and handle reserved names', () => {
  assert.equal(Core.sanitizeFilename('../../folder/画像.jpg'), '画像.jpg');
  assert.equal(Core.sanitizeFilename('C:\\pictures\\a:b?.jpg'), 'ab.jpg');
  assert.equal(Core.sanitizeFilename(' .hidden\u0000\u202E.png. '), 'hidden.png');
  assert.equal(Core.sanitizeFilename('e\u0301.jpg'), 'é.jpg');
  assert.equal(Core.sanitizeFilename('CON.jpg'), '_CON.jpg');
  assert.equal(Core.sanitizeFilename('nul'), '_nul');
  assert.equal(Core.sanitizeFilename('../', '../safe.png'), 'safe.png');
  assert.equal(Core.sanitizeFilename('...', '...'), 'image');
});

test('ZIP output naming preserves one predictable extension and safe fallback', () => {
  assert.equal(Core.zipFilename('../旅行.ZIP'), '旅行.zip');
  assert.equal(Core.zipFilename('custom name'), 'custom name.zip');
  assert.equal(Core.zipFilename(' / ', 'best-shot-picker-20261016.zip'), 'best-shot-picker-20261016.zip');
  assert.equal(Core.zipFilename('...'), 'best-shot-picker.zip');
  assert.equal(Core.zipFilename('a.zip.zip'), 'a.zip');
});

test('long multibyte filenames preserve extensions without splitting characters', () => {
  const name = Core.sanitizeFilename('写真'.repeat(200) + '.JPEG');
  assert.ok(Buffer.byteLength(name) <= 240);
  assert.ok(name.endsWith('.JPEG'));
  assert.ok(!name.includes('\ufffd'));
  assert.ok(Buffer.byteLength(Core.zipFilename('写真'.repeat(200))) <= 240);
  const result = Core.uniqueNames([file(name), file(name)]);
  assert.ok(result[1].endsWith('-2.JPEG'));
  assert.ok(Buffer.byteLength(result[1]) <= 240);
  assert.ok(Core.sanitizeFilename('CONCERT.' + 'x'.repeat(236)).startsWith('_'));
});

test('collision handling is deterministic, case-insensitive, NFC-aware and extension-preserving', () => {
  const names = ['../image.jpg', 'IMAGE.JPG', 'image-2.jpg', 'é.png', 'e\u0301.png', 'nested\\é.png', 'plain', 'PLAIN'];
  const files = names.map(name => file(name));
  const result = Core.uniqueNames(files);
  assert.deepEqual(result, ['image.jpg', 'IMAGE-2.JPG', 'image-2-2.jpg', 'é.png', 'é-2.png', 'é-3.png', 'plain', 'PLAIN-2']);
  assert.deepEqual(Core.uniqueNames(files), result);
  assert.deepEqual(files.map(f => f.name), names);
});

test('all selected fixture bytes survive STORE ZIP export with UTF-8 names and correct CRC', async () => {
  const inputs = [
    file('../../写真.jpg', fixture('portrait-exif-6.jpg')),
    file('写真.JPG', fixture('landscape-2.jpg')),
    file('透明.png', fixture('transparent.png')),
    file('static.webp', fixture('static.webp')),
    file('empty.bin', new Uint8Array()),
    file('binary.bin', Uint8Array.from({ length: 65536 }, (_, i) => i % 256))
  ];
  const progress = [];
  const blob = await Core.createZip(inputs, { onProgress: value => progress.push(value) });
  assert.equal(blob.type, 'application/zip');
  const extracted = unzip(await blob.arrayBuffer());
  assert.deepEqual(extracted.map(entry => entry.name), Core.uniqueNames(inputs));
  for (let i = 0; i < inputs.length; i++) assert.equal(sha(extracted[i].content), sha(Buffer.from(await inputs[i].arrayBuffer())));
  assert.ok(progress.length >= inputs.length + 1);
  const final = progress.at(-1);
  assert.equal(final.phase, 'complete');
  assert.equal(final.completedFiles, inputs.length);
  assert.equal(final.processedBytes, inputs.reduce((sum, f) => sum + f.size, 0));
  assert.equal(final.totalBytes, final.processedBytes);
  for (let i = 1; i < progress.length; i++) assert.ok(progress[i].processedBytes >= progress[i - 1].processedBytes);
});

test('ZIP reads bounded chunks and yields to timers instead of reading the whole File', async () => {
  const source = file('large.jpg', new Uint8Array(3 * 1024 * 1024 + 7).fill(107));
  source.arrayBuffer = () => { throw new Error('whole-file read forbidden'); };
  const sizes = [], original = source.slice.bind(source);
  source.slice = (start, end) => { sizes.push(end - start); return original(start, end); };
  let timerFired = false;
  const progress = [];
  setTimeout(() => { timerFired = true; }, 0);
  const result = await Core.createZip([source], { onProgress: p => progress.push(p) });
  assert.ok(timerFired);
  assert.ok(sizes.length >= 4);
  assert.ok(sizes.every(size => size <= 1024 * 1024));
  assert.ok(progress.filter(p => p.phase === 'reading' && p.processedBytes > 0).length >= 4);
  assert.equal(unzip(await result.arrayBuffer())[0].content.length, source.size);
});

test('cancellation before, during, and at completion never returns a stale archive; retry works', async () => {
  const files = [file('large.bin', new Uint8Array(3 * 1024 * 1024))];
  const before = new AbortController(); before.abort();
  await assert.rejects(Core.createZip(files, { signal: before.signal }), { name: 'AbortError' });
  const during = new AbortController();
  let last;
  await assert.rejects(Core.createZip(files, { signal: during.signal, onProgress(p) {
    last = p;
    if (p.processedBytes > 0) during.abort();
  } }), { name: 'AbortError' });
  assert.ok(last.processedBytes < last.totalBytes);
  const completed = new AbortController();
  await assert.rejects(Core.createZip(files, { signal: completed.signal, onProgress(p) {
    if (p.phase === 'complete') completed.abort();
  } }), { name: 'AbortError' });
  const result = await Core.createZip(files);
  assert.equal(unzip(await result.arrayBuffer()).length, 1);
});

test('ZIP read failure leaves original input available for a successful retry', async () => {
  const source = file('retry.jpg');
  const slice = source.slice.bind(source);
  source.slice = () => { throw new Error('simulated read failure'); };
  await assert.rejects(Core.createZip([source]), /simulated read failure/);
  source.slice = slice;
  assert.equal(unzip(await (await Core.createZip([source])).arrayBuffer())[0].content.toString(), 'original bytes');
});

test('ZIP32 count, size and aggregate boundary guards fail before reading, with actionable errors', async () => {
  const neverRead = { name: 'huge.jpg', size: 0xffffffff, slice() { throw new Error('should not read'); } };
  await assert.rejects(Core.createZip([neverRead]), error => error.code === 'ZIP_LIMIT' && /smaller|fewer|split/i.test(error.message));
  await assert.rejects(Core.createZip(Array(65535).fill(file('x.jpg'))), { code: 'ZIP_LIMIT' });
  const nearLimit = { ...neverRead, size: 0xffffff00 };
  await assert.rejects(Core.createZip([nearLimit, { ...neverRead, size: 256 }]), { code: 'ZIP_LIMIT' });
  await assert.rejects(Core.createZip([]), { code: 'EMPTY_SELECTION' });
  await assert.rejects(Core.createZip([{ name: 'bad', size: NaN, slice() {} }]), { code: 'INVALID_FILE' });
});

test('header inspection identifies JPEG, transparent PNG, lossy and lossless static WebP', () => {
  assert.deepEqual(Core.inspectImageHeader(fixture('landscape.jpg')), { format: 'jpeg', width: 320, height: 240, orientation: 1 });
  assert.deepEqual(Core.inspectImageHeader(fixture('portrait-exif-6.jpg')), { format: 'jpeg', width: 320, height: 240, orientation: 6 });
  assert.deepEqual(Core.inspectImageHeader(fixture('transparent.png')), { format: 'png', width: 100, height: 80, orientation: 1 });
  assert.deepEqual(Core.inspectImageHeader(fixture('static.webp')), { format: 'webp', width: 320, height: 240, orientation: 1 });
  assert.deepEqual(Core.inspectImageHeader(fixture('lossless.webp')), { format: 'webp', width: 100, height: 80, orientation: 1 });
});

test('header inspection respects typed-array offsets and ArrayBuffer input', () => {
  const png = fixture('transparent.png');
  const padded = Buffer.concat([Buffer.alloc(7), png, Buffer.alloc(5)]);
  assert.equal(Core.inspectImageHeader(padded.subarray(7, 7 + png.length)).width, 100);
  assert.equal(Core.inspectImageHeader(Uint8Array.from(png).buffer).height, 80);
});

test('header inspection rejects animated WebP, all GIF, unsupported and malformed signatures', () => {
  assert.throws(() => Core.inspectImageHeader(fixture('animated.webp')), { code: 'ANIMATED_IMAGE' });
  assert.throws(() => Core.inspectImageHeader(Buffer.from('GIF89a00000')), { code: 'UNSUPPORTED_IMAGE' });
  assert.throws(() => Core.inspectImageHeader(Buffer.from('<svg></svg>')), { code: 'UNSUPPORTED_IMAGE' });
  assert.throws(() => Core.inspectImageHeader(fixture('empty.jpg')), { code: 'INVALID_IMAGE' });
  assert.throws(() => Core.inspectImageHeader(fixture('broken.jpg')), { code: 'INVALID_IMAGE' });
  assert.throws(() => Core.inspectImageHeader(fixture('transparent.png').subarray(0, 20)), { code: 'INVALID_IMAGE' });
  assert.throws(() => Core.inspectImageHeader(Buffer.from('RIFF\x01\x00\x00\x00WEBP')), { code: 'INVALID_IMAGE' });
});

test('malformed EXIF offsets are ignored without unsafe reads or losing JPEG dimensions', () => {
  const jpeg = Buffer.from(fixture('portrait-exif-6.jpg'));
  const exif = jpeg.indexOf(Buffer.from('Exif\0\0'));
  assert.ok(exif > 0);
  jpeg.fill(0xff, exif + 10, exif + 14);
  assert.deepEqual(Core.inspectImageHeader(jpeg), { format: 'jpeg', width: 320, height: 240, orientation: 1 });
});

test('later non-EXIF APP1 metadata does not reset an earlier orientation', () => {
  const jpeg = fixture('portrait-exif-6.jpg');
  const exif = jpeg.indexOf(Buffer.from('Exif\0\0'));
  const afterExif = exif - 2 + jpeg.readUInt16BE(exif - 2);
  const xmp = Buffer.from('http://ns.adobe.com/xap/1.0/\0<metadata/>');
  const segment = Buffer.alloc(xmp.length + 4);
  segment.set([0xff, 0xe1]);
  segment.writeUInt16BE(xmp.length + 2, 2);
  xmp.copy(segment, 4);
  const combined = Buffer.concat([jpeg.subarray(0, afterExif), segment, jpeg.subarray(afterExif)]);
  assert.equal(Core.inspectImageHeader(combined).orientation, 6);
});

test('EXIF orientation supports both byte orders and all eight transforms', () => {
  const jpeg = fixture('landscape.jpg');
  for (const little of [true, false]) for (let orientation = 1; orientation <= 8; orientation++) {
    const payload = Buffer.alloc(32);
    payload.write('Exif\0\0', 0, 'binary');
    payload.write(little ? 'II' : 'MM', 6);
    const u16 = (offset, value) => little ? payload.writeUInt16LE(value, offset) : payload.writeUInt16BE(value, offset);
    const u32 = (offset, value) => little ? payload.writeUInt32LE(value, offset) : payload.writeUInt32BE(value, offset);
    u16(8, 42); u32(10, 8); u16(14, 1);
    u16(16, 0x112); u16(18, 3); u32(20, 1); u16(24, orientation);
    const header = Buffer.from([0xff, 0xe1, 0, payload.length + 2]);
    assert.equal(Core.inspectImageHeader(Buffer.concat([jpeg.subarray(0, 2), header, payload, jpeg.subarray(2)])).orientation, orientation);
  }
});

test('unreasonable encoded dimensions fail before browser decoding', () => {
  const png = Buffer.from(fixture('transparent.png'));
  png.writeUInt32BE(100000, 16);
  png.writeUInt32BE(crc(png.subarray(12, 29)), 29);
  assert.throws(() => Core.inspectImageHeader(png), { code: 'IMAGE_TOO_LARGE' });
  png.writeUInt32BE(0, 16);
  png.writeUInt32BE(crc(png.subarray(12, 29)), 29);
  assert.throws(() => Core.inspectImageHeader(png), { code: 'INVALID_IMAGE' });
});

test('JPEG prefix that ends in a large metadata block safely defers dimensions to the browser', () => {
  const prefix = Buffer.alloc(64);
  prefix.set([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff]);
  assert.deepEqual(Core.inspectImageHeader(prefix), { format: 'jpeg', width: null, height: null, orientation: 1 });
});
