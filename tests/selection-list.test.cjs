'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Core = require('../src/core.js');

const ZIP32_MAX = 0xfffffffe;
const file = (name, contents = 'original bytes') => new File([contents], name, { lastModified: 1700000000000 });
const metadata = (name, size = 1) => ({ name, size, lastModified: 1700000000000, slice() { throw new Error('File bytes must not be read'); } });
const plan = inputs => Core.planZipBatches(inputs, { maxBytes: ZIP32_MAX });
const envelopeKeys = ['schemaVersion', 'scope', 'snapshotSource', 'rows'];
const rowKeys = ['selectionIndex', 'originalName', 'zipEntryName', 'zipArchiveName', 'zipPart', 'sizeBytes'];
const csvHeaders = ['schemaVersion', 'scope', 'snapshotSource', 'selectionIndex', 'originalName_display', 'zipEntryName_display', 'zipArchiveName_display', 'zipPart', 'sizeBytes'];

// Parse only the documented fully quoted, one-line CSV dialect independently.
function parseCsv(text) {
  assert.equal(text[0], '\ufeff');
  assert.ok(text.endsWith('\r\n'));
  assert.ok(!text.slice(1).replace(/\r\n/g, '').match(/[\r\n]/));
  return text.slice(1, -2).split('\r\n').map(line => {
    const cells = [];
    let index = 0;
    while (index < line.length) {
      assert.equal(line[index++], '"', 'every cell begins with a quote');
      let value = '', closed = false;
      while (index < line.length) {
        const char = line[index++];
        if (char !== '"') value += char;
        else if (line[index] === '"') { value += '"'; index++; }
        else { closed = true; break; }
      }
      assert.ok(closed, 'every cell has a closing quote');
      cells.push(value);
      if (index < line.length) assert.equal(line[index++], ',');
    }
    assert.equal(cells.length, csvHeaders.length);
    return cells;
  });
}

function readZipEntries(arrayBuffer) {
  const bytes = Buffer.from(arrayBuffer), end = bytes.length - 22;
  assert.equal(bytes.readUInt32LE(end), 0x06054b50);
  const entries = [];
  let cursor = bytes.readUInt32LE(end + 16);
  for (let index = 0; index < bytes.readUInt16LE(end + 10); index++) {
    assert.equal(bytes.readUInt32LE(cursor), 0x02014b50);
    const size = bytes.readUInt32LE(cursor + 24), nameLength = bytes.readUInt16LE(cursor + 28);
    const name = bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    const local = bytes.readUInt32LE(cursor + 42), start = local + 30 + nameLength;
    assert.equal(bytes.readUInt32LE(local), 0x04034b50);
    entries.push({ name, size, contents: bytes.subarray(start, start + size).toString('utf8') });
    cursor += 46 + nameLength;
  }
  assert.equal(cursor, end);
  return entries;
}

test('selection-list functions are exported in the browser and CommonJS', () => {
  const context = { window: {}, TextEncoder, Blob, setTimeout, Uint8Array, DataView, ArrayBuffer };
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/core.js'), 'utf8'), context);
  for (const name of ['createSelectionList', 'serializeSelectionList', 'selectionListFilename']) {
    assert.equal(typeof Core[name], 'function');
    assert.equal(typeof context.window.BestShotCore[name], 'function');
  }
});

test('JSON preserves exact original filenames and emits only the ordered versioned allowlist', () => {
  const names = ['é.jpg', 'e\u0301.jpg', '日本語, "写真".jpg', '=SUM(1,2).jpg', 'a\\b\u0000\t\r\n\u0085\u202e.jpg', '', '💚.jpg'];
  const inputs = names.map((name, index) => file(name, 'x'.repeat(index)));
  const currentPlan = plan(inputs);
  const list = Core.createSelectionList(currentPlan, '../旅行.ZIP.zip', 'current_keep');
  const json = Core.serializeSelectionList(list, 'json'), parsed = JSON.parse(json);
  assert.deepEqual(Object.keys(parsed), envelopeKeys);
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.scope, 'kept-zip-plan');
  assert.equal(parsed.snapshotSource, 'current_keep');
  assert.deepEqual(parsed.rows.map(row => row.originalName), inputs.map(input => input.name));
  assert.notEqual(parsed.rows[0].originalName, parsed.rows[1].originalName, 'NFC/NFD originals stay distinct');
  assert.deepEqual(parsed.rows, inputs.map((input, index) => ({
    selectionIndex: index + 1, originalName: input.name, zipEntryName: currentPlan.names[index],
    zipArchiveName: '旅行.zip', zipPart: 1, sizeBytes: input.size
  })));
  for (const row of parsed.rows) assert.deepEqual(Object.keys(row), rowKeys);
  assert.equal(json, JSON.stringify(parsed, null, 2) + '\n');
  assert.equal(json, Core.serializeSelectionList(list, 'json'));
  assert.ok(!json.startsWith('\ufeff'));
});

