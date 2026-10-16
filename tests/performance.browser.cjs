/*
 * Development-only, observational browser benchmark. Run after the canonical build:
 *   node tests/performance.browser.cjs
 *   BSP_PERF_DIST_DIR=/path/to/baseline/dist BSP_PERF_LABEL=baseline node tests/performance.browser.cjs
 *   BSP_PERF_COUNTS=100,500,1000 node tests/performance.browser.cjs
 *   node tests/performance.browser.cjs --self-test  # No browser or build required.
 *
 * The same 32 x 24 synthetic PNG bytes exercise growing DOM/group/select/save work.
 * This is NOT a megapixel-photo, ML-inference, physical-phone, memory-ceiling, or
 * photographic-accuracy benchmark. The narrow viewport uses desktop Chromium CPU,
 * no throttling and DPR 1. Timing observations are not performance pass thresholds.
 * Product code, canonical artifacts, CSP, browser APIs and model clients are never
 * replaced. DOM observers add measurable overhead; compare only the same profile.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const os = require('node:os');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const PROFILE = 'tiny-flat-png-one-exact-pair-v1';
const CASE_TIMEOUT_MS = 180000;
const WIDTH = 32, HEIGHT = 24;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const round = value => value == null ? null : Math.round(value * 1000) / 1000;
const elapsed = start => Number(process.hrtime.bigint() - start) / 1e6;

function config(env) {
  const label = env.BSP_PERF_LABEL || 'current';
  assert.match(label, /^[a-z0-9][a-z0-9_-]{0,39}$/i, 'BSP_PERF_LABEL must be a safe 1–40 character filename label');
  const raw = env.BSP_PERF_COUNTS || '100,500';
  assert.match(raw, /^\d+(,\d+){0,2}$/, 'BSP_PERF_COUNTS must contain 1–3 comma-separated counts');
  const counts = raw.split(',').map(Number);
  assert(counts.every(n => Number.isSafeInteger(n) && n >= 4 && n <= 1000), 'Every photo count must be between 4 and 1000');
  assert.equal(new Set(counts).size, counts.length, 'Repeated photo counts are not allowed');
  return { label, counts, distDir: path.resolve(env.BSP_PERF_DIST_DIR || path.join(ROOT, 'dist')) };
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type, 'ascii'), size = Buffer.alloc(4), checksum = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, checksum]);
}

function flatPng(index) {
  // All pixels are identical within a photo: luma deviation is zero, so these
  // unique pictures cannot acquire a visual-similarity group. Index 1 is the one
  // intentional exact-byte copy of index 0. All other RGB values are distinct.
  const identity = index === 1 ? 0 : index;
  const rgb = [identity % 256, 64 + Math.floor(identity / 256), 96];
  const rows = Buffer.alloc((WIDTH * 3 + 1) * HEIGHT);
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    const offset = y * (WIDTH * 3 + 1) + 1 + x * 3;
    rgb.forEach((value, channel) => { rows[offset + channel] = value; });
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(WIDTH, 0); header.writeUInt32BE(HEIGHT, 4); header[8] = 8; header[9] = 2;
  // Stored DEFLATE keeps all fixture lengths equal and deterministic. This also
  // exercises the normal equal-size exact-duplicate hashing path for every file.
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(rows, { level: 0 })), pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function fixtures(count) {
  return Array.from({ length: count }, (_, index) => ({
    name: `synthetic-${String(index + 1).padStart(4, '0')}.png`, mimeType: 'image/png', buffer: flatPng(index)
  }));
}

function distribution(values) {
  if (!values.length) return { count: 0, min: null, median: null, p95: null, max: null, sum: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length, min: round(sorted[0]), median: round(sorted[Math.ceil(sorted.length / 2) - 1]),
    p95: round(sorted[Math.ceil(sorted.length * .95) - 1]), max: round(sorted.at(-1)),
    sum: round(sorted.reduce((total, value) => total + value, 0))
  };
}

function readStoredZip(bytes) {
  const entries = [];
  let offset = 0;
  while (offset + 4 <= bytes.length && bytes.readUInt32LE(offset) === 0x04034b50) {
    assert(offset + 30 <= bytes.length, 'Truncated ZIP local header');
    assert.equal(bytes.readUInt16LE(offset + 8), 0, 'Originals must use STORE');
    assert.equal(bytes.readUInt16LE(offset + 6) & 8, 0, 'Unexpected data descriptor');
    const size = bytes.readUInt32LE(offset + 18), nameSize = bytes.readUInt16LE(offset + 26);
    const start = offset + 30 + nameSize + bytes.readUInt16LE(offset + 28), end = start + size;
    assert(end <= bytes.length, 'Truncated ZIP original');
    const original = bytes.subarray(start, end);
    assert.equal(crc32(original), bytes.readUInt32LE(offset + 14), 'ZIP CRC must match its original');
    entries.push({ name: bytes.subarray(offset + 30, offset + 30 + nameSize).toString('utf8'), sha256: hash(original), bytes: size });
    offset = end;
  }
  assert(entries.length > 0, 'ZIP must contain original files');
  assert(offset + 4 <= bytes.length && bytes.readUInt32LE(offset) === 0x02014b50, 'ZIP central directory is missing');
  return entries;
}

// Runs in the page. Observe only stable roots and count mutation records/nodes;
// never rescan every card in an observer callback. Full DOM counts are snapshots.
function installProbe(expectedCount) {
  const $ = selector => document.querySelector(selector);
  const areaRoots = { cards: $('#photoGrid'), groups: $('#groupList'), groupOptions: $('#groupFilter'),
    compareOptionsA: $('#selectA'), compareOptionsB: $('#selectB'), saveRows: $('#selectedList') };
  const totals = Object.fromEntries(Object.keys(areaRoots).map(name => [name,
    { records: 0, childList: 0, attributes: 0, characterData: 0, addedNodes: 0, removedNodes: 0, peakDirectChildren: 0 }]));
  const marks = {}, snapshots = {}, tasks = [], heartbeats = [], frames = [];
  const observers = [];
  let cardCount = 0, peakCards = 0, observerMs = 0, action = null, lastFrame = performance.now(), lastHeartbeat = lastFrame;
  const clone = value => JSON.parse(JSON.stringify(value));
  const snapshot = () => ({ totals: clone(totals), observerMs, cardCount, peakCards });
  const mark = name => { if (marks[name] == null) { marks[name] = performance.now(); snapshots[name] = snapshot(); } };
  for (const [name, root] of Object.entries(areaRoots)) {
    const observer = new MutationObserver(records => {
      const started = performance.now(), bucket = totals[name];
      for (const record of records) {
        bucket.records++; bucket[record.type]++;
        if (record.type === 'childList') {
          bucket.addedNodes += record.addedNodes.length; bucket.removedNodes += record.removedNodes.length;
          if (name === 'cards' && record.target === root) {
            for (const node of record.addedNodes) if (node.nodeType === 1 && node.classList.contains('photo-card')) cardCount++;
            for (const node of record.removedNodes) if (node.nodeType === 1 && node.classList.contains('photo-card')) cardCount--;
          }
        }
      }
      bucket.peakDirectChildren = Math.max(bucket.peakDirectChildren, root.childElementCount);
      peakCards = Math.max(peakCards, cardCount);
      observerMs += performance.now() - started;
      if (cardCount > 0) mark('firstCard');
      if (cardCount === expectedCount) mark('lastCard');
    });
    observer.observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
    observers.push(observer);
  }
  const statusObserver = new MutationObserver(() => {
    if (marks.input == null) return;
    if (!$('#loadProgress').hidden) mark('loadVisible');
    if ($('#loadProgress').hidden && cardCount === expectedCount) mark('importComplete');
    if (!$('#analysisProgress').hidden) mark('analysisVisible');
    if (marks.importComplete != null && $('#analysisProgress').hidden && /finished/.test($('#analysisResult').textContent)) mark('analysisComplete');
  });
  statusObserver.observe($('#loadProgress'), { attributes: true, attributeFilter: ['hidden'] });
  statusObserver.observe($('#analysisProgress'), { attributes: true, attributeFilter: ['hidden'] });
  statusObserver.observe($('#analysisResult'), { childList: true, subtree: true, characterData: true });
  observers.push(statusObserver);
  $('#fileInput').addEventListener('change', () => mark('input'), { capture: true, once: true });
  const longTaskSupported = typeof PerformanceObserver === 'function' && PerformanceObserver.supportedEntryTypes.includes('longtask');
  let performanceObserver = null;
  if (longTaskSupported) {
    performanceObserver = new PerformanceObserver(list => {
      for (const item of list.getEntries()) tasks.push({ start: item.startTime, duration: item.duration });
    });
    performanceObserver.observe({ type: 'longtask', buffered: false });
  }
  const heartbeatTimer = setInterval(() => {
    const now = performance.now(); heartbeats.push({ start: lastHeartbeat, end: now, gap: now - lastHeartbeat, late: Math.max(0, now - lastHeartbeat - 50) }); lastHeartbeat = now;
  }, 50);
  let animationFrame;
  function frame(now) { frames.push({ start: lastFrame, end: now, gap: now - lastFrame }); lastFrame = now; animationFrame = requestAnimationFrame(frame); }
  animationFrame = requestAnimationFrame(frame);
  function eventObserved(event) {
    if (!action || action.eventAt != null || event.type !== action.eventType) return;
    if (action.selector && !event.target.closest?.(action.selector)) return;
    const pending = action;
    pending.eventAt = performance.now();
    requestAnimationFrame(() => requestAnimationFrame(() => { pending.secondFrameAt = performance.now(); }));
  }
  for (const type of ['click', 'change', 'wheel']) document.addEventListener(type, eventObserved, { capture: true, passive: true });
  window.__photoPerformance = {
    marks, longTaskSupported,
    arm(name, eventType, selector) { action = { name, eventType, selector, start: performance.now(), before: snapshot(), eventAt: null, secondFrameAt: null }; },
    finish() {
      const result = { ...action, end: performance.now(), after: snapshot() };
      action = null; return result;
    },
    dom() { return { cards: $('#photoGrid').querySelectorAll('.photo-card').length,
      visibleCards: $('#photoGrid').querySelectorAll('.photo-card:not([hidden])').length,
      keptCards: $('#photoGrid').querySelectorAll('.photo-card.kept').length,
      groups: $('#groupList').childElementCount, groupOptions: $('#groupFilter').options.length,
      compareOptionsA: $('#selectA').options.length, compareOptionsB: $('#selectB').options.length,
      saveRows: $('#selectedList').childElementCount, elements: document.querySelectorAll('*').length,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth }; },
    finishRun() {
      for (const entry of performanceObserver?.takeRecords() || []) tasks.push({ start: entry.startTime, duration: entry.duration });
      return { marks: clone(marks), snapshots: clone(snapshots), totals: snapshot(), longTaskSupported, tasks, heartbeats, frames,
        browser: { userAgent: navigator.userAgent, hardwareConcurrency: navigator.hardwareConcurrency,
          deviceMemoryGiB: navigator.deviceMemory ?? null, viewport: { width: innerWidth, height: innerHeight },
          devicePixelRatio, visibilityState: document.visibilityState } };
    },
    stop() { clearInterval(heartbeatTimer); cancelAnimationFrame(animationFrame); observers.forEach(observer => observer.disconnect()); performanceObserver?.disconnect(); }
  };
}

function mutationsBetween(before, after) {
  const areas = {};
  for (const [name, values] of Object.entries(after.totals)) {
    areas[name] = {};
    for (const [key, value] of Object.entries(values)) areas[name][key] = key === 'peakDirectChildren' ? value : value - before.totals[name][key];
  }
  return { areas, observerCallbackMs: round(after.observerMs - before.observerMs), cardsAtEnd: after.cardCount, peakCards: after.peakCards };
}

function telemetryWindow(probe, start, end) {
  const overlaps = item => item.start < end && (item.end ?? item.start + item.duration) > start;
  const heartbeats = probe.heartbeats.filter(overlaps), frames = probe.frames.filter(overlaps);
  return {
    elapsedMs: round(end - start),
    longTasks: probe.longTaskSupported ? { durationMs: distribution(probe.tasks.filter(overlaps).map(item => item.duration)),
      totalBlockingMs: round(probe.tasks.filter(overlaps).reduce((sum, item) => sum + Math.max(0, item.duration - 50), 0)) } : null,
    heartbeatGapMs: distribution(heartbeats.map(item => item.gap)), heartbeatLatenessMs: distribution(heartbeats.map(item => item.late)),
    frameGapMs: distribution(frames.map(item => item.gap))
  };
}

async function framesSettled(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function measuredAction(page, name, eventType, selector, operation, verify) {
  await page.evaluate(({ name, eventType, selector }) => window.__photoPerformance.arm(name, eventType, selector), { name, eventType, selector });
  const started = process.hrtime.bigint();
  await operation();
  if (verify) await verify();
  await framesSettled(page);
  const result = await page.evaluate(() => window.__photoPerformance.finish());
  assert.notEqual(result.eventAt, null, `${name}: expected ${eventType} event was not observed`);
  assert.notEqual(result.secondFrameAt, null, `${name}: second animation frame was not observed`);
  result.playwrightCommandAndVerificationMs = round(elapsed(started));
  return result;
}

async function benchmarkCase(browser, artifact, files, viewport) {
  const context = await browser.newContext({ viewport: viewport.size, locale: 'en-US', timezoneId: 'UTC', deviceScaleFactor: 1, acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const result = { count: files.length, viewport: viewport.name, status: 'running', errors: [], externalRequests: [], cspViolations: [], workersStarted: 0, actions: [] };
  let phase = 'startup', timedOut = false;
  const timer = setTimeout(() => { timedOut = true; void context.close().catch(() => {}); }, CASE_TIMEOUT_MS);
  page.on('pageerror', error => result.errors.push(error.message));
  page.on('worker', () => { result.workersStarted++; });
  page.on('request', request => { if (/^https?:/.test(request.url())) result.externalRequests.push(`${request.method()} ${request.url()}`); });
  let probe;
  try {
    await page.addInitScript(() => { window.__performanceCspViolations = []; document.addEventListener('securitypolicyviolation', event => {
      window.__performanceCspViolations.push({ directive: event.violatedDirective, blockedURI: event.blockedURI });
    }); });
    const startup = process.hrtime.bigint();
    await page.goto(pathToFileURL(artifact).href);
    await page.locator('#addButton').waitFor();
    await framesSettled(page);
    result.startupNavigationToReadyMs = round(elapsed(startup));
    result.initialDom = await page.locator('.photo-card').count();
    assert.equal(result.initialDom, 0);
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    result.csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    assert.match(result.csp, /connect-src\s+'none'/);
    await page.evaluate(installProbe, files.length);
    phase = 'import and automatic analysis';
    const intakeStarted = process.hrtime.bigint();
    await page.locator('#fileInput').setInputFiles(files);
    // The observer marks import and analysis independently. Do not accidentally
    // call a hidden progress bar "finished" before its input event starts work.
    await page.waitForFunction(() => window.__photoPerformance.marks.analysisComplete != null, null, { timeout: CASE_TIMEOUT_MS });
    result.setInputFilesThroughAnalysisCommandMs = round(elapsed(intakeStarted));
    await framesSettled(page);
    result.readyDom = await page.evaluate(() => window.__photoPerformance.dom());
    assert.equal(result.readyDom.cards, files.length);
    assert.equal(result.readyDom.keptCards, 0, 'Import and automatic analysis must never choose Keep');
    assert.equal(result.readyDom.groups, files.length - 1, 'Only the intentional exact-byte pair may group');
    assert.equal(result.readyDom.groupOptions, files.length, 'All groups must remain available');
    assert.equal(result.readyDom.compareOptionsA, files.length);
    assert.equal(result.readyDom.compareOptionsB, files.length);
    assert.equal(result.readyDom.horizontalOverflow, false);
    assert.equal(await page.locator('#errorList li').count(), 0);
    assert.equal(await page.locator('.photo-analysis').filter({ hasText: 'Identical files' }).count(), 2);
    const groupsBefore = await page.locator('.group-chip').evaluateAll(nodes => nodes.map(node => node.dataset.groupId));
    assert.deepEqual(groupsBefore, ['g-p1', ...Array.from({ length: files.length - 2 }, (_, index) => `g-p${index + 3}`)], 'Every input must retain its expected exact-pair or singleton group');
    const groupSizes = await page.locator('.group-chip').evaluateAll(nodes => nodes.map(node => Number(node.textContent.match(/ · (\d+) photos · /)?.[1])));
    assert.deepEqual(groupSizes, [2, ...Array(files.length - 2).fill(1)]);
    assert.equal(groupSizes.reduce((sum, size) => sum + size, 0), files.length);

    phase = 'scroll';
    // Position once outside the measurement, then issue real Chromium wheel input.
    await page.locator('#photo-p1').scrollIntoViewIfNeeded();
    const point = await page.locator('#photo-p1 .photo-open').boundingBox();
    assert(point, 'First photo must be rendered');
    await page.mouse.move(point.x + point.width / 2, point.y + point.height / 2);
    for (let index = 0; index < 6; index++) {
      const before = await page.evaluate(() => scrollY);
      result.actions.push(await measuredAction(page, `scroll-${index + 1}`, 'wheel', null,
        () => page.mouse.wheel(0, index < 4 ? 420 : -420),
        () => page.waitForFunction(previous => scrollY !== previous, before)));
    }

    phase = 'group filtering';
    await page.locator('#groupFilter').scrollIntoViewIfNeeded();
    result.actions.push(await measuredAction(page, 'filter-exact-pair', 'change', '#groupFilter',
      () => page.locator('#groupFilter').selectOption('g-p1')));
    assert.equal(await page.locator('.photo-card:not([hidden])').count(), 2);
    assert.deepEqual(await page.locator('#selectA option').evaluateAll(nodes => nodes.map(node => node.value)), ['p1', 'p2']);
    result.actions.push(await measuredAction(page, 'show-all-groups', 'change', '#groupFilter',
      () => page.locator('#groupFilter').selectOption('')));
    assert.equal(await page.locator('.photo-card:not([hidden])').count(), files.length);

    phase = 'comparison';
    if (viewport.name === 'narrow') await page.locator('[data-mobile-key="compare"]').click();
    await page.locator('#selectA').scrollIntoViewIfNeeded();
    for (const index of [Math.floor(files.length / 2), files.length - 1, 0]) {
      const id = `p${index + 1}`;
      result.actions.push(await measuredAction(page, `compare-${id}`, 'change', '#selectA',
        () => page.locator('#selectA').selectOption(id),
        () => page.waitForFunction(name => { const image = document.querySelector('#imageA'); return image.alt === name && image.complete && image.naturalWidth === 32; }, files[index].name)));
      assert.equal(await page.locator('#selectA').inputValue(), id);
    }
    assert.equal(await page.locator('.photo-card.kept').count(), 0);

    phase = 'Keep and Undo';
    if (viewport.name === 'narrow') await page.locator('[data-mobile-key="photos"]').click();
    const selectedIndices = [0, Math.floor(files.length / 2), files.length - 1];
    for (const index of selectedIndices) {
      const selector = `#photo-p${index + 1} .keep-button`;
      await page.locator(selector).scrollIntoViewIfNeeded();
      result.actions.push(await measuredAction(page, `keep-p${index + 1}`, 'click', selector, () => page.locator(selector).click()));
    }
    assert.equal(await page.locator('.photo-card.kept').count(), 3);
    result.actions.push(await measuredAction(page, 'undo-last-keep', 'click', '#appToastAction', () => page.locator('#appToastAction').click()));
    assert.equal(await page.locator('.photo-card.kept').count(), 2);
    const lastKeep = `#photo-p${files.length} .keep-button`;
    await page.locator(lastKeep).scrollIntoViewIfNeeded();
    result.actions.push(await measuredAction(page, 'restore-last-keep', 'click', lastKeep, () => page.locator(lastKeep).click()));
    assert.equal(await page.locator('.photo-card.kept').count(), 3);
    assert.deepEqual(await page.locator('.group-chip').evaluateAll(nodes => nodes.map(node => node.dataset.groupId)), groupsBefore);
    assert.equal(await page.locator('#selectedList li').count(), 3);

    phase = 'original ZIP';
    if (viewport.name === 'narrow') await page.locator('[data-mobile-key="save"]').click();
    await page.locator('#outputFilename').fill(`synthetic-${files.length}-${viewport.name}`);
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#downloadButton').click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), `synthetic-${files.length}-${viewport.name}.zip`);
    const downloadPath = await download.path();
    assert(downloadPath, 'Chromium must produce a local synthetic ZIP');
    const entries = readStoredZip(await fs.readFile(downloadPath));
    result.originals = { entries, exactByteMatch: true };
    assert.deepEqual(entries, selectedIndices.map(index => ({ name: files[index].name, sha256: hash(files[index].buffer), bytes: files[index].buffer.length })));
    result.finalDom = await page.evaluate(() => window.__photoPerformance.dom());
    assert.equal(result.finalDom.horizontalOverflow, false);
    assert.equal(result.finalDom.keptCards, 3);
    result.cspViolations = await page.evaluate(() => window.__performanceCspViolations);
    assert.deepEqual(result.errors, []); assert.deepEqual(result.externalRequests, []); assert.deepEqual(result.cspViolations, []);
    assert.equal(await page.evaluate(() => typeof window.tf), 'undefined', 'TensorFlow.js must remain unevaluated on the main page');
    // Allow pending Long Task entries and one heartbeat interval to be delivered.
    await page.waitForTimeout(60);
    probe = await page.evaluate(() => window.__photoPerformance.finishRun());
    result.browser = probe.browser;
    const { input, firstCard, lastCard, importComplete, analysisVisible, analysisComplete } = probe.marks;
    for (const [name, value] of Object.entries({ input, firstCard, lastCard, importComplete, analysisComplete })) assert(Number.isFinite(value), `Missing observed ${name} boundary`);
    assert(importComplete > input && analysisComplete >= importComplete);
    const importMs = importComplete - input;
    result.observedMilestonesMsFromInput = Object.fromEntries(Object.entries({ firstCard, lastCard, importComplete, analysisVisible, analysisComplete }).map(([name, value]) => [name, value == null ? null : round(value - input)]));
    result.import = { ...telemetryWindow(probe, input, importComplete), photosPerSecond: round(files.length * 1000 / importMs),
      mutations: mutationsBetween(probe.snapshots.input, probe.snapshots.importComplete) };
    result.automaticAnalysis = { ...telemetryWindow(probe, importComplete, analysisComplete),
      mutations: mutationsBetween(probe.snapshots.importComplete, probe.snapshots.analysisComplete) };
    result.actions = result.actions.map(action => ({ name: action.name,
      playwrightCommandAndVerificationMs: action.playwrightCommandAndVerificationMs,
      observedEventToSecondFrameMs: round(action.secondFrameAt - action.eventAt),
      ...telemetryWindow(probe, action.eventAt, action.secondFrameAt),
      mutations: mutationsBetween(action.before, action.after) }));
    result.actionSummary = Object.fromEntries(['scroll', 'compare', 'keep'].map(prefix => [prefix,
      distribution(result.actions.filter(action => action.name.startsWith(prefix + '-')).map(action => action.observedEventToSecondFrameMs))]));
    result.allObservedMutations = probe.totals;
    result.longTaskApiSupported = probe.longTaskSupported;
    result.status = 'passed';
  } catch (error) {
    result.status = timedOut ? 'timed-out' : 'failed';
    result.failure = { phase, message: timedOut ? `Case exceeded ${CASE_TIMEOUT_MS} ms during ${phase}; measurement is incomplete, not a pass.` : error.message };
    if (!page.isClosed()) {
      try { result.partialObservations = await page.evaluate(() => window.__photoPerformance?.finishRun()); } catch { /* Preserve the original failure. */ }
    }
  } finally {
    clearTimeout(timer);
    if (!page.isClosed()) await page.evaluate(() => window.__photoPerformance?.stop()).catch(() => {});
    await context.close().catch(error => { result.status = 'failed'; result.teardownError = error.message; });
  }
  return result;
}

