/*
 * Offline face-position acceptance. Synthetic fixtures + a test-only Worker double
 * cover UI state; a separate real embedded-model run uses one upstream adult
 * portrait as a positive regression, never a general accuracy/device benchmark.
 * The portrait is acquired and hash-checked before a browser starts, stays in the
 * ignored cache, and is loaded only into file:// pages. No photo screenshots,
 * traces, videos, data URLs, image bytes or downloaded photo ZIPs are artifacts.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const variants = ['index.html', 'index.self-extract.html'];
const preview = process.env.BSP_PREVIEW_URL ? new URL(process.env.BSP_PREVIEW_URL) : null;
if (preview) {
  assert.equal(preview.protocol, 'https:');
  assert.match(preview.hostname, /^r\d+-pr-\d+-bk-previews\.ttomohisa\.workers\.dev$/);
  assert.equal(preview.pathname, '/'); assert.equal(preview.search, '');
  assert.equal(preview.username, ''); assert.equal(preview.password, '');
}
assert(process.argv.slice(2).every(argument => argument === '--london-only'), 'Unknown face-test argument');
const londonOnly = process.argv.includes('--london-only');
const londonParityRequested = londonOnly || process.env.BSP_FACE_LONDON_PARITY === '1';
const portraitSource = 'https://storage.googleapis.com/mediapipe-assets/tasks/testdata/vision/portrait.jpg?generation=1782185108020964';
const portraitSha256 = 'a6f11efaa834706db23f275b6115058fa87fc7f14362681e6abe14e82749de3e';
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function portraitFixture() {
  // MediaPipe's vision BUILD declares its test package Apache-2.0 and its
  // external_files.bzl pins this official portrait. This is not user media.
  const cached = path.join(root, '.cache', 'face-test-fixture', 'portrait.jpg');
  let bytes;
  try { bytes = await fs.readFile(cached); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const acquired = path.join(root, 'test-results', 'face-research', 'assets', 'official-fixture', 'portrait.jpg');
    try { bytes = await fs.readFile(acquired); }
    catch (missing) {
      if (missing.code !== 'ENOENT') throw missing;
      const response = await fetch(portraitSource, { signal: AbortSignal.timeout(30000), redirect: 'error' });
      assert(response.ok, `Official fixture acquisition failed: HTTP ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
    }
    assert.equal(digest(bytes), portraitSha256, 'Do not use changed or unverified portrait bytes');
    await fs.mkdir(path.dirname(cached), { recursive: true });
    await fs.writeFile(cached, bytes);
  }
  assert.equal(digest(bytes), portraitSha256, 'Cached portrait hash must match the fixed source');
  return { name: 'official-positive-fixture.jpg', mimeType: 'image/jpeg', buffer: bytes };
}

// This code is injected solely by Playwright. Product globals, model clients,
// state, and result validation are not replaced. The face worker's source marker
// identifies its Blob; every other Worker and Blob keeps native behavior.
function installWorkerAudit({ fake }) {
  const NativeBlob = window.Blob, NativeWorker = window.Worker;
  const createURL = URL.createObjectURL.bind(URL), revokeURL = URL.revokeObjectURL.bind(URL);
  const faceBlobs = new WeakSet(), faceURLs = new Set();
  const audit = window.__faceTest = {
    fake, hold: '', failInit: false, result: 'valid', pending: [],
    workers: [], inputs: [], replies: [], lifecycle: [], createdURLs: 0, revokedURLs: 0,
    policyViolations: [],
    release() { this.pending.splice(0).forEach(reply => reply()); }
  };
  document.addEventListener('securitypolicyviolation', event => audit.policyViolations.push({ directive: event.violatedDirective, blocked: event.blockedURI }));
  function AuditedBlob(parts, options) {
    if (!new.target) throw new TypeError('Blob must be constructed');
    const blob = new NativeBlob(parts, options);
    if (typeof parts?.[0] === 'string' && parts[0].startsWith('/* Runs exclusively inside the optional face-position Blob worker. */')) faceBlobs.add(blob);
    return blob;
  }
  Object.setPrototypeOf(AuditedBlob, NativeBlob);
  // Preserve native own accessors: the ZIP boundary deliberately checks
  // Object.getOwnPropertyDescriptor(Blob.prototype, 'size') on real File objects.
  AuditedBlob.prototype = NativeBlob.prototype;
  window.Blob = AuditedBlob;
  URL.createObjectURL = blob => {
    const url = createURL(blob);
    if (faceBlobs.has(blob)) { faceURLs.add(url); audit.createdURLs++; }
    return url;
  };
  URL.revokeObjectURL = url => {
    if (faceURLs.delete(url)) audit.revokedURLs++;
    return revokeURL(url);
  };
  const recordInput = message => {
    if (message.type === 'infer') audit.inputs.push({ width: message.width, height: message.height, bytes: message.rgb.byteLength });
  };
  const recordReply = message => {
    if (message.type === 'result') audit.replies.push({ faceCount: message.faces?.length, boxes: message.faces?.map(face => face.box), metrics: message.metrics });
    else audit.lifecycle.push({ type: message.type, backend: message.diagnostics?.actualBackend, remainingTensors: message.remainingTensors, attempts: message.attempts, violations: message.violations });
  };
  const validFace = (width, height, index) => {
    const xMin = width * (index ? 0.58 : 0.15), yMin = height * (index ? 0.50 : 0.20);
    const w = width * 0.25, h = height * 0.28;
    return {
      box: { xMin, xMax: xMin + w, yMin, yMax: yMin + h, width: w, height: h },
      keypoints: Array.from({ length: 6 }, (_, i) => ({ x: xMin + w * (0.3 + (i % 2) * 0.4), y: yMin + h * (0.25 + Math.floor(i / 2) * 0.25) }))
    };
  };
  class FakeFaceWorker extends EventTarget {
    constructor(entry) { super(); this.entry = entry; this.onmessage = null; }
    postMessage(message) {
      recordInput(message);
      const envelope = { generation: message.generation, jobId: message.jobId };
      let data;
      if (message.type === 'init') {
        assertInit(message);
        data = audit.failInit ? { ...envelope, type: 'error', error: { name: 'Error', message: 'Synthetic unavailable face model' } } : { ...envelope, type: 'ready', diagnostics: {} };
      } else if (message.type === 'infer') {
        let faces = audit.result === 'none' ? [] : [validFace(message.width, message.height, 0), validFace(message.width, message.height, 1)];
        if (audit.result === 'invalid') faces[0].box.xMin = NaN;
        data = { ...envelope, type: 'result', faces, metrics: {} };
      } else if (message.type === 'dispose') data = { ...envelope, type: 'disposed', diagnostics: {} };
      else throw new Error('Unexpected face worker message: ' + message.type);
      // Retain the queued listener intentionally: cancellation must reject a late
      // event already enqueued before terminate(), not just suppress callbacks.
      const listener = this.onmessage;
      const reply = () => { recordReply(data); listener?.({ data }); };
      if (audit.hold === message.type) audit.pending.push(reply);
      else queueMicrotask(reply);
    }
    terminate() { this.entry.terminated = true; }
  }
  function assertInit(message) {
    if (!message.modelJson || !(message.weightData instanceof ArrayBuffer) || !message.weightData.byteLength) throw new Error('Missing embedded model payload');
  }
  function AuditedWorker(url, options) {
    if (!faceURLs.has(String(url))) return new NativeWorker(url, options);
    const entry = { terminated: false }; audit.workers.push(entry);
    if (fake) return new FakeFaceWorker(entry);
    const worker = new NativeWorker(url, options);
    const post = worker.postMessage.bind(worker), terminate = worker.terminate.bind(worker);
    worker.postMessage = (message, ...rest) => { recordInput(message); return post(message, ...rest); };
    worker.terminate = () => { entry.terminated = true; return terminate(); };
    worker.addEventListener('message', event => recordReply(event.data));
    return worker;
  }
  Object.setPrototypeOf(AuditedWorker, NativeWorker);
  AuditedWorker.prototype = NativeWorker.prototype;
  window.Worker = AuditedWorker;
}

