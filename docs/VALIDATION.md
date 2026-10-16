# v0.1 validation record

Date: 2026-10-16. Scope: manual-selection milestone only. Fixtures: project-created synthetic landscapes, EXIF orientation, transparent PNG, static/animated WebP, malformed/empty files. No personal photos.

## Automated checks

- Core tests: 18/18 pass locally under Node 24.19.0. They cover STORE ZIP / UTF-8 / CRC32 / original SHA-256, sanitization and collision names, ZIP32 limits, bounded reads, cancellation/retry, image signatures, dimensions, malformed EXIF, and orientations 1–8.
- Independent Python `zipfile` extraction: original-byte hashes, CRC, names, and STORE pass.
- Canonical PowerShell 7.6.7 syntax preflight and repository check: pass in the Linux executor, using a `tar.exe` name for installed tar.
- Normal, self-extracting, and root HTML generation: pass; self-extract payload round-trip and canonical icon identity pass.
- CI Chromium acceptance: pending. Runs `tests/browser.test.cjs` on both generated `file://` variants and records actual outcomes.
- Hosted PR preview UI / runtime requests: pending.

## Environment distinction

The dot cloud browser accepts HTTPS pages but disallows direct `file://` navigation. Launching another local Chromium process in the executor is blocked by the environment's socket restriction. Direct-file browser behavior is therefore checked by CI, not claimed from local cloud-browser navigation.

## Not tested / future gates

- Physical Android Chrome and iPhone Safari; real-device memory limits, download UX, and gestures.
- Safari, Firefox, and Edge-specific behavior.
- The later milestones (automatic grouping, quality metrics, ML, faces, eye state, high-volume optimization, split ZIPs, CSV/JSON, final release gates) are not implemented or validated.
- No claim of measured grouping accuracy, AI quality, large-collection throughput, or v1.0 readiness is made.

## Acceptance mapping

v0.1 requires BSP-001–008, 011–015, 037–042, 046, 051–054. Core tests cover byte preservation, filenames, malformed inputs, and cancellation. Browser CI covers empty/one/mixed input, add/preserve selection, oriented previews, comparison/zoom, Undo, language, filename input keys, selected ZIP contents, reset, narrow layouts, and help. Physical-device requirements remain **Not tested** even if emulated viewport checks pass.
