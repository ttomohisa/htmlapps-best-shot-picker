# Architecture

## Overview

The repository separates editable source from the release artifact:

```text
app.config.json              Product metadata
APP_SPEC.md                  Product behavior and acceptance contract
dependencies.json            Exact npm packages, assets, and update policy
dependencies.lock.json       Committed tarball SHA-256 lock
components/                   Reusable source snippets copied/adapted into apps
src/index.template.html      Editable application source
build-standalone.ps1         Dependency lock verification, embed, and build
scripts/check-dependency-updates.ps1  Update discovery/reporting
scripts/update-dependency.ps1          Reviewed upgrade helper
scripts/verify-standalone.ps1 Static release checks
<repo-name-without-htmlapps->.html  Generated repository-root copy of the readable artifact
dist/index.html              Generated readable release artifact
dist/index.self-extract.html Generated gzip self-extracting artifact
dist/build-size-report.json    Generated size and embedded-asset storage report
```

`dist/index.html`, `dist/index.self-extract.html`, and the repository-root readable copy are generated and must not be edited manually. The root copy is named from `app.config.json` `repository.name`, with a leading `htmlapps-` removed, and must remain byte-for-byte identical to `dist/index.html`.


## Reusable component layer

`components/` contains reusable source snippets for common UI and connection patterns. These files are not loaded at runtime and are not a separate bundle layer. An app copies or adapts the needed CSS, HTML, and JavaScript into `src/index.template.html`, preserving the one-file runtime model. Most components are dependency-free; dependency-aware components use the same pinned embedded-asset pipeline as the rest of the app.

The starter includes the canonical confirmation and toast APIs in the default source, while `components/` also carries the mobile bottom bar/page-tabs pattern, compact popover, preset/custom setting field, async source-state guard, and a fully serverless WebRTC QR-pairing component. Reversible operations should normally use Toast + Undo; irreversible/high-risk operations use `AppConfirm`. The WebRTC component is dependency-aware and uses the normal pinned embedded-asset pipeline rather than a runtime CDN. See `docs/COMPONENTS.md` and `docs/WEBRTC_QR_PAIRING.md`.

## Build pipeline

1. Read `app.config.json`, `dependencies.json`, and `dependencies.lock.json`.
2. Require one matching lock entry for every configured dependency.
3. Resolve each exact npm version through the npm registry when it is not already cached.
4. Verify the tarball SHA-256 against the committed lock before embedding anything.
5. Cache and extract each tarball.
6. Validate the package's own version.
7. Read only the explicitly listed asset files.
8. Calculate SHA-256 hashes for every original embedded asset.
9. Optionally gzip each declared asset (`gzip` / `auto`), then Base64-encode the stored bytes exactly once.
10. Embed the asset bundle JSON directly, avoiding a second Base64 wrapper around the whole bundle.
11. Replace the declared application-source and data placeholders with their required counts.
12. Write and verify `dist/index.html`, then copy it byte-for-byte to the repository root using `repository.name` with a leading `htmlapps-` removed.
13. Gzip that HTML, embed it into a small ASCII-only native `DecompressionStream` loader, inherit the readable HTML favicon, and write `dist/index.self-extract.html`.
14. Verify that the loader stays ASCII-only and embedded-only, the favicon matches the readable HTML, and the gzip payload restores byte-for-byte.
15. Write manifests, `build-size-report.json`, and `dist/.nojekyll`; emit warning-only size-budget messages when configured thresholds are exceeded.
16. Reject the declared unresolved build placeholders and common external runtime resource references.

## Dependency maintenance lifecycle

The runtime build stays deterministic while release discovery remains separate from source changes:

1. `scripts/check-dependency-updates.ps1` reads update policies and queries npm for newer versions.
2. `.github/workflows/dependency-updates.yml` runs weekly and creates/refreshes one open maintenance Issue when updates exist.
3. No dependency source file is changed by the scheduled workflow.
4. A human reviews release notes and chooses whether to run `scripts/update-dependency.ps1`.
5. The update helper refreshes the selected lock entry, verifies declared asset paths, runs the standalone build, and rolls config/lock files back if the process fails.

The update checker is a repository-maintenance network operation. It does not run inside the distributed browser app and does not weaken the app's runtime `connect-src 'none'` boundary.

## Build placeholders

The source template contains exactly one of each data placeholder:

- `__APP_CONFIG_JSON__`
- `__BUILD_MANIFEST_JSON__`
- `__EMBEDDED_ASSET_BUNDLE_JSON__`