async function session(browser, variant, fake) {
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: 'en-US', acceptDownloads: true });
  if (!preview) await context.setOffline(true);
  await context.addInitScript(installWorkerAudit, { fake });
  const requests = [], errors = [], page = await context.newPage();
  let expectedNavigations = preview ? 1 : 0;
  context.on('request', request => {
    if (!/^https?:/.test(request.url())) return;
    if (preview && expectedNavigations && request.url() === preview.href && request.method() === 'GET' && request.isNavigationRequest() && request.resourceType() === 'document' && request.frame() === page.mainFrame()) { expectedNavigations--; return; }
    requests.push(`${request.method()} ${request.resourceType()} ${request.url()}`);
  });
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(30000);
  const navigation = await page.goto(preview?.href || pathToFileURL(path.join(root, 'dist', variant)).href);
  if (preview) assert.equal(digest(await navigation.body()), digest(await fs.readFile(path.join(root, 'dist', 'index.html'))), 'Owned preview must serve this exact built artifact');
  await page.locator('#addButton').waitFor();
  await context.setOffline(true);
  assert.equal(expectedNavigations, 0);
  return { context, page, requests, errors };
}
async function idle(page) {
  await page.locator('#loadProgress').waitFor({ state: 'hidden' });
  await page.locator('#analysisProgress').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => /finished|完了/.test(document.querySelector('#analysisResult').textContent));
}
async function faceDone(page) {
  await page.waitForFunction(() => !document.querySelector('#findFacesButton').disabled && document.querySelector('#cancelFacesButton').hidden, null, { timeout: 90000 });
}
async function search(page) { await page.locator('#findFacesButton').click(); await faceDone(page); }
async function cleaned(page) {
  const audit = await page.evaluate(() => ({ workers: window.__faceTest.workers, createdURLs: window.__faceTest.createdURLs, revokedURLs: window.__faceTest.revokedURLs }));
  assert(audit.workers.every(worker => worker.terminated), 'Every completed/cancelled face worker must be terminated');
  assert.equal(audit.createdURLs, audit.revokedURLs, 'Every face Blob URL must be revoked');
}
async function noFaces(page) { assert.equal(await page.locator('#faceChoicesA button, #faceChoicesB button').count(), 0); }
async function held(page, type) {
  await page.evaluate(type => { window.__faceTest.hold = type; }, type);
  await page.locator('#findFacesButton').click();
  await page.waitForFunction(() => window.__faceTest.pending.length === 1);
}
async function release(page) {
  await page.evaluate(() => { window.__faceTest.hold = ''; window.__faceTest.release(); });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function memberships(page) {
  await page.locator('#organizeButton').click();
  const groups = await page.locator('#sourceGroup option').evaluateAll(options => options.map(option => ({ id: option.value, manual: /Manual|手動/.test(option.textContent) })));
  for (const group of groups) {
    await page.locator('#sourceGroup').selectOption(group.id);
    group.photos = await page.locator('#groupPhoto option').evaluateAll(options => options.map(option => option.value));
  }
  await page.locator('#closeGroupButton').click();
  return groups;
}
async function originalZip(page, originals) {
  await page.locator('#outputFilename').fill('face-check-originals');
  const pending = page.waitForEvent('download');
  await page.locator('#downloadButton').click();
  const download = await pending;
  assert.equal(download.suggestedFilename(), 'face-check-originals.zip');
  const bytes = await fs.readFile(await download.path()), entries = [];
  let offset = 0;
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(bytes.readUInt16LE(offset + 8), 0, 'Originals remain uncompressed ZIP entries');
    const size = bytes.readUInt32LE(offset + 18), nameLength = bytes.readUInt16LE(offset + 26);
    const start = offset + 30 + nameLength + bytes.readUInt16LE(offset + 28);
    entries.push({ name: bytes.subarray(offset + 30, offset + 30 + nameLength).toString(), sha256: digest(bytes.subarray(start, start + size)) });
    offset = start + size;
  }
  assert.deepEqual(entries, originals.map(file => ({ name: file.name, sha256: digest(file.buffer) })));
  await download.delete();
}
async function faceVisible(page, slot, relativeCenter) {
  await page.waitForFunction(slot => !!document.querySelector('#viewport' + slot).dataset.faceLayout, slot);
  const visible = await page.evaluate(({ slot, relativeCenter }) => {
    const image = document.querySelector('#image' + slot).getBoundingClientRect();
    const viewport = document.querySelector('#viewport' + slot).getBoundingClientRect();
    const x = image.left + image.width * relativeCenter[0], y = image.top + image.height * relativeCenter[1];
    return { inside: x >= viewport.left && x <= viewport.right && y >= viewport.top && y <= viewport.bottom, width: image.width, height: image.height };
  }, { slot, relativeCenter });
  assert(visible.inside, `Chosen face center must be visible in ${slot}: ${JSON.stringify(visible)}`);
}
async function keyboardReachable(page, selector, stage) {
  // Native focus and the mobile tab both honor the page's smooth scrolling.
  // Locator.focus() does not wait for that animation. Observe the same actual
  // hit target with a bounded wait; never scroll it into place from the test.
  try {
    await page.waitForFunction(selector => {
      const button = document.querySelector(selector);
      if (!button || document.activeElement !== button) return false;
      const r = button.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return r.width > 0 && r.height > 0 && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight && (hit === button || button.contains(hit));
    }, selector, { timeout: 5000 });
  } catch (error) {
    const detail = await page.evaluate(({ selector, stage }) => {
      const button = document.querySelector(selector), r = button?.getBoundingClientRect();
      const hit = r && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      const rect = node => { const box = node?.getBoundingClientRect(); return box ? { top: box.top, bottom: box.bottom, left: box.left, right: box.right } : null; };
      return { stage, selector, language: document.documentElement.lang, viewport: { width: innerWidth, height: innerHeight }, scrollY, button: rect(button), activeElement: document.activeElement?.id, hit: hit?.id || hit?.className || hit?.tagName || null, header: rect(document.querySelector('.app-header')), navigation: rect(document.querySelector('#appMobileBottomBar')) };
    }, { selector, stage });
    // This helper is used only with synthetic fixtures, never real photographs.
    await fs.writeFile(path.join(root, 'test-results', 'face.synthetic.focus-failure.json'), JSON.stringify(detail, null, 2) + '\n');
    await page.screenshot({ path: path.join(root, 'test-results', 'face.synthetic.focus-failure.png') });
    assert.fail('Keyboard-focused face control must become unobstructed without test scrolling: ' + JSON.stringify(detail) + '; ' + error.message);
  }
}
async function verifySession(session) {
  await cleaned(session.page);
  assert.deepEqual(session.errors, [], 'No uncaught page error');
  assert.deepEqual(session.requests, [], 'No runtime network request in offline forms');
  assert.deepEqual(await session.page.evaluate(() => window.__faceTest.policyViolations), [], 'No blocked runtime dependency or CSP violation');
  assert.equal(await session.page.evaluate(() => typeof window.tf), 'undefined', 'TFJS stays out of the main window');
  const audit = await session.page.evaluate(() => ({ fake: window.__faceTest.fake, lifecycle: window.__faceTest.lifecycle }));
  if (!audit.fake) {
    const initialized = audit.lifecycle.filter(reply => reply.type === 'ready'), disposed = audit.lifecycle.filter(reply => reply.type === 'disposed');
    assert(initialized.length > 0, 'The real embedded face worker must have initialized');
    assert(initialized.every(reply => reply.backend === 'cpu'), 'Real worker must use the CPU backend');
    assert.equal(disposed.length, initialized.length, 'Every successful real worker disposes');
    for (const reply of disposed) {
      assert.equal(reply.remainingTensors, 0, 'Disposed worker returns to zero logical tensors');
      assert.deepEqual(reply.attempts, [], 'Worker attempted no runtime network');
      assert.deepEqual(reply.violations, [], 'Worker has no CSP violations');
    }
  }
}

