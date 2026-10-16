# Best Shot Picker

Compare photos, choose your favorites, and save their untouched originals together in a ZIP.

[日本語](README.ja.md) · [Open the app](https://ttomohisa.github.io/htmlapps-best-shot-picker/)

![Best Shot Picker showing photos, comparison, and selected originals](assets/screenshot.en.png)

## Features

- Add JPEG, PNG, and still WebP files, including more photos during a session
- Find identical originals and conservative default similarity groups; split, merge, move, and undo group edits
- Optionally find additional similar-photo candidates with an embedded local model, then review and apply each grouping yourself
- Distinguish JPEG EXIF capture/digitized timestamps from file-modified time
- See group-relative technical comparison candidates and measured reasons; uncertain or tied cases have no recommendation
- Browse thumbnails, open a large view, and compare two photos
- Switch A / B on phones; inspect 100%, 200%, or 400% views by scrolling
- Keep any number of photos, with Undo for the latest selection change
- Save original file bytes in a ZIP with an editable filename and collision-safe entry names
- Isolate unreadable files, cancel work, and retry unfinished photos
- Japanese / English, keyboard controls, and narrow-screen page tabs

## How to use

1. Choose **Add photos**, drag files into the drop area, or choose a folder when supported.
2. Review **Photo groups** or **All photos**. Use **Organize** to split, move, merge, or mark a group reviewed. Open a photo for a closer look. In **Compare**, choose photos A and B. Technical hints may highlight a comparison candidate, but never select it. **Keep** the ones you want.
3. Optionally choose **Find similar-photo candidates**. It searches up to 36 eligible photos across at least two automatic, unreviewed groups whose normal analysis is complete. For larger sessions, choose whole groups to compare, totaling at most 36 photos per search. Open the candidate thumbnails to compare, then choose **Apply this grouping** only for a grouping you want. **Undo** reverses the latest group edit. Manual and reviewed groups are excluded.
4. In **Save**, review your choices and filename, then choose **Save originals as ZIP**.

Arrow keys browse the active comparison photo. Enter toggles Keep when focus is on the page or image; focused buttons keep their usual action. Esc closes a dialog. Input fields and selectors do not trigger browsing shortcuts.

## Privacy

Processing stays inside the browser. Optional candidate search uses a model embedded in the HTML and starts only when you choose it. There are no image uploads, runtime APIs, external fonts, analytics, or remote model downloads. Hosted use downloads the initial HTML. Content Security Policy blocks runtime connections with `connect-src 'none'`.

ZIP entries use the original bytes: EXIF, GPS location, color profiles, and other metadata remain. Check metadata before sharing. Original files on your device are never overwritten, moved, or deleted.

Photos and choices are temporary. Reloading, closing the page, or starting over clears the session. Only language preference may be stored.

## Browsers and devices

Designed for modern Chrome and Edge on desktop and phones. Japanese / English layouts target widths of 320px and above. Folder selection appears only when the browser supports it.

See [validation results](docs/VALIDATION.md) for the environments and checks covered.

## Limitations

This is the v0.5 development milestone. Default grouping remains non-ML; the optional local-model search is experimental. Both can miss related photos or suggest unrelated ones. Review every proposed grouping before applying it. Neither selects photos for you, and general photo-grouping accuracy is not guaranteed.

The 36-photo limit applies to each optional search, not the whole session. Choose the groups you want to compare; unselected groups stay unchanged. A group containing more than 36 photos cannot be selected for this search. No photos are silently truncated and existing groups are never split. Adding photos, editing groups, or starting a new analysis clears pending candidates. Applying one proposal clears the others, so search again for current candidates. Cancel or failure leaves existing groups, Keep choices, and originals unchanged. Processing may be slow on some devices; normal comparison and saving remain available.

Technical hints use reduced-preview measurements, not aesthetic or subject judgment. Their agreement with human preferences has not been measured. Noise, intentional blur, line art, and lighting can mislead them; a dark photo is not automatically worse. Face detection and eye-state estimation are not included. HEIC, RAW, TIFF, animated images, and videos are unsupported.

Duplicate hashing is limited to 64 MiB per original and requires Web Crypto. A skipped or unavailable duplicate check does not prevent manual selection or export. Manual groups are preserved on additional imports; Reset manual grouping explicitly rebuilds them.

Images above 100 megapixels or 32,768 pixels on either side are skipped before decoding when the header supplies dimensions, and checked again after decoding. This does not guarantee protection against every malformed image or low-memory device.

The ZIP writer reads bounded chunks for CRC and stores original Blob parts, but the final archive still uses browser-managed memory. It does not provide disk streaming, ZIP64, or split archives. Keep selections below ZIP32 limits (under 65,535 entries and 4 GiB total), and use smaller batches if memory is constrained. Download initiation is not proof that the browser finished writing to disk.

## Single HTML / offline use

Save and open `best-shot-picker.html` or `dist/index.html` directly. All application code, icons, model weights, worker code, and license notices are embedded in both forms. The optional model assets are decompressed only when needed; candidate search requires `DecompressionStream` and Web Workers. If it cannot run, the normal comparison and saving workflow remains available. `dist/index.self-extract.html` is a gzip-wrapped alternative that requires `DecompressionStream` to open and restores the same app.

## Development

Read `AGENTS.md`, `APP_SPEC.md`, `DEVELOPMENT_PLAN.md`, and `ACCEPTANCE_MATRIX.md`. Edit `src/index.template.html`, `src/app.js`, `src/core.js`, `src/grouping.js`, `src/quality.js`, `src/similarity.js`, `src/embedding-worker-client.js`, and `src/embedding-worker.js`; do not edit generated HTML. Pinned model assets and their hash manifest are in `assets/embedding/`.

On Windows, run `build-standalone.bat`. The canonical PowerShell builder generates both variants and the exact root HTML copy. Run PowerShell syntax preflight and `scripts/check-repository.ps1` before completion.

Test tooling requires Node.js 22 or later:

```sh
npm ci
npm test
npm run test:grouping
npx playwright install chromium
npm run test:browser
```

Browser tests use synthetic, non-personal images and open both generated HTML files with `file://`. Test fixtures are project-owned; regenerate them with `python tests/fixtures/generate.py` or `python tests/fixtures/generate-quality.py` and Pillow. No Node/npm tooling is required to use or build the standard Windows app.

## License

The app is MIT-licensed. The optional model feature embeds TensorFlow.js 4.22.0 and Google MobileNet V1 0.25 224 feature vector v2 under Apache-2.0, with preserved third-party notices. The help dialog includes the embedded software and model notices. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

See [grouping design and evaluation limits](docs/GROUPING.md).

See [technical-hint design and evidence limits](docs/QUALITY.md) and the [isolated embedding feasibility experiment](experiments/embedding/README.md).

The frozen-protocol HDR+ holdout is research evidence for this bounded, optional feature, not an accuracy guarantee. Research photographs and evaluation tools are excluded from the distributed app; see [experiment scope and limits](experiments/embedding/README.md#independent-hdr-burst-holdout).
