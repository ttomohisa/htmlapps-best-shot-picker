'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Q = require('../src/quality.js');
const WIDTH = 160, HEIGHT = 120;
const clamp = n => Math.min(255, Math.max(0, Math.round(n)));
function image(fn, width = WIDTH, height = HEIGHT) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(fn(x, y), (y * width + x) * 4);
  return { data, width, height };
}
function scene() {
  return image((x, y) => {
    const object = ((x - 85) / 43) ** 2 + ((y - 60) / 35) ** 2 < 1;
    const detail = object ? 25 * Math.sin(x * .83) * Math.cos(y * .71) : 8 * Math.sin(x * .2 + y * .18);
    const luma = 85 + x * .35 + y * .2 + 20 * Math.sin(x * .05) + (object ? 45 : 0) + detail;
    return [clamp(luma + 12 * Math.sin(y * .08)), clamp(luma), clamp(luma - 15), 255];
  });
}
function blur(input, radius = 3) {
  return image((x, y) => {
    const sum = [0, 0, 0]; let count = 0;
    for (let yy = Math.max(0, y - radius); yy <= Math.min(input.height - 1, y + radius); yy++) for (let xx = Math.max(0, x - radius); xx <= Math.min(input.width - 1, x + radius); xx++) {
      const i = (yy * input.width + xx) * 4; for (let c = 0; c < 3; c++) sum[c] += input.data[i + c]; count++;
    }
    return [...sum.map(v => clamp(v / count)), 255];
  }, input.width, input.height);
}
function transform(input, fn) {
  return image((x, y) => fn(Array.from(input.data.subarray((y * input.width + x) * 4, (y * input.width + x) * 4 + 4)), x, y), input.width, input.height);
}
const measure = input => Q.measure(input.data, input.width, input.height);
const record = (id, input) => ({ id, metrics: measure(input), kept: id === 'soft' });
const decision = (...records) => Q.recommend(records);

test('browser and CommonJS APIs expose only pure quality helpers and fixed configuration', () => {
  const context = { window: {} }; vm.runInNewContext(fs.readFileSync(require.resolve('../src/quality.js'), 'utf8'), context);
  for (const key of ['measure', 'recommend']) assert.equal(typeof context.window.BestShotQuality[key], 'function');
  assert.equal(Q.CONFIG.sampleLongEdge, 160); assert.ok(Object.isFrozen(Q.CONFIG));
});

test('measure validates bounded RGBA geometry and pixel values without modifying input', () => {
  const input = scene(), original = input.data.slice(); const metrics = measure(input);
  assert.deepEqual(input.data, original); assert.equal(metrics.width, 160); assert.equal(metrics.height, 120); assert.equal(metrics.aspect, 4 / 3);
  for (const key of ['sharpness', 'highlightRatio', 'darkRatio', 'noiseRatio', 'lumaDeviation']) assert.ok(Number.isFinite(metrics[key]) && metrics[key] >= 0, key);
  assert.throws(() => Q.measure([], 160, 120), TypeError);
  assert.throws(() => Q.measure(new Uint8Array(4), 1, 1), TypeError);
  assert.throws(() => Q.measure([], Infinity, 120), TypeError);
  const invalid = new Float32Array(160 * 120 * 4); invalid[17] = NaN;
  assert.throws(() => Q.measure(invalid, 160, 120), TypeError);
});

test('controlled smoothing reduces measured detail and recommends only a clearly separated candidate', () => {
  const sharp = record('sharp', scene()), soft = record('soft', blur(scene(), 3));
  assert.ok(sharp.metrics.sharpness > soft.metrics.sharpness * 1.3);
  assert.deepEqual(sharp.metrics.flags, []); assert.deepEqual(soft.metrics.flags, []);
  const before = structuredClone([sharp, soft]); const result = decision(sharp, soft);
  assert.equal(result.candidateId, 'sharp'); assert.equal(result.status, 'candidate'); assert.deepEqual(result.reasons, ['clearer-detail']);
  assert.deepEqual([sharp, soft], before); assert.equal(soft.kept, true);
  assert.equal(decision(soft, sharp).candidateId, 'sharp');
});

