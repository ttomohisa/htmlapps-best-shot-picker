'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { previewBuildDigest } = require('./preview-canonical.cjs');

const html = (timestamp, extra = '') =>
  '<html><script>const BUILD_MANIFEST = {"generatedAtUtc":"' + timestamp + '","version":"1.0.0"};</script>' + extra + '</html>';

test('preview integrity ignores only the build timestamp', () => {
  const first = html('2026-11-13T22:20:35.1200000Z');
  const second = html('2026-11-13T22:25:44.9876543Z');
  assert.equal(previewBuildDigest(first), previewBuildDigest(second));
});

test('preview integrity catches other changes to HTML or embedded data', () => {
  const first = html('2026-11-13T22:20:35.1200000Z');
  assert.notEqual(previewBuildDigest(first), previewBuildDigest(first + '<p>changed</p>'));
  assert.notEqual(previewBuildDigest(first), previewBuildDigest(first.replace('1.0.0', '1.0.1')));
});

test('preview integrity fails closed on missing, invalid or duplicate timestamps', () => {
  assert.throws(() => previewBuildDigest('<html></html>'), /Exactly one valid generatedAtUtc/);
  assert.throws(() => previewBuildDigest(html('not-a-date')), /Exactly one valid generatedAtUtc/);
  assert.throws(() => previewBuildDigest(html('2026-11-13T22:20:35.1200000Z') +
    html('2026-11-13T22:20:35.1200000Z')), /Exactly one valid generatedAtUtc/);
});
