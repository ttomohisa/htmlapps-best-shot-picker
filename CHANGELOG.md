# Changelog

## Unreleased

- Add a manual-only, staged synthetic 12MP decode/resource/recovery diagnostic; keep the existing tiny-image benchmark and automatic PR workload unchanged. No product behavior or physical-device guarantee is added.


- Add representative thumbnails to the group list using the current technical candidate or first available group photo. Reuse existing thumbnail URLs and keyed image/label nodes; preserve Keep, group/review edits, keyboard access and original-byte saving.

- Review groups directly in Compare with Next unreviewed group, explicit Mark reviewed and next, progress, zero-Keep completion and Undo returning to the original group. Pause during import/analysis and ignore the second click of a double-click. Keep, originals and frozen export plans remain unchanged.

- Allow keyboard-only inspection of overflowing enlarged images in A/B comparison and the large preview. Tab into the image to pan with arrow keys; existing photo browsing remains outside the image. Fit/hidden images add no Tab stop.

- Add bounded Chromium, Firefox and WebKit core acceptance using the same canonical standalone artifacts.
- Restore keyboard focus to a remaining selected photo, the ZIP filename when empty, or the selection-list summary while that filename is disabled, after closing Preview if Unkeep removed its original Save-list opener.


Earlier entries describe their release or research stage. v0.5 supersedes prior “model excluded / adoption unapproved” product-scope statements only for the explicitly optional feature below.

## 0.7.1 — 2026-10-17

- Add explicit, separate kept-only JSON/CSV planned-file lists with editable filenames and original-to-ZIP entry/part mapping.
- Preserve exact original names in JSON; use fixed text prefixes and visible control-character escapes in display-oriented CSV.
- Reuse frozen batch metadata after live Keep edits without exporting images, EXIF, timestamps, folder metadata or model results.
- Keep list download lifetimes separate from archive save confirmation; no automatic ZIP inclusion or session restore.

## 0.7.0 — development (2026-10-16)

- Add optional, independently extractable ZIP batches while preserving the default single-ZIP flow. This is the first bounded portion of planned v0.8 storage work, not completion of that milestone.
- Require an explicit 32/64/128/256/512 MiB capacity choice, with no preselected or physically validated safe default. Preflight exact archive sizes and part count before export reads, with safe entry names unique across the entire plan.
- Freeze selected File references, entry names and output name at start. Later Keep changes, Undo, group editing and imports update the live session without rewriting the active export.
- Build only the current part; require a separate download action and user saved acknowledgement before advancing. Keep one batch archive/URL, support current-part build retry, warn about duplicate downloads, and confirm discard of a prepared/download-requested part.
- Reject an oversized original before any export read, identify it and offer capacity/selection/single-ZIP guidance. Preserve complete original bytes and EXIF/GPS; retain ZIP32 limits with no spanning ZIP, ZIP64, disk streaming or CSV/JSON output.
- Record completed v0.6.2/PR11 release evidence separately from the new candidate's pending checks. Batch capacity is not a total-memory ceiling or a physical-phone safety guarantee.

## 0.6.2 — development (2026-10-16)

- Explain when required browser APIs for optional similarity/face searches are unavailable, while retaining readable-HTML comparison, Keep and original ZIP saving.
- Check capabilities without starting a worker or expanding model assets; keep ordinary processing failures separately retryable.
- Give bundled license text its own localized loading/error/retry state and discard failed asset-expansion cache entries so explicit retries can recover.
- Align Japanese/English browser requirements and current validation evidence without claiming untested device or release gates passed.

## 0.6.1 — development (2026-10-16)

- Reuse photo cards, group controls, comparison options and selected-photo rows instead of rebuilding unchanged DOM during import and Keep updates.
- Use session-owned photo/group indexes while retaining sequential decoding, cancellation, manual grouping, Undo and original-byte ZIP export.
- Add bounded tiny-image performance measurements and rendering identity/focus/reset regressions. These measure cloud Chromium behavior, not real-photo throughput or physical-phone speed.
- Defer automatic eye-state inference because the reviewed evaluation data does not establish suitable rights and coverage for this product.

## 0.6.0 — development (2026-10-16)

- Add optional face-position detection for the current two comparison photos, with independent face selection, original-image zoom and Whole image return.
- Keep manual zoom, Keep choices, groups and untouched original ZIP export independent of face detection. Cancel, pair changes, reset and failures discard stale work.
- Embed only the pinned short-range detector and reuse the existing pure-JavaScript TensorFlow.js CPU runtime in a disposable worker, without CSP relaxation or runtime downloads.
- Keep face sharpness, eye-state inference, identity correspondence and ranking out of this limited release.
- Record the controlled adult-photo evaluation and isolated browser gates separately from general accuracy and physical-phone claims.

## 0.5.1 — development (2026-10-16)

- Choose whole eligible groups for optional candidate search in larger photo sessions, with a 36-photo limit per search.
- Show selected counts and unavailable oversized groups in a keyboard-accessible, mobile-sized dialog; keep small-session one-click search.
- Bind proposals to the selected scope and preserve outside groups, Keep choices, originals, and deliberate Apply/Undo.