test('ties and close detail differences abstain without input-order tie breaking', () => {
  const a = record('a', scene()), b = record('b', scene());
  assert.deepEqual(decision(a, b), { candidateId: null, reasons: [], status: 'near-tie' });
  const adjusted = { ...b, metrics: { ...b.metrics, sharpness: a.metrics.sharpness * 1.03 } };
  assert.equal(decision(a, adjusted).candidateId, null); assert.equal(decision(adjusted, a).candidateId, null);
});

test('singletons, missing/invalid metrics and duplicate IDs never produce a candidate', () => {
  const a = record('a', scene());
  for (const values of [[], [a], [a, { id: 'b', metrics: null }], [a, a], [a, { id: 'b', metrics: { ...a.metrics, sharpness: NaN } }]]) {
    assert.equal(Q.recommend(values).candidateId, null); assert.equal(Q.recommend(values).status, 'insufficient');
  }
});

test('mixed compositions, dimensions and monochrome conversions are not ranked together', () => {
  const a = record('a', scene());
  const shifted = record('shifted', transform(scene(), (_, x, y) => Array.from(scenePixels.subarray((y * WIDTH + (x + 65) % WIDTH) * 4, (y * WIDTH + (x + 65) % WIDTH) * 4 + 4))));
  assert.equal(decision(a, shifted).status, 'incomparable');
  const portrait = image((x, y) => [x, y, 100, 255], 120, 160);
  assert.equal(decision(a, record('portrait', portrait)).status, 'incomparable');
  const mono = record('mono', transform(scene(), px => { const l = px[0] * .2126 + px[1] * .7152 + px[2] * .0722; return [l, l, l, 255]; }));
  assert.equal(decision(a, mono).candidateId, null);
});
const scenePixels = scene().data;

test('flat, line-art-like, transparent and noise-dominated samples abstain', () => {
  let seed = 123456789;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const inputs = [
    ['low-information', image(() => [130, 130, 130, 255])],
    ['line-art', image((x, y) => { const c = (Math.floor(x / 12) + Math.floor(y / 12)) % 2 ? 255 : 0; return [c, c, c, 255]; })],
    ['transparency', transform(scene(), px => [...px.slice(0, 3), 128])],
    ['noise', transform(scene(), px => { const noise = (random() - .5) * 170; return px.map((v, n) => n === 3 ? 255 : clamp(v + noise)); })]
  ];
  for (const [flag, input] of inputs) { const a = record('a', input); assert.ok(a.metrics.flags.includes(flag), flag); assert.equal(decision(a, record('b', scene())).candidateId, null, flag); }
});

test('low exposure alone does not lower relative detail or create a bright-picture preference', () => {
  const sharp = scene(), soft = blur(sharp, 3);
  const darken = input => transform(input, px => [...px.slice(0, 3).map(v => clamp(v * .36)), 255]);
  const darkSharp = record('dark-sharp', darken(sharp)), darkSoft = record('dark-soft', darken(soft));
  assert.equal(decision(darkSharp, darkSoft).candidateId, 'dark-sharp');
  const lighter = record('light', sharp), darker = record('dark', darken(sharp));
  assert.equal(decision(lighter, darker).candidateId, null);
});

test('highlight and dark ratios report only clipped pixel proportions', () => {
  const m = measure(image((x, y) => y < 12 ? [255, 255, 255, 255] : y < 24 ? [0, 0, 0, 255] : [100 + x / 2, 100, 90, 255]));
  assert.equal(m.highlightRatio, .1); assert.equal(m.darkRatio, .1);
});

