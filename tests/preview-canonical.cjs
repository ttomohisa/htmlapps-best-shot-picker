/* Build the exact canonical distribution in the unprivileged preview-test checkout.
 * The privileged workflow uploads dist from a separate runner; the verify checkout
 * has sources but no dist. Never skip the existing byte-for-byte preview assertion.
 */
'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

let buildPending;
async function readCanonicalPreviewHtml(root) {
  const output = path.join(root, 'dist', 'index.html');
  try {
    return await fs.readFile(output);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  if (!buildPending) {
    buildPending = Promise.resolve().then(() => {
      const result = spawnSync('pwsh', [
        '-NoLogo', '-NoProfile', '-File',
        path.join(root, 'scripts', 'check-repository.ps1')
      ], { cwd: root, encoding: 'utf8', timeout: 10 * 60 * 1000,
        maxBuffer: 32 * 1024 * 1024, windowsHide: true });
      if (result.error) throw result.error;
      if (result.status !== 0) {
        throw new Error(`Canonical preview build failed (exit ${result.status}):\n${result.stderr}\n${result.stdout}`);
      }
    });
  }
  await buildPending;
  return fs.readFile(output);
}

module.exports = { readCanonicalPreviewHtml };