test('selection lists are deeply frozen and never serialize File, photo, path or analysis metadata', () => {
  let bytesRead = 0, forbiddenReads = 0;
  const input = metadata('private-name.jpg', 7);
  input.slice = input.arrayBuffer = input.stream = input.text = () => { bytesRead++; throw new Error('unexpected read'); };
  for (const key of ['relativePath', 'webkitRelativePath', 'exif', 'gps', 'timestamp', 'captureTime', 'groupId', 'embedding', 'metrics', 'pixels', 'thumbnailUrl', 'contentHash', 'toJSON']) {
    Object.defineProperty(input, key, { get() { forbiddenReads++; throw new Error('private field accessed: ' + key); } });
  }
  const currentPlan = plan([input]);
  const list = Core.createSelectionList(currentPlan, 'chosen', 'zip_batch_plan');
  for (const object of [list, list.rows, ...list.rows]) assert.ok(Object.isFrozen(object));
  assert.throws(() => { list.rows[0].originalName = 'changed'; }, TypeError);
  assert.throws(() => { list.rows.push({}); }, TypeError);
  assert.throws(() => { list.scope = 'all-photos'; }, TypeError);
  assert.deepEqual(Object.keys(list), envelopeKeys);
  assert.deepEqual(Object.keys(list.rows[0]), rowKeys);
  for (const format of ['json', 'csv']) {
    const text = Core.serializeSelectionList(list, format);
    assert.ok(!/relativePath|webkitRelativePath|exif|gps|timestamp|captureTime|groupId|embedding|metrics|pixels|thumbnailUrl|contentHash|lastModified|estimatedBytes/.test(text));
  }
  assert.equal(bytesRead, 0);
  assert.equal(forbiddenReads, 0);
});

test('raw names, size, ordering and output base are frozen independently of later source changes', () => {
  let nameReads = 0;
  const first = metadata('unused', 7), second = metadata('é.jpg', 9);
  Object.defineProperty(first, 'name', { configurable: true, get() { nameReads++; return 'e\u0301.jpg'; } });
  const current = [first, second], currentPlan = plan(current);
  assert.equal(nameReads, 1);
  const base = { toString() { return 'frozen.zip'; } };
  const list = Core.createSelectionList(currentPlan, base, 'zip_batch_plan');
  const initialJson = Core.serializeSelectionList(list, 'json'), initialCsv = Core.serializeSelectionList(list, 'csv');
  current.reverse(); current.push(metadata('new.jpg', 11));
  Object.defineProperty(first, 'name', { get() { throw new Error('name was re-read'); } });
  first.size = 1000; first.lastModified = 0; second.name = 'changed.jpg'; second.size = 999;
  base.toString = () => 'changed.zip';
  assert.equal(Core.serializeSelectionList(list, 'json'), initialJson);
  assert.equal(Core.serializeSelectionList(list, 'csv'), initialCsv);
  assert.equal(Core.serializeSelectionList(Core.createSelectionList(currentPlan, 'frozen', 'zip_batch_plan'), 'json'), initialJson);
  assert.equal(nameReads, 1);
  assert.deepEqual(list.rows.map(row => [row.originalName, row.sizeBytes]), [['e\u0301.jpg', 7], ['é.jpg', 9]]);
});

