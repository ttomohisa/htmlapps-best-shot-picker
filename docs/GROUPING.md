# Conservative grouping (v0.2 development)

## Meaning and ownership

A group is a set of photos to compare, never a recommendation or Keep selection. Exact-byte duplicate evidence is independent of editable group membership. Split/merge/move/review operations use ID-only Undo patches; original File objects and Keep flags are not part of those snapshots. Additional input and selection changes survive Undo.

`src/grouping.js` owns the pure pair predicate, deterministic complete-link insertion, and partition edits. `src/core.js` owns bounded JPEG EXIF parsing and exact-byte verification. `src/app.js` owns session, input and grouping revisions. Results commit only when all three still match; cancellation cannot stop an already-running native digest, but discards its late result. Opening Organize stops analysis so dialog options cannot become stale.

## Exact duplicates and memory

Only equal-byte-size originals become SHA-256 candidates. Native Web Crypto hashes them sequentially, with a 64 MiB per-file cap. Matching digests are then verified by original-byte comparison in 1 MiB chunks. Names and modified times are not identity evidence. Missing crypto, over-budget files and read failures have visible statuses and do not block preview, selection, or ZIP export. No automatic deduplication occurs.

## Time and features

JPEG EXIF DateTimeOriginal is preferred, with DateTimeDigitized fallback; only their corresponding offsets/subseconds are read. Without an explicit timezone, a wall-clock value is preserved without converting through the viewer's timezone. Wall and instant domains are not mixed. File.lastModified is always labeled separately and never relaxes visual thresholds. A bounded 512 KiB metadata prefix may leave metadata unavailable.

Browser-oriented pixels are sampled on a white analysis background at 9×8. A horizontal 64-bit dHash, spatial RGB sample, aspect ratio and luminance deviation corroborate one another. No extra EXIF rotation is applied. Low-information images remain separate unless their originals match exactly.

`CONFIG` defines the version and thresholds. Comparable capture times must be within 6 seconds; that path permits Hamming distance ≤6, RGB mean absolute difference ≤15, and relative aspect difference ≤0.025. Without comparable capture time the limits tighten to 1, 3, and 0.005. Both paths require luminance standard deviation ≥12. These are conservative development settings, not calibrated real-world accuracy claims.

Every pair in an automatic group must pass. A new photo joins at most one eligible automatic group; it never merges two existing groups. Manual groups are excluded from automatic insertion. Explicit regrouping can reset manual groups after confirmation and never changes Keep flags.

## Evaluation and release gate

Run `npm run test:grouping`. The runner writes `test-results/grouping-evaluation.json`, recording exact configuration, project-authored feature-descriptor cases, expected labels, output groups, false-group count/rate, pair recall and elapsed time. It does not log private filenames, hashes or image content during normal app use.

Current evidence is 50 parameterized synthetic feature cases: 50 automatic multi-photo groups, 0 false groups, 50/50 expected pairs recovered. This is algorithmic smoke coverage, not 50 human-labeled photographic cases and not a measurement of photographic accuracy. The cases share a construction and are not statistically independent.

**Release gate remains open:** the supplied plan requires at least 50 human-organized comparison cases and an honest photographic false-group/recall assessment. A suitably licensed, privacy-cleared photographic evaluation corpus has not been supplied or assembled. No ≤1% real-world false-group claim is made. v0.3 technical hints are documented separately in [QUALITY.md](QUALITY.md). ML, faces, eye state, high-volume optimization and v1.0 readiness remain out of scope.