async function syntheticAcceptance(browser, variant) {
  const run = await session(browser, variant, true), { page } = run;
  try {
    const names = ['landscape.jpg', 'portrait-exif-6.jpg', 'transparent.png'];
    const files = await Promise.all(names.map(async name => ({ name, mimeType: name.endsWith('.png') ? 'image/png' : 'image/jpeg', buffer: await fs.readFile(path.join(__dirname, 'fixtures', name)) })));
    await page.locator('#fileInput').setInputFiles(files); await idle(page);
    assert.equal(await page.evaluate(() => window.__faceTest.workers.length), 0, 'Import and normal analysis must not start a face worker');
    assert.equal(await page.evaluate(() => window.__faceTest.inputs.length), 0);
    assert.equal(await page.locator('.photo-card.kept').count(), 0);
    await page.locator('#organizeButton').click();
    const groupIds = await page.locator('#sourceGroup option').evaluateAll(options => options.map(option => option.value));
    assert(groupIds.length >= 2, 'Synthetic fixtures must permit an explicit manual group');
    await page.locator('#sourceGroup').selectOption(groupIds.at(-1));
    await page.locator('#targetGroup').selectOption(groupIds[0]);
    await page.locator('#mergeGroupButton').click();
    await page.locator('#photo-p1 .keep-button').click();
    const beforeGroups = await memberships(page);
    assert(beforeGroups.some(group => group.manual));
    await page.locator('#selectA').selectOption('p1'); await page.locator('#selectB').selectOption('p2');
    await search(page);
    assert.deepEqual(await page.evaluate(() => window.__faceTest.inputs), [{ width: 320, height: 240, bytes: 320 * 240 * 3 }, { width: 240, height: 320, bytes: 240 * 320 * 3 }], 'Only current A/B are inferred, in browser-oriented dimensions; the third photo is excluded');
    assert.equal(await page.locator('#faceChoicesA button').count(), 2);
    assert.equal(await page.locator('#faceChoicesB button').count(), 2);
    assert.equal(await page.locator('[data-face-index][aria-pressed="true"]').count(), 0, 'Finding positions must not choose a face automatically');
    const originalB = await page.locator('#imageB').getAttribute('style');
    await page.locator('#faceChoicesA [data-face-index="1"]').focus(); await page.keyboard.press('Enter');
    assert.equal(await page.locator('#faceChoicesA [data-face-index="1"]').getAttribute('aria-pressed'), 'true');
    await faceVisible(page, 'A', [0.705, 0.64]);
    assert.equal(await page.locator('#imageB').getAttribute('style'), originalB, 'A face selection must not imply matching a person in B');
    await page.locator('#faceChoicesB [data-face-index="0"]').click(); await faceVisible(page, 'B', [0.275, 0.34]);
    await page.locator('#wholeImageA').focus(); await page.keyboard.press('Space');
    assert.equal(await page.locator('#imageA').evaluate(image => image.style.width), '');
    assert.equal(await page.locator('#faceChoicesA [aria-pressed="true"]').count(), 0);
    assert.equal(await page.locator('#faceChoicesB [aria-pressed="true"]').count(), 1);
    await page.locator('#compareZoom').selectOption('2');
    assert.equal(await page.locator('#imageA').evaluate(image => image.style.width), '640px');
    assert.equal(await page.locator('#imageB').evaluate(image => image.style.width), '480px');
    assert.equal(await page.locator('[data-face-index][aria-pressed="true"]').count(), 0);
    await page.locator('#compareZoom').selectOption('fit');
    assert.deepEqual(await memberships(page), beforeGroups);
    assert.equal(await page.locator('.photo-card.kept').count(), 1);
    await originalZip(page, [files[0]]); await cleaned(page);

    // Separate held init and held inference ensure both cancellation boundaries
    // release resources; the latter deliberately delivers its already-queued reply.
    await held(page, 'init'); await page.locator('#cancelFacesButton').click(); await release(page); await faceDone(page); await noFaces(page); await cleaned(page);
    await held(page, 'infer');
    await page.locator('#keepB').click();
    assert(await page.locator('#downloadButton').isEnabled(), 'Keep/export remain usable during optional inference');
    await page.locator('#cancelFacesButton').click(); await release(page); await faceDone(page); await noFaces(page); await cleaned(page);
    assert.equal(await page.locator('.photo-card.kept').count(), 2);
    await search(page); assert.equal(await page.locator('#faceChoicesA button').count(), 2);

    await held(page, 'infer'); await page.locator('#selectB').selectOption('p3'); await release(page); await faceDone(page); await noFaces(page); await cleaned(page);
    assert.equal(await page.locator('#selectB').inputValue(), 'p3');
    const inputStart = await page.evaluate(() => window.__faceTest.inputs.length);
    await search(page);
    assert.deepEqual(await page.evaluate(start => window.__faceTest.inputs.slice(start).map(input => [input.width, input.height]), inputStart), [[320, 240], [100, 80]]);
    // Duplicate A/B selections represent one photo and must not run it twice.
    await page.locator('#selectB').selectOption('p1');
    const duplicateStart = await page.evaluate(() => window.__faceTest.inputs.length);
    await search(page);
    assert.equal(await page.evaluate(start => window.__faceTest.inputs.length - start, duplicateStart), 1);
    await page.locator('#selectB').selectOption('p2');

    await page.evaluate(() => { window.__faceTest.failInit = true; }); await search(page);
    await noFaces(page); await cleaned(page); assert.match(await page.locator('#faceStatus').textContent(), /unavailable|could not|failed/i);
    assert.equal(await page.locator('.photo-card.kept').count(), 2); assert(await page.locator('#downloadButton').isEnabled());
    await page.evaluate(() => { window.__faceTest.failInit = false; }); await search(page);
    assert.equal(await page.locator('#faceChoicesA button').count(), 2, 'Retry after unavailable model succeeds');
    await page.evaluate(() => { window.__faceTest.result = 'invalid'; }); await search(page);
    await noFaces(page); await cleaned(page); assert.match(await page.locator('#faceStatus').textContent(), /unavailable|could not|failed/i);
    await page.evaluate(() => { window.__faceTest.result = 'none'; }); await search(page);
    await noFaces(page); assert.match(await page.locator('#faceMessageA').textContent(), /no face|not found|not detected/i);
    assert.equal(await page.locator('.photo-card.kept').count(), 2, 'No detection never changes Keep');
    await page.evaluate(() => { window.__faceTest.result = 'valid'; }); await search(page);

    for (const language of ['en', 'ja']) {
      if (await page.locator('html').getAttribute('lang') !== language) await page.locator('#languageButton').click();
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 640 });
        await page.locator('[data-mobile-key="compare"]').click();
        for (const slot of ['A', 'B']) {
          await page.locator('#slot' + slot).click();
          const choice = page.locator(`#faceChoices${slot} [data-face-index="0"]`);
          await choice.focus();
          await keyboardReachable(page, `#faceChoices${slot} [data-face-index="0"]`, `${variant}: choose face`);
          await page.keyboard.press('Enter');
          assert.equal(await choice.getAttribute('aria-pressed'), 'true');
          await faceVisible(page, slot, [0.275, 0.34]);
          if (slot === 'A') await page.screenshot({ path: path.join(root, 'test-results', `face.synthetic.${variant}.${language}.${width}.png`) });
          await page.locator('#wholeImage' + slot).focus();
          await keyboardReachable(page, '#wholeImage' + slot, `${variant}: before Whole image`);
          await page.keyboard.press('Space');
          assert.equal(await page.locator('#faceChoices' + slot + ' [aria-pressed="true"]').count(), 0);
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${language} ${width}px must not horizontally overflow`);
          await keyboardReachable(page, '#wholeImage' + slot, `${variant}: after Whole image`);
        }
      }
    }
    await page.setViewportSize({ width: 1360, height: 900 });
    await page.locator('#languageButton').click();
    assert.deepEqual(await memberships(page), beforeGroups);
    await originalZip(page, [files[0], files[1]]);
    await held(page, 'infer'); await page.locator('#clearButton').click(); await page.locator('#appConfirmOk').click();
    await release(page); await noFaces(page); await cleaned(page);
    assert.equal(await page.locator('.photo-card').count(), 0); assert(await page.locator('#downloadButton').isDisabled());
    await page.locator('#fileInput').setInputFiles([files[2]]); await idle(page);
    assert.equal(await page.locator('.photo-name').textContent(), 'transparent.png'); await noFaces(page);
    await verifySession(run);
    console.log('PASS optional face UI/state ' + variant);
    return { variant, scope: 'Synthetic state/geometry only', externalRequests: 0, errors: [], manualGroupsUnchanged: true, keptOriginalHashesUnchanged: true };
  } finally { await run.context.close(); }
}

async function realModelAcceptance(browser, variant, portrait) {
  const run = await session(browser, variant, false), { page } = run;
  try {
    await page.locator('#fileInput').setInputFiles([portrait]); await idle(page);
    assert.equal(await page.evaluate(() => window.__faceTest.workers.length), 0);
    const start = Date.now(); await search(page); const elapsedMs = Date.now() - start;
    assert.equal(await page.locator('#faceChoicesA button').count(), 1, 'Pinned official one-face portrait must yield one usable face');
    const measurements = await page.evaluate(() => ({ inputs: window.__faceTest.inputs, results: window.__faceTest.replies }));
    assert.deepEqual(measurements.inputs, [{ width: 820, height: 1024, bytes: 820 * 1024 * 3 }]);
    assert.equal(measurements.results.length, 1); assert.equal(measurements.results[0].faceCount, 1);
    const box = measurements.results[0].boxes[0];
    assert(Object.values(box).every(Number.isFinite));
    assert(box.width > 0 && box.height > 0 && box.xMin >= 0 && box.yMin >= 0 && box.xMax <= 820 && box.yMax <= 1024);
    await page.locator('#faceChoicesA [data-face-index="0"]').click();
    await faceVisible(page, 'A', [(box.xMin + box.xMax) / 2 / 820, (box.yMin + box.yMax) / 2 / 1024]);
    await page.locator('#wholeImageA').click(); assert.equal(await page.locator('#imageA').evaluate(image => image.style.width), '');
    assert.equal(await page.locator('.photo-card.kept').count(), 0);
    await verifySession(run);
    console.log('PASS real embedded face positive regression ' + variant);
    return { variant, fixtureSha256: portraitSha256, scope: 'One official adult portrait; positive regression only, not general accuracy or physical-device evidence', elapsedMs, ...measurements, externalRequests: 0, errors: [] };
  } finally { await run.context.close(); }
}

async function realSyntheticAcceptance(browser) {
  assert(preview, 'Synthetic real-model preview check requires the verified owned preview');
  const run = await session(browser, 'https-preview', false), { page } = run;
  try {
    const base64 = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 96;
      const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, 128, 96);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    await page.locator('#fileInput').setInputFiles([{ name: 'synthetic-white.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') }]);
    await idle(page); assert.equal(await page.evaluate(() => window.__faceTest.workers.length), 0);
    await search(page); await noFaces(page);
    assert(await page.locator('#faceControlsA').isVisible());
    assert.match(await page.locator('#faceMessageA').textContent(), /no face/i);
    assert.deepEqual(await page.evaluate(() => window.__faceTest.replies.map(reply => reply.faceCount)), [0]);
    await page.locator('#compareZoom').selectOption('2');
    assert.equal(await page.locator('#imageA').evaluate(image => image.style.width), '256px');
    await page.locator('#wholeImageA').click();
    assert.equal(await page.locator('#imageA').evaluate(image => image.style.width), '');
    await verifySession(run);
    console.log('PASS real embedded model, synthetic no-face, owned HTTPS preview');
    return { variant: 'https-preview', scope: 'Real embedded model on a generated white PNG only; no real photo upload', faceCount: 0, externalRequests: 0, errors: [] };
  } finally { await run.context.close(); }
}

async function londonFixtures() {
  assert(!preview, 'London photos may only enter a local file:// app');
  // Reuse the frozen record validator, not its separate Node/Pillow inference.
  // It reads only numeric metadata here; photo acquisition remains an explicit
  // preceding command. Neither this helper nor the browser downloads photos.
  const { readFrozenInputs, pins } = require('../experiments/face-detection/photo-evaluate.cjs');
  const frozen = readFrozenInputs();
  const frontal = frozen.sample.filter(item => item.pose === 'frontal');
  assert.equal(frontal.length, 12);
  const fixtures = [];
  for (const item of frontal) {
    const buffer = await fs.readFile(path.join(root, '.cache', 'face-detection-photos', 'london', item.file));
    assert.equal(digest(buffer), item.sha256, 'Frozen frontal photograph hash: ' + item.file);
    const label = frozen.byFile.get(item.file);
    assert.equal(label.eyeCenters.length, 2);
    fixtures.push({ item, label, input: { name: path.basename(item.file), mimeType: 'image/jpeg', buffer } });
  }
  return { fixtures, acceptanceSha256: pins.acceptance, frontalSampleSha256: pins.frontalSample, labelsSha256: digest(await fs.readFile(path.join(root, 'experiments', 'face-detection', 'photo-boxes.json'))) };
}

async function londonCanvasAcceptance(browser, frozen) {
  assert(!preview, 'London canvas acceptance must never run on HTTPS');
  const { boxIou, inImage, inside } = require('../experiments/face-detection/photo-evaluate.cjs');
  const run = await session(browser, 'index.html', false), { page } = run;
  const report = {
    status: 'running', variant: 'index.html', scope: 'Fixed 12 frontal adult London photographs, actual product browser canvas and short-model CPU worker; no pose expansion or broad accuracy claim',
    license: 'Face Research Lab London Set v5, Lisa DeBruine and Benedict Jones, CC BY 4.0; source photos remain in the ignored cache, no image pixels in this report',
    frozen: { acceptanceSha256: frozen.acceptanceSha256, frontalSampleSha256: frozen.frontalSampleSha256, labelsSha256: frozen.labelsSha256 },
    criterion: { images: 12, usefulCropsRequired: 11, minimumBoxIou: 0.5, bothCreatorEyeCenters: true },
    preprocessing: 'Actual app: browser-oriented original, white canvas, drawImage to max 1024 edge, RGB to real FaceWorkerClient and embedded detector',
    rows: []
  };
  try {
    await page.locator('#fileInput').setInputFiles(frozen.fixtures.map(fixture => fixture.input)); await idle(page);
    assert.equal(await page.evaluate(() => window.__faceTest.workers.length), 0);
    for (let index = 0; index < frozen.fixtures.length; index += 2) {
      await page.locator('#selectA').selectOption('p' + (index + 1));
      await page.locator('#selectB').selectOption('p' + (index + 2));
      const start = await page.evaluate(() => ({ inputs: window.__faceTest.inputs.length, replies: window.__faceTest.replies.length }));
      await search(page);
      const observed = await page.evaluate(start => ({ inputs: window.__faceTest.inputs.slice(start.inputs), replies: window.__faceTest.replies.slice(start.replies) }), start);
      assert.equal(observed.inputs.length, 2, 'Only current London A/B were inferred');
      assert.equal(observed.replies.length, 2);
      for (let offset = 0; offset < 2; offset++) {
        const { item, label } = frozen.fixtures[index + offset], input = observed.inputs[offset], output = observed.replies[offset];
        const slot = ['A', 'B'][offset];
        assert.deepEqual(input, { width: 1024, height: 1024, bytes: 1024 * 1024 * 3 });
        assert.equal(await page.locator('#faceChoices' + slot + ' button').count(), output.faceCount, 'Only client-validated current-photo results reach the UI');
        const candidates = output.boxes.map(box => {
          const originalBox = { xMin: box.xMin * label.width / input.width, xMax: box.xMax * label.width / input.width, yMin: box.yMin * label.height / input.height, yMax: box.yMax * label.height / input.height };
          assert(inImage(originalBox, label.width, label.height), 'No invalid or out-of-image geometry reaches comparison');
          const iou = boxIou(originalBox, label.box), eyesInside = label.eyeCenters.map(point => inside(originalBox, point));
          return { originalBox, iou, eyesInside, usefulCrop: iou >= 0.5 && eyesInside.every(Boolean) };
        });
        report.rows.push({ file: item.file, sha256: item.sha256, inputWidth: input.width, inputHeight: input.height, returnedFaceCount: output.faceCount, unwantedCandidates: Math.max(0, output.faceCount - 1), inferenceMs: output.metrics.inferenceMs, usefulCrop: candidates.some(candidate => candidate.usefulCrop), candidates });
        if (output.faceCount) {
          await page.locator('#faceChoices' + slot + ' [data-face-index="0"]').click();
          const box = output.boxes[0];
          await faceVisible(page, slot, [(box.xMin + box.xMax) / 2 / input.width, (box.yMin + box.yMax) / 2 / input.height]);
          await page.locator('#wholeImage' + slot).click();
        }
      }
    }
    assert.equal(await page.locator('.photo-card.kept').count(), 0);
    await verifySession(run);
    report.usefulCropImages = report.rows.filter(row => row.usefulCrop).length;
    report.unwantedCandidateCount = report.rows.reduce((sum, row) => sum + row.unwantedCandidates, 0);
    report.externalRequests = 0; report.errors = [];
    report.status = report.usefulCropImages >= 11 ? 'frozen-frontal-criterion-passed' : 'frozen-frontal-criterion-failed';
    assert(report.usefulCropImages >= 11, `Browser canvas frozen frontal gate: ${report.usefulCropImages}/12 useful crops; requires 11, no retuning`);
    console.log(`PASS browser canvas frozen frontal gate: ${report.usefulCropImages}/12; ${report.unwantedCandidateCount} extra candidates`);
    return report;
  } catch (error) {
    report.status = 'failed'; report.error = error.message; throw error;
  } finally {
    // Numeric-only evidence is retained on failure too; never record this page.
    await fs.writeFile(path.join(root, 'test-results', 'face-canvas-parity.json'), JSON.stringify(report, null, 2) + '\n');
    await run.context.close();
  }
}

async function main() {
  assert(!(preview && londonParityRequested), 'London photographs are file:// only, never HTTPS previews');
  const portrait = preview || londonOnly ? null : await portraitFixture();
  const london = londonParityRequested ? await londonFixtures() : null;
  await fs.mkdir(path.join(root, 'test-results'), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const report = { synthetic: [], realModel: [], londonCanvas: { status: 'not-requested', instruction: 'Not run in routine validation. Use the photographic workflow profile for face-processing changes or an explicit evaluation milestone; prior results are not a current-run pass.' } };
  try {
    if (!londonOnly) {
      for (const variant of (preview ? ['https-preview'] : variants)) report.synthetic.push(await syntheticAcceptance(browser, variant));
      if (preview) report.realModel.push(await realSyntheticAcceptance(browser));
      else for (const variant of variants) report.realModel.push(await realModelAcceptance(browser, variant, portrait));
    }
    if (london) report.londonCanvas = await londonCanvasAcceptance(browser, london);
  } finally { await browser.close(); }
  await fs.writeFile(path.join(root, 'test-results', 'face-product.json'), JSON.stringify(report, null, 2) + '\n');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
