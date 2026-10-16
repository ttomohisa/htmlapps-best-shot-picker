# v0.1 validation record

Date: 2026-10-16. Scope: manual-selection milestone only. Fixtures: project-created synthetic landscapes, EXIF orientation, transparent PNG, static/animated WebP, malformed/empty files. No personal photos.

## Automated checks

- Core tests: 18/18 pass locally under Node 24.19.0. They cover STORE ZIP / UTF-8 / CRC32 / original SHA-256, sanitization and collision names, ZIP32 limits, bounded reads, cancellation/retry, image signatures, dimensions, malformed EXIF, and orientations 1–8.
- Independent Python `zipfile` extraction: original-byte hashes, CRC, names, and STORE pass.
- Canonical PowerShell 7.6.7 syntax preflight and repository check: pass in the Linux executor, using a `tar.exe` name for installed tar.
- Normal, self-extracting, and root HTML generation: pass; self-extract payload round-trip and canonical icon identity pass.
- CI Chromium acceptance: both generated `file://` variants pass. The ae69c707 run passed 52 browser acceptance checks, including original-byte downloads, oriented geometry, selection/Undo, comparison, Japanese/English, 320/360/390px layouts, short-height dialogs, deterministic cancel/retry/reset races, giant-image rejection, reload, retained status localization, and zero HTTP(S) requests. [Run evidence](https://github.com/ttomohisa/htmlapps-best-shot-picker/actions/runs/38859746073).
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

The header, Hero, and local-processing badge use the canonical htmlapps-template shell (cb908779). The existing subtitle is unchanged. Browser regression assertions cover desktop shell widths and font sizes, the borderless help control, shield icon, EN / JA labels, and narrow-screen typography/version visibility. Local core tests and canonical syntax/build checks pass. All 52 browser assertions pass in CI at ae69c707. The same-head HTTPS preview was checked with four synthetic images, two kept originals, A/B comparison, a renamed ZIP, and Japanese/English switching. Independent Python extraction confirms both downloaded files match their original bytes and CRC. Refreshed Japanese/English README screenshots were captured from that hosted preview and visually compared with the canonical template; CI also retains desktop screenshots. Narrow-width screenshot capture is included for continued visual regression review.

## Local-processing label and mobile footer

At a10cff89, canonical build and all 52 Chromium checks pass. The badge reads “完全ローカル処理” / “Fully local processing”, including initial HTML fallback. The informational footer is hidden at widths ≤600px, while desktop footer and mobile navigation remain present. Tests cover desktop and 320/360/390px visibility. Updated desktop screenshots were captured from the same-runtime HTTPS preview after loading four synthetic photos and keeping two.

## v0.2 development status

Core + grouping unit tests: 45 pass locally. Exact-byte/EXIF tests also pass in UTC, America/New_York and Asia/Tokyo. Canonical build passes. New group browser coverage and PR preview verification are pending. The 50 synthetic feature cases are logic coverage only; the supplied plan’s 50 human-labeled photographic cases and ≤1% photographic false-group release gate remain unverified. See [GROUPING.md](GROUPING.md).
