# Best Shot Picker

[![GitHub Pages](https://github.com/ttomohisa/htmlapps-best-shot-picker/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/ttomohisa/htmlapps-best-shot-picker/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Single HTML](https://img.shields.io/badge/distribution-single%20HTML-0ea5e9)](https://ttomohisa.github.io/htmlapps-best-shot-picker/)

[日本語版 README](README.ja.md)

Compare similar photos, choose your favorites, and save their untouched originals together in a ZIP.

## Live demo

### [Open Best Shot Picker](https://ttomohisa.github.io/htmlapps-best-shot-picker/)

No installation or account is required. The hosted page downloads the initial HTML; photos are then processed in your browser without being uploaded.

[![Best Shot Picker showing photos, comparison, and selected originals](assets/screenshot.en.png)](https://ttomohisa.github.io/htmlapps-best-shot-picker/)

## Features

- **Bring your photos together:** Add JPEG, PNG, and still WebP files, including more photos during a session.
- **Organize similar shots:** Find duplicates and conservative similarity groups; split, merge, move, and undo group edits.
- **Compare the details:** Use large previews, two-photo comparison, 100% / 200% / 400% zoom, and optional face-position zoom.
- **Choose for yourself:** Keep any number of photos, undo the latest selection change, and move through unreviewed groups. Technical hints and optional local-model candidates never choose photos for you.
- **Save the originals:** Export one ZIP or smaller independent ZIPs, with editable output names, collision-safe filenames, and optional JSON/CSV file lists.
- **Work locally in one HTML file:** Japanese/English UI, keyboard controls, and phone-friendly tabs, with embedded code and models for offline use.

## Quick start

### Use online

[Open the app](https://ttomohisa.github.io/htmlapps-best-shot-picker/) in a current Chrome or Edge browser.

### Download and open

1. Download [best-shot-picker.html](https://github.com/ttomohisa/htmlapps-best-shot-picker/blob/main/best-shot-picker.html) using GitHub's **Download raw file** button.
2. Open the saved HTML in your browser and choose **Add photos**.

### Use offline

The saved `best-shot-picker.html` works as a single file with the network disconnected. `dist/index.html` is the same readable app. No installation, local server, Node.js, or build is needed to use it.

The alternative `dist/index.self-extract.html` restores the same app from a gzip wrapper, but requires `DecompressionStream` just to open. Use the readable HTML if it cannot start. To build your own copy, see [Development](#development).

## Usage

1. **Add photos.** Use the file picker, drag and drop, or folder selection where supported. Adding files preserves current Keep choices and manual groups. Unreadable files are listed separately; cancel or retry unfinished photos when needed.
2. **Review and compare.** Open a group or **All photos**, then choose A and B in **Compare**. On a phone, switch A / B; at 100%, 200%, or 400%, scroll within the image. Group thumbnails and technical candidates are viewing aids, not Keep choices. Use **Organize** to adjust groups.
3. **Keep your favorites.** Choose any number, including none in a group. **Next unreviewed group** only navigates; **Mark reviewed and next** records that you have finished the current group, and Undo returns to it. These controls pause during import and analysis.
4. **Save.** Review the kept photos, edit the ZIP filename, and choose **Save originals as ZIP**. Check the browser's downloads and open the saved archive before leaving the page.

### Optional comparison aids

**Find similar-photo candidates** searches at least two automatic, unreviewed groups with completed analysis, totaling at most 36 photos per search. For larger sessions, select whole groups within that limit; a group larger than 36 cannot be searched. Review each proposal before **Apply this grouping**; Undo reverses the latest group edit. Manual/reviewed groups and unselected groups stay protected. Input or group changes, reanalysis, or applying a proposal clear pending candidates. Cancellation or failure leaves existing groups, choices, and originals unchanged.

**Find faces** finds up to six candidate positions per comparison photo. Choose a face independently in each photo to zoom, or return to **Whole image**. Missed or incorrect detections are possible; manual zoom remains available.

Keyboard: arrow keys browse the active comparison photo. Tab into an overflowing image to pan with the arrows instead. Enter toggles Keep when focus is on the page; focused controls keep their usual actions. Esc closes a dialog. Input fields and selectors do not trigger browsing shortcuts.

### Smaller independent ZIPs and file lists

- Choose the optional smaller-ZIP mode and explicitly select 32, 64, 128, 256, or 512 MiB. No capacity is preselected or established as a safe device default.
- Review the sizes and part count. The plan freezes the starting selection, filenames, and output name; later edits affect your collection and the next export, not this plan.
- Prepare only the current ZIP, download it, check the browser's save status, then choose **Saved; next ZIP** or **Saved; finish**. Nothing downloads or advances automatically. Each ZIP opens independently; originals are never cut into pieces.
- Cancellation or failure retries only the current part. Downloading it again warns about duplicate copies. Discarding a prepared/requested part warns because releasing its download link may affect an unfinished download.
- **Save a selected-file list** downloads JSON or CSV separately, never inside the ZIP. It records kept filenames, ZIP destinations, order, and sizes, without EXIF/GPS or model results. Single-ZIP mode uses current choices; batch mode uses the frozen plan. This is a planned-file list, not a download receipt or session backup. JSON preserves exact names; CSV is display-oriented. See the [field and CSV contract](docs/SELECTION_LIST.md).

## Browsers and verification

Designed for current Chrome and Edge on desktop and phones, with Japanese/English layouts at widths of 320px and above. Folder selection depends on browser support.

The owner confirmed on **Android Chrome** that device-saved photos could be saved both as an ordinary ZIP and as smaller independent ZIPs, extracted, and opened. This confirms that reported workflow, not a safe maximum size or all Android devices.

Physical Windows and iPhone operation, Android/iPhone 100/500-photo and PC 1,000-photo loads, peak memory, and real-photo throughput remain unverified or deferred. Automated desktop-engine and synthetic checks are recorded separately in [validation results](docs/VALIDATION.md).

Both optional model features require Web Workers and `DecompressionStream`. The readable HTML retains manual comparison, Keep, and ZIP export without them. API availability alone does not guarantee model startup or completion on every device.

## Privacy

All photo processing stays in the browser. Models start only when requested and are embedded in the HTML; there are no image uploads, runtime APIs, external fonts, analytics, or remote model downloads. The app's Content Security Policy blocks runtime connections with `connect-src 'none'`.

ZIPs preserve original bytes, including **EXIF, GPS location, color profiles, and other metadata**. Check these before sharing. File lists can contain personal information in filenames. The app never overwrites, moves, or deletes your originals.

**Photos, choices, and export plans are temporary.** Reloading, closing the page, or starting over clears them; there is no session restoration. Only language preference may be stored. Finish saving before leaving.

## Limitations and troubleshooting

**v1.0.0 is a scope-limited release of the existing capabilities.** It does not certify every original roadmap target. General photographic accuracy and physical large-load/memory acceptance remain deferred. See the current release scope in [APP_SPEC.md](APP_SPEC.md), [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md), and [ACCEPTANCE_MATRIX.md](ACCEPTANCE_MATRIX.md).

- **File formats:** JPEG, PNG, and still WebP only. HEIC/HEIF, AVIF, RAW, TIFF, animated images, and videos are unsupported. Images above 100 megapixels or 32,768 pixels on either side are skipped; this is not a guarantee against every malformed file or low-memory failure.
- **Grouping and hints:** Default grouping is non-ML; optional local-model search is experimental. Either can miss related photos or group unrelated ones. Technical hints use reduced-preview measurements, not aesthetic or subject judgment; agreement with human preferences is unmeasured. Face detection is a navigation aid, without eye-state estimation, face ranking, or person matching. See [grouping](docs/GROUPING.md) and [technical-hint limits](docs/QUALITY.md).
- **Duplicate checks:** Hashing requires Web Crypto and is limited to 64 MiB per original. A skipped check does not prevent manual selection or export.
- **ZIP size and memory:** Each archive must stay below 65,535 entries and 4 GiB including ZIP overhead. Batch preflight stops if one original plus overhead cannot fit: choose a higher capacity, change the selection, or use single-ZIP mode. The selected capacity limits one archive, not total browser memory. ZIP64, disk streaming, and spanning ZIPs are not included. Download initiation or your saved confirmation does not verify a completed disk write.

### If an original cannot be read during ZIP export

`ZIP_READ_FAILED` means an original could not be read again; a visible thumbnail does not guarantee later access to its original bytes. Download cloud-backed photos to the device, then select those local files in a **separate tab**. Keep the original tab open to preserve its choices; choices do not transfer or restore automatically.

In the reported Android case, originals selected through a cloud provider failed during ZIP reading with `NotReadableError`, while device-saved files succeeded. The exact underlying cause remains unknown. Archive-assembly and download-link failures have separate diagnostics and do not by themselves establish a memory shortage. No photo upload is needed for troubleshooting.

## Development

Read [AGENTS.md](AGENTS.md), [APP_SPEC.md](APP_SPEC.md), and the [architecture guide](docs/ARCHITECTURE.md). Edit `src/` and configuration, never the generated HTML. Pinned models and hash manifests live under `assets/embedding/` and `assets/face-detection/`.

On Windows, run `build-standalone.bat`. It runs PowerShell syntax preflight and builds both HTML variants plus the identical root copy; the first build may download pinned dependencies. Run `scripts/check-repository.ps1` for repository verification. Node/npm are not required for the standard Windows build or app use.

Existing test tooling requires Node.js 22 or later:

```sh
npm ci
npm test
npm run test:grouping
npx playwright install chromium
npm run test:browser
```

Browser tests use project-owned synthetic images and both generated HTML forms through `file://`. See [validation records](docs/VALIDATION.md) for evidence boundaries, and the separate [embedding research](experiments/embedding/README.md) and [manual resource diagnostic](experiments/resource-probe/README.md) for their limited scope.

## License

The app is [MIT-licensed](LICENSE). Embedded TensorFlow.js, MobileNet, and MediaPipe face-detection components carry Apache-2.0 licenses and preserved notices. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md); the in-app help also includes software and model notices.
