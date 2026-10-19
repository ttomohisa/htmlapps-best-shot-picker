/*
 * Optional-browser-capability regression. Only generated, non-person PNGs enter
 * the app. Browser APIs are observed or made unavailable before navigation;
 * application state, model clients and StandaloneAssets are never replaced.
 * Run in CI after the canonical build. --self-test checks this harness without
 * starting a browser. This is not a physical-device or model-accuracy benchmark.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const results = path.join(root, 'test-results');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function previewURL(value) {
  if (!value) return null;
  const url = new URL(value);
  assert.equal(url.protocol, 'https:');
  assert.match(url.hostname, /^r\d+-pr-\d+-bk-previews\.ttomohisa\.workers\.dev$/);
  for (const key of ['search', 'hash', 'username', 'password', 'port']) assert.equal(url[key], '');
  assert.equal(url.pathname, '/');
  return url;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type, bytes) {
  const body = Buffer.concat([Buffer.from(type), bytes]);
  const length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length); checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}
function syntheticPNG(rgb) {
  const width = 48, height = 36, header = Buffer.alloc(13);
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  const pixels = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    for (let c = 0; c < 3; c++) pixels[y * (width * 3 + 1) + 1 + x * 3 + c] = rgb[c];
  }
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'), pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(pixels)), pngChunk('IEND', Buffer.alloc(0))
  ]);
}
function fixtures() {
  return [[210, 30, 40], [30, 190, 60], [35, 60, 220]].map((rgb, index) => ({
    name: `synthetic-color-${index + 1}.png`, mimeType: 'image/png', buffer: syntheticPNG(rgb)
  }));
}
function zipEntries(zip) {
  let offset = 0;
  const entries = [];
  while (offset + 4 <= zip.length && zip.readUInt32LE(offset) === 0x04034b50) {
    assert(offset + 30 <= zip.length, 'Complete ZIP local header');
    assert.equal(zip.readUInt16LE(offset + 8), 0, 'Originals must use ZIP store');
    assert.equal(zip.readUInt16LE(offset + 6) & 8, 0, 'Known-size local entries');
    const size = zip.readUInt32LE(offset + 18), nameLength = zip.readUInt16LE(offset + 26);
    const start = offset + 30 + nameLength + zip.readUInt16LE(offset + 28);
    assert(start + size <= zip.length, 'Complete original entry');
    const bytes = zip.subarray(start, start + size);
    assert.equal(crc32(bytes), zip.readUInt32LE(offset + 14));
    entries.push({ name: zip.subarray(offset + 30, offset + 30 + nameLength).toString('utf8'), sha256: digest(bytes) });
    offset = start + size;
  }
  assert.equal(zip.readUInt32LE(offset), 0x02014b50, 'Central directory follows originals');
  return entries;
}

// Transparent native observers. The only stream fault is explicitly armed after
// bootstrap: one gzip input is corrupted, so the real native decoder and the
// real embedded-asset promise cache must recover on the UI's explicit retry.
function installBrowserAudit({ missing }) {
  const NativeWorker = window.Worker, NativeDecoder = window.DecompressionStream;
  const nativeAtob = window.atob.bind(window);
  const audit = window.__compatibilityAudit = {
    decodes: 0, gzip: 0, completed: 0, workers: 0, injectedFailures: 0,
    nextMode: '', pending: [], violations: [],
    release() { this.pending.splice(0).forEach(release => release()); }
  };
  window.addEventListener('securitypolicyviolation', event => audit.violations.push({
    directive: event.violatedDirective, blocked: event.blockedURI
  }));
  window.atob = (...args) => { audit.decodes++; return nativeAtob(...args); };
  if (missing === 'Worker') {
    if (!Reflect.deleteProperty(window, 'Worker')) throw new Error('Cannot remove test Worker API');
  } else {
    function ObservedWorker(...args) {
      if (!new.target) throw new TypeError('Worker must be constructed');
      audit.workers++;
      return Reflect.construct(NativeWorker, args);
    }
    Object.setPrototypeOf(ObservedWorker, NativeWorker);
    ObservedWorker.prototype = NativeWorker.prototype;
    window.Worker = ObservedWorker;
  }
  if (missing === 'DecompressionStream') {
    if (!Reflect.deleteProperty(window, 'DecompressionStream')) throw new Error('Cannot remove test decompression API');
  } else {
    function ObservedDecoder(format) {
      if (!new.target) throw new TypeError('DecompressionStream must be constructed');
      audit.gzip++;
      const decoder = new NativeDecoder(format), mode = audit.nextMode;
      audit.nextMode = '';
      let writable = decoder.writable, readable = decoder.readable;
      if (mode) {
        const wait = mode === 'hold' ? new Promise(resolve => audit.pending.push(resolve)) : null;
        if (mode === 'fail') audit.injectedFailures++;
        const input = new TransformStream({
          async transform(chunk, controller) {
            if (wait) await wait;
            controller.enqueue(mode === 'fail' ? new Uint8Array([0, 0, 0]) : chunk);
          }
        });
        writable = input.writable;
        readable = input.readable.pipeThrough(decoder);
      }
      const observed = readable.pipeThrough(new TransformStream({
        transform(chunk, controller) { controller.enqueue(chunk); },
        flush() { audit.completed++; }
      }));
      return { writable, readable: observed };
    }
    Object.setPrototypeOf(ObservedDecoder, NativeDecoder);
    ObservedDecoder.prototype = NativeDecoder.prototype;
    window.DecompressionStream = ObservedDecoder;
  }
}

async function auditSnapshot(page) {
  return page.evaluate(() => {
    const a = window.__compatibilityAudit;
    return { decodes: a.decodes, gzip: a.gzip, completed: a.completed, workers: a.workers,
      injectedFailures: a.injectedFailures, pending: a.pending.length, violations: a.violations };
  });
}
async function session(browser, target, missing, loaderOnly = false) {
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: 'en-US', acceptDownloads: true });
  if (!target.preview) await context.setOffline(true);
  await context.addInitScript(installBrowserAudit, { missing });
  const page = await context.newPage(), requests = [], errors = [], consoleErrors = [];
  let allowedNavigation = target.preview ? 1 : 0;
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  context.on('request', request => {
    if (!/^https?:/.test(request.url())) return;
    if (allowedNavigation && request.url() === target.url && request.method() === 'GET' &&
        request.isNavigationRequest() && request.resourceType() === 'document' && request.frame() === page.mainFrame()) {
      allowedNavigation--; return;
    }
    requests.push(`${request.method()} ${request.resourceType()} ${request.url()}`);
  });
  const response = await page.goto(target.url);
  if (target.preview) {
    assert(response && response.ok(), 'Owned preview must load successfully');
    assert.equal(page.url(), target.url, 'No preview redirect');
    assert.equal(digest(await response.body()), digest(await fs.readFile(path.join(root, 'dist/index.html'))),
      'Verify canonical preview bytes before loading any synthetic fixture');
  }
  await context.setOffline(true);
  assert.equal(allowedNavigation, 0);
  if (!loaderOnly) await page.locator('#addButton').waitFor();
  return { context, page, requests, errors, consoleErrors };
}
async function assertClean(run, expectedConsole = []) {
  assert.deepEqual(run.requests, [], 'No runtime HTTP(S) requests');
  assert.deepEqual(run.errors, [], 'No unhandled page errors');
  assert.deepEqual(run.consoleErrors, expectedConsole, 'No unexpected console errors');
  assert.deepEqual((await auditSnapshot(run.page)).violations, [], 'No CSP violations');
}
async function idle(page) {
  await page.locator('#loadProgress').waitFor({ state: 'hidden' });
  await page.locator('#analysisProgress').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => /finished|完了/.test(document.querySelector('#analysisResult').textContent));
}
async function setLanguage(page, language) {
  if (await page.locator('html').getAttribute('lang') !== language) await page.locator('#languageButton').click();
  assert.equal(await page.locator('html').getAttribute('lang'), language);
}
async function assertFallback(page, language) {
  for (const id of ['findSimilarButton', 'chooseSimilarityGroupsButton', 'findFacesButton']) {
    assert(await page.locator('#' + id).isDisabled(), `${id} must be unavailable`);
  }
  for (const id of ['similarityMessage', 'faceStatus']) {
    const text = await page.locator('#' + id).textContent();
    assert(text.trim(), `${id} must explain unavailable browser features`);
    assert.match(text, language === 'en' ? /compar|Keep|sav/i : /比較|残す|保存/);
    if (language === 'ja') assert.match(text, /[\u3040-\u30ff\u4e00-\u9fff]/);
  }
  assert(await page.locator('#similarityScopeDialog').isHidden());
  assert(await page.locator('#similarityProgress').isHidden());
}
async function coreWorkflow(page, files) {
  assert.equal(await page.locator('.photo-card.kept').count(), 0);
  await page.locator('#photo-p1 .keep-button').click();
  await page.locator('#selectA').selectOption('p1');
  await page.locator('#selectB').selectOption('p3');
  await page.locator('#imageA').evaluate(image => image.decode());
  await page.locator('#imageB').evaluate(image => image.decode());
  await page.locator('#compareZoom').selectOption('2');
  assert.equal(await page.locator('#imageA').evaluate(image => image.style.width), '96px');
  await page.locator('#keepB').click();
  assert.equal(await page.locator('.photo-card.kept').count(), 2);
  const merge = async () => {
    await page.locator('#organizeButton').click();
    await page.locator('#sourceGroup').selectOption('g-p2');
    await page.locator('#targetGroup').selectOption('g-p1');
    await page.locator('#mergeGroupButton').click();
    assert.equal(await page.locator('.group-chip').count(), 2);
    assert.equal(await page.locator('.photo-card.kept').count(), 2);
  };
  await merge();
  await page.locator('#appToastAction').click();
  assert.equal(await page.locator('.group-chip').count(), 3);
  await merge();
  for (const language of ['ja', 'en']) {
    await setLanguage(page, language);
    assert.equal(await page.locator('.group-chip').count(), 2, 'Language change preserves manual merge');
    assert.equal(await page.locator('.photo-card.kept').count(), 2);
    await assertFallback(page, language);
  }
  await page.locator('#outputFilename').fill('compatibility-originals');
  const pending = page.waitForEvent('download');
  await page.locator('#downloadButton').click();
  const download = await pending;
  assert.equal(download.suggestedFilename(), 'compatibility-originals.zip');
  const entries = zipEntries(await fs.readFile(await download.path()));
  assert.deepEqual(entries, [files[0], files[2]].map(file => ({ name: file.name, sha256: digest(file.buffer) })));
  assert.equal(await page.locator('.photo-card.kept').count(), 2);
  return entries;
}
async function missingCapability(browser, target, missing) {
  const run = await session(browser, target, missing);
  try {
    const { page } = run, before = await auditSnapshot(page), files = fixtures();
    assert.equal(before.workers, 0);
    assert.equal(before.gzip, target.variant === 'index.self-extract.html' ? 1 : 0, 'Only wrapper bootstrap may expand');
    assert.equal(await page.evaluate(name => typeof window[name], missing), 'undefined');
    await page.locator('#fileInput').setInputFiles(files); await idle(page);
    assert.equal(await page.locator('.photo-card').count(), 3);
    assert.equal(await page.locator('.group-chip').count(), 3);
    await assertFallback(page, 'en');
    // Physical pointer activation remains inert on genuinely disabled controls.
    for (const id of ['findSimilarButton', 'chooseSimilarityGroupsButton', 'findFacesButton']) {
      await page.locator('#' + id).scrollIntoViewIfNeeded();
      const box = await page.locator('#' + id).boundingBox();
      assert(box); await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }
    const originals = await coreWorkflow(page, files);
    const after = await auditSnapshot(page);
    assert.deepEqual(after, before, 'Core fallback must not decode embedded model assets or start a worker');
    await assertClean(run);
    return { variant: target.variant, missing, originals, audit: after, externalRequests: run.requests, errors: run.errors };
  } finally { await run.context.close(); }
}

async function shortHelpScreenshots(page, target, language) {
  await page.locator('#retryModelLicensesButton').waitFor();
  const help = await page.locator('#helpDialog').textContent();
  assert.match(help, /readable HTML|通常版/); assert.match(help, /memory|メモリ/);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 360 });
    await page.locator('#retryModelLicensesButton').scrollIntoViewIfNeeded();
    const geometry = await page.evaluate(() => {
      const rect = selector => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      };
      const body = document.querySelector('#helpDialog .dialog-body');
      return { dialog: rect('#helpDialog'), close: rect('#closeHelpButton'), retry: rect('#retryModelLicensesButton'),
        body: rect('#helpDialog .dialog-body'), horizontal: document.documentElement.scrollWidth > innerWidth,
        remaining: body.scrollHeight - body.scrollTop - body.clientHeight };
    });
    assert(!geometry.horizontal, 'Narrow help must not overflow horizontally');
    for (const box of [geometry.dialog, geometry.close, geometry.retry]) {
      assert(box.top >= -1 && box.bottom <= 361 && box.left >= -1 && box.right <= width + 1, JSON.stringify(geometry));
    }
    assert(geometry.retry.top >= geometry.body.top && geometry.retry.bottom <= geometry.body.bottom + 1,
      'The explicit retry is reachable inside the short help scroll area');
    await page.screenshot({ path: path.join(results, `compatibility.help.${target.variant}.${language}.${width}.png`) });
  }
  await page.setViewportSize({ width: 1360, height: 900 });
  await page.locator('#helpDialog .dialog-body').evaluate(node => { node.scrollTop = 0; });
  await page.screenshot({ path: path.join(results, `compatibility.help-overview.${target.variant}.${language}.png`) });
}
async function expectedLicenseText() {
  const texts = [];
  for (const directory of ['embedding', 'face-detection']) {
    const base = path.join(root, 'assets', directory);
    const manifest = JSON.parse(await fs.readFile(path.join(base, 'manifest.json'), 'utf8'));
    for (const key of ['notices', 'license']) {
      const asset = manifest.assets.find(item => item.key === key);
      const bytes = await fs.readFile(path.join(base, asset.path));
      assert.equal(digest(bytes), asset.sha256, 'Expected license is the canonical pinned source');
      texts.push(bytes.toString('utf8'));
    }
  }
  return texts.join('\n\n');
}
async function licenseRecovery(browser, target) {
  const run = await session(browser, target, null);
  try {
    const { page } = run, baseline = await auditSnapshot(page);
    // Arm only after the wrapper has finished. All following calls use the real
    // frozen StandaloneAssets and native gzip implementation, including retries.
    assert.equal(await page.evaluate(() => Object.isFrozen(window.StandaloneAssets)), true);
    await page.evaluate(() => { window.__compatibilityAudit.nextMode = 'fail'; });
    await page.locator('#helpButton').click();
    await page.locator('#modelLicenses summary').click();
    await page.locator('#retryModelLicensesButton').waitFor();
    await page.waitForFunction(base => window.__compatibilityAudit.completed === base + 3, baseline.completed);
    const failed = await auditSnapshot(page);
    assert.equal(failed.gzip - baseline.gzip, 4, 'The four real embedded license assets were attempted once');
    assert.equal(failed.injectedFailures, 1);
    assert.equal(await page.locator('#modelLicenseText').textContent(), '', 'Failure copy must not masquerade as license text');
    assert.equal(await page.locator('#modelLicenseStatus').getAttribute('role'), 'status');
    const englishFailure = await page.locator('#modelLicenseStatus').textContent();
    assert.match(englishFailure, /licen[cs]e/i); assert.match(englishFailure, /retry|again|could not|unable|failed/i);
    await shortHelpScreenshots(page, target, 'en');
    // Change language through normal controls while keeping the failed details
    // open. Reopening Help does not replace the error with stale English text.
    await page.locator('#closeHelpButton').click();
    await setLanguage(page, 'ja');
    await page.locator('#helpButton').click();
    const japaneseFailure = await page.locator('#modelLicenseStatus').textContent();
    assert.notEqual(japaneseFailure, englishFailure);
    assert.match(japaneseFailure, /ライセンス/); assert.match(japaneseFailure, /再試行|もう一度|読み込|取得/);
    assert.equal(await page.locator('#modelLicenseText').textContent(), '');
    await shortHelpScreenshots(page, target, 'ja');
    await page.evaluate(() => { window.__compatibilityAudit.nextMode = 'hold'; });
    await page.locator('#retryModelLicensesButton').focus();
    await page.locator('#retryModelLicensesButton').press('Enter');
    assert(await page.locator('#modelLicenses summary').evaluate(node => node === document.activeElement),
      'Keyboard retry moves focus to the visible summary before hiding its button');
    await page.waitForFunction(() => window.__compatibilityAudit.pending.length === 1);
    const loading = await auditSnapshot(page);
    assert.equal(loading.gzip, failed.gzip + 1, 'Retry evicts only the rejected cached asset');
    assert.equal(loading.decodes, failed.decodes + 1, 'Successful license asset caches remain reusable');
    assert.equal(await page.locator('#modelLicenseText').textContent(), '');
    assert.match(await page.locator('#modelLicenseStatus').textContent(), /読込|読み込|準備|開いて/);
    assert(await page.locator('#retryModelLicensesButton').isHidden() || await page.locator('#retryModelLicensesButton').isDisabled());
    for (let repeat = 0; repeat < 2; repeat++) {
      await page.locator('#modelLicenses summary').click();
      await page.locator('#modelLicenses summary').click();
    }
    assert.deepEqual(await auditSnapshot(page), loading, 'Repeated toggles share one in-flight expansion');
    await page.evaluate(() => window.__compatibilityAudit.release());
    const expected = await expectedLicenseText();
    await page.waitForFunction(text => document.querySelector('#modelLicenseText').textContent === text, expected);
    assert(await page.locator('#retryModelLicensesButton').isHidden());
    const loaded = await auditSnapshot(page);
    assert.equal(loaded.completed, baseline.completed + 4);
    assert.equal(loaded.gzip, baseline.gzip + 5);
    assert.equal(loaded.workers, 0, 'License viewing never initializes either optional model');
    await page.locator('#modelLicenses summary').click();
    await page.locator('#modelLicenses summary').click();
    await page.locator('#closeHelpButton').click();
    await setLanguage(page, 'en');
    await page.locator('#helpButton').click();
    assert.equal(await page.locator('#modelLicenseText').textContent(), expected, 'Language changes preserve real license text');
    assert.deepEqual(await auditSnapshot(page), loaded, 'Loaded licenses never expand again');
    await page.locator('#helpDialog').press('Escape');
    await page.locator('#fileInput').setInputFiles(fixtures()); await idle(page);
    for (const id of ['findSimilarButton', 'chooseSimilarityGroupsButton', 'findFacesButton']) {
      assert(await page.locator('#' + id).isEnabled(), 'Supported browser retains optional actions');
    }
    await assertClean(run);
    return { variant: target.variant, scenario: 'real-license-gzip-retry', licenseSha256: digest(Buffer.from(expected)),
      attempts: loaded.gzip - baseline.gzip, retainedSuccessfulAssets: 3, errors: run.errors, externalRequests: run.requests };
  } finally { await run.context.close(); }
}
async function wrapperDiagnostic(browser) {
  const target = { variant: 'index.self-extract.html', url: pathToFileURL(path.join(root, 'dist/index.self-extract.html')).href };
  const run = await session(browser, target, 'DecompressionStream', true);
  try {
    await run.page.locator('body.failed #error').waitFor();
    const diagnostic = await run.page.locator('#error').textContent();
    assert.match(diagnostic, /Failed to unpack the application/);
    assert.match(diagnostic, /DecompressionStream/); assert.match(diagnostic, /展開に失敗/);
    assert.equal(await run.page.locator('#addButton').count(), 0, 'Wrapper cannot bootstrap without its own required API');
    assert.equal(run.consoleErrors.length, 1, 'One expected loader diagnostic');
    assert.match(run.consoleErrors[0], /DecompressionStream/);
    await assertClean(run, run.consoleErrors.slice());
    const audit = await auditSnapshot(run.page);
    assert.equal(audit.decodes, 0); assert.equal(audit.gzip, 0); assert.equal(audit.workers, 0);
    return { variant: target.variant, scenario: 'wrapper-missing-decompressor', diagnostic, expectedConsoleErrors: run.consoleErrors };
  } finally { await run.context.close(); }
}

async function selfTest() {
  const vm = require('node:vm');
  const window = { atob, Worker: class {}, DecompressionStream, addEventListener() {} };
  vm.runInNewContext(`(${installBrowserAudit.toString()})({missing:null})`, { window, TransformStream, Uint8Array });
  const bytes = Buffer.from('real native gzip observer test'), compressed = zlib.gzipSync(bytes);
  const expand = () => new Response(new Blob([compressed]).stream().pipeThrough(new window.DecompressionStream('gzip'))).arrayBuffer();
  assert.deepEqual(Buffer.from(await expand()), bytes);
  window.__compatibilityAudit.nextMode = 'fail';
  await assert.rejects(expand(), 'Corrupt test input must fail in the native decoder');
  window.__compatibilityAudit.nextMode = 'hold';
  const held = expand();
  assert.equal(window.__compatibilityAudit.pending.length, 1);
  assert.equal(window.__compatibilityAudit.completed, 1);
  window.__compatibilityAudit.release();
  assert.deepEqual(Buffer.from(await held), bytes);
  assert.equal(window.__compatibilityAudit.completed, 2);
  assert.equal(window.__compatibilityAudit.injectedFailures, 1);
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
  assert.equal(new Set(fixtures().map(file => digest(file.buffer))).size, 3);
  const { File } = require('node:buffer');
  const core = require('../src/core.js'), samples = fixtures().slice(0, 2);
  const zip = await core.createZip(samples.map(file => new File([file.buffer], file.name, { type: file.mimeType })));
  assert.deepEqual(zipEntries(Buffer.from(await zip.arrayBuffer())), samples.map(file => ({ name: file.name, sha256: digest(file.buffer) })));
  assert.match(await expectedLicenseText(), /Apache License/);
  for (const missing of ['Worker', 'DecompressionStream']) {
    const controlled = { atob, Worker: class {}, DecompressionStream, addEventListener() {} };
    vm.runInNewContext(`(${installBrowserAudit.toString()})({missing:${JSON.stringify(missing)}})`, { window: controlled, TransformStream, Uint8Array });
    assert.equal(typeof controlled[missing], 'undefined');
  }
  assert(previewURL('https://r1-pr-2-bk-previews.ttomohisa.workers.dev/'));
  assert.throws(() => previewURL('https://example.com/'));
  assert.throws(() => previewURL('https://r1-pr-2-bk-previews.ttomohisa.workers.dev/?other=1'));
  console.log('PASS compatibility harness self-test: native gzip pass/fail/hold, API removal, synthetic PNGs/original ZIP hashes, pinned license text and preview allowlist; no browser launched');
}
async function main() {
  if (process.argv.includes('--self-test')) return selfTest();
  const preview = previewURL(process.env.BSP_PREVIEW_URL);
  const targets = preview ? [{ variant: 'https-preview', url: preview.href, preview: true }] :
    ['index.html', 'index.self-extract.html'].map(variant => ({ variant, url: pathToFileURL(path.join(root, 'dist', variant)).href }));
  const { chromium } = require('playwright');
  await fs.mkdir(results, { recursive: true });
  const browser = await chromium.launch({ headless: true }), report = [];
  try {
    for (const target of targets) {
      report.push(await missingCapability(browser, target, 'Worker'));
      if (target.variant !== 'index.self-extract.html') report.push(await missingCapability(browser, target, 'DecompressionStream'));
      report.push(await licenseRecovery(browser, target));
      console.log(`PASS optional browser fallback and real license retry: ${target.variant}`);
    }
    if (!preview) report.push(await wrapperDiagnostic(browser));
  } finally { await browser.close(); }
  await fs.writeFile(path.join(results, 'compatibility-browser.json'), JSON.stringify({
    scenarios: report, syntheticInputsOnly: true, physicalDeviceMeasured: false
  }, null, 2) + '\n');
  console.log('PASS missing browser APIs, manual comparison/Keep/group edit/Undo/original ZIP, real gzip retry/cache, EN/JA short help, and no runtime network');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
