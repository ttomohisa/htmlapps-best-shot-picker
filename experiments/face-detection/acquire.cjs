/* Research acquisition only. Never imported by the application build. */
'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const manifest = require('./dependencies.json');
const runtime = require('../embedding/tfjs.dependencies.json').runtime;
const root = path.resolve(__dirname, '../..');
const cache = path.join(root, '.cache/face-detection');
const out = path.join(root, 'test-results/face-research');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function verify(bytes, expected, name) {
  if (!Number.isSafeInteger(expected.bytes) || bytes.length !== expected.bytes) throw new Error('Size mismatch: ' + name);
  if (sha(bytes) !== expected.sha256) throw new Error('SHA-256 mismatch: ' + name);
  if (expected.integrity && 'sha512-' + crypto.createHash('sha512').update(bytes).digest('base64') !== expected.integrity) throw new Error('SHA-512 mismatch: ' + name);
  return bytes;
}
function safeName(name) {
  if (!name || name.startsWith('/') || name.includes('\\') || name.includes(':') || /[\x00-\x1f\x7f]/.test(name) || name.split('/').some(p => p === '..' || p === '.')) throw new Error('Unsafe archive path: ' + name);
}
// Parse verified archives in memory. Only explicitly selected regular files are
// returned. No archive name, link, permission or owner controls a filesystem write.
// These pinned archives use basic tar records; unknown extensions fail closed.
function extractSelected(compressed, selected, maxOutputLength = 180 * 1024 * 1024) {
  const tar = zlib.gunzipSync(compressed, {maxOutputLength});
  const wanted = new Set(selected), found = new Map(), seen = new Set();
  const string = bytes => bytes.toString('utf8').replace(/\0.*$/s, '');
  const octal = bytes => {
    const value = string(bytes).trim();
    if (!/^[0-7]+$/.test(value)) throw new Error('Invalid tar numeric field');
    const number = Number.parseInt(value, 8);
    if (!Number.isSafeInteger(number)) throw new Error('Invalid tar size');
    return number;
  };
  let offset = 0, ended = false;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) { ended = true; break; }
    const checksum = [...header].reduce((sum, byte, i) => sum + (i >= 148 && i < 156 ? 32 : byte), 0);
    if (checksum !== octal(header.subarray(148, 156))) throw new Error('Invalid tar checksum');
    const prefix = string(header.subarray(345, 500));
    const name = (prefix ? prefix + '/' : '') + string(header.subarray(0, 100));
    safeName(name);
    if (seen.has(name)) throw new Error('Duplicate archive member: ' + name);
    seen.add(name);
    const type = header[156], size = octal(header.subarray(124, 136));
    if (![0, 48, 53].includes(type)) throw new Error('Unsupported archive member: ' + name);
    if (type === 53 && size !== 0) throw new Error('Invalid tar directory');
    const start = offset + 512, end = start + size;
    offset = start + Math.ceil(size / 512) * 512;
    if (offset > tar.length || end > tar.length) throw new Error('Truncated tar member');
    if (wanted.has(name)) {
      if (type === 53) throw new Error('Expected regular file: ' + name);
      found.set(name, Buffer.from(tar.subarray(start, end)));
    }
  }
  if (!ended || tar.length - offset < 1024 || !tar.subarray(offset).every(byte => byte === 0)) throw new Error('Truncated or trailing tar data');
  for (const name of wanted) if (!found.has(name)) throw new Error('Missing archive member: ' + name);
  return found;
}
async function download(pin, filename, {offline = false, fallback} = {}) {
  const file = path.join(cache, filename);
  let bytes;
  try { bytes = await fs.readFile(file); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    if (fallback) {
      try { bytes = await fs.readFile(fallback); }
      catch (missing) { if (missing.code !== 'ENOENT') throw missing; }
    }
    if (!bytes) {
      if (offline) throw new Error('Missing cached archive in offline mode: ' + filename);
      if (!/^https:\/\/(registry\.npmjs\.org|www\.kaggle\.com)\//.test(pin.url)) throw new Error('Unexpected acquisition origin');
      const response = await fetch(pin.url, {signal: AbortSignal.timeout(120000)});
      if (!response.ok) throw new Error('Download failed: ' + response.status + ' ' + pin.url);
      const chunks = []; let length = 0;
      for await (const chunk of response.body) {
        length += chunk.length;
        if (length > pin.bytes) { await response.body.cancel().catch(() => {}); throw new Error('Oversized download: ' + filename); }
        chunks.push(chunk);
      }
      bytes = Buffer.concat(chunks);
    }
    verify(bytes, pin, filename);
    await fs.writeFile(file, bytes);
  }
  return verify(bytes, pin, filename);
}
async function acquire({offline = false} = {}) {
  await fs.mkdir(cache, {recursive: true}); await fs.mkdir(out, {recursive: true});
  const assets = [], archives = [];
  async function save(name, bytes, pin) {
    verify(bytes, pin, name);
    await fs.mkdir(path.dirname(path.join(cache, name)), {recursive: true});
    await fs.writeFile(path.join(cache, name), bytes);
    assets.push({path: name, bytes: bytes.length, sha256: sha(bytes)});
  }
  for (const [name, pin, selected, fallback] of [
    ['tfjs-4.22.0.tgz', runtime, [runtime.asset, 'package/package.json'], path.join(root, '.cache/embedding-tfjs/tfjs-4.22.0.tgz')],
    ['face-detection-1.0.3.tgz', manifest.package, [manifest.package.asset, 'package/package.json']]
  ]) {
    const archive = await download(pin, name, {offline, fallback});
    const files = extractSelected(archive, selected);
    const metadata = JSON.parse(files.get('package/package.json'));
    if (metadata.name !== (pin.name || pin.package) || metadata.version !== pin.version || metadata.license !== pin.license) throw new Error('Package metadata mismatch: ' + name);
    const key = pin === runtime ? 'runtime.js' : 'detector.js';
    await save(key, files.get(pin.asset), {sha256: pin.assetSha256, bytes: pin.assetBytes || 17930});
    archives.push({file: name, url: pin.url, bytes: archive.length, sha256: sha(archive), integrity: pin.integrity});
  }
  for (const [type, pin] of Object.entries(manifest.models)) {
    const filename = type + '-model.tar.gz';
    const archive = await download(pin, filename, {offline});
    const files = extractSelected(archive, pin.assets.map(a => path.posix.basename(a.path)), 4 * 1024 * 1024);
    for (const asset of pin.assets) await save(asset.path, files.get(path.posix.basename(asset.path)), asset);
    archives.push({file: filename, url: pin.url, bytes: archive.length, sha256: sha(archive)});
  }
  const report = {scope: 'Official hash-pinned assets only; no photo acquisition', runtimeVersion: runtime.version, detectorVersion: manifest.package.version, archives, assets};
  await fs.writeFile(path.join(out, 'probe-acquire-results.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}
module.exports = {acquire, extractSelected, verify, sha, cache, out, root};
if (require.main === module) acquire({offline: process.argv.includes('--offline')}).then(report => console.log(JSON.stringify(report, null, 2))).catch(error => {console.error(error); process.exitCode = 1;});
