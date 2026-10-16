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
  for (const name of ['sanitizeFilename', 'zipFilename', 'uniqueNames', 'createZip', 'inspectImageHeader', 'findExactDuplicates']) {
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
  assert.deepEqual(Core.inspectImageHeader(fixture('landscape.jpg')), { format: 'jpeg', width: 320, height: 240, orientation: 1, captureTime: null });
  assert.deepEqual(Core.inspectImageHeader(fixture('portrait-exif-6.jpg')), { format: 'jpeg', width: 320, height: 240, orientation: 6, captureTime: null });
  assert.deepEqual(Core.inspectImageHeader(fixture('transparent.png')), { format: 'png', width: 100, height: 80, orientation: 1, captureTime: null });
  assert.deepEqual(Core.inspectImageHeader(fixture('static.webp')), { format: 'webp', width: 320, height: 240, orientation: 1, captureTime: null });
  assert.deepEqual(Core.inspectImageHeader(fixture('lossless.webp')), { format: 'webp', width: 100, height: 80, orientation: 1, captureTime: null });
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
  assert.deepEqual(Core.inspectImageHeader(jpeg), { format: 'jpeg', width: 320, height: 240, orientation: 1, captureTime: null });
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
  assert.deepEqual(Core.inspectImageHeader(prefix), { format: 'jpeg', width: null, height: null, orientation: 1, captureTime: null });
});

// Minimal independently constructed TIFF/EXIF blocks; only synthetic metadata is used.
function timedJpeg(tags, { little = true, orientation = 6 } = {}) {
  const entries = Object.entries(tags).map(([tag, value]) => [Number(tag), Buffer.from(value + '\0', 'ascii')]);
  const exifOffset = 38, dataOffset = exifOffset + 2 + entries.length * 12 + 4;
  const tiff = Buffer.alloc(dataOffset + entries.reduce((n, [, value]) => n + (value.length > 4 ? value.length : 0), 0));
  const u16 = (offset, value) => little ? tiff.writeUInt16LE(value, offset) : tiff.writeUInt16BE(value, offset);
  const u32 = (offset, value) => little ? tiff.writeUInt32LE(value, offset) : tiff.writeUInt32BE(value, offset);
  tiff.write(little ? 'II' : 'MM'); u16(2, 42); u32(4, 8); u16(8, 2);
  u16(10, 0x112); u16(12, 3); u32(14, 1); u16(18, orientation);
  u16(22, 0x8769); u16(24, 4); u32(26, 1); u32(30, exifOffset);
  u16(exifOffset, entries.length);
  let data = dataOffset;
  entries.forEach(([tag, value], n) => {
    const entry = exifOffset + 2 + n * 12;
    u16(entry, tag); u16(entry + 2, 2); u32(entry + 4, value.length);
    if (value.length <= 4) value.copy(tiff, entry + 8);
    else { u32(entry + 8, data); value.copy(tiff, data); data += value.length; }
  });
  const payload = Buffer.concat([Buffer.from('Exif\0\0'), tiff]);
  const marker = Buffer.from([0xff, 0xe1, 0, 0]); marker.writeUInt16BE(payload.length + 2, 2);
  const jpeg = fixture('landscape.jpg');
  return Buffer.concat([jpeg.subarray(0, 2), marker, payload, jpeg.subarray(2)]);
}
const capture = (tags, options) => Core.inspectImageHeader(timedJpeg(tags, options)).captureTime;

test('EXIF original dates, offsets and subseconds support both endiannesses without losing orientation', () => {
  for (const little of [true, false]) {
    const jpeg = timedJpeg({ 0x9003: '2024:01:01 00:15:30', 0x9011: '+09:00', 0x9291: '123456', 0x9004: '2025:01:01 12:00:00' }, { little });
    const header = Core.inspectImageHeader(jpeg);
    assert.equal(header.orientation, 6);
    assert.deepEqual(header.captureTime, { valueMs: Date.UTC(2023, 11, 31, 15, 15, 30, 123), domain: 'instant', source: 'exif-original', display: '2024-01-01 00:15:30.123456+09:00', offsetMinutes: 540 });
  }
});