## 0.5.0 — development (2026-10-16)

- Add an explicitly approved, experimental **Find similar-photo candidates** action; default grouping remains non-ML.
- Search up to 36 eligible photos in whole automatic, unreviewed, nonpending groups using one local CPU worker. Keep the frozen cosine 0.85 plus visual-guard complete-link conditions.
- Show candidate thumbnails for review and require Apply for each grouping. Preserve Keep choices and original bytes; support Undo and clear stale candidates on cancellation, additional input, reanalysis or group changes.
- Embed pinned TensorFlow.js 4.22.0, MobileNet V1 0.25 224 feature vector v2, model weights and license notices in both HTML forms. Decompress lazily after opt-in, with no runtime network or CSP relaxation.
- Keep prior research records and limited evidence separate from product accuracy claims. The product uses 480px thumbnails; historical 17/18 positive-pair recovery and zero observed false joins among 612 negatives do not guarantee its accuracy.
- Retain the owner-provided shared header/favicon SVG and the bounded worker's timeout, stale-result and resource-cleanup protections.

## Prior unreleased research — approved icon and isolated embedding worker

- Replace the header icon and favicon with the owner-provided Best Shot Picker SVG, using the canonical shared asset.
- Prototype a bounded CPU embedding worker with transferable inputs, cancellation, timeout and stale-result cleanup.
- Compare the unchanged frozen corpus and main-thread timer responsiveness without adding a model to the app.

## Prior unreleased research — frozen external burst validation

- Add an independent, hash-pinned HDR+ burst corpus and a fixed-protocol evaluator that cannot tune on external labels.
- Record both grouping denominators, sequential browser costs, synthetic CPU stress, and failure fallback without shipping a model or changing app behavior.

## 0.4.0 — 2026-10-16

- Extend the isolated evaluation with a roughly 89% smaller TFJS harness, verified CPU inference in both unchanged-CSP forms, negative security controls, and a licensed scene-disjoint real-photo lighting pilot.
- Retain the pilot's raw pair evidence, frozen development thresholds, all strategy results, and a clearly labeled fixed-guard diagnostic. Keep consumer-photo and device adoption gates open.

- Harden the non-ML fallback against malformed, sparse, non-finite or incompatible visual evidence, without broadening grouping thresholds.
- Ignore unknown capture-time domains rather than treating them as trusted timestamps; exact-byte duplicates retain priority.
- Add an isolated, hash-pinned MediaPipe/MobileNetV3 offline feasibility experiment with SIMD/scalar, invalid-model fallback and canonical self-extract checks.
- Keep ML out of the distributed app. Photographic improvement and physical-device gates remain unmet; experiment measurements are not accuracy claims.


## 0.3.0 — development

- Added bounded, contrast-normalized detail and near-white/near-black measurements from oriented reduced previews.
- Added group-relative comparison candidates and measured reasons, without selecting or reordering photos.
- Abstained for ties, incomplete evidence, incomparable scenes, noise/line-art/transparency flags, and conflicting local detail.
- Preserved selections, originals and editable groups through cancellation, additional input, reset and partial measurement failure.
- Added bilingual explanations and synthetic heuristic/state regression coverage; real-photo recommendation accuracy remains unmeasured.

## 0.2.0 — development

- Added bounded JPEG EXIF capture/digitized timestamps, with explicit timezone domains and file-modified fallback.
- Added native SHA-256 candidate hashing followed by exact byte comparison, with cancellation and visible skipped/error states.
- Added conservative all-pairs dHash/RGB/time grouping, independent duplicate badges, group filtering and split/move/merge/review Undo.
- Preserved Keep selections, original export, manual groups on additional intake, and stale-result guards.
- Added synthetic grouping/state coverage and an explicit unmeasured real-photo release gate.
- Updated the local-processing badge and hid only the informational footer on phones.

## 0.1.0 — 2026-10-16

- Added manual JPEG / PNG / still WebP photo intake, thumbnails, EXIF-aware browser previews, and isolated import errors.
- Added desktop A/B comparison, phone switching, full-size preview, zoom, explicit Keep selection, and Undo.
- Added original-byte STORE ZIP export with editable output name, Unicode/case collision protection, progress, cancellation, and retry.
- Aligned the header, Hero, and local-processing badge with the canonical template; retained the subtitle and used EN / JA language labels.
- Added bilingual help, mobile page tabs, session reset, generation guards, and resource cleanup.
- Added synthetic fixtures, original-byte ZIP regression tests, and browser acceptance CI for both standalone variants.
- Adopted the supplied v0.1–v1.0 specification, milestone plan, and acceptance matrix. This release implements only the manual v0.1 milestone.

Template baseline: ttomohisa/htmlapps-template `cb908779682fa315ccd0f1eb58549f6c208f36f0`, checked on 2026-10-16. Generated output remains one readable HTML, one self-extracting HTML, and an exact root readable copy.
