/*
 * Optional selection-list regression, independent of app/core serialization.
 * Run after the canonical build: both file:// variants by default. An explicitly
 * supplied BSP_PREVIEW_URL must be an owned PR preview and match the canonical
 * readable build byte-for-byte BEFORE synthetic files are supplied.
 *
 * Inputs are small valid PNGs; the batch scenario uses three valid 12 MiB padded
 * PNGs to cross the real 32 MiB preset. Native read/Blob/URL/anchor observers never
 * retain original contents or replace app/model/core state. A native read can be
 * held to inspect real import/export cancellation. Playwright's clock is used only
 * in the final resource-lifetime case. Pagehide events exercise cleanup handlers.
 * --self-test checks fixtures/parsers/observers without a build or browser.
 * These observations do not establish device memory limits or disk completion.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { pathToFileURL } = require('node:url');
const ROOT = path.resolve(__dirname, '..');
const RESULTS = path.join(ROOT, 'test-results');
const MiB = 1024 * 1024;
const JSON_BUTTON = '#downloadSelectionJsonButton';
const CSV_BUTTON = '#downloadSelectionCsvButton';
const BUTTONS = [JSON_BUTTON, CSV_BUTTON];
const CSV_HEADERS = ['schemaVersion', 'scope', 'snapshotSource', 'selectionIndex', 'originalName_display',
  'zipEntryName_display', 'zipArchiveName_display', 'zipPart', 'sizeBytes'];
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = (value >>> 8) ^ CRC_TABLE[(value ^ byte) & 255];
  return (value ^ 0xffffffff) >>> 0;
}
function chunk(type, bytes) {
  const body = Buffer.concat([Buffer.from(type), bytes]), header = Buffer.alloc(4), tail = Buffer.alloc(4);
  header.writeUInt32BE(bytes.length); tail.writeUInt32BE(crc32(body));
  return Buffer.concat([header, body, tail]);
}
function syntheticPNG(index, size = 512) {
  const width = 32, height = 24, header = Buffer.alloc(13);
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  const pixels = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (let c = 0; c < 3; c++) {
    pixels[y * (width * 3 + 1) + 1 + x * 3 + c] = (index * 79 + c * 61) % 256;
  }
  const begin = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(pixels))]);
  const end = chunk('IEND', Buffer.alloc(0)), padding = size - begin.length - end.length - 12;
  assert(padding >= 0);
  return Buffer.concat([begin, chunk('npAd', Buffer.alloc(padding, index)), end]);
}
const fixture = (name, index, size = 512 + index) => ({ name, mimeType: 'image/png', buffer: syntheticPNG(index, size) });
function nameFixtures() {
  return ['same.png', 'SAME.PNG', 'same?.png', 'caf\u00e9.png', 'cafe\u0301.png', '=SUM(1,2).png',
    '+plus.png', '-minus.png', '@cmd.png', '\t=cmd,\r\n"quoted"\u202e.png', 'folder\\=path.png',
    '\u96ea\ud83d\udcf7.png', 'UNSELECTED-PRIVATE-MARKER.png'].map((name, index) => fixture(name, index + 1));
}
const SAFE_NAMES = ['same.png', 'SAME-2.PNG', 'same-3.png', 'caf\u00e9.png', 'caf\u00e9-2.png', '=SUM(1,2).png',
  '+plus.png', '-minus.png', '@cmd.png', '=cmd,quoted.png', '=path.png', '\u96ea\ud83d\udcf7.png'];
const BATCH_NAMES = ['same.png', 'SAME-2.PNG', 'same-3.png'];
const batchFixtures = () => ['same.png', 'SAME.PNG', 'same?.png'].map((name, index) => fixture(name, index + 1, 12 * MiB + index));
function expectedList(files, names, archive, source = 'current_keep', parts = files.map(() => 1)) {
  return { schemaVersion: 1, scope: 'kept-zip-plan', snapshotSource: source,
    rows: files.map((file, index) => ({ selectionIndex: index + 1, originalName: file.name, zipEntryName: names[index],
      zipArchiveName: typeof archive === 'string' ? archive : archive[index], zipPart: parts[index], sizeBytes: file.buffer.length })) };
}
function displayName(raw) {
  let result = 'file: ';
  for (const char of raw) {
    const point = char.codePointAt(0);
    if (char === '\\') result += '\\\\';
    else if (point <= 31 || (point >= 127 && point <= 159) || point === 0x61c || point === 0x200e || point === 0x200f ||
        (point >= 0x2028 && point <= 0x202e) || (point >= 0x2066 && point <= 0x206f) || point === 0xfeff) {
      result += '\\u' + point.toString(16).padStart(4, '0');
    } else result += char;
  }
  return result;
}
function csvCells(list) {
  return [CSV_HEADERS, ...list.rows.map(row => [list.schemaVersion, list.scope, list.snapshotSource, row.selectionIndex,
    displayName(row.originalName), displayName(row.zipEntryName), displayName(row.zipArchiveName), row.zipPart, row.sizeBytes].map(String))];
}
// Independent strict CSV parser: every cell must be quoted, every line ends CRLF.
function parseCSV(bytes) {
  assert.deepEqual(bytes.subarray(0, 3), Buffer.from([0xef, 0xbb, 0xbf]), 'CSV starts with a UTF-8 BOM');
  const text = bytes.subarray(3).toString('utf8'), rows = [];
  let cursor = 0;
  while (cursor < text.length) {
    const row = [];
    while (true) {
      assert.equal(text[cursor++], '"', 'Each CSV cell, including headers and numbers, is quoted');
      let cell = '', closed = false;
      while (cursor < text.length) {
        const char = text[cursor++];
        if (char === '"') {
          if (text[cursor] === '"') { cell += '"'; cursor++; }
          else { closed = true; break; }
        } else { assert.notEqual(char, '\r', 'Controls are visibly escaped'); assert.notEqual(char, '\n'); cell += char; }
      }
      assert(closed, 'CSV quote closes'); row.push(cell);
      if (text[cursor] === ',') { cursor++; continue; }
      assert.equal(text.slice(cursor, cursor + 2), '\r\n', 'CSV records, including the last, end CRLF');
      cursor += 2; break;
    }
    rows.push(row);
  }
  assert(rows.length >= 2); return rows;
}
function validateJSON(bytes, expected) {
  assert.notDeepEqual(bytes.subarray(0, 3), Buffer.from([0xef, 0xbb, 0xbf]), 'JSON needs no BOM');
  const text = bytes.toString('utf8'), actual = JSON.parse(text);
  assert.deepEqual(actual, expected, 'Exact whitelist, raw names, sizes, planned archive names and order');
  assert.equal(text, JSON.stringify(expected, null, 2) + '\n', 'Stable readable JSON and final LF');
  assert(!text.includes('UNSELECTED-PRIVATE-MARKER'), 'Unselected names never enter the list');
  return actual;
}
function validateCSV(bytes, expected) {
  const actual = parseCSV(bytes); assert.deepEqual(actual, csvCells(expected));
  for (const row of actual.slice(1)) for (const index of [4, 5, 6]) {
    assert(row[index].startsWith('file: '), 'Filename cells have an inert literal prefix');
    assert.doesNotMatch(row[index], /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028-\u202e\u2066-\u206f\ufeff]/);
  }
  return actual;
}
function readZIP(bytes) {
  assert(bytes.length >= 22); const end = bytes.length - 22;
  assert.equal(bytes.readUInt32LE(end), 0x06054b50);
  assert.equal(bytes.readUInt16LE(end + 4), 0); assert.equal(bytes.readUInt16LE(end + 6), 0);
  assert.equal(bytes.readUInt16LE(end + 20), 0);
  const count = bytes.readUInt16LE(end + 10); assert.equal(bytes.readUInt16LE(end + 8), count); assert(count > 0);
  const start = bytes.readUInt32LE(end + 16); let cursor = start, offset = 0; const entries = [];
  for (let index = 0; index < count; index++) {
    assert.equal(bytes.readUInt32LE(cursor), 0x02014b50);
    assert.equal(bytes.readUInt16LE(cursor + 8), 0x800); assert.equal(bytes.readUInt16LE(cursor + 10), 0);
    const size = bytes.readUInt32LE(cursor + 20), checksum = bytes.readUInt32LE(cursor + 16), nameLength = bytes.readUInt16LE(cursor + 28);
    assert.equal(bytes.readUInt32LE(cursor + 24), size); assert.equal(bytes.readUInt32LE(cursor + 42), offset);
    assert.equal(bytes.readUInt16LE(cursor + 34), 0);
    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLength), name = nameBytes.toString('utf8');
    assert.deepEqual(Buffer.from(name), nameBytes);
    assert.equal(bytes.readUInt32LE(offset), 0x04034b50); assert.equal(bytes.readUInt16LE(offset + 6), 0x800);
    assert.equal(bytes.readUInt16LE(offset + 8), 0); assert.equal(bytes.readUInt32LE(offset + 14), checksum);
    assert.equal(bytes.readUInt32LE(offset + 18), size); assert.equal(bytes.readUInt32LE(offset + 22), size);
    assert.equal(bytes.readUInt16LE(offset + 26), nameLength);
    assert.deepEqual(bytes.subarray(offset + 30, offset + 30 + nameLength), nameBytes);
    const dataStart = offset + 30 + nameLength + bytes.readUInt16LE(offset + 28);
    assert(dataStart + size <= start); const original = bytes.subarray(dataStart, dataStart + size);
    assert.equal(crc32(original), checksum); entries.push({ name, size, sha256: sha(original) });
    offset = dataStart + size; cursor += 46 + nameLength + bytes.readUInt16LE(cursor + 30) + bytes.readUInt16LE(cursor + 32);
  }
  assert.equal(offset, start); assert.equal(cursor, end); assert.equal(cursor - start, bytes.readUInt32LE(end + 12));
  return entries;
}
function expectedEntries(files, names) { return files.map((file, index) => ({ name: names[index], size: file.buffer.length, sha256: sha(file.buffer) })); }
function targets(env) {
  if (!env.BSP_PREVIEW_URL) return ['index.html', 'index.self-extract.html'].map(variant => ({
    variant, url: pathToFileURL(path.join(ROOT, 'dist', variant)).href
  }));
  const url = new URL(env.BSP_PREVIEW_URL);
  assert.equal(url.protocol, 'https:'); assert.match(url.hostname, /^r\d+-pr-\d+-bk-previews\.ttomohisa\.workers\.dev$/);
  for (const key of ['search', 'hash', 'username', 'password', 'port']) assert.equal(url[key], '');
  assert.equal(url.pathname, '/'); return [{ variant: 'https-preview', url: url.href, preview: true }];
}
function installAudit() {
  const NativeBlob = window.Blob, nativeRead = NativeBlob.prototype.arrayBuffer;
  const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL), nativeClick = HTMLAnchorElement.prototype.click;
  const category = blob => blob.type.split(';')[0] === 'application/zip' ? 'zip' :
    ['application/json', 'text/csv'].includes(blob.type.split(';')[0]) ? 'list' : '';
  const state = window.__selectionListAudit = { reads: 0, holdNext: false, pending: [], built: [], urls: [], clicks: [], violations: [],
    release() { this.pending.splice(0).forEach(release => release()); },
    snapshot() { return { reads: this.reads, pending: this.pending.length, built: this.built.slice(),
      urls: this.urls.map(item => ({ ...item })), clicks: this.clicks.slice(), violations: this.violations.slice() }; }
  };
  NativeBlob.prototype.arrayBuffer = async function(...args) {
    state.reads++; const held = state.holdNext; state.holdNext = false;
    const bytes = await nativeRead.apply(this, args);
    if (held) await new Promise(resolve => state.pending.push(resolve)); return bytes;
  };
  function ObservedBlob(...args) {
    if (!new.target) throw new TypeError('Blob must be constructed');
    const blob = Reflect.construct(NativeBlob, args, new.target === ObservedBlob ? NativeBlob : new.target);
    const kind = category(blob); if (kind) state.built.push({ kind, size: blob.size }); return blob;
  }
  Object.setPrototypeOf(ObservedBlob, NativeBlob); ObservedBlob.prototype = NativeBlob.prototype; window.Blob = ObservedBlob;
  URL.createObjectURL = blob => {
    const url = create(blob), kind = category(blob); if (kind) state.urls.push({ url, kind, size: blob.size, revoked: false }); return url;
  };
  URL.revokeObjectURL = url => { const row = state.urls.find(item => item.url === url); if (row) row.revoked = true; return revoke(url); };
  HTMLAnchorElement.prototype.click = function(...args) {
    if (this.download && this.href.startsWith('blob:')) state.clicks.push({ filename: this.download, url: this.href });
    return nativeClick.apply(this, args);
  };
  window.addEventListener('securitypolicyviolation', event => state.violations.push({ directive: event.violatedDirective, blocked: event.blockedURI }));
}
const audit = page => page.evaluate(() => window.__selectionListAudit.snapshot());
const liveURLs = (state, kind) => state.urls.filter(item => item.kind === kind && !item.revoked);
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function session(browser, target) {
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: 'en-US', acceptDownloads: true });
  if (!target.preview) await context.setOffline(true);
  await context.addInitScript(installAudit);
  const page = await context.newPage(), errors = [], consoleErrors = [], requests = [], downloads = [];
  let allowedNavigation = target.preview ? 1 : 0;
  page.setDefaultTimeout(60000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('download', download => downloads.push(download.suggestedFilename()));
  context.on('request', request => {
    if (!/^https?:/.test(request.url())) return;
    if (allowedNavigation && request.url() === target.url && request.method() === 'GET' && request.isNavigationRequest() &&
        request.resourceType() === 'document' && request.frame() === page.mainFrame()) { allowedNavigation--; return; }
    requests.push(`${request.method()} ${request.resourceType()} ${request.url()}`);
  });
  try {
    const response = await page.goto(target.url);
    if (target.preview) {
      assert(response && response.ok()); assert.equal(response.url(), target.url); assert.equal(page.url(), target.url);
      assert.equal(sha(await response.body()), sha(await fs.readFile(path.join(ROOT, 'dist/index.html'))),
        'Verify exact canonical preview bytes before supplying synthetic inputs');
    }
    await context.setOffline(true); assert.equal(allowedNavigation, 0);
    await page.locator('#addButton').waitFor();
    assert.match(await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content'), /connect-src\s+'none'/);
    return { context, page, errors, consoleErrors, requests, downloads };
  } catch (error) { await context.close(); throw error; }
}
async function clean(run) {
  assert.deepEqual(run.requests, [], 'No runtime HTTP(S) requests'); assert.deepEqual(run.errors, [], 'No unhandled page errors');
  assert.deepEqual(run.consoleErrors, [], 'No console errors'); assert.deepEqual((await audit(run.page)).violations, [], 'No CSP violations');
}
async function idle(page, count) {
  await page.locator('#loadProgress').waitFor({ state: 'hidden' }); await page.locator('#analysisProgress').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => /finished|完了/.test(document.querySelector('#analysisResult').textContent));
  assert.equal(await page.locator('.photo-card').count(), count); assert.equal(await page.locator('#errorList li').count(), 0);
}
async function openOptions(page) {
  if (!(await page.locator('#selectionListOptions').evaluate(node => node.open))) {
    await page.locator('#selectionListOptions > summary').focus(); await page.locator('#selectionListOptions > summary').press('Enter');
  }
  assert(await page.locator('#selectionListOptions').evaluate(node => node.open));
}
async function readyLists(page) {
  await page.waitForFunction(() => ['downloadSelectionJsonButton', 'downloadSelectionCsvButton'].every(id => !document.getElementById(id).disabled));
}
async function disabledLists(page) { for (const selector of BUTTONS) assert(await page.locator(selector).isDisabled(), `${selector} disabled`); }
async function download(page, action, expectedName) {
  const pending = page.waitForEvent('download'); await action(); const item = await pending;
  assert.equal(item.suggestedFilename(), expectedName); const bytes = await fs.readFile(await item.path());
  assert.equal(await item.failure(), null); return bytes;
}
async function listDownload(page, format, expected, name = 'Edited picks', action) {
  await readyLists(page); const before = await audit(page);
  const bytes = await download(page, action || (() => page.locator(format === 'json' ? JSON_BUTTON : CSV_BUTTON).click()), `${name}-selection.${format}`);
  const after = await audit(page);
  assert.equal(after.reads, before.reads, 'List generation reads no original bytes');
  assert.equal(after.built.filter(item => item.kind === 'zip').length, before.built.filter(item => item.kind === 'zip').length,
    'A list never constructs a ZIP');
  assert.deepEqual(liveURLs(after, 'zip'), liveURLs(before, 'zip'), 'A list neither acquires nor releases the current archive URL');
  assert.equal(after.clicks.length, before.clicks.length + 1, 'Exactly one explicit list request');
  if (format === 'json') validateJSON(bytes, expected); else validateCSV(bytes, expected);
  return bytes;
}
async function language(page, locale) {
  if (await page.locator('html').getAttribute('lang') !== locale) await page.locator('#languageButton').click();
  assert.equal(await page.locator('html').getAttribute('lang'), locale);
}
async function narrowScreens(page, target) {
  for (const locale of ['ja', 'en']) {
    await language(page, locale); await readyLists(page);
    const status = await page.locator('#selectionListResult').textContent();
    assert.match(status, locale === 'ja' ? /[\u3040-\u30ff\u4e00-\u9fff]/ : /[A-Za-z]/);
    assert.match(status, locale === 'ja' ? /ダウンロード|ブラウザー/ : /requested|browser/i);
    assert.doesNotMatch(status, /saved successfully|saved to.*disk|disk write complete|保存が完了しました|保存に成功しました/i);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 640 }); await page.locator('[data-mobile-key="save"]').click();
      for (const selector of ['#selectionListName', JSON_BUTTON, CSV_BUTTON]) {
        const control = page.locator(selector); await control.scrollIntoViewIfNeeded(); const box = await control.boundingBox();
        assert(box && box.x >= -1 && box.x + box.width <= width + 1, `${selector} fits ${locale}/${width}`);
        assert(await control.evaluate(node => {
          const rect = node.getBoundingClientRect(), hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
          return rect.top >= 0 && rect.bottom <= innerHeight && (hit === node || node.contains(hit));
        }), 'List controls remain reachable above fixed navigation');
        await control.focus(); assert(await control.evaluate(node => node === document.activeElement));
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
      await page.screenshot({ path: path.join(RESULTS, `selection-list.${target.variant}.${locale}.${width}.png`) });
    }
  }
  await page.setViewportSize({ width: 1360, height: 900 });
}

async function currentKeepWorkflow(browser, target) {
  const run = await session(browser, target); let phase = 'empty and opt-in';
  try {
    const { page } = run, files = nameFixtures(), selected = files.slice(0, -1);
    assert.equal(await page.locator('#zipMode').inputValue(), 'single');
    assert.equal(await page.locator('#selectionListOptions').evaluate(node => node.open), false, 'Optional list is collapsed by default');
    assert.equal(await page.locator('#selectionListResult').getAttribute('role'), 'status');
    assert.equal(await page.locator('#selectionListResult').getAttribute('aria-live'), 'polite');
    await openOptions(page); await disabledLists(page);
    await page.locator('#fileInput').setInputFiles(files); await idle(page, files.length); await disabledLists(page);
    assert.equal(run.downloads.length, 0, 'Opening options/import/analysis never downloads a list');
    for (let index = 0; index < selected.length; index++) await page.locator(`#photo-p${index + 1} .keep-button`).click();
    const defaultListName = await page.locator('#selectionListName').inputValue(); assert(defaultListName.trim());
    await page.locator('#outputFilename').fill('../Trip:*?.zip.zip');
    assert.equal(await page.locator('#selectionListName').inputValue(), defaultListName, 'List basename is separate from ZIP basename');
    await page.locator('#selectionListName').fill('../Edited picks:*?.zip.zip');
    assert.match(await page.locator('#selectionListSummary').textContent(), /current|Keep|choices/i);
    assert.equal(run.downloads.length, 0, 'Keep and filename editing never auto-export');
    const initial = expectedList(selected, SAFE_NAMES, 'Trip.zip');

    phase = 'synchronous current Keep capture and shared format double-click guard';
    await listDownload(page, 'json', initial, 'Edited picks', () => page.evaluate(() => {
      document.querySelector('#downloadSelectionJsonButton').click();
      document.querySelector('#downloadSelectionJsonButton').click();
      document.querySelector('#downloadSelectionCsvButton').click();
      document.querySelector('#photo-p1 .keep-button').click();
    }));
    await settle(page); assert.equal(run.downloads.length, 1, 'Rapid mixed-format activation starts only one request');
    assert.equal(await page.locator('.photo-card.kept').count(), selected.length - 1);
    const changed = expectedList(selected.slice(1), ['SAME.PNG', 'same-2.png', ...SAFE_NAMES.slice(3)], 'Trip.zip');
    await listDownload(page, 'json', changed);
    await page.locator('#appToastAction').click();
    assert.equal(await page.locator('.photo-card.kept').count(), selected.length);
    await listDownload(page, 'csv', initial, 'Edited picks', async () => {
      await page.locator(CSV_BUTTON).focus(); await page.locator(CSV_BUTTON).press('Enter');
    });
    assert.equal(run.downloads.length, 3);
    await narrowScreens(page, target);

    phase = 'loading disables metadata export';
    await readyLists(page); await page.evaluate(() => { window.__selectionListAudit.holdNext = true; });
    const later = fixture('UNSELECTED-PRIVATE-MARKER-later.png', 30, 2048);
    await page.locator('#fileInput').setInputFiles([later]);
    await page.waitForFunction(() => window.__selectionListAudit.pending.length === 1);
    await disabledLists(page); await page.evaluate(() => window.__selectionListAudit.release()); await idle(page, files.length + 1);
    await readyLists(page); assert.equal(run.downloads.length, 3);

    phase = 'ordinary ZIP preparation disables list controls and cancellation recovers';
    await page.evaluate(() => { window.__selectionListAudit.holdNext = true; });
    await page.locator('#downloadButton').click();
    await page.waitForFunction(() => window.__selectionListAudit.pending.length === 1);
    await disabledLists(page); await page.locator('#cancelExportButton').click();
    await page.evaluate(() => window.__selectionListAudit.release());
    await page.locator('#exportProgress').waitFor({ state: 'hidden' }); await readyLists(page);
    assert.equal(run.downloads.length, 3, 'Cancelled ZIP does not trigger a list or archive request');
    await listDownload(page, 'json', initial);

    phase = 'original-byte ordinary ZIP stays photo-only';
    const zipBytes = await download(page, () => page.locator('#downloadButton').click(), 'Trip.zip');
    const entries = readZIP(zipBytes); assert.deepEqual(entries, expectedEntries(selected, SAFE_NAMES));
    assert(entries.every(entry => !/\.(?:json|csv)$/i.test(entry.name)), 'Optional lists are never inserted into a ZIP');
    assert.equal(run.downloads.length, 5);

    phase = 'pending ZIP confirmation disables lists during planning';
    await page.locator('#zipMode').selectOption('batches'); await page.locator('#zipBatchSize').selectOption('32');
    await disabledLists(page); await page.locator('#planZipBatchesButton').click();
    await page.locator('#appConfirmDialog').waitFor(); await disabledLists(page);
    await page.locator('#appConfirmCancel').click(); await disabledLists(page);
    assert(await page.locator('#zipBatchPanel').isHidden());
    await page.locator('#zipMode').selectOption('single'); await readyLists(page);
    assert.equal(run.downloads.length, 5);
    await clean(run);
    return { variant: target.variant, scenario: 'current-keep-and-independent-lists', originalCount: selected.length,
      exactUnicodeAndControlNames: true, inertCSVCells: true, clickTimeSnapshotAndUndo: true, optInOnly: true,
      ordinaryZipEntries: entries, explicitDownloadRequests: run.downloads.length, externalRequests: run.requests };
  } catch (error) { error.message = `${target.variant} / ${phase}: ${error.message}`; throw error; }
  finally { await run.context.close(); }
}

async function frozenBatchWorkflow(browser, target) {
  const run = await session(browser, target); let phase = 'list-only download before batch planning';
  try {
    const { page } = run, files = batchFixtures();
    await page.locator('#fileInput').setInputFiles(files); await idle(page, 3);
    for (let index = 1; index <= 3; index++) await page.locator(`#photo-p${index} .keep-button`).click();
    await openOptions(page); await page.locator('#selectionListName').fill('Edited picks');
    await page.locator('#outputFilename').fill('Batch memories');
    await listDownload(page, 'json', expectedList(files, BATCH_NAMES, 'Batch memories.zip'));
    await page.locator('#zipMode').selectOption('batches'); await disabledLists(page);
    await page.locator('#zipBatchSize').selectOption('32'); await disabledLists(page);
    const beforePlan = await audit(page);
    await page.locator('#planZipBatchesButton').click();
    assert.equal(await page.locator('#appConfirmDialog').evaluate(node => node.open), false,
      'List URLs and list requests never enter the prior-ZIP confirmation/lease state');
    await page.locator('#zipBatchPanel').waitFor(); await readyLists(page);
    assert.equal((await audit(page)).reads, beforePlan.reads, 'Batch review uses metadata only');
    assert.equal(await page.locator('#zipBatchList > li').count(), 2, 'Real 32 MiB preset creates two independent parts');
    assert.deepEqual(await page.locator('#zipBatchList > li ul > li').allTextContents(), BATCH_NAMES);
    assert.match(await page.locator('#selectionListSummary').textContent(), /plan|starting selection/i);
    for (const selector of ['#zipMode', '#zipBatchSize', '#outputFilename']) assert(await page.locator(selector).isDisabled());
    assert.equal(run.downloads.length, 1);
    const part1 = 'Batch memories-part-001-of-002.zip', part2 = 'Batch memories-part-002-of-002.zip';
    const planned = expectedList(files, BATCH_NAMES, [part1, part1, part2], 'zip_batch_plan', [1, 1, 2]);
    await listDownload(page, 'json', planned);

    phase = 'Keep/Undo/import/group edits keep the entire reviewed plan frozen';
    await page.locator('#photo-p1 .keep-button').click(); await page.locator('#appToastAction').click();
    await listDownload(page, 'csv', planned);
    await page.locator('#photo-p1 .keep-button').click();
    const later = fixture('later-kept.png', 9, 2048);
    await page.locator('#fileInput').setInputFiles([later]); await idle(page, 4);
    await page.locator('#photo-p4 .keep-button').click();
    const kept = [files[1].name, files[2].name, later.name];
    assert.deepEqual(await page.locator('.photo-card.kept .photo-name').allTextContents(), kept);
    const groups = await page.locator('.group-chip').evaluateAll(nodes => nodes.map(node => node.dataset.groupId));
    assert(groups.length >= 2);
    await page.locator('#organizeButton').click(); await page.locator('#sourceGroup').selectOption(groups[0]);
    await page.locator('#targetGroup').selectOption(groups[1]); await page.locator('#mergeGroupButton').click();
    assert.equal(await page.locator('.group-chip').count(), groups.length - 1);
    await listDownload(page, 'json', planned);
    await page.locator('#appToastAction').click(); assert.equal(await page.locator('.group-chip').count(), groups.length);
    await page.locator('#selectionListName').fill('Later list name');
    await listDownload(page, 'csv', planned, 'Later list name');
    assert.equal(await page.locator('#outputFilename').inputValue(), 'Batch memories');

    phase = 'metadata list during held ZIP preparation and cancellation';
    await readyLists(page); await page.evaluate(() => { window.__selectionListAudit.holdNext = true; });
    await page.locator('#prepareZipBatchButton').click();
    await page.waitForFunction(() => window.__selectionListAudit.pending.length === 1);
    const held = await audit(page);
    await listDownload(page, 'json', planned, 'Later list name');
    assert.equal((await audit(page)).reads, held.reads, 'Metadata list does not consume the held original read');
    assert.equal((await audit(page)).pending, 1);
    await page.locator('#cancelExportButton').click(); await page.evaluate(() => window.__selectionListAudit.release());
    await page.locator('#exportProgress').waitFor({ state: 'hidden' });
    assert.match(await page.locator('#zipBatchStatus').textContent(), /stopped|cancel/i);
    assert.equal((await audit(page)).built.filter(item => item.kind === 'zip').length, 0);
    await listDownload(page, 'csv', planned, 'Later list name');

    phase = 'ready archive survives list downloads and dismissed close confirmation';
    const beforePrepareDownloads = run.downloads.length;
    await page.locator('#prepareZipBatchButton').click(); await page.locator('#downloadZipBatchButton').waitFor();
    assert.equal(run.downloads.length, beforePrepareDownloads, 'ZIP preparation does not download either format');
    assert.equal(liveURLs(await audit(page), 'zip').length, 1);
    await page.locator('#closeZipBatchesButton').click(); await page.locator('#appConfirmDialog').waitFor();
    await disabledLists(page); await page.locator('#appConfirmCancel').click(); await readyLists(page);
    await listDownload(page, 'json', planned, 'Later list name');
    const first = await download(page, () => page.locator('#downloadZipBatchButton').click(), part1);
    assert(first.length <= 32 * MiB); assert.deepEqual(readZIP(first), expectedEntries(files.slice(0, 2), BATCH_NAMES.slice(0, 2)));
    await listDownload(page, 'csv', planned, 'Later list name');
    assert.equal(liveURLs(await audit(page), 'zip').length, 1);

    phase = 'advancing parts does not narrow the list or prepare/download silently';
    const beforeNext = await audit(page), downloadsBeforeNext = run.downloads.length;
    await page.locator('#nextZipBatchButton').click(); await settle(page);
    assert.equal(liveURLs(await audit(page), 'zip').length, 0);
    assert.equal((await audit(page)).built.filter(item => item.kind === 'zip').length, beforeNext.built.filter(item => item.kind === 'zip').length);
    assert.equal((await audit(page)).reads, beforeNext.reads); assert.equal(run.downloads.length, downloadsBeforeNext);
    await listDownload(page, 'json', planned, 'Later list name');
    await page.locator('#prepareZipBatchButton').click(); await page.locator('#downloadZipBatchButton').waitFor();
    const second = await download(page, () => page.locator('#downloadZipBatchButton').click(), part2);
    assert(second.length <= 32 * MiB); assert.deepEqual(readZIP(second), expectedEntries(files.slice(2), BATCH_NAMES.slice(2)));
    assert.deepEqual([...readZIP(first), ...readZIP(second)], expectedEntries(files, BATCH_NAMES), 'List mapping matches every unchanged original exactly once');
    await page.locator('#finishZipBatchesButton').click(); await disabledLists(page);
    assert.equal(liveURLs(await audit(page), 'zip').length, 0);
    assert.deepEqual(await page.locator('.photo-card.kept .photo-name').allTextContents(), kept);

    phase = 'closing the plan returns future lists to live Keep choices';
    await page.locator('#zipMode').selectOption('single'); await page.locator('#outputFilename').fill('New live archive');
    const liveFiles = [files[1], files[2], later];
    await listDownload(page, 'json', expectedList(liveFiles, ['SAME.PNG', 'same-2.png', later.name], 'New live archive.zip'), 'Later list name');
    await page.locator('#zipMode').selectOption('batches'); await page.locator('#planZipBatchesButton').click();
    const nextPlan = expectedList(liveFiles, ['SAME.PNG', 'same-2.png', later.name], 'New live archive.zip', 'zip_batch_plan');
    await listDownload(page, 'json', nextPlan, 'Later list name');

    phase = 'reset cancels a held batch and clears list state without invalidating requested list files';
    await readyLists(page); await page.evaluate(() => { window.__selectionListAudit.holdNext = true; });
    await page.locator('#prepareZipBatchButton').click();
    await page.waitForFunction(() => window.__selectionListAudit.pending.length === 1);
    const beforeReset = await audit(page), downloadsBeforeReset = run.downloads.length;
    await page.locator('#clearButton').click(); await page.locator('#appConfirmOk').click();
    await disabledLists(page); assert.equal(await page.locator('#selectionListResult').textContent(), '');
    assert.equal(await page.locator('.photo-card').count(), 0); assert(await page.locator('#zipBatchPanel').isHidden());
    await page.evaluate(() => window.__selectionListAudit.release()); await settle(page);
    const afterReset = await audit(page);
    assert.deepEqual(afterReset.built, beforeReset.built, 'Obsolete ZIP read cannot publish a list or archive');
    assert.equal(run.downloads.length, downloadsBeforeReset);
    assert.equal(liveURLs(afterReset, 'zip').length, 0);
    // The most recent list stays usable through reset; its own delayed cleanup owns it.
    const lastList = beforeReset.urls.filter(item => item.kind === 'list').at(-1);
    assert(afterReset.urls.some(item => item.url === lastList.url && !item.revoked));
    await clean(run);
    return { variant: target.variant, scenario: 'frozen-32MiB-batch-plan', budgetBytes: 32 * MiB,
      partEntries: [readZIP(first), readZIP(second)], fullPlanAfterAdvance: true, listDuringHeldPreparation: true,
      liveKeepImportAndGroupUndo: true, separateArchiveURLLifetime: true, resetRejectsStaleOutput: true,
      explicitDownloadRequests: run.downloads.length, externalRequests: run.requests };
  } catch (error) { error.message = `${target.variant} / ${phase}: ${error.message}`; throw error; }
  finally { await run.context.close(); }
}

async function listResourceLifetime(browser, target) {
  const run = await session(browser, target);
  try {
    const { page } = run, file = fixture('lifetime.png', 40, 1024);
    await page.locator('#fileInput').setInputFiles([file]); await idle(page, 1);
    await page.locator('.photo-card .keep-button').click(); await openOptions(page);
    await page.locator('#selectionListName').fill('Edited picks'); await page.locator('#outputFilename').fill('Lifetime');
    const expected = expectedList([file], [file.name], 'Lifetime.zip');
    // Fake time only here, after import/analysis. It verifies resource-timer logic,
    // not real elapsed performance, heap collection, or download completion.
    await page.clock.install();
    await listDownload(page, 'json', expected); await listDownload(page, 'csv', expected);
    const requested = await audit(page);
    assert.equal(liveURLs(requested, 'list').length, 2, 'Successive legitimate formats retain their own requested URLs');
    assert.equal(liveURLs(requested, 'zip').length, 0);
    await page.clock.fastForward(60001);
    assert.equal(liveURLs(await audit(page), 'list').length, 0, 'Each small-list URL is revoked after the 60-second retention');
    await listDownload(page, 'json', expected);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
    assert.equal(liveURLs(await audit(page), 'list').length, 1, 'Back-forward-cache pagehide keeps an active download URL');
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
    assert.equal(liveURLs(await audit(page), 'list').length, 0, 'Nonpersisted pagehide releases list download URLs');
    assert.equal(run.downloads.length, 3); await clean(run);
    return { variant: target.variant, scenario: 'independent-list-URL-lifetime', retentionMilliseconds: 60000,
      resourceTimerUsesVirtualTime: true, pagehideHandlersExercised: true, externalRequests: run.requests };
  } finally { await run.context.close(); }
}

async function selfTest() {
  const files = nameFixtures(), selected = files.slice(0, -1);
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
  for (const file of files) {
    assert.equal(file.buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    let offset = 8; const types = [];
    while (offset < file.buffer.length) {
      const size = file.buffer.readUInt32BE(offset), type = file.buffer.subarray(offset + 4, offset + 8).toString();
      assert.equal(crc32(file.buffer.subarray(offset + 4, offset + 8 + size)), file.buffer.readUInt32BE(offset + 8 + size));
      if (type === 'IDAT') assert.equal(zlib.inflateSync(file.buffer.subarray(offset + 8, offset + 8 + size)).length, (32 * 3 + 1) * 24);
      types.push(type); offset += size + 12;
    }
    assert.equal(offset, file.buffer.length); assert.deepEqual(types, ['IHDR', 'IDAT', 'npAd', 'IEND']);
  }
  assert.equal(new Set(files.map(file => sha(file.buffer))).size, files.length);
  assert.equal(displayName('\t=1\r\n\\\u202e\u2069\u061c\u007f'), 'file: \\u0009=1\\u000d\\u000a\\\\\\u202e\\u2069\\u061c\\u007f');
  assert.equal(displayName('cafe\u0301.png'), 'file: cafe\u0301.png', 'Display names preserve non-NFC originals');
  const expected = expectedList(selected, SAFE_NAMES, 'Trip.zip');
  const json = Buffer.from(JSON.stringify(expected, null, 2) + '\n'); validateJSON(json, expected);
  assert.throws(() => validateJSON(Buffer.from(JSON.stringify({ ...expected, groups: [] }, null, 2) + '\n'), expected));
  const csv = Buffer.from('\ufeff' + csvCells(expected).map(row => row.map(cell => '"' + cell.replace(/"/g, '""') + '"').join(',')).join('\r\n') + '\r\n');
  validateCSV(csv, expected);
  assert.throws(() => parseCSV(csv.subarray(3)), 'A missing BOM is detected');
  assert.throws(() => parseCSV(Buffer.from(csv.toString().replace(/\r\n/g, '\n'))), 'LF-only CSV is rejected');
  assert.throws(() => parseCSV(Buffer.from('\ufeff"one",unquoted\r\n')), 'Unquoted fields are rejected');
  assert.throws(() => validateCSV(Buffer.from(csv.toString().replace('file: =SUM', '=SUM')), expected), 'Formula-prefix removal is detected');
  assert.throws(() => validateCSV(Buffer.from(csv.toString().replace('\\u0009', '\t')), expected), 'Unescaped control characters are detected');
  const { File } = require('node:buffer'), core = require('../src/core.js');
  const input = selected.map(file => new File([file.buffer], file.name, { type: file.mimeType }));
  const zip = Buffer.from(await (await core.createZip(input)).arrayBuffer());
  assert.deepEqual(readZIP(zip), expectedEntries(selected, SAFE_NAMES));
  const damaged = Buffer.from(zip); damaged[50] ^= 1; assert.throws(() => readZIP(damaged));
  assert.throws(() => readZIP(zip.subarray(0, -1)));
  assert.equal(targets({}).length, 2);
  assert.equal(targets({ BSP_PREVIEW_URL: 'https://r123-pr-45-bk-previews.ttomohisa.workers.dev/' })[0].preview, true);
  for (const url of ['http://r123-pr-45-bk-previews.ttomohisa.workers.dev/', 'https://example.com/',
    'https://r123-pr-45-bk-previews.ttomohisa.workers.dev.evil.example/',
    'https://name:secret@r123-pr-45-bk-previews.ttomohisa.workers.dev/',
    'https://r123-pr-45-bk-previews.ttomohisa.workers.dev:444/',
    'https://r123-pr-45-bk-previews.ttomohisa.workers.dev/other.html',
    'https://r123-pr-45-bk-previews.ttomohisa.workers.dev/?x=1',
    'https://r123-pr-45-bk-previews.ttomohisa.workers.dev/#x']) assert.throws(() => targets({ BSP_PREVIEW_URL: url }));

  const vm = require('node:vm');
  class TestBlob extends Blob { arrayBuffer() { return super.arrayBuffer(); } }
  class Anchor { click() { this.nativeClicks = (this.nativeClicks || 0) + 1; } }
  let nextURL = 0;
  const window = { Blob: TestBlob, addEventListener() {} };
  const URL = { createObjectURL: () => `blob:synthetic-${++nextURL}`, revokeObjectURL() {} };
  vm.runInNewContext(`(${installAudit.toString()})()`, { window, URL, HTMLAnchorElement: Anchor });
  const original = new window.Blob(['original'], { type: 'image/png' });
  assert(original instanceof Blob); assert.equal(Buffer.from(await original.arrayBuffer()).toString(), 'original');
  window.__selectionListAudit.holdNext = true; const held = original.arrayBuffer();
  await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(window.__selectionListAudit.pending.length, 1);
  window.__selectionListAudit.release(); assert.equal(Buffer.from(await held).toString(), 'original');
  const list = new window.Blob(['{}'], { type: 'application/json;charset=utf-8' });
  const archive = new window.Blob(['zip'], { type: 'application/zip' });
  const listURL = URL.createObjectURL(list), zipURL = URL.createObjectURL(archive);
  const anchor = new Anchor(); anchor.href = listURL; anchor.download = 'test-selection.json'; anchor.click();
  assert.equal(anchor.nativeClicks, 1);
  assert.equal(liveURLs(window.__selectionListAudit.snapshot(), 'list').length, 1);
  assert.equal(liveURLs(window.__selectionListAudit.snapshot(), 'zip').length, 1);
  URL.revokeObjectURL(listURL);
  assert.equal(liveURLs(window.__selectionListAudit.snapshot(), 'list').length, 0);
  assert.equal(liveURLs(window.__selectionListAudit.snapshot(), 'zip').length, 1);
  URL.revokeObjectURL(zipURL); assert.equal(window.__selectionListAudit.snapshot().clicks.length, 1);
  console.log('PASS selection-list harness self-test: valid synthetic PNGs, exact naming/JSON/strict CSV oracles, independent original-byte ZIP parser, owned-preview guards, separate native list/ZIP URL and held-read observers. No browser/build/device test ran.');
}
async function main() {
  if (process.argv.includes('--self-test')) return selfTest();
  const { chromium } = require('playwright'), cases = targets(process.env), scenarios = [];
  await fs.mkdir(RESULTS, { recursive: true }); const browser = await chromium.launch({ headless: true });
  try {
    for (const target of cases) {
      scenarios.push(await currentKeepWorkflow(browser, target));
      scenarios.push(await frozenBatchWorkflow(browser, target));
      scenarios.push(await listResourceLifetime(browser, target));
      console.log(`PASS selection lists ${target.variant}: opt-in exact JSON/inert CSV, current Keep/Undo, frozen 32 MiB ZIP mapping, original SHA-256, separate URL lifetime, EN/JA narrow keyboard, no runtime network`);
    }
  } finally { await browser.close(); }
  await fs.writeFile(path.join(RESULTS, 'selection-list-browser.json'), JSON.stringify({
    scenarios, syntheticInputsOnly: true, physicalDeviceMeasured: false, diskWriteCompletionClaimed: false,
    resourceEvidence: 'Native Blob/read/URL/anchor observations; timer case uses virtual time. Not a heap/GC or physical-device measurement.'
  }, null, 2) + '\n');
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { targets, syntheticPNG, parseCSV, readZIP, displayName, installAudit };