test('EXIF missing timezone stays a wall clock; digitized fallback uses only its own tags', () => {
  assert.deepEqual(capture({ 0x9003: '2024:02:29 14:05:06', 0x9291: '7', 0x9012: '-05:00' }), { valueMs: Date.UTC(2024, 1, 29, 14, 5, 6, 700), domain: 'wall', source: 'exif-original', display: '2024-02-29 14:05:06.7' });
  assert.deepEqual(capture({ 0x9003: '0000:00:00 00:00:00', 0x9004: '2024:12:31 23:30:00', 0x9012: '-02:00', 0x9292: '045', 0x9011: '+09:00' }), { valueMs: Date.UTC(2025, 0, 1, 1, 30, 0, 45), domain: 'instant', source: 'exif-digitized', display: '2024-12-31 23:30:00.045-02:00', offsetMinutes: -120 });
  assert.equal(capture({ 0x0132: '2024:01:01 01:02:03' }), null, 'file modification EXIF tag is not capture time');
  assert.equal(capture({}), null);
});

test('EXIF invalid dates are rejected instead of rolling over or guessing a timezone', () => {
  for (const value of ['2023:02:29 00:00:00', '2024:04:31 00:00:00', '2024:13:01 00:00:00', '2024:01:00 00:00:00', '2024:01:01 24:00:00', '2024:01:01 00:60:00', '2024:01:01 00:00:60', '0000:01:01 00:00:00', '    :  :     :  :  ', '2024-01-01 00:00:00']) assert.equal(capture({ 0x9003: value }), null, value);
  const early = capture({ 0x9003: '0099:01:01 00:00:00' });
  assert.equal(new Date(early.valueMs).getUTCFullYear(), 99);
  for (const offset of ['+24:00', '-01:60', '+9:00', '  :  ', 'abc']) assert.equal(capture({ 0x9003: '2024:01:01 00:00:00', 0x9011: offset }).domain, 'wall');
  for (const subsec of ['abc', '-1', '12.3']) assert.equal(capture({ 0x9003: '2024:01:01 00:00:00', 0x9291: subsec }).valueMs, Date.UTC(2024, 0, 1));
  assert.equal(capture({ 0x9003: '2024:01:01 00:00:00', 0x9011: '+00:00' }).domain, 'instant');
});

test('EXIF corrupt pointers, counts, types and nonterminated text fail closed without affecting dimensions', () => {
  for (const mutate of [
    b => b.writeUInt32LE(0xffffffff, 30), // Exif IFD offset
    b => b.writeUInt32LE(8, 30), // self-reference: IFD0 is not an Exif date directory
    b => b.writeUInt16LE(65535, 38),
    b => b.writeUInt16LE(7, 42), // DateTimeOriginal type
    b => b.writeUInt32LE(0xffffffff, 44), // count
    b => b.writeUInt32LE(0xffffffff, 48), // data pointer
    b => b.fill(65, 56) // missing string terminator
  ]) {
    const jpeg = timedJpeg({ 0x9003: '2024:01:01 00:00:00' }); const at = jpeg.indexOf(Buffer.from('Exif\0\0')) + 6;
    const length = jpeg.readUInt16BE(at - 8) - 8; mutate(jpeg.subarray(at, at + length));
    const value = Core.inspectImageHeader(jpeg); assert.equal(value.captureTime, null); assert.equal(value.width, 320); assert.equal(value.orientation, 6);
  }
});

const records = (...contents) => contents.map((data, n) => Object.freeze({ id: `p${n}`, file: file(`photo-${n}.jpg`, data), size: new Blob([data]).size, kept: n % 2 === 0 }));
const nativeDigest = (algorithm, bytes) => crypto.webcrypto.subtle.digest(algorithm, bytes);

test('exact duplicates narrow by size, SHA-256 then original bytes, with stable sets and no input mutation', async () => {
  const input = records('same', 'else', 'same', 'longer file', 'else', 'unique');
  const original = input.map(p => ({ ...p })), hashed = [], progress = [];
  const result = await Core.findExactDuplicates(input, { digest: async (algorithm, bytes) => { assert.equal(algorithm, 'SHA-256'); hashed.push(bytes.byteLength); return nativeDigest(algorithm, bytes); }, onProgress: p => progress.push(p) });
  assert.deepEqual(result.sets, [['p0', 'p2'], ['p1', 'p4']]);
  assert.deepEqual({ ...result.statuses }, { p0: 'duplicate', p1: 'duplicate', p2: 'duplicate', p3: 'unique-size', p4: 'duplicate', p5: 'unique-size' });
  assert.deepEqual(hashed, [4, 4, 4, 4]); assert.deepEqual(input, original);
  assert.equal(progress.at(-1).phase, 'complete'); assert.equal(progress.at(-1).completedFiles, input.length);
  assert.equal(progress.at(-1).totalFiles, input.length);
});

test('digest collision never labels different bytes as exact duplicates', async () => {
  const input = records('aaaa', 'bbbb', 'aaaa', 'cccc', 'bbbb');
  const result = await Core.findExactDuplicates(input, { digest: async () => new Uint8Array(32).buffer });
  assert.deepEqual(result.sets, [['p0', 'p2'], ['p1', 'p4']]); assert.equal(result.statuses.p3, 'checked');
});