test('highlight improvement needs equivalent detail; contradictory evidence abstains', () => {
  const a = record('a', scene()), b = record('b', scene());
  const clipped = { ...b, metrics: { ...b.metrics, highlightRatio: .12 } };
  assert.deepEqual(decision(a, clipped), { candidateId: 'a', reasons: ['less-highlight-clipping'], status: 'candidate' });
  const sharperClipped = { ...clipped, metrics: { ...clipped.metrics, sharpness: a.metrics.sharpness * 2 } };
  assert.equal(decision(a, sharperClipped).candidateId, null);
  const dark = { ...b, metrics: { ...b.metrics, darkRatio: .9 } };
  assert.equal(decision(a, dark).candidateId, null);
});

test('incomplete group evidence or a distant third scene blocks a pairwise winner', () => {
  const sharp = record('sharp', scene()), soft = record('soft', blur(scene(), 3));
  const other = record('other', transform(scene(), px => [255 - px[0], 255 - px[1], 255 - px[2], 255]));
  assert.equal(decision(sharp, soft, other).candidateId, null);
  assert.equal(decision(sharp, soft, { id: 'missing' }).status, 'insufficient');
});

test('small samples and spatially conflicting detail changes abstain', () => {
  const tiny = image((x, y) => [x * 2, y * 2, 80, 255], 80, 60);
  const m = measure(tiny); assert.ok(m.flags.includes('small-sample')); assert.equal(decision(record('a', tiny), record('b', tiny)).candidateId, null);
  const sharp = scene(), soft = blur(sharp, 4);
  const centerSharp = transform(soft, (px, x, y) => x > 40 && x < 120 && y > 30 && y < 90 ? Array.from(sharp.data.subarray((y * WIDTH + x) * 4, (y * WIDTH + x) * 4 + 4)) : px);
  const backgroundSharp = transform(sharp, (px, x, y) => x > 40 && x < 120 && y > 30 && y < 90 ? Array.from(soft.data.subarray((y * WIDTH + x) * 4, (y * WIDTH + x) * 4 + 4)) : px);
  assert.equal(decision(record('center', centerSharp), record('background', backgroundSharp)).candidateId, null);
});

test('duplicate best measurements never win by sort stability, even with a weaker third photo', () => {
  const sharp = record('sharp', scene()), copy = record('copy', scene()), soft = record('soft', blur(scene(), 4));
  for (const values of [[sharp, copy, soft], [soft, copy, sharp], [copy, soft, sharp]]) assert.equal(Q.recommend(values).candidateId, null);
});

test('recommend rejects impossible metric geometry, bounded ratios and signature values', () => {
  const a = record('a', scene());
  for (const patch of [
    { aspect: 9 }, { highlightRatio: 1.1 }, { lumaDeviation: 4 },
    { signature: { ...a.metrics.signature, meanLuma: -1 } },
    { signature: { ...a.metrics.signature, rgb: Array(192).fill(-1) } },
    { signature: { ...a.metrics.signature, detail: Array(16).fill(-.1) } },
    { version: 'unknown-version' }
  ]) assert.equal(decision(a, { id: 'b', metrics: { ...a.metrics, ...patch } }).status, 'insufficient');
});

test('configuration changes cannot remove numerical noise and low-information safety checks through stale flags', () => {
  const a = record('a', scene()), b = record('b', blur(scene(), 3));
  assert.equal(Q.recommend([a, b], { maxNoiseRatio: 0 }).candidateId, null);
  assert.equal(Q.recommend([a, b], { minLumaDeviation: .5 }).candidateId, null);
});

test('sparse signature arrays are missing evidence rather than a perfect composition match', () => {
  const a = record('a', scene()), b = record('b', blur(scene(), 3));
  for (const [key, length] of [['rgb', 192], ['luma', 64], ['detail', 16]]) {
    const invalid = { ...a, metrics: { ...a.metrics, signature: { ...a.metrics.signature, [key]: Array(length) } } };
    assert.equal(decision(invalid, b).status, 'insufficient');
  }
});