async function main() {
  const options = config(process.env), artifact = path.join(options.distDir, 'index.html');
  const output = path.join(ROOT, 'test-results', `photo-performance-${options.label}.json`);
  const bytes = await fs.readFile(artifact); // Missing canonical build is a failure, never an implicit rebuild.
  const { chromium } = require('playwright');
  const report = {
    schemaVersion: 1, profile: PROFILE, label: options.label, generatedAt: new Date().toISOString(),
    artifact: { filename: 'index.html', bytes: bytes.length, sha256: hash(bytes) },
    harnessSha256: hash(await fs.readFile(__filename)),
    ci: { sha: process.env.GITHUB_SHA || null, runId: process.env.GITHUB_RUN_ID || null },
    environment: { platform: process.platform, architecture: process.arch, node: process.version, cpus: os.cpus().length,
      cpuModel: os.cpus()[0]?.model || null, runnerTotalMemoryBytes: os.totalmem(), chromium: null, cpuThrottleRate: 1 },
    fixture: { width: WIDTH, height: HEIGHT, format: 'PNG RGB8, stored DEFLATE', metadata: 'No EXIF, people, real photos, or personal data',
      duplicatePairs: [[1, 2]], allOtherPhotos: 'Unique solid RGB; zero luma deviation; expected singleton groups',
      fileLastModified: 'Assigned by Playwright; not controlled and never treated as capture time by the product' },
    limits: {
      physicalPhoneMeasured: false, megapixelDecodeMeasured: false, optionalMlMeasured: false, peakProcessMemoryMeasured: false,
      narrowViewportIsPhysicalDevice: false, caseTimeoutMs: CASE_TIMEOUT_MS, maxCount: 1000,
      timingThresholdGate: false, repeatsPerCase: 1, readableVariantOnly: true,
      notes: [
        'This profile isolates growing CPU/DOM work using tiny images; it cannot establish real-photo throughput or phone memory limits.',
        'Both layouts use desktop Chromium CPU, DPR 1 and no CPU throttling. Narrow viewport is layout coverage only.',
        'Import starts at the real file-input change event, excluding Playwright transfer and fixture generation.',
        'Import/analysis boundaries are DOM-observed after task completion; they include final import rendering and may include initial analysis setup in the same task.',
        'Event-to-second-rAF is a rendering opportunity proxy, not measured display presentation or physical input latency. Driver timings also include verification overhead.',
        'Long Task, heartbeat and rAF observations are incomplete, not upper bounds. Intervals crossing phase boundaries may appear in both phases.',
        'Observer callbacks count direct added/removed nodes and mutation records, not every descendant allocation or JS function call. Peak child counts are lifetime peaks.',
        'Observers perturb the workload; compare only identical harness hashes/profiles, fixtures and runner configuration. One sample is not a statistically robust benchmark.',
        'Cancellation/retry/reset correctness remains covered by the separate existing browser suites; this harness does not pause or replace native work.'
      ]
    },
    cases: [], status: 'running'
  };
  await fs.mkdir(path.dirname(output), { recursive: true });
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    report.environment.chromium = browser.version();
    for (const count of options.counts) {
      const files = fixtures(count);
      const fixtureSha256 = hash(Buffer.concat(files.map(file => file.buffer)));
      const views = [{ name: 'desktop', size: { width: 1360, height: 900 } }, ...(count > 500 ? [] : [{ name: 'narrow', size: { width: 390, height: 844 } }])];
      for (const viewport of views) {
        const result = await benchmarkCase(browser, artifact, files, viewport);
        result.fixtureSha256 = fixtureSha256;
        result.inputBytes = files.reduce((sum, file) => sum + file.buffer.length, 0);
        report.cases.push(result);
        await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
        console.log(`${result.status.toUpperCase()} ${options.label} ${count} ${viewport.name}: ${result.import ? `${result.import.elapsedMs} ms import, ${result.automaticAnalysis.elapsedMs} ms analysis` : result.failure?.message}`);
        assert.equal(result.status, 'passed', `${count}/${viewport.name}: ${result.failure?.phase}: ${result.failure?.message}`);
      }
    }
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed'; report.failure = error.message; throw error;
  } finally {
    if (browser) await browser.close().catch(error => { report.status = 'failed'; report.teardownError = error.message; process.exitCode = 1; });
    await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
    console.log(`Performance report: ${path.relative(ROOT, output)}`);
  }
}