`__APP_ICON_DATA_URI__` intentionally appears exactly twice: once for the browser favicon and once for the upper-left application brand icon. The builder reads `assets/favicon.svg` once and substitutes the same Base64 data URI into both locations; the standalone verifier rejects mismatched icon payloads.

Do not rename or duplicate these placeholders without changing the builder and verifier. Other runtime identifiers that happen to use a `__NAME__` convention are allowed and must not be rejected as build placeholders.

## Embedded asset API

The generated page exposes `window.StandaloneAssets`:

```js
StandaloneAssets.list();
StandaloneAssets.has('library-id', 'asset-key');
StandaloneAssets.bytes('library-id', 'asset-key'); // uncompressed only
await StandaloneAssets.bytesAsync('library-id', 'asset-key'); // compressed or uncompressed
StandaloneAssets.text('library-id', 'asset-key'); // uncompressed only
await StandaloneAssets.textAsync('library-id', 'asset-key');
StandaloneAssets.blobUrl('library-id', 'asset-key'); // uncompressed only
await StandaloneAssets.blobUrlAsync('library-id', 'asset-key');
await StandaloneAssets.loadClassicScript('library-id', 'main', 'ExpectedGlobal');
const module = await StandaloneAssets.importModule('library-id', 'main');
```

Blob URLs are revoked after script/module loading and on page exit. Gzip assets are expanded with native `DecompressionStream` and cached in memory after first use.

### Important limitation

`importModule` does not rewrite relative imports inside a module. Choose a self-contained browser bundle, list every required file and implement a package-specific loader, or bundle the library before embedding.

## Runtime security boundary

The default Content Security Policy blocks ordinary fetch/XHR/WebSocket-style runtime connections with `connect-src 'none'`. It also blocks frames, objects, forms, and external base URLs. Inline CSS and JavaScript are allowed because the release is intentionally one HTML document. Embedded scripts and workers may be loaded through `blob:` URLs. An application that intentionally uses peer-to-peer WebRTC DataChannels may still keep this CSP and the fully serverless `iceServers: []` design; its privacy copy must distinguish “no server/cloud transfer” from “no data leaves this device.”

Static scanning is a guardrail, not a proof. Browser developer tools should still be used to verify that the generated app makes no unexpected request.

## Large applications

Keep source in one HTML while it remains understandable. When an app grows substantially, development files may be split under `src/` and assembled by the build script. Preserve these properties:

- Two generated one-file release variants.
- Pinned and auditable dependencies.
- No runtime external resource.
- Clear state ownership.
- A build that fails on missing input.


## Best Shot Picker source split

The template retains the generic embedded asset loader. `src/core.js` contains the dependency-free byte-preserving ZIP and header utilities; `src/app.js` owns the temporary UI session, sequential thumbnail queue, explicit selections, and cancellation/generation guards. The canonical PowerShell builder injects the application sources through separately counted placeholders before standalone verification. No external script files are needed at runtime.

Browser-decoded `naturalWidth` / `naturalHeight` are the oriented display dimensions. Canvas thumbnails use those same dimensions and the browser-oriented image. Zoom uses those dimensions in CSS pixels; original File bytes never pass through canvas for export.

The exporter snapshots selected File references before processing. Later selection changes affect the next export only. Reset invalidates import/export generations and releases thumbnails and full-preview Blob URLs. Only active comparison and large-preview originals have full-size Blob URLs; thumbnails remain until reset. Legacy single-ZIP download URLs are released after a delay; an independent pending-download acknowledgement survives that timer before a batch plan can start. The optional batch planner freezes names and File references across all parts, while only its current archive Blob/URL is materialized. Explicit saved confirmation releases it before advancing; abandoning a prepared/requested part or resetting warns first. Browser download completion and total process memory are not inferred from URL release.

## Best Shot Picker analysis

See [GROUPING.md](GROUPING.md) for the versioned pair predicate, ID-owned group state, EXIF domains, atomic async commits and evidence limits. The builder injects `__BEST_SHOT_GROUPING_JS__` exactly once between the core and app sources, rejecting closing script tags in every injected source.

## Relative technical hints

`src/quality.js` is embedded between grouping and app source using a counted `__BEST_SHOT_QUALITY_JS__` placeholder. It measures a bounded oriented preview and derives optional relative candidates from complete current group membership. `src/app.js` sequentially resamples existing thumbnails; temporary canvases and decoded previews are released. Metrics commit only with the existing session/input/group revision guard. A failed metric is isolated without rejecting a valid photo. Candidates are derived after each group edit, never stored in Undo patches or written into Keep, comparison selection, or original File objects. See [QUALITY.md](QUALITY.md).


