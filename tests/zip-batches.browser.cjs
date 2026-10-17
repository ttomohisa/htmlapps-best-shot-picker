/*
 * Sequential, independent ZIP regression. Run only after the canonical build.
 * Default: both generated file:// variants. BSP_PREVIEW_URL: owned HTTPS preview,
 * whose exact readable build bytes are checked BEFORE synthetic files are added.
 *
 * Three 12 MiB, 32 x 24 synthetic PNGs cross the real 32 MiB preset. Their extra
 * bytes are a valid private ancillary PNG chunk, not fake File sizes or changed
 * application state. Native Blob/read/URL/anchor observers retain no originals.
 * One native read may be held or failed to make interruption tests deterministic.
 * No model/client/core replacement, test budget, network dependency, or app hook.
 * --self-test runs small fixture/parser/observer checks without a browser/build.
 * This is not evidence of physical-device memory limits or disk-write completion.
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
const BUDGET = 32 * MiB;
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
function pngChunk(type, bytes) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), bytes]);
  const length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length); checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}
function syntheticPNG(index, size = 512) {
  const width = 32, height = 24, header = Buffer.alloc(13);
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  const pixels = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    for (let channel = 0; channel < 3; channel++) {
      pixels[y * (width * 3 + 1) + 1 + x * 3 + channel] = (index * 79 + channel * 61) % 256;
    }
  }
  const start = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(pixels))]);
  const end = pngChunk('IEND', Buffer.alloc(0));
  const padding = size - start.length - end.length - 12;
  assert(padding >= 0, 'Requested fixture size must accommodate a complete PNG');
  // Lowercase first/second/fourth characters: ancillary, private, safe to copy.
  // Uppercase third character preserves PNG's reserved-bit requirement.
  return Buffer.concat([start, pngChunk('npAd', Buffer.alloc(padding, index)), end]);
}
function fixture(name, index, size = 512) {
  return { name, mimeType: 'image/png', buffer: syntheticPNG(index, size) };
}
function batchFixtures(size = 12 * MiB) {
  // Unequal lengths avoid incidental duplicate hashing during fixture import.
  return ['same.png', 'SAME.PNG', 'same?.png'].map((name, index) => fixture(name, index + 1, size + index));
}
const SAFE_NAMES = ['same.png', 'SAME-2.PNG', 'same-3.png'];
function expectedEntries(files, names = files.map(file => file.name)) {
  return files.map((file, index) => ({ name: names[index], size: file.buffer.length, sha256: sha(file.buffer) }));
}
function expectedZipSize(files, names) {
  return 22 + files.reduce((total, file, index) => total + file.buffer.length + 76 + 2 * Buffer.byteLength(names[index]), 0);
}

// Independent ZIP reader: verify local records, STORE original bytes, CRC, UTF-8
// names, central directory, contiguous offsets, and a single-volume end record.
function readZip(bytes) {
  assert(bytes.length >= 22, 'ZIP has an end record');
  const end = bytes.length - 22;
  assert.equal(bytes.readUInt32LE(end), 0x06054b50);
  assert.equal(bytes.readUInt16LE(end + 4), 0, 'Independent ZIP disk number');
  assert.equal(bytes.readUInt16LE(end + 6), 0, 'Independent central-directory disk');
  assert.equal(bytes.readUInt16LE(end + 20), 0);
  const count = bytes.readUInt16LE(end + 10);
  assert.equal(bytes.readUInt16LE(end + 8), count);
  assert(count > 0 && count < 65535);
  let cursor = bytes.readUInt32LE(end + 16), localOffset = 0;
  const centralStart = cursor, entries = [];
  for (let index = 0; index < count; index++) {
    assert(cursor + 46 <= end, 'Complete central directory header');
    assert.equal(bytes.readUInt32LE(cursor), 0x02014b50);
    assert.equal(bytes.readUInt16LE(cursor + 8), 0x0800, 'UTF-8, unencrypted, known-size entry');
    assert.equal(bytes.readUInt16LE(cursor + 10), 0, 'STORE keeps original bytes');
    const checksum = bytes.readUInt32LE(cursor + 16), size = bytes.readUInt32LE(cursor + 20);
    assert.equal(bytes.readUInt32LE(cursor + 24), size);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLength);
    const name = nameBytes.toString('utf8');
    assert.deepEqual(Buffer.from(name), nameBytes, 'Names contain valid UTF-8');
    assert.equal(bytes.readUInt16LE(cursor + 34), 0, 'Entry starts on this independent ZIP');
    assert.equal(bytes.readUInt32LE(cursor + 42), localOffset);
    assert.equal(bytes.readUInt32LE(localOffset), 0x04034b50);
    assert.equal(bytes.readUInt16LE(localOffset + 6), 0x0800);
    assert.equal(bytes.readUInt16LE(localOffset + 8), 0);
    assert.equal(bytes.readUInt32LE(localOffset + 14), checksum);
    assert.equal(bytes.readUInt32LE(localOffset + 18), size);
    assert.equal(bytes.readUInt32LE(localOffset + 22), size);
    assert.equal(bytes.readUInt16LE(localOffset + 26), nameLength);
    assert.deepEqual(bytes.subarray(localOffset + 30, localOffset + 30 + nameLength), nameBytes);
    const contentStart = localOffset + 30 + nameLength + bytes.readUInt16LE(localOffset + 28);
    assert(contentStart + size <= centralStart, 'Complete original before central directory');
    const original = bytes.subarray(contentStart, contentStart + size);
    assert.equal(crc32(original), checksum, 'Original entry CRC');
    entries.push({ name, size, sha256: sha(original) });
    localOffset = contentStart + size;
    cursor += 46 + nameLength + bytes.readUInt16LE(cursor + 30) + bytes.readUInt16LE(cursor + 32);
  }
  assert.equal(localOffset, centralStart, 'All original bytes accounted for exactly once');
  assert.equal(cursor, end);
  assert.equal(cursor - centralStart, bytes.readUInt32LE(end + 12));
  return entries;
}
function targets(env) {
  if (!env.BSP_PREVIEW_URL) return ['index.html', 'index.self-extract.html'].map(variant => ({
    variant, url: pathToFileURL(path.join(ROOT, 'dist', variant)).href
  }));
  const url = new URL(env.BSP_PREVIEW_URL);
  assert.equal(url.protocol, 'https:');
  assert.match(url.hostname, /^r\d+-pr-\d+-bk-previews\.ttomohisa\.workers\.dev$/);
  for (const key of ['search', 'hash', 'username', 'password', 'port']) assert.equal(url[key], '');
  assert.equal(url.pathname, '/');
  return [{ variant: 'https-preview', url: url.href, preview: true }];
}

function installAudit() {
  const NativeBlob = window.Blob, nativeRead = NativeBlob.prototype.arrayBuffer;
  const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
  const nativeClick = HTMLAnchorElement.prototype.click;
  const identities = new WeakMap();
  const audit = window.__zipBatchAudit = {
    reads: 0, nextRead: '', pending: [], failures: 0, built: [], urls: [], clicks: [],
    peakLive: 0, builtWhileLive: [], violations: [],
    release() { this.pending.splice(0).forEach(release => release()); },
    snapshot() {
      return { reads: this.reads, pending: this.pending.length, failures: this.failures,
        built: this.built.slice(), urls: this.urls.map(item => ({ ...item })), clicks: this.clicks.slice(),
        peakLive: this.peakLive, builtWhileLive: this.builtWhileLive.slice(), violations: this.violations.slice() };
    }
  };
  NativeBlob.prototype.arrayBuffer = async function(...args) {
    audit.reads++;
    const mode = audit.nextRead; audit.nextRead = '';
    const bytes = await nativeRead.apply(this, args);
    if (mode === 'hold') await new Promise(resolve => audit.pending.push(resolve));
    if (mode === 'fail') { audit.failures++; throw new Error('Synthetic one-off original-read failure'); }
    return bytes;
  };
  function ObservedBlob(...args) {
    if (!new.target) throw new TypeError('Blob must be constructed');
    const blob = Reflect.construct(NativeBlob, args, new.target === ObservedBlob ? NativeBlob : new.target);
    if (blob.type === 'application/zip') {
      const id = audit.built.length + 1;
      if (audit.urls.some(item => !item.revoked)) audit.builtWhileLive.push(id);
      audit.built.push({ id, size: blob.size }); identities.set(blob, id);
    }
    return blob;
  }
  Object.setPrototypeOf(ObservedBlob, NativeBlob); ObservedBlob.prototype = NativeBlob.prototype;
  window.Blob = ObservedBlob;
  URL.createObjectURL = blob => {
    const url = create(blob);
    if (blob.type === 'application/zip') {
      audit.urls.push({ url, id: identities.get(blob), size: blob.size, revoked: false });
      audit.peakLive = Math.max(audit.peakLive, audit.urls.filter(item => !item.revoked).length);
    }
    return url;
  };
  URL.revokeObjectURL = url => {
    const record = audit.urls.find(item => item.url === url);
    if (record) record.revoked = true;
    return revoke(url);
  };
  HTMLAnchorElement.prototype.click = function(...args) {
    if (this.download && this.href.startsWith('blob:')) audit.clicks.push({ filename: this.download, url: this.href });
    return nativeClick.apply(this, args);
  };
  window.addEventListener('securitypolicyviolation', event => audit.violations.push({
    directive: event.violatedDirective, blocked: event.blockedURI
  }));
}
const audit = page => page.evaluate(() => window.__zipBatchAudit.snapshot());
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const rapidClick = (page, selector) => page.locator(selector).evaluate(button => { button.click(); button.click(); });
const unavailable = async (page, selector) => assert(
  await page.locator(selector).isHidden() || await page.locator(selector).isDisabled(), `${selector} must be unavailable`);
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
    if (allowedNavigation && request.url() === target.url && request.method() === 'GET' &&
        request.isNavigationRequest() && request.resourceType() === 'document' && request.frame() === page.mainFrame()) {
      allowedNavigation--; return;
    }
    requests.push(`${request.method()} ${request.resourceType()} ${request.url()}`);
  });
  try {
    const response = await page.goto(target.url);
    if (target.preview) {
      assert(response && response.ok(), 'Owned preview must load successfully');
      assert.equal(response.url(), target.url, 'Preview must not redirect');
      assert.equal(page.url(), target.url);
      assert.equal(sha(await response.body()), sha(await fs.readFile(path.join(ROOT, 'dist/index.html'))),
        'Verify exact canonical preview bytes before providing synthetic inputs');
    }
    await context.setOffline(true);
    assert.equal(allowedNavigation, 0);
    await page.locator('#addButton').waitFor();
    assert.match(await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content'), /connect-src\s+'none'/);
    return { context, page, errors, consoleErrors, requests, downloads };
  } catch (error) { await context.close(); throw error; }
}
async function assertClean(run) {
  assert.deepEqual(run.requests, [], 'No runtime HTTP(S) requests');
  assert.deepEqual(run.errors, [], 'No unhandled page error');
  assert.deepEqual(run.consoleErrors, [], 'No unexpected console error');
  assert.deepEqual((await audit(run.page)).violations, [], 'No CSP violation');
}
async function idle(page, count) {
  await page.locator('#loadProgress').waitFor({ state: 'hidden' });
  await page.locator('#analysisProgress').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => /finished|完了/.test(document.querySelector('#analysisResult').textContent));
  assert.equal(await page.locator('.photo-card').count(), count);
  assert.equal(await page.locator('#errorList li').count(), 0, 'Synthetic PNGs decode normally');
}
async function language(page, value) {
  if (await page.locator('html').getAttribute('lang') !== value) await page.locator('#languageButton').click();
  assert.equal(await page.locator('html').getAttribute('lang'), value);
}
async function keptNames(page) { return page.locator('.photo-card.kept .photo-name').allTextContents(); }
async function consumeDownload(page, action, filename) {
  const pending = page.waitForEvent('download');
  await action();
  const download = await pending;
  assert.equal(download.suggestedFilename(), filename);
  const bytes = await fs.readFile(await download.path());
  assert.equal(await download.failure(), null);
  return { entries: readZip(bytes), size: bytes.length, sha256: sha(bytes) };
}
async function plannedParts(page, files) {
  const rows = await page.locator('#zipBatchList > li').allTextContents();
  const sizes = [expectedZipSize(files.slice(0, 2), SAFE_NAMES.slice(0, 2)), expectedZipSize(files.slice(2), SAFE_NAMES.slice(2))];
  assert.equal(rows.length, 2, 'Preflight lists both independent ZIPs');
  assert.match(rows[0], /Batch memories-part-001-of-002\.zip/);
  assert.match(rows[1], /Batch memories-part-002-of-002\.zip/);
  assert(rows[0].includes(` · 2 photos · ${sizes[0].toLocaleString('en')} bytes`));
  assert(rows[1].includes(` · 1 photos · ${sizes[1].toLocaleString('en')} bytes`));
  assert.deepEqual(await page.locator('#zipBatchList > li ul > li').allTextContents(), SAFE_NAMES,
    'Preflight names are globally collision-safe across independent ZIPs');
  const summary = await page.locator('#zipBatchSummary').textContent();
  assert(summary.includes(`3 photos · 2 ZIP files · ${(sizes[0] + sizes[1]).toLocaleString('en')} bytes`),
    'Preflight reports exact total file count, part count, and archive bytes including all headers');
}
async function narrowScreens(page, target, phase, controls) {
  for (const locale of ['ja', 'en']) {
    await language(page, locale);
    const status = await page.locator('#zipBatchStatus').textContent();
    assert(status.trim());
    if (locale === 'ja') assert.match(status, /[\u3040-\u30ff\u4e00-\u9fff]/);
    else assert.match(status, /[A-Za-z]/);
    if (phase === 'requested') assert.match(status, locale === 'ja' ? /保存完了を確認できません/ : /cannot confirm disk completion/i);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 640 });
      await page.locator('[data-mobile-key="save"]').click();
      for (const selector of controls) {
        // Trial actionability settles scrolling and tries unobstructed alignment without clicking.
        // One nearest scroll position can still sit beneath the fixed mobile bar.
        try {
          await page.locator(selector).click({ trial: true });
          const box = await page.locator(selector).boundingBox();
          assert(box && box.x >= -1 && box.x + box.width <= width + 1, `${selector} fits narrow ${locale} layout`);
          await page.waitForFunction(selector => {
            const node=document.querySelector(selector),rect=node.getBoundingClientRect();
            const hit=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);
            return rect.top>=0&&rect.bottom<=innerHeight&&(hit===node||node.contains(hit));
          }, selector);
          await page.locator(selector).focus();
          assert(await page.locator(selector).evaluate(node => node === document.activeElement), 'Control remains keyboard reachable');
        } catch (error) {
          console.error('Narrow ZIP reachability', await page.locator(selector).evaluate(node => {
            const rect=node.getBoundingClientRect(),hit=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);
            return {rect:rect.toJSON(),hit:hit?.outerHTML?.slice(0,600),scrollY,viewport:{width:innerWidth,height:innerHeight},header:document.querySelector('header')?.getBoundingClientRect().toJSON(),bar:document.querySelector('#appMobileBottomBar')?.getBoundingClientRect().toJSON()};
          }));
          await page.screenshot({path:path.join(RESULTS,`zip-batches.${target.variant}.${phase}.${locale}.${width}.failure.png`)});
          throw error;
        }
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal page overflow');
      await page.screenshot({ path: path.join(RESULTS, `zip-batches.${target.variant}.${phase}.${locale}.${width}.png`) });
    }
  }
  await page.setViewportSize({ width: 1360, height: 900 });
}

async function ordinarySingleZip(browser, target) {
  const run = await session(browser, target);
  try {
    const { page } = run, files = batchFixtures(512);
    assert.equal(await page.locator('#zipMode').inputValue(), 'single', 'Existing single ZIP remains the default');
    await unavailable(page, '#downloadButton');
    await page.locator('#fileInput').setInputFiles(files); await idle(page, 3);
    for (const id of ['p1', 'p3']) await page.locator(`#photo-${id} .keep-button`).click();
    await page.locator('#outputFilename').fill('../ordinary:*?.zip.zip');
    const result = await consumeDownload(page, () => page.locator('#downloadButton').click(), 'ordinary.zip');
    assert.deepEqual(result.entries, expectedEntries([files[0], files[2]], ['same.png', 'same-2.png']));
    assert.deepEqual(await keptNames(page), [files[0].name, files[2].name]);
    assert.equal(run.downloads.length, 1);
    await assertClean(run);
    return { variant: target.variant, scenario: 'ordinary-single-ZIP-regression', ...result };
  } finally { await run.context.close(); }
}

async function sequentialBatches(browser, target, files) {
  const run = await session(browser, target);
  let phase = 'preflight';
  try {
    const { page } = run;
    await page.locator('#fileInput').setInputFiles(files); await idle(page, 3);
    for (const id of ['p1', 'p2', 'p3']) await page.locator(`#photo-${id} .keep-button`).click();
    await page.locator('#zipMode').selectOption('batches');
    assert.equal(await page.locator('#zipBatchSize').inputValue(), '', 'No unverified safe-device budget is preselected');
    await unavailable(page, '#planZipBatchesButton');
    await page.locator('#zipBatchSize').selectOption('32');
    await page.locator('#outputFilename').fill('../Batch memories:*.zip.zip');
    const beforePlan = await audit(page);
    await rapidClick(page, '#planZipBatchesButton'); await settle(page);
    await plannedParts(page, files);
    for (const selector of ['#zipMode', '#zipBatchSize', '#outputFilename']) {
      assert(await page.locator(selector).isDisabled(), 'The reviewed plan retains its mode, capacity and edited filename');
    }
    assert.equal((await audit(page)).reads, beforePlan.reads, 'Preflight uses metadata without original-byte reads');
    assert.equal((await audit(page)).built.length, 0, 'Planning does not create a ZIP Blob');
    assert.equal(run.downloads.length, 0);
    await unavailable(page, '#downloadButton');
    await unavailable(page, '#downloadZipBatchButton');
    await unavailable(page, '#nextZipBatchButton');
    await narrowScreens(page, target, 'planned', ['#prepareZipBatchButton', '#closeZipBatchesButton']);

    phase = 'frozen starting selection';
    await page.locator('#photo-p1 .keep-button').click();
    await page.locator('#appToastAction').click();
    assert.deepEqual(await keptNames(page), files.map(file => file.name), 'Live Keep Undo remains independent of the ZIP snapshot');
    await plannedParts(page, files);
    await page.locator('#photo-p1 .keep-button').click();
    const later = fixture('later.png', 9, 1024);
    await page.locator('#fileInput').setInputFiles([later]); await idle(page, 4);
    await page.locator('#photo-p4 .keep-button').click();
    const currentKeep = [files[1].name, files[2].name, later.name];
    assert.deepEqual(await keptNames(page), currentKeep);
    await plannedParts(page, files);
    assert.match(await page.locator('[data-i18n="zipSnapshot"]').textContent(), /when you started|starting selection|snapshot/i,
      'Explain that later Keep/input changes do not alter the starting selection');

    phase = 'live group edit and Undo preserve the export snapshot';
    const groups = await page.locator('.group-chip').evaluateAll(nodes => nodes.map(node => node.dataset.groupId));
    assert(groups.length >= 2, 'Distinct synthetic colors provide groups for a real manual edit');
    await page.locator('#organizeButton').click();
    await page.locator('#sourceGroup').selectOption(groups[0]);
    await page.locator('#targetGroup').selectOption(groups[1]);
    await page.locator('#mergeGroupButton').click();
    assert.equal(await page.locator('.group-chip').count(), groups.length - 1);
    assert.deepEqual(await keptNames(page), currentKeep);
    await plannedParts(page, files);
    await page.locator('#appToastAction').click();
    assert.equal(await page.locator('.group-chip').count(), groups.length);
    assert.deepEqual(await keptNames(page), currentKeep);
    await plannedParts(page, files);

    phase = 'cancel while building and retry without stale output';
    await page.evaluate(() => { window.__zipBatchAudit.nextRead = 'hold'; });
    const beforeCancel = await audit(page);
    await rapidClick(page, '#prepareZipBatchButton');
    await page.waitForFunction(() => window.__zipBatchAudit.pending.length === 1);
    await settle(page);
    assert.equal((await audit(page)).reads, beforeCancel.reads + 1, 'Rapid Prepare clicks start one build');
    await unavailable(page, '#prepareZipBatchButton');
    await unavailable(page, '#downloadZipBatchButton');
    await unavailable(page, '#nextZipBatchButton');
    await page.locator('#cancelExportButton').click();
    await page.evaluate(() => window.__zipBatchAudit.release());
    await page.locator('#exportProgress').waitFor({ state: 'hidden' });
    assert(await page.locator('#prepareZipBatchButton').isEnabled());
    assert.match(await page.locator('#zipBatchStatus').textContent(), /cancel|stopped/i);
    assert.equal((await audit(page)).built.length, 0);
    assert.deepEqual(await keptNames(page), currentKeep);
    await plannedParts(page, files);

    phase = 'native read failure and explicit retry';
    await page.evaluate(() => { window.__zipBatchAudit.nextRead = 'fail'; });
    await page.locator('#prepareZipBatchButton').click();
    await page.waitForFunction(() => window.__zipBatchAudit.failures === 1);
    await page.locator('#exportProgress').waitFor({ state: 'hidden' });
    assert.match(await page.locator('#zipBatchStatus').textContent(), /fail|could not|unable|retry/i);
    assert(await page.locator('#prepareZipBatchButton').isEnabled());
    assert.equal((await audit(page)).built.length, 0);
    assert.equal(run.downloads.length, 0);
    assert.deepEqual(await keptNames(page), currentKeep);

    phase = 'prepare first part without automatic download';
    await page.locator('#prepareZipBatchButton').focus();
    await page.locator('#prepareZipBatchButton').press('Enter');
    await page.locator('#downloadZipBatchButton').waitFor();
    assert(await page.locator('#downloadZipBatchButton').isEnabled());
    await settle(page);
    const ready = await audit(page);
    assert.equal(ready.built.length, 1); assert.equal(ready.urls.filter(item => !item.revoked).length, 1);
    assert.equal(ready.clicks.length, 0); assert.equal(run.downloads.length, 0);
    await unavailable(page, '#nextZipBatchButton');
    await page.locator('#closeZipBatchesButton').click();
    await page.locator('#appConfirmCancel').click();
    assert.equal((await audit(page)).urls.filter(item => !item.revoked).length, 1, 'Dismissed discard keeps prepared ZIP');
    assert(await page.locator('#downloadZipBatchButton').isEnabled());

    phase = 'explicit first download and duplicate-click guard';
    const first = await consumeDownload(page, () => rapidClick(page, '#downloadZipBatchButton'), 'Batch memories-part-001-of-002.zip');
    assert(first.size <= BUDGET);
    assert.equal(first.size, expectedZipSize(files.slice(0, 2), SAFE_NAMES.slice(0, 2)));
    assert.deepEqual(first.entries, expectedEntries(files.slice(0, 2), SAFE_NAMES.slice(0, 2)));
    assert.equal(run.downloads.length, 1, 'Rapid Download clicks request just one file');
    assert.equal((await audit(page)).clicks.length, 1);
    await unavailable(page, '#downloadZipBatchButton');
    assert(await page.locator('#nextZipBatchButton').isEnabled());
    await page.waitForFunction(() => !document.querySelector('#retryZipBatchDownloadButton').disabled);
    assert.match(await page.locator('#zipBatchDuplicateNote').textContent(), /another copy/i);
    const requested = await page.locator('#zipBatchStatus').textContent();
    assert.match(requested, /request|browser|download/i);
    assert.doesNotMatch(requested, /saved successfully|saved to.*disk|saving complete|disk write complete/i,
      'A download request is not evidence of successful disk saving');
    await narrowScreens(page, target, 'requested', ['#retryZipBatchDownloadButton', '#nextZipBatchButton', '#closeZipBatchesButton']);
    const firstReady = await audit(page);
    const retry = await consumeDownload(page, () => page.locator('#retryZipBatchDownloadButton').click(), 'Batch memories-part-001-of-002.zip');
    assert.equal(retry.sha256, first.sha256, 'Explicit download retry reuses the exact same prepared ZIP');
    assert.equal((await audit(page)).built.length, 1);
    assert.equal((await audit(page)).reads, firstReady.reads);
    assert.equal((await audit(page)).urls.length, 1, 'Download retry does not allocate another URL');
    await page.locator('#closeZipBatchesButton').click();
    await page.locator('#appConfirmCancel').click();
    assert.equal((await audit(page)).urls.filter(item => !item.revoked).length, 1);

    phase = 'explicit saved acknowledgement and no automatic next build';
    const beforeNext = await audit(page);
    await rapidClick(page, '#nextZipBatchButton'); await settle(page);
    const afterNext = await audit(page);
    assert.equal(afterNext.urls.filter(item => !item.revoked).length, 0, 'Release prior download URL before the next build');
    assert.equal(afterNext.built.length, 1); assert.equal(afterNext.reads, beforeNext.reads);
    assert.equal(run.downloads.length, 2, 'No automatic download or next-part preparation');
    assert(await page.locator('#prepareZipBatchButton').isEnabled());
    await unavailable(page, '#downloadZipBatchButton');
    await unavailable(page, '#nextZipBatchButton');

    phase = 'second independent part and explicit finish';
    await rapidClick(page, '#prepareZipBatchButton');
    await page.locator('#downloadZipBatchButton').waitFor();
    assert.equal((await audit(page)).built.length, 2);
    assert.equal(run.downloads.length, 2);
    const second = await consumeDownload(page, () => rapidClick(page, '#downloadZipBatchButton'), 'Batch memories-part-002-of-002.zip');
    assert(second.size <= BUDGET);
    assert.equal(second.size, expectedZipSize(files.slice(2), SAFE_NAMES.slice(2)));
    assert.deepEqual(second.entries, expectedEntries(files.slice(2), SAFE_NAMES.slice(2)));
    await unavailable(page, '#nextZipBatchButton');
    assert(await page.locator('#finishZipBatchesButton').isEnabled());
    const allEntries = [...first.entries, ...second.entries];
    assert.deepEqual(allEntries, expectedEntries(files, SAFE_NAMES), 'Every starting original appears once, even after live Keep/input changes');
    assert.equal(new Set(allEntries.map(entry => entry.name.normalize('NFC').toUpperCase().toLowerCase())).size, files.length);
    for (const entry of allEntries) assert.doesNotMatch(entry.name, /[\\/:*?"<>|\u0000-\u001f]/);
    await rapidClick(page, '#finishZipBatchesButton'); await settle(page);
    assert.equal((await audit(page)).urls.filter(item => !item.revoked).length, 0);
    assert(await page.locator('#planZipBatchesButton').isEnabled());
    assert.deepEqual(await keptNames(page), currentKeep);

    phase = 'confirmed discard releases a prepared ZIP';
    await page.locator('#planZipBatchesButton').click();
    await page.locator('#prepareZipBatchButton').click();
    await page.locator('#downloadZipBatchButton').waitFor();
    const downloadsBeforeClose = run.downloads.length;
    await page.locator('#closeZipBatchesButton').click();
    await page.locator('#appConfirmOk').click(); await settle(page);
    assert.equal((await audit(page)).urls.filter(item => !item.revoked).length, 0);
    assert.equal(run.downloads.length, downloadsBeforeClose, 'Discard never downloads silently');
    assert.deepEqual(await keptNames(page), currentKeep);

    phase = 'reset during a held original read rejects late output after replacement input';
    await page.locator('#planZipBatchesButton').click();
    await page.evaluate(() => { window.__zipBatchAudit.nextRead = 'hold'; });
    await page.locator('#prepareZipBatchButton').click();
    await page.waitForFunction(() => window.__zipBatchAudit.pending.length === 1);
    const beforeReset = await audit(page);
    await page.locator('#clearButton').click();
    await page.locator('#appConfirmOk').click();
    assert.equal(await page.locator('.photo-card').count(), 0);
    assert(await page.locator('#zipBatchPanel').isHidden());
    const replacement = fixture('replacement-session.png', 11, 2048);
    await page.locator('#fileInput').setInputFiles([replacement]); await idle(page, 1);
    await page.locator('.photo-card .keep-button').click();
    await page.evaluate(() => window.__zipBatchAudit.release()); await settle(page);
    const afterStale = await audit(page);
    assert.equal(afterStale.pending, 0);
    assert.equal(afterStale.built.length, beforeReset.built.length, 'Obsolete held build never constructs a ZIP');
    assert.equal(afterStale.urls.length, beforeReset.urls.length, 'Obsolete held build never publishes a download URL');
    assert.equal(afterStale.urls.filter(item => !item.revoked).length, 0);
    assert.equal(run.downloads.length, downloadsBeforeClose);
    assert.deepEqual(await keptNames(page), [replacement.name], 'Late cancellation does not change the replacement session');
    assert(await page.locator('#zipBatchPanel').isHidden());

    phase = 'reset warning protects a ready ZIP until explicitly confirmed';
    await page.locator('#planZipBatchesButton').click();
    await page.locator('#prepareZipBatchButton').click();
    await page.locator('#downloadZipBatchButton').waitFor();
    await page.locator('#clearButton').click();
    assert.match(await page.locator('#appConfirmMessage').textContent(), /download.*finished|download link/i,
      'Reset warns that the current prepared/download URL will be released');
    await page.locator('#appConfirmCancel').click();
    assert.equal((await audit(page)).urls.filter(item => !item.revoked).length, 1);
    assert.deepEqual(await keptNames(page), [replacement.name]);
    assert(await page.locator('#downloadZipBatchButton').isVisible());
    await page.locator('#clearButton').click();
    await page.locator('#appConfirmOk').click(); await settle(page);
    const finished = await audit(page);
    assert.equal(finished.urls.filter(item => !item.revoked).length, 0);
    assert.equal(finished.peakLive, 1, 'At most one prepared ZIP download URL exists');
    assert.deepEqual(finished.builtWhileLive, [], 'No new ZIP Blob is constructed while an earlier ZIP URL is live');
    assert.equal(await page.locator('.photo-card').count(), 0);
    assert(await page.locator('#zipBatchPanel').isHidden());
    assert.equal(run.downloads.length, downloadsBeforeClose, 'Reset never downloads silently');
    await assertClean(run);
    return { variant: target.variant, scenario: 'sequential-independent-ZIPs', budgetBytes: BUDGET,
      originalCount: files.length, parts: [first, second], explicitDownloadRequests: run.downloads.length,
      peakLiveZipURLs: finished.peakLive, readFailureRecovered: finished.failures === 1,
      frozenSnapshotVerified: true, liveKeepAndGroupUndoVerified: true, resetStaleReadAndReadyWarningVerified: true,
      externalRequests: run.requests };
  } catch (error) { error.message = `${target.variant} / ${phase}: ${error.message}`; throw error; }
  finally { await run.context.close(); }
}

async function oversizePreflight(browser, target, file) {
  const run = await session(browser, target);
  try {
    const { page } = run;
    await page.locator('#fileInput').setInputFiles([file]); await idle(page, 1);
    await page.locator('.photo-card .keep-button').click();
    await page.locator('#zipMode').selectOption('batches');
    await page.locator('#zipBatchSize').selectOption('32');
    const before = await audit(page);
    await page.locator('#planZipBatchesButton').click(); await settle(page);
    const after = await audit(page);
    assert.equal(after.reads, before.reads, 'Oversize rejection precedes original-byte reads');
    assert.equal(after.built.length, 0); assert.equal(after.urls.length, 0); assert.equal(run.downloads.length, 0);
    await unavailable(page, '#prepareZipBatchButton');
    await unavailable(page, '#downloadZipBatchButton');
    assert.match(await page.locator('#zipBatchError').textContent(), /larg|exceed|fit|limit|budget/i);
    assert((await page.locator('#zipBatchError').textContent()).includes(file.name), 'Preflight identifies the original that cannot fit');
    assert.deepEqual(await keptNames(page), [file.name]);
    await language(page, 'ja');
    assert.match(await page.locator('#zipBatchError').textContent(), /超|大き|上限|容量|収ま/);
    await assertClean(run);
    return { variant: target.variant, scenario: 'oversize-original-preflight', originalBytes: file.buffer.length,
      budgetBytes: BUDGET, originalReadsDuringPreflight: after.reads - before.reads, externalRequests: run.requests };
  } finally { await run.context.close(); }
}

async function selfTest() {
  const files = batchFixtures(512);
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
  assert.equal(new Set(files.map(file => sha(file.buffer))).size, 3);
  for (const file of files) {
    assert.equal(file.buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    let offset = 8; const chunks = [];
    while (offset < file.buffer.length) {
      const size = file.buffer.readUInt32BE(offset), type = file.buffer.subarray(offset + 4, offset + 8).toString('ascii');
      assert.equal(crc32(file.buffer.subarray(offset + 4, offset + 8 + size)), file.buffer.readUInt32BE(offset + 8 + size));
      if (type === 'IDAT') assert.equal(zlib.inflateSync(file.buffer.subarray(offset + 8, offset + 8 + size)).length, (32 * 3 + 1) * 24);
      chunks.push(type); offset += size + 12;
    }
    assert.equal(offset, file.buffer.length); assert.deepEqual(chunks, ['IHDR', 'IDAT', 'npAd', 'IEND']);
  }
  const { File } = require('node:buffer'), core = require('../src/core.js');
  const inputs = files.map(file => new File([file.buffer], file.name, { type: file.mimeType }));
  const zip = Buffer.from(await (await core.createZip(inputs)).arrayBuffer());
  assert.deepEqual(readZip(zip), expectedEntries(files, SAFE_NAMES));
  const corrupted = Buffer.from(zip); corrupted[50] ^= 1;
  assert.throws(() => readZip(corrupted), 'Independent parser rejects damaged originals');
  assert.throws(() => readZip(zip.subarray(0, zip.length - 1)));
  assert.equal(targets({}).length, 2);
  assert.equal(targets({ BSP_PREVIEW_URL: 'https://r123-pr-45-bk-previews.ttomohisa.workers.dev/' })[0].preview, true);
  for (const url of ['http://r123-pr-45-bk-previews.ttomohisa.workers.dev/', 'https://example.com/',
    'https://r123-pr-45-bk-previews.ttomohisa.workers.dev.evil.example/',
    'https://name:secret@r123-pr-45-bk-previews.ttomohisa.workers.dev/',
    'https://r123-pr-45-bk-previews.ttomohisa.workers.dev:444/',
    'https://r123-pr-45-bk-previews.ttomohisa.workers.dev/other.html',
    'https://r123-pr-45-bk-previews.ttomohisa.workers.dev/?other=1',
    'https://r123-pr-45-bk-previews.ttomohisa.workers.dev/#other']) assert.throws(() => targets({ BSP_PREVIEW_URL: url }));

  // Isolate native API observation in a VM, so the harness self-test never alters
  // Node's own Blob prototype or starts browser/application code.
  const vm = require('node:vm');
  class TestBlob extends Blob { arrayBuffer() { return super.arrayBuffer(); } }
  class Anchor { click() { this.nativeClicks = (this.nativeClicks || 0) + 1; } }
  let nextURL = 0;
  const window = { Blob: TestBlob, addEventListener() {} };
  const URL = { createObjectURL: () => `blob:synthetic-${++nextURL}`, revokeObjectURL() {} };
  vm.runInNewContext(`(${installAudit.toString()})()`, { window, URL, HTMLAnchorElement: Anchor });
  const observed = new window.Blob(['original'], { type: 'image/png' });
  assert(observed instanceof Blob);
  assert.equal(Buffer.from(await observed.arrayBuffer()).toString(), 'original');
  window.__zipBatchAudit.nextRead = 'fail'; await assert.rejects(observed.arrayBuffer(), /Synthetic/);
  window.__zipBatchAudit.nextRead = 'hold'; const held = observed.arrayBuffer();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(window.__zipBatchAudit.pending.length, 1);
  window.__zipBatchAudit.release(); assert.equal(Buffer.from(await held).toString(), 'original');
  const first = new window.Blob(['zip-1'], { type: 'application/zip' }), url = URL.createObjectURL(first);
  const anchor = new Anchor(); anchor.href = url; anchor.download = 'part.zip'; anchor.click();
  assert.equal(anchor.nativeClicks, 1); URL.revokeObjectURL(url);
  const second = new window.Blob(['zip-2'], { type: 'application/zip' }); URL.createObjectURL(second);
  assert.equal(window.__zipBatchAudit.snapshot().built.length, 2);
  assert.equal(window.__zipBatchAudit.snapshot().peakLive, 1);
  assert.equal(window.__zipBatchAudit.snapshot().builtWhileLive.length, 0);
  assert.equal(window.__zipBatchAudit.snapshot().clicks.length, 1);
  console.log('PASS ZIP-batches harness self-test: valid padded synthetic PNGs, independent ZIP/CRC/SHA parser, owned-preview guards, transparent native read fail/hold and ZIP URL observations. No browser/build/device test ran.');
}
async function main() {
  if (process.argv.includes('--self-test')) return selfTest();
  const cases = targets(process.env), files = batchFixtures();
  const oversized = fixture('synthetic-too-large-for-budget.png', 7, BUDGET);
  const { chromium } = require('playwright');
  await fs.mkdir(RESULTS, { recursive: true });
  const browser = await chromium.launch({ headless: true }), scenarios = [];
  try {
    for (const target of cases) {
      scenarios.push(await ordinarySingleZip(browser, target));
      scenarios.push(await sequentialBatches(browser, target, files));
      scenarios.push(await oversizePreflight(browser, target, oversized));
      console.log(`PASS ZIP batches ${target.variant}: ordinary ZIP, metadata preflight, frozen Keep snapshot, cancel/failure/retry, explicit one-at-a-time downloads, complete original hashes, global safe names, EN/JA narrow, no runtime network`);
    }
  } finally { await browser.close(); }
  await fs.writeFile(path.join(RESULTS, 'zip-batches-browser.json'), JSON.stringify({
    scenarios, syntheticInputsOnly: true, physicalDeviceMeasured: false, diskWriteCompletionClaimed: false,
    resourceEvidence: 'ZIP construction and live download URL observations; not a heap/GC measurement'
  }, null, 2) + '\n');
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { targets, syntheticPNG, readZip, installAudit };
