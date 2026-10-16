# Security Policy

## Supported version

Security fixes target the latest version on the default branch.

## Reporting a vulnerability

Do not publish sensitive vulnerability details in a public issue. Use the repository owner's private security reporting channel when available.

Include:

- Affected commit or version.
- Reproduction steps.
- Expected and actual behavior.
- Security impact.
- A minimal test file when file parsing is involved.

## Trust model

The default template is a static browser application with no backend. Its primary protections are:

- No ordinary runtime CDN/API connection (`connect-src 'none'`). Optional peer-to-peer WebRTC must be explicit in the product specification and must not introduce hidden signaling/STUN/TURN services.
- Explicitly pinned and embedded third-party files.
- Committed `dependencies.lock.json` tarball SHA-256 values verified before embedding.
- SHA-256 records in the generated dependency manifest.
- No analytics, telemetry, remote fonts, or silent update checks.
- User-initiated downloads rather than automatic uploads.

A generated HTML file is executable code. Distribute it through a trusted channel and verify hashes for high-trust workflows.

If an app uses `components/webrtc-qr-pairing.html`, treat the paired browser as an explicit data recipient. “No server upload” does not mean “data never leaves this device.” Keep the manual signaling and `iceServers: []` boundary visible in the UI/help text, and do not silently add STUN/TURN later.

## Input files

Applications created from this template may parse untrusted local files. Implementations should:

- Validate type, size, and structure before expensive processing.
- Avoid unbounded allocation or recursion.
- Handle malformed data without exposing stack traces to users.
- Release Blob URLs, workers, canvas resources, and large buffers.
- Make destructive transformations reversible where practical.
- Never upload a selected file unless the product explicitly requires it and the user is clearly informed.

## Dependency review

Before adding or upgrading a package:

- Confirm the package identity and exact version.
- Review the scheduled dependency Issue; never treat an available update as an automatic approval to upgrade.
- Review its license and required notices.
- Inspect the browser bundle and package scripts.
- Confirm every runtime support asset is embedded.
- Refresh the selected lock entry with the dependency scripts; never hand-edit a lock hash to bypass a mismatch.
- Rebuild with a clean cache.
- Test with the network disabled.


## Best Shot Picker file boundary

Only explicit JPEG/PNG/static WebP signatures are accepted. Header checks and browser decoding both gate a file before it enters the successful photo list. A 100-megapixel / 32,768-pixel-per-axis resource guard is checked wherever dimensions are available. This cannot guarantee immunity to all browser decoder failures.

Original File objects remain immutable. ZIP export flattens and sanitizes names, normalizes Unicode, avoids case-insensitive collisions, checks ZIP32 limits, and copies original bytes without image rewriting. Export therefore preserves private EXIF/GPS metadata; the app warns users before sharing. No image, thumbnail, selection, or face data is persisted. Language preference is the only localStorage value.

## Photo grouping boundary

The grouping path reads only JPEG orientation and capture/digitized timestamp metadata. GPS and unrelated EXIF data are not followed. Thumbnails/descriptors/digests remain session-only and are not logged or transmitted. SHA-256 uses sequential native whole-file buffers up to 64 MiB per candidate; matching hashes undergo bounded byte verification. This budget is not a guarantee for every low-memory device. Analysis failure never changes Keep choices or original files.

## Optional local embedding boundary (v0.5)

The explicitly approved product feature embeds TensorFlow.js 4.22.0 and Google MobileNet V1 0.25 224 feature vector v2, its weights, worker, Apache-2.0 license and third-party notices in both single-HTML releases. The npm tarball lock plus the reviewed runtime and model asset byte lengths/SHA-256 hashes are checked before embedding. `assets/embedding/manifest.json` records provenance; upstream model URLs are not fetched at runtime or by the normal build. Missing or modified assets fail closed. Upgrades require a fresh joint runtime/model/license review.

No model code runs until the user explicitly starts candidate search. Lazy decompression and a local Blob CPU worker use embedded bytes only. The unchanged CSP retains `connect-src 'none'`, with no eval or WASM-evaluation exception. The worker additionally blocks fetch, XHR, WebSocket and importScripts; model loading uses in-memory bytes. The local lexical WebAssembly override only avoids long.js's optional accelerator and does not modify global browser capabilities.

Only bounded, oriented thumbnail RGB pixels go to the worker, one at a time. Search is limited to at most 36 photos across complete automatic, unreviewed, nonpending groups; there is no silent partial-group or first-36 sampling. Model vectors and proposals remain session-only and are not logged, exported or persisted. The model does not detect or identify people. Initialization, inference and overall-job timeouts bound stalled work; cancellation and stale-generation checks prevent obsolete results from changing the current session. Worker termination and Blob URL revocation run on completion, failure and cancellation. Immutable decompressed model assets may remain in page memory for later searches.

Candidate similarity is not a security or accuracy guarantee. Malformed evidence is rejected, the frozen visual guard and all-pairs checks restrict candidates, and results require deliberate Apply. Manual/reviewed groups are excluded. Apply validates the complete group snapshot, changes group membership only, and provides Undo; it cannot change Keep selections or original files. Additional input, reanalysis, group edits, reset or cancellation invalidate pending work. Unsupported or failed optional inference leaves the ordinary selection and original-byte export path available. Research counts must not be represented as product accuracy guarantees.

## Isolated embedding experiments (historical research scope)

The developer-only MediaPipe/TFJS experiments are excluded from the normal application build and deployments. Public research photographs are downloaded with explicit source attribution/license and pinned hashes; user-selected private photos are not used in CI. Experimental HTML/model/photo bundles are not published as CI artifacts.

The TFJS candidate does not change the canonical self-extract builder or production CSP. A local lexical parameter disables only the bundled long.js optional WASM accelerator, retaining its JavaScript fallback; global WebAssembly remains unchanged. CPU/WebGL inference and model loading use embedded in-memory bytes. Negative tests independently check that JavaScript eval/Function, WASM compilation and external connections remain blocked. At the research stage, these results did not authorize model adoption. The later explicitly approved, bounded v0.5 opt-in feature is documented above; that approval does not turn research measurements into general accuracy or device-performance guarantees.

The independent HDR+ holdout is also development-only. Its acquisition tool reads exact public Google Cloud Storage object generations, checks source SHA-256/MD5 and size, and verifies every fixed-render derivative before embedding. No input or user photo is sent. Rawpy/native decoding occurs in the developer/CI environment, never in the shipped app. Photographs and research HTML stay out of git and CI artifacts; only numerical JSON reports are uploaded. The holdout acquisition/evaluation itself adds no CSP permission, runtime dependency, account, or persistent access. The separately approved product runtime and model are described above.