test('each selected row matches the actual ZIP entries and independent part filenames', async () => {
  const names = ['photo.jpg', 'PHOTO.JPG', 'é.png', 'e\u0301.png', '写真'.repeat(100) + '.jpg'];
  const inputs = names.map((name, index) => file(name, 'original-' + index));
  const unique = Core.uniqueNames(inputs), maxBytes = Math.max(...unique.map((name, index) => 98 + Buffer.byteLength(name) * 2 + inputs[index].size));
  const currentPlan = Core.planZipBatches(inputs, { maxBytes });
  assert.ok(currentPlan.batches.length > 1);
  const base = '旅行'.repeat(100) + '.zip';
  const list = Core.createSelectionList(currentPlan, base, 'zip_batch_plan');
  const allRows = [];
  for (const batch of currentPlan.batches) {
    const archive = await Core.createZipBatch(currentPlan, batch.index);
    const entries = readZipEntries(await archive.arrayBuffer());
    const rows = list.rows.filter(row => row.zipPart === batch.index + 1);
    assert.deepEqual(rows.map(row => [row.zipEntryName, row.sizeBytes]), entries.map(entry => [entry.name, entry.size]));
    for (const row of rows) {
      assert.equal(row.zipArchiveName, Core.zipBatchFilename(base, batch.index, currentPlan.batches.length));
      assert.ok(Buffer.byteLength(row.zipArchiveName) <= 240);
      assert.equal(row.originalName, names[row.selectionIndex - 1]);
    }
    assert.deepEqual(entries.map(entry => entry.contents), rows.map(row => 'original-' + (row.selectionIndex - 1)));
    allRows.push(...rows);
  }
  assert.deepEqual(allRows, list.rows);
  assert.deepEqual(list.rows.map(row => row.selectionIndex), [1, 2, 3, 4, 5]);
});

