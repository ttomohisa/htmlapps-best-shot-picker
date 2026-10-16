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
- The later milestones (ML, faces, eye state, high-volume optimization, split ZIPs, CSV/JSON, final release gates) are not implemented or validated. v0.2 grouping and v0.3 technical-hint evidence are recorded separately below.
- No claim of measured grouping accuracy, AI quality, large-collection throughput, or v1.0 readiness is made.

## Acceptance mapping

v0.1 requires BSP-001–008, 011–015, 037–042, 046, 051–054. Core tests cover byte preservation, filenames, malformed inputs, and cancellation. Browser CI covers empty/one/mixed input, add/preserve selection, oriented previews, comparison/zoom, Undo, language, filename input keys, selected ZIP contents, reset, narrow layouts, and help. Physical-device requirements remain **Not tested** even if emulated viewport checks pass.

## Template alignment regression

The header, Hero, and local-processing badge use the canonical htmlapps-template shell (cb908779). The existing subtitle is unchanged. Browser regression assertions cover desktop shell widths and font sizes, the borderless help control, shield icon, EN / JA labels, and narrow-screen typography/version visibility. Local core tests and canonical syntax/build checks pass. All 52 browser assertions pass in CI at ae69c707. The same-head HTTPS preview was checked with four synthetic images, two kept originals, A/B comparison, a renamed ZIP, and Japanese/English switching. Independent Python extraction confirms both downloaded files match their original bytes and CRC. Refreshed Japanese/English README screenshots were captured from that hosted preview and visually compared with the canonical template; CI also retains desktop screenshots. Narrow-width screenshot capture is included for continued visual regression review.

## Local-processing label and mobile footer

At a10cff89, canonical build and all 52 Chromium checks pass. The badge reads “完全ローカル処理” / “Fully local processing”, including initial HTML fallback. The informational footer is hidden at widths ≤600px, while desktop footer and mobile navigation remain present. Tests cover desktop and 320/360/390px visibility. Updated desktop screenshots were captured from the same-runtime HTTPS preview after loading four synthetic photos and keeping two.

## v0.2 development status

Core + grouping unit tests: 45 pass locally. Exact-byte/EXIF tests also pass in UTC, America/New_York and Asia/Tokyo. Canonical build passes. CI at c32d5822 passes 52 existing and 24 grouping browser checks across both file:// variants, plus Windows/Linux canonical builds. Short-screen Undo is exercised in both Japanese and English on each variant. Grouping checks cover exact-duplicate evidence, split/move/merge/review and Undo, later-input and Keep preservation, focus-independent Save preview scope, held-digest cancellation/retry/reset, original-byte ZIP, 320/390px short-screen dialogs and no HTTP(S) runtime requests. The same-head normal preview deployment/probe passes.

The HTTPS preview was exercised in cloud Chrome with four project-generated images: one exact-duplicate pair and two singletons; Keep; split; merge and Undo with selection preserved; Japanese/English; repeated-copy export warning; edited ZIP filename and actual download. Independent Python verification confirms CRC, STORE and all three selected original byte sequences. Desktop Japanese/English grouping screenshots and narrow-screen Organize screenshots from actual CI rendering were visually reviewed. Physical-device checks and non-Chromium engines remain unperformed. A subsequent optional HTTPS comparison navigation hit a browser-transport timeout; that extra interaction is not claimed as verified.

 The 50 synthetic feature cases are logic coverage only; the supplied plan’s 50 human-labeled photographic cases and ≤1% photographic false-group release gate remain unverified. See [GROUPING.md](GROUPING.md).

## v0.3 development status

Local Node core/grouping/quality and build-wiring tests pass (63 checks at the first v0.3 review snapshot). Quality tests use project-owned synthetic pixels, including controlled smoothing, tie/order invariance, missing metrics, mixed compositions, monochrome, low light, line-art-like and noise-dominated inputs, transparency, and conflicting local detail. These are algorithm and state checks, not photographic recommendation accuracy. The additional browser suite is prepared for both generated variants, with cancellation/retry/reset, Keep/Undo, exact-copy ties, partial failures, group edits, original-byte export, Japanese/English and narrow/short screens. The first CI run passed the existing 52 plus 24 browser checks, then the new quality test caught a short-screen preview-image-height regression. The hint region is now height-capped and scrollable on short screens; the full post-fix result is pending. A normal HTTPS preview smoke test runs after the existing automatic deployment, checks exact served/build bytes, synthetic intake/grouping/candidates, explicit selections, original ZIP, languages, narrow layouts and no subsequent HTTP requests.

The user merged v0.2 as main `27546aa`. Its automatic Pages build/deploy succeeded in [run 38868664830](https://github.com/ttomohisa/htmlapps-best-shot-picker/actions/runs/38868664830). The served readable HTML exactly matches that run’s artifact (SHA-256 `48d6569efbaa5f94683e95c15b641f135dd0e0c0fb2cf96d3bcf9413fe59e184`), and cloud Chrome displayed v0.2.0. A further production grouping check was interrupted by a disappearing/crashed browser target after synthetic intake started; it is not counted as a completed grouping pass. The merged tree is identical to the PR2 head that passed 45 unit and 76 browser checks.

The 50 human-labeled photographic grouping cases, real-photo recommendation/human-preference agreement, physical Android/iPhone and other browser engines remain **Not tested**. No accuracy or v1.0 release claim is made.
