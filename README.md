# Best Shot Picker

[![GitHub Pages](https://github.com/ttomohisa/htmlapps-best-shot-picker/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/ttomohisa/htmlapps-best-shot-picker/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Single HTML](https://img.shields.io/badge/distribution-single%20HTML-0ea5e9)](https://ttomohisa.github.io/htmlapps-best-shot-picker/)

[日本語版 README](README.ja.md)

Compare similar photos, choose your favorites, and save their untouched originals in a ZIP, all in one local-processing HTML app.

## 🚀 Live demo

### [Open Best Shot Picker](https://ttomohisa.github.io/htmlapps-best-shot-picker/)

No installation or account is required. After the initial HTML loads, photos are processed in your browser without being uploaded.

[![Best Shot Picker showing comparison and selected photos](assets/screenshot.en.png)](https://ttomohisa.github.io/htmlapps-best-shot-picker/)

## Features

- **Bring photos together:** Add JPEG, PNG, and still WebP files, including more during a session.
- **Organize similar shots:** Review duplicate/similarity groups, then split, move, merge, or undo changes.
- **Compare details:** Use A/B previews, 100% / 200% / 400% zoom, and optional face-position zoom.
- **Choose for yourself:** Keep any number of photos and work through unreviewed groups. Hints never choose for you.
- **Save the originals:** Export one ZIP or smaller independent ZIPs, with optional JSON/CSV file lists.
- **Use one HTML file:** Japanese/English UI, phone-friendly tabs, and embedded code/models for offline use.

## Quick start

### Use the web demo

[Open the app](https://ttomohisa.github.io/htmlapps-best-shot-picker/) in a current Chrome or Edge browser.

### Download and use offline

1. Open [best-shot-picker.html](https://github.com/ttomohisa/htmlapps-best-shot-picker/blob/main/best-shot-picker.html) and choose GitHub's **Download raw file**.
2. Open the saved HTML in your browser. It works offline without installation or a local server.

### Build your own copy

On Windows, download or clone this repository and run `build-standalone.bat`. It generates `dist/index.html`, the identical root copy, and `dist/index.self-extract.html`. The first build may download pinned dependencies. Node.js is not needed to build or use the app.

## Usage

1. **Add photos.** Choose files, drag them in, or select a folder where supported. Adding more preserves your choices.
2. **Compare.** Open a photo or choose A and B. On a phone, switch with A / B. Use **Organize** to adjust groups.
3. **Keep favorites.** Select as many as you want. Undo reverses the latest change. **Next unreviewed group** only moves; **Mark reviewed and next** records completion.
4. **Save.** Review your choices, edit the ZIP name, and save. Open the downloaded ZIP before leaving the page.

### Saving options

For smaller downloads, choose **Smaller ZIPs**, a capacity, and review the plan. Prepare and download one ZIP at a time; confirm it saved before continuing. Each opens independently. Later Keep changes require a new plan.

Optional JSON/CSV lists are separate files, not download receipts or session backups. Filenames can contain personal information. [File-list details](docs/SELECTION_LIST.md).

### Comparison aids and keyboard

Similar-photo search accepts at least two automatic, unreviewed groups, up to 36 photos. Review candidates before applying them. **Find faces** lets you choose a detected position to zoom in; it does not identify people or judge open eyes.

| Key | Action |
| --- | --- |
| ← / → | Browse the active photo |
| Enter | Keep / unkeep when focus is on the page |
| Esc | Close a dialog |
| Tab into an enlarged image, then arrow keys | Pan within the image |

Focused inputs and controls keep their normal actions.

## Development and publishing

Edit `src/` and configuration, then rebuild; do not edit generated HTML. Run `scripts/check-powershell-syntax.ps1` and `scripts/check-repository.ps1` for build verification. Existing Node.js 22+ tests use `npm ci`, `npm test`, and `npm run test:grouping`; browser checks are described in [validation](docs/VALIDATION.md).

The included GitHub Pages workflow rebuilds and publishes `main` automatically. See [architecture](docs/ARCHITECTURE.md), [app specification](APP_SPEC.md), and [contributing](CONTRIBUTING.md) for development details.

## Privacy

- Photos and models are processed locally. No image uploads, analytics, or remote AI calls; runtime connections are blocked by CSP.
- ZIPs preserve original bytes, including **EXIF, GPS location, and other metadata**. Check them before sharing. Original files are never overwritten or deleted.
- **Reloading, closing the page, or starting over clears photos and choices.** There is no session restore; save before leaving. Only language preference may be stored.

## Limitations

- JPEG, PNG, and still WebP only. HEIC/HEIF, AVIF, RAW, TIFF, animated images, and video are unsupported.
- Grouping, technical hints, and optional model results can be wrong. Inspect the originals and make the final choice yourself.
- Large images or ZIPs can exhaust device memory. Use fewer photos or smaller ZIPs; no capacity guarantees memory safety. ZIP64 and disk streaming are not supported.
- Cloud-selected originals may become unreadable. Download them to the device and select local files in a **separate tab**; keep the original tab open to preserve its choices.
- Optional searches need Web Workers and `DecompressionStream`. The self-extracting HTML also needs `DecompressionStream` to open; use the readable HTML if it cannot start.
- Android Chrome local-photo saving and opening were confirmed for both ZIP modes. Physical Windows/iPhone use, large real-device loads, and broad photo accuracy remain unverified. [Scope and verification details](docs/VALIDATION.md).

## License and dependencies

The app is [MIT-licensed](LICENSE). Embedded TensorFlow.js, MobileNet, and MediaPipe face-detection components use Apache-2.0 licenses with preserved notices. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md); bundled notices are also available in the app's help.