test('exact duplicate verification compares bounded chunks and yields; hashing is sequential', async () => {
  const input = records(new Uint8Array(2 * 1024 * 1024 + 9).fill(71), new Uint8Array(2 * 1024 * 1024 + 9).fill(71));
  let active = 0, maximum = 0, timer = false; const slices = [];
  for (const p of input) { const original = p.file.slice.bind(p.file); p.file.slice = (start, end) => { slices.push(end - start); return original(start, end); }; }
  setTimeout(() => { timer = true; }, 0);
  const result = await Core.findExactDuplicates(input, { digest: async (algorithm, bytes) => { active++; maximum = Math.max(maximum, active); await new Promise(resolve => setTimeout(resolve, 0)); const hash = await nativeDigest(algorithm, bytes); active--; return hash; } });
  assert.deepEqual(result.sets, [['p0', 'p1']]); assert.equal(maximum, 1); assert.ok(timer);
  assert.ok(slices.slice(2).length >= 6); assert.ok(slices.slice(2).every(length => length <= 1024 * 1024));
});

test('per-file hash budget and unavailable crypto are explicit and do not read skipped candidates', async () => {
  const input = records('same', 'same', 'other size');
  for (const p of input) p.file.slice = () => { throw new Error('must not read'); };
  let result = await Core.findExactDuplicates(input, { maxHashBytes: 3 });
  assert.deepEqual(result.sets, []); assert.equal(result.statuses.p0, 'skipped-large'); assert.equal(result.statuses.p1, 'skipped-large'); assert.equal(result.statuses.p2, 'unique-size');
  result = await Core.findExactDuplicates(input, { digest: null });
  assert.equal(result.statuses.p0, 'unavailable'); assert.equal(result.statuses.p1, 'unavailable'); assert.equal(result.statuses.p2, 'unique-size');
  await assert.rejects(Core.findExactDuplicates(input, { maxHashBytes: -1 }), /maxHashBytes/);
});

test('duplicate analysis cancellation before/read/digest/compare/complete returns no stale result and can retry', async () => {
  const input = records('same', 'same');
  const before = new AbortController(); before.abort();
  await assert.rejects(Core.findExactDuplicates(input, { signal: before.signal }), { name: 'AbortError' });
  for (const phase of ['hashing', 'comparing', 'complete']) { const controller = new AbortController(); await assert.rejects(Core.findExactDuplicates(input, { signal: controller.signal, onProgress: p => { if (p.phase === phase) controller.abort(); } }), { name: 'AbortError' }); }
  const controller = new AbortController(); let release, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const pending = Core.findExactDuplicates(input, { signal: controller.signal, digest: async () => { entered(); await new Promise(resolve => { release = resolve; }); return new Uint8Array(32).buffer; } });
  await started; controller.abort(); release(); await assert.rejects(pending, { name: 'AbortError' });
  assert.deepEqual((await Core.findExactDuplicates(input)).sets, [['p0', 'p1']]);
});

test('hash and comparison read failures isolate affected records; retry can finish', async () => {
  const input = records('same', 'same', 'same'); const original = input[0].file.slice.bind(input[0].file);
  input[0].file.slice = () => { throw new Error('simulated read failure'); };
  let result = await Core.findExactDuplicates(input); assert.equal(result.statuses.p0, 'failed'); assert.deepEqual(result.sets, [['p1', 'p2']]);
  let calls = 0; input[0].file.slice = (start, end) => { if (++calls > 1) throw new Error('comparison failure'); return original(start, end); };
  result = await Core.findExactDuplicates(input); assert.equal(result.statuses.p0, 'failed'); assert.deepEqual(result.sets, [['p1', 'p2']]);
  input[0].file.slice = original; assert.deepEqual((await Core.findExactDuplicates(input)).sets, [['p0', 'p1', 'p2']]);
  result = await Core.findExactDuplicates(input, { digest: async () => { throw new Error('digest failed'); } }); assert.equal(result.statuses.p0, 'failed'); assert.deepEqual(result.sets, []);
});

test('duplicate analysis handles empty files, prototype-like IDs, and invalid record identity safely', async () => {
  const input = records('', ''); const safe = [{ ...input[0], id: '__proto__' }, { ...input[1], id: 'constructor' }];
  const result = await Core.findExactDuplicates(safe); assert.deepEqual(result.sets, [['__proto__', 'constructor']]); assert.equal(result.statuses.__proto__, 'duplicate');
  assert.deepEqual((await Core.findExactDuplicates([])).sets, []);
  await assert.rejects(Core.findExactDuplicates([input[0], input[0]]), /unique.*id|duplicate.*id/i);
  assert.equal((await Core.findExactDuplicates([{ ...input[0], size: 10 }])).statuses.p0, 'failed');
});