test('CSV is a fully quoted UTF-8 BOM display format for ASCII/fullwidth formula starts and separators', () => {
  const names = ['=1+2.jpg', '+SUM(1,2).jpg', '-1.jpg', '@x.jpg', '＝1.jpg', '＋1.jpg', '－1.jpg', '＠x.jpg', 'a,b;c"d.jpg', "'quoted.jpg", '日本語.jpg'];
  const currentPlan = plan(names.map(name => metadata(name)));
  const list = Core.createSelectionList(currentPlan, '=archive', 'current_keep');
  const csv = Core.serializeSelectionList(list, 'csv'), parsed = parseCsv(csv);
  assert.deepEqual([...Buffer.from(csv).subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.deepEqual(parsed[0], csvHeaders);
  assert.deepEqual(parsed.slice(1).map(row => row[4]), names.map(name => 'file: ' + name));
  parsed.slice(1).forEach((row, index) => {
    assert.deepEqual(row.slice(0, 4), ['1', 'kept-zip-plan', 'current_keep', String(index + 1)]);
    assert.equal(row[5], 'file: ' + currentPlan.names[index]);
    assert.equal(row[6], 'file: =archive.zip');
    assert.deepEqual(row.slice(7), ['1', '1']);
    for (const column of [4, 5, 6]) assert.ok(row[column].startsWith('file: '));
  });
  assert.ok(csv.includes('a,b;c""d.jpg'));
  assert.equal(csv, Core.serializeSelectionList(list, 'csv'));
});

test('CSV renders controls, bidi formatting and backslashes visibly without losing raw JSON names', () => {
  const name = '\t\r\n\u0000\u001f\u007f\u0085\u009f\u061c\u200e\u200f\u2028\u2029\u202a\u202e\u2066\u2069\u206f\ufeff\\u000a_日本語.jpg';
  const expected = 'file: \\u0009\\u000d\\u000a\\u0000\\u001f\\u007f\\u0085\\u009f\\u061c\\u200e\\u200f\\u2028\\u2029\\u202a\\u202e\\u2066\\u2069\\u206f\\ufeff\\\\u000a_日本語.jpg';
  const list = Core.createSelectionList(plan([metadata(name)]), 'names', 'current_keep');
  const csv = Core.serializeSelectionList(list, 'csv');
  assert.equal(parseCsv(csv)[1][4], expected);
  assert.ok(!/[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028-\u202e\u2066-\u206f\ufeff]/.test(csv.slice(1).replace(/\r\n/g, '')));
  assert.equal(JSON.parse(Core.serializeSelectionList(list, 'json')).rows[0].originalName, name);
});

test('selection-list filenames preserve a safe base and reserve the UTF-8 suffix budget', () => {
  assert.equal(Core.selectionListFilename('../旅行.ZIP.zip', 'json'), '旅行-selection.json');
  assert.equal(Core.selectionListFilename('...', 'csv'), 'best-shot-picker-selection.csv');
  assert.equal(Core.selectionListFilename('CON.zip', 'json'), '_CON-selection.json');
  assert.equal(Core.selectionListFilename('report', 'csv'), 'report-selection.csv');
  for (const format of ['json', 'csv']) {
    for (const base of ['写真'.repeat(200), 'x'.repeat(500) + '.zip', 'nested\\control\u0000?.zip', '\u202e../colon:name.zip']) {
      const name = Core.selectionListFilename(base, format);
      assert.ok(Buffer.byteLength(name) <= 240);
      assert.ok(name.endsWith('-selection.' + format));
      assert.ok(!/[\\/\u0000-\u001f\u007f-\u009f\u202e\ufffd:]/.test(name));
    }
  }
});

test('forged plans/lists, invalid sources/formats and single-ZIP overflow are rejected without reading', () => {
  const currentPlan = plan([metadata('a.jpg')]);
  for (const fake of [null, undefined, {}, { ...currentPlan }, JSON.parse(JSON.stringify(currentPlan))]) {
    assert.throws(() => Core.createSelectionList(fake, 'x', 'current_keep'), { code: 'INVALID_ZIP_PLAN' });
  }
  for (const source of [undefined, null, '', 'all_photos', {}, ['current_keep']]) {
    assert.throws(() => Core.createSelectionList(currentPlan, 'x', source), { code: 'INVALID_SELECTION_SOURCE' });
  }
  const list = Core.createSelectionList(currentPlan, 'x', 'current_keep');
  for (const fake of [undefined, null, {}, { ...list }, JSON.parse(JSON.stringify(list))]) {
    assert.throws(() => Core.serializeSelectionList(fake, 'json'), { code: 'INVALID_SELECTION_LIST' });
  }
  for (const format of [undefined, null, '', 'JSON', 'xlsx', {}, ['csv']]) {
    assert.throws(() => Core.serializeSelectionList(list, format), { code: 'INVALID_SELECTION_FORMAT' });
    assert.throws(() => Core.selectionListFilename('x', format), { code: 'INVALID_SELECTION_FORMAT' });
  }
  const manyParts = Core.planZipBatches([metadata('a.jpg'), metadata('b.jpg')], { maxBytes: 109 });
  assert.equal(manyParts.batches.length, 2);
  assert.throws(() => Core.createSelectionList(manyParts, 'x', 'current_keep'), { code: 'ZIP_LIMIT' });
  assert.equal(Core.createSelectionList(manyParts, 'x', 'zip_batch_plan').rows.length, 2);
  for (const name of [undefined, null, 1, {}]) {
    // Existing ZIP plans allow unnamed Blobs, but a raw-name list requires actual string names.
    assert.throws(() => Core.createSelectionList(plan([metadata(name)]), 'x', 'current_keep'), { code: 'INVALID_SELECTION_LIST' });
  }
});

test('numeric fields remain plain safe integers including the valid empty-file size', () => {
  const list = Core.createSelectionList(plan([metadata('empty.jpg', 0), metadata('large.jpg', 4294967080)]), 'x', 'zip_batch_plan');
  const parsed = JSON.parse(Core.serializeSelectionList(list, 'json'));
  assert.deepEqual(parsed.rows.map(row => row.sizeBytes), [0, 4294967080]);
  for (const row of parsed.rows) {
    for (const field of ['selectionIndex', 'zipPart', 'sizeBytes']) assert.ok(Number.isSafeInteger(row[field]));
    assert.ok(row.selectionIndex > 0 && row.zipPart > 0 && row.sizeBytes >= 0);
  }
  const csv = parseCsv(Core.serializeSelectionList(list, 'csv'));
  for (const row of csv.slice(1)) for (const column of [0, 3, 7, 8]) assert.match(row[column], /^(0|[1-9][0-9]*)$/);
});