## Optional similar-photo proposals (v0.5)

The default `BestShotGrouping` path remains non-ML. The builder injects `src/similarity.js` and `src/embedding-worker-client.js` through counted `__BEST_SHOT_SIMILARITY_JS__` and `__BEST_SHOT_EMBEDDING_CLIENT_JS__` placeholders before the app. TFJS is not evaluated on the main page: its runtime, the model and `src/embedding-worker.js` are gzip-compressed assets in the existing `StandaloneAssets` bundle. Both generated forms contain the complete assets and notices. See [pinned model packaging](../assets/embedding/README.md).

Only an explicit **Find similar-photo candidates** action decompresses model assets and starts one Blob CPU worker. The selected search scope must have at least two automatic, unreviewed, nonpending groups, containing no more than 36 ready photos in total. Larger sessions open a native whole-group chooser with no preselection. Its draft is separate from the committed scope; only Search commits a valid selection and starts inference. Existing groups are indivisible, and a group larger than 36 is unavailable. Smaller sessions retain one-click all-eligible search and can optionally change the scope. Normal comparison, Keep and saving do not wait for this optional path.

`src/app.js` sequentially decodes the existing oriented, maximum-480px thumbnails, composites transparency on white, and transfers one bounded RGB input at a time. The worker resizes it to 224×224, normalizes to [0, 1], and computes a 256-dimensional unit feature vector with TFJS 4.22.0 / Google MobileNet V1 0.25 224 feature vector v2. Neither original files nor Keep state are sent to the worker. Model bytes use `tf.io.fromMemory`; no remote loader is used. A lexical `WebAssembly` parameter disables the runtime's optional long.js accelerator without changing global WebAssembly or the CSP. The CPU backend is selected explicitly.

`BestShotSimilarity` uses cosine ≥0.85 plus the frozen visual guard: dHash distance ≤12, mean RGB distance ≤48, aspect-ratio relative difference ≤0.025 and luma deviation ≥12 on each image. Finite, versioned descriptors and complete vector shapes are required. Greedy complete-link checks every pair, including pairs within existing groups, and stages only merges of whole groups. It never weakens the normal grouping predicate or silently moves matching subsets.

The proposal is a snapshot, not a group mutation. Its fingerprint covers the complete ordered partition, member IDs and manual/reviewed/pending flags. Each proposal also binds the canonical selected group IDs; inference and proposals use only that scope, while Apply preserves every outside group. App-level session/input/group revision checks reject late async results; `apply()` repeats partition and eligibility checks immediately before a deliberate Apply. Applying one proposal creates one manual, unreviewed group and a normal group-edit Undo patch, then clears all proposals. Keep flags, File references and original-byte export remain independent. Undo restores affected memberships while preserving later-imported photos.

Cancel, failure, timeout, new input, normal reanalysis, group edits, Undo, reset and page exit clear or invalidate candidate work. One worker request is active at a time, carrying generation and job IDs; mismatched replies cannot settle the active request. Initialization/inference/disposal timeouts are 30/10/5 seconds, with an app-wide 60-second search budget. Success disposes model tensors and closes the worker; all exit paths terminate/revoke remaining worker resources. Decompressed immutable asset caches may remain in page memory for reuse; per-search vectors are not persisted or attached to photo records.

The normal builder checks the exact npm tarball lock, the reviewed runtime byte hash, and each local model/license asset's length and SHA-256 before embedding. Missing or changed assets fail the build. Asset provenance URLs are records, not runtime/build model downloads. Research image corpora and evaluation harnesses remain separate from the shipped app. The research 17/18 positive-pair result and zero observed false joins across 612 negatives use a frozen corpus/input pipeline; they do not establish accuracy for the product's 480px preprocessing. See [validation evidence](VALIDATION.md).


### Optional planned-file list boundary (v0.7.1)

The core retains exact primitive original names with each private ZIP plan and creates a frozen, allowlisted selection-list value. Current single-ZIP lists use a synchronous current-Keep plan; active batch lists reuse the existing immutable plan. Serialization never spreads photo/file objects or reads their binary content. JSON is exact-name interchange; CSV is deliberately prefixed/escaped display text. Text download URLs and cooldown state are independent of ZIP download URLs and the pending saved acknowledgement. See [SELECTION_LIST.md](SELECTION_LIST.md).
