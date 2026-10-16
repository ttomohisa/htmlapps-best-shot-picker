# v0.1 validation record

Date: 2026-10-16. Scope: manual-selection milestone only. Fixtures: project-created synthetic landscapes, EXIF orientation, transparent PNG, static/animated WebP, malformed/empty files. No personal photos.

## Automated checks

- Core tests: 18/18 pass locally under Node 24.19.0. They cover STORE ZIP / UTF-8 / CRC32 / original SHA-256, sanitization and collision names, ZIP32 limits, bounded reads, cancellation/retry, image signatures, dimensions, malformed EXIF, and orientations 1–8.
- Independent Python `zipfile` extraction: original-byte hashes, CRC, names, and STORE pass.
- Canonical PowerShell 7.6.7 syntax preflight and repository check: pass in the Linux executor, using a `tar.exe` name for installed tar.
- Normal, self-extracting, and root HTML generation: pass; self-extract payload round-trip and canonical icon identity pass.
- CI Chromium acceptance: both generated `file://` variants pass. The d84cdff run passed 50 browser acceptance checks, including original-byte downloads, oriented geometry, selection/Undo, comparison, Japanese/English, 320/360/390px layouts, short-height dialogs, deterministic cancel/retry/reset races, giant-image rejection, reload, retained status localization, and zero HTTP(S) requests. [Run evidence](https://github.com/ttomohisa/htmlapps-best-shot-picker/actions/runs/38857745699).
- Hosted PR preview: synthetic JPEG/PNG/WebP intake, EXIF display dimensions, A/B comparison, Keep/Undo, Japanese/English, editable ZIP naming and download verified in the dot cloud Chrome browser. The downloaded two-entry ZIP passes independent Python CRC and exact original-byte checks. Actual Japanese/English screenshots are saved in `assets/`. Browser-extension diagnostic errors were observed; no application-origin errors were observed. No-runtime-request coverage is the automated file-mode CI check, not a claim about unrelated browser-extension traffic.
- Independent review: export/header core and UI state/cancellation reviewed; modal Undo, short-screen overlap, off-screen Undo and focus-restoration findings resolved. The latest language-status correction has focused regression coverage.

## Environment distinction

The dot cloud browser accepts HTTPS pages but disallows direct `file://` navigation. Launching another local Chromium process in the executor is blocked by the environment's socket restriction. Direct-file browser behavior is therefore checked by CI, not claimed from local cloud-browser navigation.

## Not tested / future gates

- Physical Android Chrome and iPhone Safari; real-device memory limits, download UX, and gestures.
- Safari, Firefox, and Edge-specific behavior.
- The later milestones (automatic grouping, quality metrics, ML, faces, eye state, high-volume optimization, split ZIPs, CSV/JSON, final release gates) are not implemented or validated.
- No claim of measured grouping accuracy, AI quality, large-collection throughput, or v1.0 readiness is made.

## Acceptance mapping

v0.1 requires BSP-001–008, 011–015, 037–042, 046, 051–054. Core tests cover byte preservation, filenames, malformed inputs, and cancellation. Browser CI covers empty/one/mixed input, add/preserve selection, oriented previews, comparison/zoom, Undo, language, filename input keys, selected ZIP contents, reset, narrow layouts, and help. Physical-device requirements remain **Not tested** even if emulated viewport checks pass.

## Template alignment regression

The header, Hero, and local-processing badge use the canonical htmlapps-template shell (cb908779). The existing subtitle is unchanged. Browser regression assertions cover desktop shell widths and font sizes, the borderless help control, shield icon, EN / JA labels, and narrow-screen typography/version visibility. Local core tests and the canonical syntax/build checks pass; the new browser assertions and refreshed screenshots are pending CI/hosted-preview verification.
