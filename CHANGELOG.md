# Changelog

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
