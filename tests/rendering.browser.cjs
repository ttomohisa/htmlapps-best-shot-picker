/*
 * Incremental-rendering regression, using project-owned synthetic pixels only.
 * Run after the canonical build: node tests/rendering.browser.cjs
 * Optional additional owned HTTPS case: BSP_RENDERING_PREVIEW_URL=https://r123-pr-10-bk-previews.ttomohisa.workers.dev/
 *
 * Real app events and DOM references are the oracle; no app state is exposed or
 * replaced. Native digest/toBlob results can be delayed to exercise stale work.
 * Pre-optimization renderGroups/renderSave replace chips, options and rows, and
 * renderPhotoQuality rewrites unchanged children. Those are intended failures,
 * not timing thresholds. Browser execution belongs to CI, not the self-test.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { flatPng, fixtures } = require('./performance.browser.cjs');

const ROOT = path.resolve(__dirname, '..');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const chip = id => `.group-chip[data-group-id="${id}"]`;
const option = (select, value) => `${select} option[value="${value}"]`;
const file = (name, buffer) => ({ name, mimeType: 'image/png', buffer });

function targets(env) {
  const cases = ['index.html', 'index.self-extract.html'].map(variant => ({
    label: variant, url: pathToFileURL(path.join(ROOT, 'dist', variant)).href
  }));
  if (env.BSP_RENDERING_PREVIEW_URL) {
    const url = new URL(env.BSP_RENDERING_PREVIEW_URL);
    assert.equal(url.protocol, 'https:', 'Preview must use HTTPS');
    assert.match(url.hostname, /^r\d+-pr-\d+-bk-previews\.ttomohisa\.workers\.dev$/, 'Preview must be an owned PR preview');
    assert.equal(url.username + url.password, '', 'Preview must not contain credentials');
    assert.equal(url.port, '', 'Preview must use the default HTTPS port');
    assert.equal(url.pathname, '/', 'Preview must serve the readable artifact at its root');
    assert.equal(url.hash, '', 'Preview must not contain a fragment');
    cases.push({ label: 'owned HTTPS preview', url: url.href, preview: true });
  }
  return cases;
}

function installProbe() {
  window.__renderProbe = { snapshots: {}, pendingHashes: [], pendingThumbnails: [], urls: [], holdHashes: false, holdThumbnails: false };
  const probe = window.__renderProbe;
  const digest = crypto.subtle.digest.bind(crypto.subtle);
  crypto.subtle.digest = (...args) => digest(...args).then(value => probe.holdHashes
    ? new Promise(resolve => probe.pendingHashes.push(() => resolve(value))) : value);
  const toBlob = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = function(callback, ...args) {
    toBlob.call(this, blob => probe.holdThumbnails
      ? probe.pendingThumbnails.push(() => callback(blob)) : callback(blob), ...args);
  };
  const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = blob => {
    const url = create(blob);
    probe.urls.push({ url, name: blob instanceof File ? blob.name : null, original: blob instanceof File, revoked: false });
    return url;
  };
  URL.revokeObjectURL = url => {
    const record = probe.urls.find(record => record.url === url);
    if (record) record.revoked = true;
    return revoke(url);
  };
}

async function idle(page, count) {
  await page.locator('#loadProgress').waitFor({ state: 'hidden' });
  await page.locator('#analysisProgress').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => /finished|完了/.test(document.querySelector('#analysisResult').textContent));
  assert.equal(await page.locator('.photo-card').count(), count);
}

async function remember(page, name, selectors, descendants = []) {
  await page.evaluate(({ name, selectors, descendants }) => {
    window.__renderProbe.snapshots[name] = selectors.map(selector => {
      const node = document.querySelector(selector);
      if (!node) throw new Error(`Cannot snapshot missing node: ${selector}`);
      return { selector, node, descendants: descendants.includes(selector) ? [...node.querySelectorAll('*')] : [] };
    });
  }, { name, selectors, descendants });
}

async function retained(page, name, phase) {
  const changed = await page.evaluate(name => window.__renderProbe.snapshots[name].flatMap(({ selector, node, descendants }) => {
    if (!node.isConnected || document.querySelector(selector) !== node) return [`${selector}: replaced or detached`];
    const current = [...node.querySelectorAll('*')];
    return descendants.length && (current.length !== descendants.length || descendants.some((child, index) => current[index] !== child))
      ? [`${selector}: descendants replaced`] : [];
  }), name);
  assert.deepEqual(changed, [], `${phase}: retained DOM identities`);
}

async function detached(page, name) {
  const connected = await page.evaluate(name => window.__renderProbe.snapshots[name]
    .filter(({ node }) => node.isConnected).map(({ selector }) => selector), name);
  assert.deepEqual(connected, [], 'Reset must discard all old keyed nodes');
}

async function observeCard(page, selector) {
  await page.evaluate(selector => {
    const probe = window.__renderProbe;
    probe.mutations = [];
    probe.observer = new MutationObserver(records => probe.mutations.push(...records.map(record => `${record.type}:${record.attributeName || record.target.nodeName}`)));
    probe.observer.observe(document.querySelector(selector), { subtree: true, attributes: true, childList: true, characterData: true });
  }, selector);
}

async function unchangedCard(page, phase) {
  const mutations = await page.evaluate(() => {
    const probe = window.__renderProbe;
    probe.mutations.push(...probe.observer.takeRecords().map(record => `${record.type}:${record.attributeName || record.target.nodeName}`));
    probe.observer.disconnect();
    return probe.mutations;
  });
  assert.deepEqual(mutations, [], `${phase}: an unaffected card must not receive redundant DOM writes`);
}

async function assertFocus(page, selector, phase) {
  assert(await page.locator(selector).evaluate(node => document.activeElement === node), `${phase}: preserve focus on ${selector}`);
}

async function visibleCards(page, ids) {
  assert.deepEqual(await page.locator('.photo-card').evaluateAll(cards => cards.filter(card => !card.hidden).map(card => card.id)), ids.map(id => `photo-${id}`));
}

async function groupIds(page, ids) {
  assert.deepEqual(await page.locator('.group-chip').evaluateAll(nodes => nodes.map(node => node.dataset.groupId)), ids);
  assert.deepEqual(await page.locator('#groupFilter option').evaluateAll(nodes => nodes.map(node => node.value)), ['', ...ids]);
}

async function organize(page, source, photo, target, action) {
  await page.locator('#organizeButton').click();
  await page.locator('#sourceGroup').selectOption(source);
  if (photo) await page.locator('#groupPhoto').selectOption(photo);
  if (target) await page.locator('#targetGroup').selectOption(target);
  await page.locator(`#${action}GroupButton`).click();
}

async function release(page, kind) {
  await page.evaluate(kind => {
    const probe = window.__renderProbe;
    probe[`hold${kind}`] = false;
    probe[`pending${kind}`].splice(0).forEach(release => release());
  }, kind);
}

async function holdAnalysis(page) {
  await page.evaluate(() => { window.__renderProbe.holdHashes = true; document.querySelector('#analyzeButton').click(); });
  await page.waitForFunction(() => window.__renderProbe.pendingHashes.length === 1);
}

async function originalUrls(page, names) {
  const active = await page.evaluate(() => window.__renderProbe.urls.filter(record => record.original && !record.revoked).map(record => record.name).sort());
  assert.deepEqual(active, [...names].sort(), 'Only active comparison/preview original URLs should remain');
}

async function labels(page, language, firstName, thirdName) {
  const ja = language === 'ja';
  assert.equal(await page.locator('html').getAttribute('lang'), language);
  assert.equal(await page.locator('#photo-p1 .keep-button').textContent(), ja ? '選択済み' : 'Kept');
  assert.equal(await page.locator('#photo-p1 .keep-button').getAttribute('aria-label'), `${ja ? '解除' : 'Unkeep'}: ${firstName}`);
  assert.equal(await page.locator('#photo-p1 .keep-button').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#photo-p3 .keep-button').textContent(), ja ? '残す' : 'Keep');
  assert.equal(await page.locator('#photo-p3 .keep-button').getAttribute('aria-label'), `${ja ? '残す' : 'Keep'}: ${thirdName}`);
  assert.equal(await page.locator('#photo-p3 .keep-button').getAttribute('aria-pressed'), 'false');
  assert.equal(await page.locator('#photo-p3 .photo-open').getAttribute('aria-label'), `${ja ? '写真を見る' : 'View photo'}: ${thirdName}`);
  assert.equal(await page.locator('#selectedList .remove-selection').textContent(), ja ? '解除' : 'Unkeep');
  assert.equal(await page.locator('#selectedList .remove-selection').getAttribute('aria-label'), `${ja ? '解除' : 'Unkeep'}: ${firstName}`);
  assert.match(await page.locator(chip('g-p1')).textContent(), ja ? /1 枚選択/ : /1 kept/);
  assert.equal(await page.locator(option('#groupFilter', 'g-p1')).textContent(), await page.locator(chip('g-p1')).textContent());
  assert.equal(await page.locator(option('#groupFilter', '')).textContent(), ja ? 'すべての写真' : 'All photos');
}

async function runCase(browser, target) {
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: 'en-US' });
  const page = await context.newPage(), errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  page.on('dialog', dialog => dialog.accept());
  await page.addInitScript(installProbe);
  let phase = 'load';
  try {
    const response = await page.goto(target.url);
    if (target.preview) {
      assert(response, 'Preview must return a response');
      assert.equal(response.status(), 200);
      assert.equal(response.url(), target.url, 'Preview must not redirect');
      assert.equal(sha(await response.body()), sha(await fs.readFile(path.join(ROOT, 'dist/index.html'))), 'Preview must serve the exact canonical readable build before synthetic files are selected');
    }
    await page.locator('#addButton').waitFor();
    const inputs = fixtures(4), names = inputs.map(input => input.name);
    await page.locator('#fileInput').setInputFiles(inputs);
    await idle(page, 4);
    await groupIds(page, ['g-p1', 'g-p3', 'g-p4']);
    await page.locator('#photo-p1 .keep-button').click();
    const stable = ['#photo-p1', '#photo-p3', chip('g-p1'), chip('g-p3'), chip('g-p4'),
      option('#groupFilter', ''), option('#groupFilter', 'g-p1'), option('#groupFilter', 'g-p3'),
      option('#selectA', 'p1'), option('#selectA', 'p3'), option('#selectB', 'p2'),
      '#selectedList li:first-child', '#selectedList li:first-child button:not(.remove-selection)', '#selectedList li:first-child .remove-selection'];
    await remember(page, 'stable', stable, ['#photo-p3', '#selectedList li:first-child']);

    phase = 'Keep preserves unaffected identity, focus and writes';
    // A pointer click legitimately changes focus. Dispatch the real Keep handler
    // without moving focus, so this isolates focus loss caused by rerendering.
    const focusTargets = ['#photo-p3 .keep-button', chip('g-p3'), '#selectA', '#selectedList li:first-child button:not(.remove-selection)'];
    for (const [index, selector] of focusTargets.entries()) {
      await page.locator(selector).focus();
      await observeCard(page, '#photo-p3');
      await page.locator('#photo-p2 .keep-button').evaluate(button => button.click());
      await unchangedCard(page, `Keep ${index + 1}`);
      await retained(page, 'stable', phase);
      await assertFocus(page, selector, phase);
      const kept = index % 2 === 0;
      assert.equal(await page.locator('#photo-p2 .keep-button').getAttribute('aria-pressed'), String(kept));
      assert.equal(await page.locator('#photo-p2 .keep-button').textContent(), kept ? 'Kept' : 'Keep');
      assert.match(await page.locator(chip('g-p1')).textContent(), new RegExp(`${kept ? 2 : 1} kept`));
      assert.equal(await page.locator('#selectedList li').count(), kept ? 2 : 1);
    }
    await page.locator('#photo-p2 .keep-button').click();
    await page.locator('#appToastAction').click();
    assert.equal(await page.locator('#photo-p2 .keep-button').getAttribute('aria-pressed'), 'false');
    await retained(page, 'stable', 'Keep Undo');

    phase = 'group-filter membership and shared option identity';
    await remember(page, 'shared-options', [option('#selectA', 'p1'), option('#selectB', 'p2')]);
    await page.locator('#groupFilter').selectOption('g-p1');
    await visibleCards(page, ['p1', 'p2']);
    await retained(page, 'shared-options', phase);
    assert.equal(await page.locator(chip('g-p1')).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator(chip('g-p3')).getAttribute('aria-pressed'), 'false');
    await page.locator('#groupFilter').selectOption('g-p3');
    await visibleCards(page, ['p3']);
    assert.equal(await page.locator('#selectA').inputValue(), 'p3');
    assert.deepEqual(await page.locator('#selectA option').evaluateAll(nodes => nodes.map(node => node.value)), ['p3']);
    await page.locator(chip('g-p3')).click();
    await assertFocus(page, '#groupFilter', 'Deliberate chip activation');
    await visibleCards(page, ['p1', 'p2', 'p3', 'p4']);

    phase = 'new input discards late analysis without replacing unaffected nodes';
    await remember(page, 'import', stable, ['#photo-p3', '#selectedList li:first-child']);
    await page.locator(chip('g-p3')).focus();
    await holdAnalysis(page);
    const fifth = file('synthetic-added.png', flatPng(4));
    await page.locator('#fileInput').setInputFiles([fifth]);
    await release(page, 'Hashes');
    await idle(page, 5);
    // Analysis may legitimately change labels. Identity/focus remain required;
    // the zero-write oracle is deliberately limited to unrelated Keep changes.
    await retained(page, 'import', phase);
    await assertFocus(page, chip('g-p3'), phase);
    await groupIds(page, ['g-p1', 'g-p3', 'g-p4', 'g-p5']);
    assert.equal(await page.locator('#selectedList li').count(), 1);
    assert.equal(await page.locator(option('#selectA', 'p5')).textContent(), fifth.name);

    phase = 'cancelled analysis keeps current keyed state';
    await holdAnalysis(page);
    await page.locator('#cancelAnalysisButton').click();
    await release(page, 'Hashes');
    await page.locator('#analysisProgress').waitFor({ state: 'hidden' });
    assert.match(await page.locator('#analysisResult').textContent(), /cancelled/);
    await retained(page, 'import', phase);
    await groupIds(page, ['g-p1', 'g-p3', 'g-p4', 'g-p5']);

    phase = 'split, merge and Undo refresh group indexes';
    const groupStable = ['#photo-p1', '#photo-p3', chip('g-p3'), option('#groupFilter', 'g-p3'), '#selectedList li:first-child'];
    await remember(page, 'group-edit', groupStable);
    await remember(page, 'split-options', [option('#selectA', 'p1'), option('#selectB', 'p2')]);
    await organize(page, 'g-p1', 'p2', null, 'split');
    await groupIds(page, ['g-p1', 'g-p3', 'g-p4', 'g-p5', 'manual-p2']);
    await retained(page, 'group-edit', 'Split');
    await retained(page, 'split-options', 'Split without changing the comparison pool');
    await page.locator('#groupFilter').selectOption('g-p1');
    await visibleCards(page, ['p1']);
    await page.locator('#appToastAction').click();
    await groupIds(page, ['g-p1', 'g-p3', 'g-p4', 'g-p5']);
    await visibleCards(page, ['p1', 'p2']);
    assert.deepEqual(await page.locator('#selectA option').evaluateAll(nodes => nodes.map(node => node.value)), ['p1', 'p2']);
    await retained(page, 'group-edit', 'Split Undo');
    await page.locator('#groupFilter').selectOption('g-p4');
    await organize(page, 'g-p4', null, 'g-p3', 'merge');
    await groupIds(page, ['g-p1', 'g-p3', 'g-p5']);
    assert.equal(await page.locator('#groupFilter').inputValue(), '', 'Removing the filtered source group resets the filter');
    await visibleCards(page, ['p1', 'p2', 'p3', 'p4', 'p5']);
    await retained(page, 'group-edit', 'Merge');
    await page.locator('#groupFilter').selectOption('g-p3');
    await visibleCards(page, ['p3', 'p4']);
    await page.locator('#appToastAction').click();
    await groupIds(page, ['g-p1', 'g-p3', 'g-p4', 'g-p5']);
    await visibleCards(page, ['p3']);
    await retained(page, 'group-edit', 'Merge Undo');
    await page.locator('#groupFilter').selectOption('');

    phase = 'EN/JA updates current labels without replacing controls';
    await remember(page, 'language', [...groupStable, '#photo-p1 .keep-button', '#photo-p3 .keep-button', '#selectedList .remove-selection', option('#selectA', 'p1')]);
    await labels(page, 'en', names[0], names[2]);
    await page.locator('#languageButton').click();
    await labels(page, 'ja', names[0], names[2]);
    await retained(page, 'language', phase);
    await page.locator('#photo-p2 .keep-button').click();
    assert.equal(await page.locator('#photo-p2 .keep-button').textContent(), '選択済み');
    assert.equal(await page.locator('#photo-p2 .keep-button').getAttribute('aria-label'), `解除: ${names[1]}`);
    await page.locator('#appToastAction').click();
    assert.equal(await page.locator('#photo-p2 .keep-button').getAttribute('aria-label'), `残す: ${names[1]}`);
    await page.locator('#languageButton').click();
    await labels(page, 'en', names[0], names[2]);

    phase = 'active full-image URL lifetime';
    await page.locator('#selectA').selectOption('p1');
    await page.locator('#selectB').selectOption('p2');
    await originalUrls(page, [names[0], names[1]]);
    const previousA = await page.locator('#imageA').getAttribute('src');
    await page.locator('#photo-p4 .photo-open').click();
    const previewUrl = await page.locator('#previewImage').getAttribute('src');
    await originalUrls(page, [names[0], names[1], names[3]]);
    await page.locator('#previewDialog').press('Escape');
    await page.waitForFunction(url => window.__renderProbe.urls.find(record => record.url === url)?.revoked, previewUrl);
    await originalUrls(page, [names[0], names[1]]);
    await page.locator('#selectA').selectOption('p3');
    await originalUrls(page, [names[1], names[2]]);
    assert(await page.evaluate(url => window.__renderProbe.urls.find(record => record.url === url)?.revoked, previousA));

    phase = 'cancelled import leaves current cards and save rows intact';
    await remember(page, 'cancel-import', groupStable);
    await page.evaluate(() => { window.__renderProbe.holdThumbnails = true; });
    await page.locator('#fileInput').setInputFiles([file('synthetic-cancelled.png', flatPng(5))]);
    await page.waitForFunction(() => window.__renderProbe.pendingThumbnails.length === 1);
    await page.locator('#cancelLoadButton').click();
    await release(page, 'Thumbnails');
    await idle(page, 5);
    await retained(page, 'cancel-import', phase);
    assert.equal(await page.locator('#errorList li').count(), 1);
    assert.equal(await page.locator('.photo-name').filter({ hasText: 'synthetic-cancelled.png' }).count(), 0);
    await originalUrls(page, [names[1], names[2]]);

    phase = 'reset clears keyed nodes before new input and late thumbnail';
    await remember(page, 'old-session', [...groupStable, option('#selectA', 'p1'), option('#selectB', 'p2')]);
    await page.evaluate(() => { window.__renderProbe.holdThumbnails = true; });
    await page.locator('#fileInput').setInputFiles([file('synthetic-obsolete.png', flatPng(6))]);
    await page.waitForFunction(() => window.__renderProbe.pendingThumbnails.length === 1);
    await page.locator('#clearButton').click();
    await page.locator('#appConfirmOk').click();
    assert.equal(await page.locator('.photo-card').count(), 0);
    await groupIds(page, []);
    assert.equal(await page.locator('#selectedList li').count(), 0);
    assert.equal(await page.locator('#selectA option').count(), 0);
    assert.equal(await page.locator('#selectB option').count(), 0);
    assert.equal(await page.locator('#downloadButton').isEnabled(), false);
    await detached(page, 'old-session');
    await page.evaluate(() => { window.__renderProbe.holdThumbnails = false; });
    const sharp = await fs.readFile(path.join(__dirname, 'fixtures/quality-detail.png'));
    const soft = await fs.readFile(path.join(__dirname, 'fixtures/quality-soft.png'));
    // Reusing filenames after reset must not reuse the old photo/Keep handlers.
    await page.locator('#fileInput').setInputFiles([file(names[0], sharp), file(names[1], soft)]);
    await idle(page, 2);
    await release(page, 'Thumbnails');
    await page.waitForFunction(() => !window.__renderProbe.urls.some(record => record.name === 'synthetic-obsolete.png' && !record.revoked));
    assert.deepEqual(await page.locator('.photo-name').allTextContents(), names.slice(0, 2));
    assert.equal(await page.locator('.photo-card.kept').count(), 0);
    assert.equal(await page.locator('#selectedList li').count(), 0);
    await detached(page, 'old-session');
    await originalUrls(page, names.slice(0, 2));

    phase = 'quality child identity and membership invalidation';
    const [sharpId, softId] = await page.locator('.photo-open').evaluateAll(nodes => nodes.map(node => node.dataset.id));
    const currentGroups = await page.locator('.group-chip').evaluateAll(nodes => nodes.map(node => node.dataset.groupId));
    if (currentGroups.length === 2) await organize(page, currentGroups[1], null, currentGroups[0], 'merge');
    const qualityGroup = await page.locator('.group-chip').getAttribute('data-group-id');
    const qualityCard = `#photo-${sharpId}`;
    assert.equal(await page.locator(`${qualityCard} .quality-badge`).count(), 1);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-mobile-key="compare"]').click();
    await page.locator('#slotA').click();
    await page.locator('#selectA').selectOption(sharpId);
    await page.locator('#compareZoom').selectOption('4');
    await page.locator('#imageA').evaluate(image => image.decode());
    const scrollBefore = await page.locator('#viewportA').evaluate(viewport => {
      viewport.scrollTo(87, 103);
      return { left: viewport.scrollLeft, top: viewport.scrollTop, url: document.querySelector('#imageA').src };
    });
    assert(scrollBefore.left > 0 && scrollBefore.top > 0, 'The real 400% image must overflow in both directions');
    await remember(page, 'quality', [qualityCard], [qualityCard]);
    await observeCard(page, qualityCard);
    await page.locator(`#photo-${softId} .keep-button`).evaluate(button => button.click());
    await unchangedCard(page, phase);
    await retained(page, 'quality', phase);
    assert.deepEqual(await page.locator('#viewportA').evaluate(viewport => ({
      left: viewport.scrollLeft, top: viewport.scrollTop, url: document.querySelector('#imageA').src
    })), scrollBefore, 'Keeping another photo must preserve comparison scroll offsets and the active original URL');
    await page.setViewportSize({ width: 1360, height: 900 });
    assert.equal(await page.locator('#selectedList li').count(), 1);
    assert.equal(await page.locator(`${qualityCard} .keep-button`).getAttribute('aria-pressed'), 'false');
    await page.locator('#languageButton').click();
    assert.equal(await page.locator(`${qualityCard} .quality-badge`).textContent(), '比較の候補');
    assert.match(await page.locator(`${qualityCard} .photo-quality`).textContent(), /縮小画像の細部指標が高め/);
    await page.locator('#languageButton').click();
    assert.match(await page.locator(`${qualityCard} .photo-quality`).textContent(), /detail signal/);
    await organize(page, qualityGroup, softId, null, 'split');
    assert.equal(await page.locator('.photo-card .quality-badge').count(), 0);
    assert.equal(await page.locator(`#photo-${softId} .keep-button`).getAttribute('aria-pressed'), 'true');
    await page.locator('#appToastAction').click();
    assert.equal(await page.locator(`${qualityCard} .quality-badge`).count(), 1);
    assert.equal(await page.locator('#selectedList li').count(), 1);
    await page.locator('#selectedList .remove-selection').click();
    assert.equal(await page.locator(`#photo-${softId} .keep-button`).getAttribute('aria-pressed'), 'false');
    assert.equal(await page.locator('#selectedList li').count(), 0);
    await page.locator('#appToastAction').click();
    assert.equal(await page.locator(`#photo-${softId} .keep-button`).getAttribute('aria-pressed'), 'true');

    phase = 'final reset and runtime boundary';
    await page.locator('#clearButton').click();
    await page.locator('#appConfirmOk').click();
    await originalUrls(page, []);
    assert.equal(await page.locator('.photo-card').count(), 0);
    assert.equal(await page.locator('#selectedList li').count(), 0);
    assert.equal(await page.locator('#downloadButton').isEnabled(), false);
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, target.preview ? [target.url] : []);
    console.log(`PASS rendering ${target.label}: identity/focus/zoom scroll, zero unaffected-card Keep mutations, import/cancel/reset, filter/split/merge/Undo, EN/JA, quality invalidation, original URL cleanup, no runtime network`);
  } catch (error) {
    error.message = `${target.label} / ${phase}: ${error.message}`;
    throw error;
  } finally {
    await context.close();
  }
}

async function main() {
  const cases = targets(process.env);
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true });
  try { for (const target of cases) await runCase(browser, target); }
  finally { await browser.close(); }
}

function selfTest() {
  assert.equal(targets({}).length, 2);
  assert.equal(targets({ BSP_RENDERING_PREVIEW_URL: 'https://r123-pr-10-bk-previews.ttomohisa.workers.dev/' }).length, 3);
  for (const url of ['http://r123-pr-10-bk-previews.ttomohisa.workers.dev/', 'https://example.com/',
    'https://r123-pr-10-bk-previews.ttomohisa.workers.dev.evil.example/',
    'https://name:secret@r123-pr-10-bk-previews.ttomohisa.workers.dev/',
    'https://r123-pr-10-bk-previews.ttomohisa.workers.dev:444/',
    'https://r123-pr-10-bk-previews.ttomohisa.workers.dev/other.html']) {
    assert.throws(() => targets({ BSP_RENDERING_PREVIEW_URL: url }));
  }
  console.log('PASS rendering harness target guards. No browser launched; browser regression remains unverified.');
}

if (require.main === module) {
  if (process.argv.includes('--self-test')) selfTest();
  else main().catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { targets };