function selfTest() {
  assert.deepEqual(config({}).counts, [100, 500]);
  for (const raw of ['0', '3', '1001', '100,100', '100,500,1000,1000', 'NaN', '100, 500']) assert.throws(() => config({ BSP_PERF_COUNTS: raw }));
  assert.throws(() => config({ BSP_PERF_LABEL: '../outside' }));
  assert.deepEqual(config({ BSP_PERF_COUNTS: '100,500,1000' }).counts, [100, 500, 1000]);
  const files = fixtures(1000), hashes = files.map(file => hash(file.buffer));
  assert.equal(new Set(hashes).size, 999); assert.equal(hashes[0], hashes[1]);
  assert.equal(hash(flatPng(999)), hashes[999]);
  assert.equal(new Set(files.map(file => file.buffer.length)).size, 1);
  for (const index of [0, 255, 256, 999]) {
    const png = files[index].buffer;
    assert.equal(png.readUInt32BE(16), WIDTH); assert.equal(png.readUInt32BE(20), HEIGHT);
    let offset = 8, pixels;
    while (offset < png.length) {
      const length = png.readUInt32BE(offset), type = png.subarray(offset + 4, offset + 8).toString('ascii');
      const data = png.subarray(offset + 8, offset + 8 + length);
      assert.equal(crc32(png.subarray(offset + 4, offset + 8 + length)), png.readUInt32BE(offset + 8 + length));
      if (type === 'IDAT') pixels = zlib.inflateSync(data);
      offset += length + 12;
    }
    assert.equal(pixels.length, (WIDTH * 3 + 1) * HEIGHT);
    const first = pixels.subarray(1, 4);
    for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) assert.deepEqual(pixels.subarray(y * (WIDTH * 3 + 1) + 1 + x * 3, y * (WIDTH * 3 + 1) + 4 + x * 3), first);
  }
  assert.equal(distribution([]).max, null); assert.equal(distribution([8, 2, 4]).median, 4);
  assert.equal(telemetryWindow({ tasks: [], heartbeats: [], frames: [], longTaskSupported: false }, 0, 100).longTasks, null);
  const original = files[0].buffer, name = Buffer.from(files[0].name), local = Buffer.alloc(30), central = Buffer.alloc(4);
  local.writeUInt32LE(0x04034b50); local.writeUInt32LE(crc32(original), 14); local.writeUInt32LE(original.length, 18); local.writeUInt16LE(name.length, 26); central.writeUInt32LE(0x02014b50);
  const zip = Buffer.concat([local, name, original, central]);
  assert.deepEqual(readStoredZip(zip), [{ name: files[0].name, sha256: hash(original), bytes: original.length }]);
  const broken = Buffer.from(zip); broken[30 + name.length] ^= 1; assert.throws(() => readStoredZip(broken), /CRC/);
  assert.throws(() => readStoredZip(zip.subarray(0, zip.length - 4)), /central directory/);
  console.log(`PASS benchmark self-test: deterministic ${WIDTH}x${HEIGHT} PNGs, 1000 bounded inputs, exact-pair uniqueness, PNG/ZIP CRC, config guards, summaries. No browser launched.`);
}

if (require.main === module) {
  if (process.argv.includes('--self-test')) selfTest();
  else main().catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { config, flatPng, fixtures, distribution, crc32, readStoredZip, mutationsBetween, telemetryWindow };