test('EXIF directory traversal excludes GPS and unrelated timestamps, and preserves original priority across APP1 blocks', () => {
  const first = timedJpeg({ 0x9004: '2020:01:01 00:00:00' });
  const second = timedJpeg({ 0x9003: '2024:02:29 12:00:00' });
  const firstEnd = 4 + first.readUInt16BE(4), secondEnd = 4 + second.readUInt16BE(4);
  const combined = Buffer.concat([first.subarray(0, firstEnd), second.subarray(2, secondEnd), first.subarray(firstEnd)]);
  assert.equal(Core.inspectImageHeader(combined).captureTime.source, 'exif-original');
  assert.equal(Core.inspectImageHeader(combined).captureTime.valueMs, Date.UTC(2024, 1, 29, 12));
  const gps = Buffer.from(second); const tiff = gps.indexOf(Buffer.from('Exif\0\0')) + 6;
  gps.writeUInt16LE(0x8825, tiff + 22); // Replace ExifIFD pointer with GPS pointer. Never traverse it.
  assert.equal(Core.inspectImageHeader(gps).captureTime, null);
  assert.equal(Core.inspectImageHeader(second.subarray(0, secondEnd - 1)).captureTime, null);
  assert.equal(capture({ 0x9003: '2100:02:29 00:00:00' }), null);
  assert.equal(capture({ 0x9003: '2000:02:29 00:00:00' }).domain, 'wall');
});

test('duplicate analysis defaults to unavailable when native crypto is missing', async () => {
  const context = { window: {}, TextEncoder, Blob, setTimeout, DOMException, Uint8Array, DataView, ArrayBuffer };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/core.js'), 'utf8'), context);
  const input = records('same', 'same');
  for (const p of input) p.file.slice = () => { throw new Error('must not read'); };
  const result = await context.window.BestShotCore.findExactDuplicates(input);
  assert.equal(result.statuses.p0, 'unavailable'); assert.equal(result.statuses.p1, 'unavailable'); assert.equal(result.sets.length, 0);
});

test('cancelling an in-flight file read or chunk comparison rejects after the pending read settles', async () => {
  for (const holdAt of [1, 2]) {
    const input = records('same', 'same'), controller = new AbortController();
    let release, entered, count = 0;
    const enteredRead = new Promise(resolve => { entered = resolve; });
    const original = input[0].file.slice.bind(input[0].file);
    input[0].file.slice = (start, end) => {
      const part = original(start, end);
      if (++count !== holdAt) return part;
      return { arrayBuffer: async () => { entered(); await new Promise(resolve => { release = resolve; }); return part.arrayBuffer(); } };
    };
    const pending = Core.findExactDuplicates(input, { signal: controller.signal });
    await enteredRead; controller.abort(); release(); await assert.rejects(pending, { name: 'AbortError' });
    input[0].file.slice = original; assert.deepEqual((await Core.findExactDuplicates(input)).sets, [['p0', 'p1']]);
  }
});

test('short reads and malformed digest output cannot create a duplicate claim', async () => {
  const input = records('same', 'same', 'same');
  input[0].file.slice = () => ({ arrayBuffer: async () => new ArrayBuffer(0) });
  let result = await Core.findExactDuplicates(input); assert.equal(result.statuses.p0, 'failed'); assert.deepEqual(result.sets, [['p1', 'p2']]);
  result = await Core.findExactDuplicates(input, { digest: async () => new ArrayBuffer(1) });
  assert.deepEqual(result.sets, []); assert.equal(result.statuses.p1, 'failed');
});

test('seeded malformed EXIF mutations never cause an out-of-bounds exception', () => {
  const valid = timedJpeg({ 0x9003: '2024:02:29 12:30:45', 0x9011: '+09:00', 0x9291: '123' });
  const start = valid.indexOf(Buffer.from('Exif\0\0')) + 6, end = 4 + valid.readUInt16BE(4);
  let seed = 0x4c617469;
  for (let n = 0; n < 500; n++) {
    const mutated = Buffer.from(valid);
    for (let j = 0; j < 6; j++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; mutated[start + seed % (end - start)] = seed >>> 24; }
    const header = Core.inspectImageHeader(mutated); assert.equal(header.width, 320); assert.equal(header.height, 240);
    if (header.captureTime) assert.ok(Number.isFinite(header.captureTime.valueMs));
  }
});
