/* Bounded Playwright engine acceptance for canonical file:// artifacts.
 * Existing generated JPEG/PNG/still-WebP fixtures; no user photos or model
 * accuracy claims. Engine results are not actual Safari/physical-phone evidence.
 * Run after build: BSP_BROWSER_ENGINE=firefox node tests/cross-engine.browser.cjs
 * --self-test validates fixtures/oracles without a build or browser launch.
 * HTTP(S) is blocked and audited; deliberately do not use context offline mode,
 * which can interfere with WebKit file/blob resources.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { pathToFileURL } = require('node:url');
const ROOT = path.resolve(__dirname, '..');
const MiB = 1024 * 1024;
const VARIANTS = ['index.html', 'index.self-extract.html'];
function engineName(value = 'chromium') {
  assert(['chromium', 'firefox', 'webkit'].includes(value), 'BSP_BROWSER_ENGINE must be chromium, firefox, or webkit');
  return value;
}
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

async function mixedFixtures() {
  return Promise.all([['landscape.jpg', 'image/jpeg'], ['transparent.png', 'image/png'], ['static.webp', 'image/webp']]
    .map(async ([name, mimeType]) => ({ name, mimeType, buffer: await fs.readFile(path.join(__dirname, 'fixtures', name)) })));
}
function batchFixtures() {
  return [1, 2, 3].map(index => ({ name: `synthetic-${index}.png`, mimeType: 'image/png', buffer: syntheticPNG(index, 12 * MiB) }));
}
function analysisFinished() {
  return /Analysis finished\.|解析が終わりました。/.test(document.querySelector('#analysisResult').textContent);
}
async function idle(page, count) {
  await page.locator('#loadProgress').waitFor({ state: 'hidden' });
  await page.locator('#analysisProgress').waitFor({ state: 'hidden' });
  await page.waitForFunction(analysisFinished);
  assert.equal(await page.locator('.photo-card').count(), count);
  assert.equal(await page.locator('#errorList li').count(), 0);
}
async function importFiles(page, files) { await page.locator('#fileInput').setInputFiles(files); await idle(page, files.length); }
async function download(page, selector, expectedName) {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click(); const item = await pending;
  assert.equal(item.suggestedFilename(), expectedName);
  assert.equal(await item.failure(), null);
  return fs.readFile(await item.path());
}
async function originals(page, files, name = 'cross-engine') {
  await page.locator('#outputFilename').fill(name);
  const entries = readZIP(await download(page, '#downloadButton', `${name}.zip`));
  assert.deepEqual(entries, expectedEntries(files, files.map(file => file.name)));
  return entries;
}
async function keepAll(page, count) {
  for (let i = 1; i <= count; i++) await page.locator(`#photo-p${i} .keep-button`).click();
}
async function focusState(page) {
  return page.evaluate(() => {
    const el = document.activeElement, rect = el?.getBoundingClientRect(), style = el && getComputedStyle(el);
    return { id: el?.id || '', tag: el?.tagName || '', connected: !!el?.isConnected,
      visible: !!rect && rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
      enabled: !!el && !el.disabled, tabIndex: el?.tabIndex,
      inViewport: !!rect && rect.top >= 0 && rect.left >= 0 && rect.bottom <= innerHeight && rect.right <= innerWidth,
      rect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null };
  });
}
async function shot(run, label) {
  const file = `${run.variant}.${run.name}.${label}.png`;
  await run.page.screenshot({ path: path.join(run.directory, file) });
  run.record.screenshots.push(file);
}
async function core(run) {
  const { page } = run, files = await mixedFixtures(); await importFiles(page, files);
  await page.locator('#selectA').selectOption('p1'); await page.locator('#selectB').selectOption('p2');
  for (const id of ['imageA', 'imageB']) await page.locator(`#${id}`).evaluate(img => img.decode());
  await page.locator('#compareZoom').selectOption('2');
  assert.equal(await page.locator('#imageA').evaluate(img => img.style.width), '640px');
  await page.locator('#keepA').click(); await page.locator('#keepB').click();
  assert.equal(await page.locator('.photo-card.kept').count(), 2);
  await page.locator('#keepB').click(); assert.equal(await page.locator('.photo-card.kept').count(), 1);
  await page.locator('#appToastAction').click(); assert.equal(await page.locator('.photo-card.kept').count(), 2);
  const groups = await page.locator('.group-chip').evaluateAll(nodes => nodes.map(node => node.dataset.groupId));
  assert(groups.length >= 2, 'Fixtures expose distinct groups for manual merge');
  await page.locator('#organizeButton').click(); await page.locator('#sourceGroup').selectOption(groups[0]);
  await page.locator('#targetGroup').selectOption(groups[1]); await page.locator('#mergeGroupButton').click();
  assert.equal(await page.locator('.group-chip').count(), groups.length - 1);
  await page.locator('#appToastAction').click(); assert.equal(await page.locator('.group-chip').count(), groups.length);
  assert.equal(await page.locator('.photo-card.kept').count(), 2);
  assert(await page.locator('#groupDialog').isHidden(), 'Manual group dialog closes before ZIP saving');
  run.record.originals = await originals(page, files.slice(0, 2)); await shot(run, 'core');
}
async function batches(run) {
  const { page } = run, files = batchFixtures(); await importFiles(page, files); await keepAll(page, files.length);
  await page.locator('#selectionListOptions > summary').click();
  await page.locator('#selectionListName').fill('cross-engine'); await page.locator('#outputFilename').fill('cross-engine');
  await page.locator('#zipMode').selectOption('batches'); await page.locator('#zipBatchSize').selectOption('32');
  await page.locator('#planZipBatchesButton').click(); await page.locator('#zipBatchPanel').waitFor();
  assert.equal(await page.locator('#zipBatchList > li').count(), 2);
  const names = ['cross-engine-part-001-of-002.zip', 'cross-engine-part-002-of-002.zip'];
  const expected = { schemaVersion: 1, scope: 'kept-zip-plan', snapshotSource: 'zip_batch_plan', rows: files.map((file, index) => ({
    selectionIndex: index + 1, originalName: file.name, zipEntryName: file.name,
    zipArchiveName: names[index < 2 ? 0 : 1], zipPart: index < 2 ? 1 : 2, sizeBytes: file.buffer.length
  })) };
  const json = await download(page, '#downloadSelectionJsonButton', 'cross-engine-selection.json');
  assert.deepEqual(JSON.parse(json), expected);
  const csv = parseCSV(await download(page, '#downloadSelectionCsvButton', 'cross-engine-selection.csv'));
  assert.deepEqual(csv, [['schemaVersion', 'scope', 'snapshotSource', 'selectionIndex', 'originalName_display',
    'zipEntryName_display', 'zipArchiveName_display', 'zipPart', 'sizeBytes'], ...expected.rows.map(row => [1, expected.scope,
    expected.snapshotSource, row.selectionIndex, `file: ${row.originalName}`, `file: ${row.zipEntryName}`,
    `file: ${row.zipArchiveName}`, row.zipPart, row.sizeBytes].map(String))]);
  // The reviewed plan must retain its starting selection after live Keep edits.
  await page.locator('#photo-p1 .keep-button').click();
  assert.equal(await page.locator('.photo-card.kept').count(), 2);
  // The frozen plan disables the filename; empty live selection must still have
  // a visible focus destination without discarding or rewriting that plan.
  while(await page.locator('#selectedList li').count()){
    await page.locator('#selectedList li button').first().focus(); await page.keyboard.press('Enter');
    await page.locator('#previewDialog').waitFor(); await page.locator('#previewKeep').click(); await page.keyboard.press('Escape');
    await page.locator('#previewDialog').waitFor({state:'hidden'});
  }
  assert(await page.locator('#outputFilename').isDisabled());
  await page.waitForFunction(()=>document.activeElement===document.querySelector('#selectionListOptions > summary'));
  run.record.activeBatchEmptyFocus=await focusState(page);
  assert(run.record.activeBatchEmptyFocus.visible&&run.record.activeBatchEmptyFocus.inViewport);
  for(const id of ['p2','p3'])await page.locator(`#photo-${id} .keep-button`).click();
  const actual = [];
  for (let index = 0; index < 2; index++) {
    await page.locator('#prepareZipBatchButton').click(); await page.locator('#downloadZipBatchButton').waitFor();
    const bytes = await download(page, '#downloadZipBatchButton', names[index]); assert(bytes.length <= 32 * MiB);
    const entries = readZIP(bytes); assert.deepEqual(entries, expectedEntries(index ? files.slice(2) : files.slice(0, 2),
      (index ? files.slice(2) : files.slice(0, 2)).map(file => file.name))); actual.push(...entries);
    if (!index) {
      await page.locator('#nextZipBatchButton').click();
      const frozen = await download(page, '#downloadSelectionJsonButton', 'cross-engine-selection.json');
      assert.deepEqual(JSON.parse(frozen), expected, 'Full frozen plan survives Keep change and part advance');
    }
  }
  assert.deepEqual(actual, expectedEntries(files, files.map(file => file.name)));
  run.record.originals = actual; run.record.selectionList = expected;
  await shot(run, 'two-parts'); await page.locator('#finishZipBatchesButton').click();
  assert.equal(await page.locator('.photo-card.kept').count(), 2, 'Finishing frozen ZIPs preserves live Keep edits');
  assert.deepEqual(await page.locator('.photo-card.kept .photo-name').allTextContents(), files.slice(1).map(file => file.name));
}
async function mobileDialogs(run) {
  const { page } = run; await importFiles(page, await mixedFixtures()); await keepAll(page, 3);
  await page.setViewportSize({ width: 320, height: 640 }); run.record.focus = [];
  for (const language of ['en', 'ja']) {
    if (await page.locator('html').getAttribute('lang') !== language) await page.locator('#languageButton').click();
    await page.locator('[data-mobile-key="photos"]').click();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    for (const [opener, dialog] of [['#helpButton', '#helpDialog'], ['#clearButton', '#appConfirmDialog']]) {
      // Explicit focus before activation makes keyboard return independent of engines'
      // platform-specific mouse-click focus policy.
      await page.locator(opener).focus(); await page.locator(opener).press('Enter'); await page.locator(dialog).waitFor();
      assert(await page.locator(dialog).evaluate(node => node.contains(document.activeElement)));
      const rect = await page.locator(dialog).boundingBox();
      assert(rect && rect.x >= -1 && rect.x + rect.width <= 321, 'Dialog fits 320px width');
      if (dialog === '#helpDialog') {
        await page.locator('#helpDialog .dialog-body').evaluate(node => { node.scrollTop = node.scrollHeight; });
        assert(await page.locator('#helpDialog .dialog-body').evaluate(node => node.scrollHeight - node.scrollTop - node.clientHeight < 2));
      }
      await shot(run, `${language}.${dialog.slice(1)}`); await page.keyboard.press('Escape');
      await page.locator(dialog).waitFor({ state: 'hidden' });
      const focus = await focusState(page); run.record.focus.push({ language, dialog, ...focus });
      assert.equal(focus.id, opener.slice(1)); assert(focus.connected && focus.visible && focus.enabled);
      assert.equal(await page.locator('.photo-card.kept').count(), 3, 'Esc is non-destructive');
    }
  }
  // Separate concrete observations: these do not silently redefine the documented
  // arrow-to-browse behavior or make an unapproved panning requirement mandatory.
  await page.locator('[data-mobile-key="save"]').click();
  await page.locator('#selectedList li button').first().focus(); await page.keyboard.press('Enter');
  await page.locator('#previewDialog').waitFor(); await page.locator('#previewZoom').selectOption('4');
  const before = await page.locator('#previewName').textContent();
  run.record.zoomObservation = await page.locator('#previewViewport').evaluate(node => ({
    tabIndex: node.tabIndex, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth,
    scrollHeight: node.scrollHeight, clientHeight: node.clientHeight
  }));
  await page.locator('#closePreviewButton').focus(); await page.keyboard.press('ArrowRight');
  run.record.zoomObservation.arrowBrowsed = before !== await page.locator('#previewName').textContent();
  // Reopen the original Save opener to test its removal, rather than unkeeping
  // whichever photo the arrow observation selected.
  await page.keyboard.press('Escape');
  await page.locator('#selectedList li button').first().focus(); await page.keyboard.press('Enter');
  await page.locator('#previewKeep').click(); await page.keyboard.press('Escape');
  await page.locator('#previewDialog').waitFor({ state: 'hidden' });
  await page.waitForFunction(()=>document.activeElement===document.querySelector('#selectedList button'));
  run.record.detachedSaveOpenerFocus = await focusState(page);
  run.record.detachedSaveOpenerFocus.reachableControl = run.record.detachedSaveOpenerFocus.connected &&
    run.record.detachedSaveOpenerFocus.visible && run.record.detachedSaveOpenerFocus.enabled &&
    run.record.detachedSaveOpenerFocus.tabIndex >= 0 && run.record.detachedSaveOpenerFocus.inViewport;
  assert(run.record.detachedSaveOpenerFocus.reachableControl, 'Closing Preview after Unkeep restores a visible reachable control');
  await shot(run, 'detached-save-opener');
  while(await page.locator('#selectedList li').count()){
    await page.locator('#selectedList li button').first().focus(); await page.keyboard.press('Enter');
    await page.locator('#previewDialog').waitFor(); await page.locator('#previewKeep').click(); await page.keyboard.press('Escape');
    await page.locator('#previewDialog').waitFor({state:'hidden'});
  }
  await page.waitForFunction(()=>document.activeElement===document.querySelector('#outputFilename'));
  run.record.emptySaveFocus=await focusState(page);
  assert(run.record.emptySaveFocus.visible&&run.record.emptySaveFocus.inViewport, 'Empty selection returns to visible ZIP filename');
  assert.equal(await page.locator('.photo-card').count(),3,'Unkeep never removes originals');
  assert.equal(await page.locator('.photo-card.kept').count(),0);
  await shot(run,'empty-save-focus');
}
async function zoomKeyboard(run) {
  const {page}=run;await importFiles(page,await mixedFixtures());
  await page.locator('#selectA').selectOption('p1');await page.locator('#selectB').selectOption('p2');
  for(const id of ['viewportA','viewportB'])assert.equal(await page.locator('#'+id).getAttribute('tabindex'),'-1','Fit image has no extra Tab stop');
  await page.locator('#compareZoom').selectOption('4');
  for(const [slot,selected] of [['A','p1'],['B','p2']]){
    const viewport='#viewport'+slot;
    await page.waitForFunction(id=>document.querySelector(id).tabIndex===0,viewport);
    await page.locator('#select'+slot).focus();await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'viewport'+slot,'Image reached with Tab');
    assert(await page.locator(viewport).getAttribute('aria-label'));
    assert.notEqual(await page.locator(viewport).evaluate(n=>getComputedStyle(n).outlineStyle),'none');
    await page.locator(viewport).evaluate(n=>n.scrollTo({left:0,top:0,behavior:'instant'}));
    await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowDown');
    await page.waitForFunction(id=>{const n=document.querySelector(id);return n.scrollLeft>0&&n.scrollTop>0;},viewport);
    assert.equal(await page.locator('#select'+slot).inputValue(),selected,'Arrow pans without changing photo');
    const middle=await page.locator(viewport).evaluate(n=>{n.scrollTo({left:n.scrollWidth/2,top:n.scrollHeight/2,behavior:'instant'});return{left:n.scrollLeft,top:n.scrollTop};});
    await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowUp');
    await page.waitForFunction(({id,before})=>{const n=document.querySelector(id);return n.scrollLeft<before.left&&n.scrollTop<before.top;},{id:viewport,before:middle});
    assert.equal(await page.locator('#select'+slot).inputValue(),selected,'Left/Up pans back without changing photo');
    await page.locator(viewport).evaluate(n=>n.scrollTo({left:n.scrollWidth,top:n.scrollHeight,behavior:'instant'}));
    await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('#select'+slot).inputValue(),selected,'At edge arrows never browse another photo');
    assert.equal(await page.locator('.photo-card.kept').count(),0);
  }
  await page.locator('#compareZoom').selectOption('fit');
  for(const id of ['viewportA','viewportB'])await page.waitForFunction(id=>document.querySelector(id).tabIndex===-1,'#'+id);
  await page.locator('#slotA').click();
  await page.setViewportSize({width:900,height:700});
  await page.locator('#openPreviewButton').click();await page.locator('#previewZoom').selectOption('4');
  assert.equal(await page.locator('#previewName').textContent(),'landscape.jpg','Choose the large fixture, not a PNG that fits at 400%');
  await page.waitForFunction(()=>document.querySelector('#previewViewport').tabIndex===0);
  await page.locator('#closePreviewButton').focus();await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'previewViewport');
  const original=await page.locator('#previewName').textContent();
  await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowDown');
  await page.waitForFunction(()=>{const n=document.querySelector('#previewViewport');return n.scrollLeft>0&&n.scrollTop>0;});
  assert.equal(await page.locator('#previewName').textContent(),original);
  await shot(run,'keyboard-pan');
  await page.locator('#previewViewport').evaluate(n=>n.scrollTo({left:n.scrollWidth,top:n.scrollHeight,behavior:'instant'}));
  await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#previewName').textContent(),original);
  await page.locator('#closePreviewButton').focus();await page.keyboard.press('ArrowRight');
  assert.notEqual(await page.locator('#previewName').textContent(),original,'Outside image existing browse shortcut remains');
  await page.keyboard.press('Escape');
  await page.locator('#compareZoom').selectOption('4');await page.setViewportSize({width:320,height:640});
  await page.locator('[data-mobile-key="photos"]').click();
  await page.waitForFunction(()=>document.querySelector('#viewportA').tabIndex===-1);
  await page.locator('[data-mobile-key="compare"]').click();
  await page.waitForFunction(()=>document.querySelector('#viewportA').tabIndex===0);
  await page.locator('#languageButton').click();assert.match(await page.locator('#viewportA').getAttribute('aria-label'),/写真A/);
  await page.locator('#viewportA').focus();await shot(run,'ja-narrow-image-focus');
  await page.locator('#compareZoom').selectOption('fit');
  await page.waitForFunction(()=>document.querySelector('#viewportA').tabIndex===-1);
  await page.locator('[data-mobile-key="save"]').click();await page.locator('#outputFilename').fill('keyboard');
  const pair=await page.locator('#selectA').inputValue();await page.locator('#outputFilename').press('ArrowLeft');
  assert.equal(await page.locator('#selectA').inputValue(),pair,'Text-field arrows do not browse');
  run.record.keyboard={nativePan:true,edgeDoesNotBrowse:true,fitAndHiddenExcluded:true,formsPreserved:true};
}
async function reviewNavigation(run) {
  const {page}=run, files=[1,1,2,3].map((index,i)=>({name:`review-${i+1}.png`,mimeType:'image/png',buffer:syntheticPNG(index,1024)}));
  await importFiles(page,files);
  assert.equal(await page.locator('.group-chip').count(),3);
  assert.equal(await page.locator('#reviewAndNextButton').count(),1,'Compare exposes explicit review navigation');
  assert(await page.locator('#reviewAndNextButton').isDisabled(),'All photos is not one review group');
  assert.match(await page.locator('#reviewProgress').textContent(),/0 \/ 3/);
  await page.locator('#nextUnreviewedButton').click();assert.equal(await page.locator('#groupFilter').inputValue(),'g-p1');
  assert.equal(await page.locator('#selectA').inputValue(),'p1');assert.equal(await page.locator('#selectB').inputValue(),'p2');
  await page.locator('#nextUnreviewedButton').click();assert.equal(await page.locator('#groupFilter').inputValue(),'g-p3');
  assert.match(await page.locator('#reviewProgress').textContent(),/0 \/ 3/,'Next alone never marks reviewed');
  await page.locator('#compareZoom').selectOption('4');
  await page.locator('#reviewAndNextButton').focus();await page.keyboard.down('Enter');await page.keyboard.down('Enter');await page.keyboard.up('Enter');await page.keyboard.press('Escape');
  assert.equal(await page.locator('#groupFilter').inputValue(),'g-p4');assert.equal(await page.locator('#compareZoom').inputValue(),'fit');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'selectA');
  assert.match(await page.locator('#reviewProgress').textContent(),/1 \/ 3/,'Held Enter reviews one visible group only');
  assert.match(await page.locator('.group-chip[data-group-id="g-p3"]').textContent(),/Reviewed/);
  await page.locator('#appToastAction').click();assert.equal(await page.locator('#groupFilter').inputValue(),'g-p3');
  assert.match(await page.locator('#reviewProgress').textContent(),/0 \/ 3/);
  await page.locator('#reviewAndNextButton').dblclick();
  assert.match(await page.locator('#reviewProgress').textContent(),/1 \/ 3/,'Double click reviews only the group the user saw');
  assert.equal(await page.locator('#groupFilter').inputValue(),'g-p4');
  await page.locator('#reviewAndNextButton').click();assert.equal(await page.locator('#groupFilter').inputValue(),'g-p1','Review wraps past reviewed groups');
  assert(await page.locator('#nextUnreviewedButton').isDisabled(),'Only current unreviewed group remains');
  await page.locator('#reviewAndNextButton').click();
  assert.match(await page.locator('#reviewProgress').textContent(),/All groups reviewed/);
  assert.equal(await page.locator('#groupFilter').inputValue(),'g-p1');assert.equal(await page.locator('.photo-card.kept').count(),0,'Zero Keep can complete a group');
  assert(await page.locator('#reviewAndNextButton').isDisabled());assert(await page.locator('#nextUnreviewedButton').isDisabled());
  await page.locator('#appToastAction').click();assert.match(await page.locator('#reviewProgress').textContent(),/2 \/ 3/);
  await page.locator('#keepA').click();await page.locator('#reviewAndNextButton').focus();await page.keyboard.down('Space');await page.keyboard.down('Space');await page.keyboard.up('Space');
  assert.equal(await page.locator('.photo-card.kept').count(),1,'Review leaves Keep untouched');
  await page.locator('#analyzeButton').click();await idle(page,4);
  assert.match(await page.locator('#reviewProgress').textContent(),/All groups reviewed/,'Ordinary reanalysis preserves reviewed state');
  await originals(page,[files[0]],'review-original');
  await page.locator('#regroupButton').click();await page.locator('#appConfirmOk').click();await idle(page,4);
  assert.match(await page.locator('#reviewProgress').textContent(),/0 \/ 3/);
  await page.evaluate(()=>{window.__reviewHeld=[];const digest=crypto.subtle.digest.bind(crypto.subtle);crypto.subtle.digest=(...args)=>digest(...args).then(value=>window.__reviewHold?new Promise(resolve=>window.__reviewHeld.push(()=>resolve(value))):value);window.__reviewHold=true;});
  await page.locator('#analyzeButton').click();await page.waitForFunction(()=>window.__reviewHeld.length>0);
  assert(await page.locator('#nextUnreviewedButton').isDisabled());assert(await page.locator('#reviewAndNextButton').isDisabled());
  await page.locator('#organizeButton').click();await page.locator('#groupDialog').press('Escape');
  assert(await page.locator('#nextUnreviewedButton').isEnabled(),'Organize cancellation refreshes direct review controls');
  assert(await page.locator('#reviewAndNextButton').isEnabled());
  await page.evaluate(()=>{window.__reviewHold=false;window.__reviewHeld.splice(0).forEach(release=>release());});
  await page.locator('#analysisProgress').waitFor({state:'hidden'});
  await page.locator('#analyzeButton').click();await idle(page,4);
  await page.setViewportSize({width:320,height:480});await page.locator('[data-mobile-key="compare"]').click();await page.locator('#languageButton').click();
  assert.match(await page.locator('#nextUnreviewedButton').textContent(),/未確認/);assert.match(await page.locator('#reviewAndNextButton').textContent(),/確認済み/);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Narrow Japanese review controls do not overflow');
  await page.locator('#nextUnreviewedButton').click();assert.equal(await page.locator('#groupFilter').inputValue(),'g-p3');
  await page.locator('#reviewAndNextButton').click();await page.locator('#appToastAction').click();
  assert.equal(await page.evaluate(()=>document.activeElement.id),'selectA');
  await page.locator('#reviewProgress').scrollIntoViewIfNeeded();await shot(run,'review-navigation-ja-narrow');
  await page.setViewportSize({width:1360,height:900});await page.locator('#languageButton').click();await page.locator('#reviewProgress').scrollIntoViewIfNeeded();await shot(run,'review-navigation-en-desktop');
  await page.locator('#clearButton').click();await page.locator('#appConfirmOk').click();
  assert(await page.locator('#reviewNavigation').isHidden());assert.equal(await page.locator('.photo-card').count(),0);
  run.record.review={navigationOnly:true,zeroKeep:true,undo:true,lastGroup:true,reanalysis:true,doubleClick:true,heldEnter:true,heldSpace:true,organizeCancellation:true,narrowKeyboard:true};
}
async function groupThumbnails(run) {
  const {page}=run,chip=id=>`.group-chip[data-group-id="${id}"]`,thumb=id=>`${chip(id)} img`;
  assert.equal(await page.locator('.group-thumbnail').count(),0,'Empty session has no representatives');
  const files=[
    {name:'soft.png',mimeType:'image/png',buffer:await fs.readFile(path.join(__dirname,'fixtures/quality-soft.png'))},
    {name:'detail.png',mimeType:'image/png',buffer:await fs.readFile(path.join(__dirname,'fixtures/quality-detail.png'))},
    ...(await mixedFixtures()).slice(0,2)
  ];
  await importFiles(page,files);
  const edit=async(photo,action)=>{await page.locator('#organizeButton').click();await page.locator('#sourceGroup').selectOption('g-p1');if(photo)await page.locator('#groupPhoto').selectOption(photo);await page.locator(`#${action}GroupButton`).click();};
  if(await page.locator(chip('g-p2')).count()){
    await page.locator('#organizeButton').click();await page.locator('#sourceGroup').selectOption('g-p2');await page.locator('#targetGroup').selectOption('g-p1');await page.locator('#mergeGroupButton').click();
  }
  assert.equal(await page.locator('#photo-p2 .quality-badge').count(),1,'Generated detail fixture is the technical candidate');
  const first=await page.locator('#photo-p1 img').getAttribute('src'),candidate=await page.locator('#photo-p2 img').getAttribute('src');
  assert.equal(await page.locator(thumb('g-p1')).getAttribute('src'),candidate,'Candidate, not first member, is represented');
  assert.equal(await page.locator(thumb('g-p3')).getAttribute('src'),await page.locator('#photo-p3 img').getAttribute('src'),'Single uses its existing thumbnail');
  assert.equal(await page.locator(thumb('g-p1')).getAttribute('alt'),'');assert.equal(await page.locator(thumb('g-p1')).getAttribute('loading'),'lazy');
  await page.evaluate(()=>{window.__groupNodes=[...document.querySelectorAll('.group-chip')].map(button=>({button,image:button.querySelector('img'),label:button.querySelector('.group-chip-label')}));});
  await page.locator('#photo-p1 .keep-button').click();await edit(null,'review');
  assert.equal(await page.locator(thumb('g-p1')).getAttribute('src'),candidate,'Keep and review do not choose the representative');
  await page.locator(chip('g-p1')).press('Enter');assert.equal(await page.locator('#groupFilter').inputValue(),'g-p1');
  assert.equal(await page.locator(chip('g-p1')).getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.photo-card.kept').count(),1);
  await edit('p2','split');assert.equal(await page.locator(thumb('g-p1')).getAttribute('src'),first,'Split removes the old candidate from its source thumbnail');
  assert.equal(await page.locator(thumb('manual-p2')).getAttribute('src'),candidate);await page.locator('#appToastAction').click();
  assert.equal(await page.locator(thumb('g-p1')).getAttribute('src'),candidate,'Undo restores current membership representative');
  await page.locator('#analyzeButton').click();await idle(page,4);
  assert.equal(await page.locator(thumb('g-p1')).getAttribute('src'),candidate);
  assert(await page.evaluate(()=>window.__groupNodes.every(({button,image,label})=>button.isConnected&&button.querySelector('img')===image&&button.querySelector('.group-chip-label')===label)),'Stable chips retain child identities across Keep/review/edit/Undo/reanalysis');
  await originals(page,[files[0]],'group-thumbnails');
  for(const language of ['en','ja']){
    if(language==='ja')await page.locator('#languageButton').click();
    for(const width of [1360,320,390]){
      await page.setViewportSize({width,height:width===1360?900:480});
      if(width<600)await page.locator('[data-mobile-key="photos"]').click();
      await page.locator('#groupList').scrollIntoViewIfNeeded();
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Group thumbnails must not cause page overflow');
      assert(await page.locator('.group-chip').evaluateAll(nodes=>nodes.every(node=>node.scrollWidth<=node.clientWidth+1)),'Group labels fit their controls');
      const image=page.locator(thumb('g-p1'));await image.scrollIntoViewIfNeeded();await image.evaluate(async image=>{if(!image.complete)await new Promise(resolve=>image.addEventListener('load',resolve,{once:true}));});
      assert(await image.evaluate(image=>image.naturalWidth>0&&image.getBoundingClientRect().width===48&&image.getBoundingClientRect().height===40));
      await shot(run,`group-thumbnails-${language}-${width}`);
    }
    assert.equal(await page.locator(thumb('g-p1')).getAttribute('src'),candidate);assert.equal(await page.locator('.photo-card.kept').count(),1);
  }
  await page.locator('#clearButton').click();await page.locator('#appConfirmOk').click();assert.equal(await page.locator('.group-thumbnail').count(),0);
  await importFiles(page,[files[2]]);assert.equal(await page.locator('.group-thumbnail').count(),1);
  assert.equal(await page.locator(thumb('g-p5')).count(),1,'New session does not reuse a prior photo ID');
  assert.equal(await page.locator('.group-thumbnail').getAttribute('src'),await page.locator('.photo-card img').getAttribute('src'));
  run.record.groupThumbnails={candidate:true,fallback:true,keepIndependent:true,reviewIndependent:true,splitUndo:true,reanalysis:true,stableNodes:true,keyboard:true,enJaWidths:[1360,320,390],reset:true};
}
function capabilityFault(mode) {
  window.__crossEngineFault = { mode, attempts: 0 };
  if (mode === 'missing-worker') {
    if (!Reflect.deleteProperty(window, 'Worker')) throw new Error('Could not remove Worker API');
  } else if (mode === 'worker-failure') {
    const NativeWorker = window.Worker;
    function FailedWorker() { window.__crossEngineFault.attempts++; throw new Error('Synthetic Worker construction failure'); }
    Object.setPrototypeOf(FailedWorker, NativeWorker); FailedWorker.prototype = NativeWorker.prototype;
    window.Worker = FailedWorker;
  }
}
async function optionalModel(run) {
  const { page } = run, files = await mixedFixtures(); await importFiles(page, files);
  if (run.name === 'missing-worker') {
    for (const id of ['findSimilarButton', 'chooseSimilarityGroupsButton', 'findFacesButton']) assert(await page.locator(`#${id}`).isDisabled());
    assert.match(await page.locator('#similarityMessage').textContent(), /compar|Keep|sav/i);
  } else {
    assert(await page.locator('#findSimilarButton').isEnabled(), 'Optional search capability available before injected failure');
    await page.locator('#findSimilarButton').click();
    await page.waitForFunction(() => window.__crossEngineFault.attempts > 0);
    await page.locator('#similarityProgress').waitFor({ state: 'hidden' });
    assert.match(await page.locator('#similarityMessage').textContent(), /could not finish/i);
  }
  await page.locator('#selectA').selectOption('p1'); await page.locator('#selectB').selectOption('p2');
  await page.locator('#imageA').evaluate(img => img.decode()); await page.locator('#imageB').evaluate(img => img.decode());
  await page.locator('#keepA').click(); await page.locator('#keepB').click();
  run.record.originals = await originals(page, files.slice(0, 2));
  run.record.fault = await page.evaluate(() => window.__crossEngineFault); await shot(run, 'ordinary-flow-survives');
}

async function scenario(browser, directory, variant, name, execute) {
  const record = { variant, scenario: name, status: 'running', screenshots: [], externalRequests: [], pageErrors: [], consoleErrors: [] };
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: 'en-US', acceptDownloads: true });
  const run = { context, directory, variant, name, record }; let timer;
  try {
    await context.tracing.start({ screenshots: true, snapshots: true });
    await context.route(/^https?:\/\//, route => route.abort());
    context.on('request', request => { if (/^https?:/.test(request.url())) record.externalRequests.push(request.url()); });
    if (['missing-worker', 'worker-failure'].includes(name)) await context.addInitScript(capabilityFault, name);
    const page = run.page = await context.newPage(); page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(30000);
    page.on('pageerror', error => record.pageErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') record.consoleErrors.push(message.text()); });
    const work = async () => {
      await page.goto(pathToFileURL(path.join(ROOT, 'dist', variant)).href); await page.locator('#addButton').waitFor();
      assert.match(await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content'), /connect-src\s+'none'/);
      await execute(run);
      assert.deepEqual(record.externalRequests, [], 'No HTTP(S) attempts; route also blocks them');
      assert.deepEqual(record.pageErrors, [], 'No unhandled page errors');
      assert.deepEqual(record.consoleErrors, [], 'No unexpected console errors');
    };
    await Promise.race([work(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Scenario exceeded 90s budget')), 90000); })]);
    record.status = 'passed'; await context.tracing.stop();
  } catch (error) {
    record.status = 'failed'; record.error = error.stack || String(error);
    if (run.page) await shot(run, 'failure').catch(error => { record.screenshotError = String(error); });
    record.trace = `${variant}.${name}.trace.zip`;
    await context.tracing.stop({ path: path.join(directory, record.trace) }).catch(error => { record.traceError = String(error); });
  } finally { clearTimeout(timer); await context.close(); }
  return record;
}
async function selfTest() {
  for (const [text, expected] of [['Analysis finished. Review groups before keeping photos.', true], ['解析が終わりました。グループを確認して、残す写真を選んでください。', true], ['Analyzing', false], ['解析中', false], ['Analysis cancelled.', false], ['', false]]) {
    assert.equal(require('node:vm').runInNewContext('(' + analysisFinished.toString() + ')()', { document: { querySelector: () => ({ textContent: text }) } }), expected, `Localized idle predicate: ${text}`);
  }
  assert.equal(engineName(), 'chromium'); for (const name of ['chromium', 'firefox', 'webkit']) assert.equal(engineName(name), name);
  for (const bad of ['', '../webkit', 'safari', 'Firefox']) assert.throws(() => engineName(bad));
  const files = await mixedFixtures(); assert.deepEqual(files.map(file => file.mimeType), ['image/jpeg', 'image/png', 'image/webp']);
  assert.equal(files[0].buffer.readUInt16BE(), 0xffd8); assert.equal(files[1].buffer.subarray(1, 4).toString(), 'PNG');
  assert.equal(files[2].buffer.subarray(8, 12).toString(), 'WEBP');
  const png = syntheticPNG(1, 1024); assert.equal(png.length, 1024); assert.equal(png.subarray(-8, -4).toString(), 'IEND');
  assert.deepEqual(parseCSV(Buffer.from('\ufeff"a","b"\r\n"c","d"\r\n')), [['a', 'b'], ['c', 'd']]);
  assert.throws(() => parseCSV(Buffer.from('a,b\n'))); assert.throws(() => readZIP(Buffer.alloc(22)));
  // Real core ZIP producer against the independent parser, then deliberate byte
  // corruption proves the CRC/SHA oracle rejects damaged downloads.
  const Core = require('../src/core.js'), contents = Buffer.from('synthetic original');
  const zip = Buffer.from(await (await Core.createZip([Object.assign(new Blob([contents]), { name: 'test.png' })])).arrayBuffer());
  assert.deepEqual(readZIP(zip), [{ name: 'test.png', size: contents.length, sha256: sha(contents) }]);
  const damaged = Buffer.from(zip); damaged[30 + Buffer.byteLength('test.png')] ^= 1; assert.throws(() => readZIP(damaged));
  console.log('PASS cross-engine harness self-test (no browser launch)');
}
async function main() {
  if (process.argv.includes('--self-test')) return selfTest();
  const engine = engineName(process.env.BSP_BROWSER_ENGINE), directory = path.join(ROOT, 'test-results', 'cross-engine', engine);
  if(process.env.BSP_BROWSER_SCENARIO)assert(['core','batches','mobile-dialogs','zoom-keyboard','review-navigation','group-thumbnails','missing-worker','worker-failure'].includes(process.env.BSP_BROWSER_SCENARIO),'Unknown scenario');
  assert(!process.env.BSP_PREVIEW_URL, 'This bounded harness tests file:// artifacts only');
  await fs.mkdir(directory, { recursive: true });
  const report = { engine, version: null, playwrightVersion: require('playwright/package.json').version,
    scope: 'Playwright desktop engine, synthetic files, 320px viewport; not actual Safari or physical-device evidence', scenarios: [] };
  let browser;
  try {
    browser = await require('playwright')[engine].launch({ headless: true }); report.version = browser.version();
    for (const variant of VARIANTS) for (const [name, execute] of [['core', core], ['batches', batches],
      ['mobile-dialogs', mobileDialogs], ['zoom-keyboard',zoomKeyboard], ['review-navigation',reviewNavigation], ['group-thumbnails',groupThumbnails], ['missing-worker', optionalModel], ['worker-failure', optionalModel]]) {
      if(process.env.BSP_BROWSER_SCENARIO && process.env.BSP_BROWSER_SCENARIO!==name)continue;
      const result = await scenario(browser, directory, variant, name, execute); report.scenarios.push(result);
      await fs.writeFile(path.join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
      console.log(`${result.status.toUpperCase()} ${engine} ${variant} ${name}${result.error ? '\n' + result.error : ''}`);
    }
  } catch (error) { report.error = error.stack || String(error); process.exitCode = 1; }
  finally {
    if (browser) await browser.close();
    report.status = report.error || report.scenarios.some(item => item.status !== 'passed') ? 'failed' : 'passed';
    await fs.writeFile(path.join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    if (report.status !== 'passed') process.exitCode = 1;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
