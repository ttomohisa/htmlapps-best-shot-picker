# Best Shot Picker

Compare photos, choose your favorites, and save their untouched originals together in a ZIP.

[日本語](README.ja.md) · [Open the app](https://ttomohisa.github.io/htmlapps-best-shot-picker/)

![Best Shot Picker showing photos, comparison, and selected originals](assets/screenshot.en.png)

## Features

- Add JPEG, PNG, and still WebP files, including more photos during a session
- Find identical originals and conservative similarity groups; split, merge, move, and undo group edits
- Distinguish JPEG EXIF capture/digitized timestamps from file-modified time
- Browse thumbnails, open a large view, and compare two photos
- Switch A / B on phones; inspect 100%, 200%, or 400% views by scrolling
- Keep any number of photos, with Undo for the latest selection change
- Save original file bytes in a ZIP with an editable filename and collision-safe entry names
- Isolate unreadable files, cancel work, and retry unfinished photos
- Japanese / English, keyboard controls, and narrow-screen page tabs

## How to use

1. Choose **Add photos**, drag files into the drop area, or choose a folder when supported.
2. Review **Photo groups** or **All photos**. Use **Organize** to split, move, merge, or mark a group reviewed. Open a photo for a closer look. In **Compare**, choose photos A and B. **Keep** the ones you want.
3. In **Save**, review your choices and filename, then choose **Save originals as ZIP**.

Arrow keys browse the active comparison photo. Enter toggles Keep when focus is on the page or image; focused buttons keep their usual action. Esc closes a dialog. Input fields and selectors do not trigger browsing shortcuts.

## Privacy

Processing stays inside the browser. There are no image uploads, runtime APIs, external fonts, analytics, or remote AI models. Hosted use downloads the initial HTML. Content Security Policy blocks runtime connections with `connect-src 'none'`.

ZIP entries use the original bytes: EXIF, GPS location, color profiles, and other metadata remain. Check metadata before sharing. Original files on your device are never overwritten, moved, or deleted.

Photos and choices are temporary. Reloading, closing the page, or starting over clears the session. Only language preference may be stored.

## Browsers and devices

Designed for modern Chrome and Edge on desktop and phones. Japanese / English layouts target widths of 320px and above. Folder selection appears only when the browser supports it.

See [validation results](docs/VALIDATION.md) for actual checks. Real Android/iPhone hardware, Safari, Firefox, and Edge-specific validation must not be inferred from Chromium tests.

## Limitations

This is the v0.2 development milestone. Similarity groups can be wrong or miss related photos; they never select photos for you. Real-photo grouping accuracy has not yet been measured. Recommendations, face detection, and eye-state estimation are not included. HEIC, RAW, TIFF, animated images, and videos are unsupported.

Duplicate hashing is limited to 64 MiB per original and requires Web Crypto. A skipped or unavailable duplicate check does not prevent manual selection or export. Manual groups are preserved on additional imports; Reset manual grouping explicitly rebuilds them.

Images above 100 megapixels or 32,768 pixels on either side are skipped before decoding when the header supplies dimensions, and checked again after decoding. This does not guarantee protection against every malformed image or low-memory device.

The ZIP writer reads bounded chunks for CRC and stores original Blob parts, but the final archive still uses browser-managed memory. It does not provide disk streaming, ZIP64, or split archives. Keep selections below ZIP32 limits (under 65,535 entries and 4 GiB total), and use smaller batches if memory is constrained. Download initiation is not proof that the browser finished writing to disk.

## Single HTML / offline use

Save and open `best-shot-picker.html` or `dist/index.html` directly. All application code and icons are embedded. `dist/index.self-extract.html` is a smaller gzip-wrapped alternative requiring `DecompressionStream`; it restores the same app.

## Development

Read `AGENTS.md`, `APP_SPEC.md`, `DEVELOPMENT_PLAN.md`, and `ACCEPTANCE_MATRIX.md`. Edit `src/index.template.html`, `src/app.js`, and `src/core.js`, and `src/grouping.js`; do not edit generated HTML.

On Windows, run `build-standalone.bat`. The canonical PowerShell builder generates both variants and the exact root HTML copy. Run PowerShell syntax preflight and `scripts/check-repository.ps1` before completion.

Test tooling requires Node.js 22 or later:

```sh
npm ci
npm test
npm run test:grouping
npx playwright install chromium
npm run test:browser
```

Browser tests use synthetic, non-personal images and open both generated HTML files with `file://`. Test fixtures are project-owned; regenerate them with `python tests/fixtures/generate.py` and Pillow. No Node/npm tooling is required to use or build the standard Windows app.

## License

MIT. No third-party runtime dependencies. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

See [grouping design and evaluation limits](docs/GROUPING.md).
