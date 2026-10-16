# Changelog

## Unreleased

- Added automatic repository-root HTML generation: normal builds copy `dist/index.html` byte-for-byte to `<repository-name-without-htmlapps-prefix>.html`, and repository checks verify the copy exists and matches.

- Split Cloudflare PR Preview creation and PR-close cleanup into separate workflows so normal Preview runs contain only deployment checks and cleanup runs independently on `closed`.

- Added optional Cloudflare Workers PR Previews using pinned Wrangler 4.135.0, with same-repository secret protection, standalone build verification, Preview probing, stable PR comments, and automatic cleanup when a PR closes.
- Added `wrangler.preview.jsonc` for the shared `bk-previews` static-assets Worker while keeping GitHub Pages as the production publishing path.
- Documented the required `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets and the fact that template-created repositories must configure them individually.

## 1.3.0 - Build preflight, canonical app icon, and mobile help hardening - 2026-09-06

- Added `scripts/check-powershell-syntax.ps1` and run it before local / CI builds to catch parser errors before repository checks.
- The preflight also rejects BOM-less PowerShell source containing non-ASCII bytes, preventing Windows PowerShell 5.1 mojibake from turning localized strings into syntax failures.
- Added `assets/favicon.svg` as the canonical icon source. The readable build now embeds the exact same SVG payload for both the browser favicon and upper-left application brand icon, and verification rejects drift between them.
- Reworked the help dialog into a viewport-bounded flex layout with a dedicated scroll body and safe-area-aware bottom padding so long Japanese / English help remains reachable on smartphones.
- Documented `Set-StrictMode` collection normalization (`@(...)` before `.Count`) and expanded release / offline checks for the new guardrails.
- Kept canonical favicon/header-icon verification mandatory for real standalone builds while allowing explicitly marked synthetic verifier fixtures to omit product chrome.

## 1.2.2 - WebRTC DataChannel-ready connection gate - 2026-09-01

- Application `onConnected` now waits for both PeerConnection `connected` and the designated readiness DataChannel `open`.
- Added `readyChannelLabel` / `requireReadyChannelOpen` for custom DataChannel layouts.
- Added repository regression checks for the readiness contract.
- Updated bilingual WebRTC/component/template guidance.

## 1.2.1 - Dependency update check collection fix - 2026-08-31

- Fixed dependency collection normalization in `check-dependency-updates.ps1`, `sync-dependency-lock.ps1`, and `update-dependency.ps1`; an empty `dependencies.json` now remains a zero-length array under `Set-StrictMode` instead of becoming `$null`.
- Added repository regression coverage for both zero dependencies and a single disabled dependency without making npm network requests.

## 1.2.0 - Dependency lifecycle and Issue-based update monitoring - 2026-08-29

- Added committed `dependencies.lock.json` tarball SHA-256 locking and build-time mismatch rejection.
- Added `patch` / `minor` / `major` / `manual` dependency update policies without allowing scheduled jobs to change source automatically.
- Added local PowerShell commands to check updates, synchronize lock entries, and apply a reviewed update with asset validation, standalone build verification, and config/lock rollback on failure.
- Added a weekly GitHub Actions workflow that creates or refreshes one dependency maintenance Issue, closes it when no tracked updates remain, and never creates an automatic dependency pull request.
- Added bilingual dependency lifecycle documentation and updated security, architecture, contributor, README, and LLM guidance.

## 1.1.0 - Reusable fully serverless WebRTC QR pairing - 2026-08-29

- Added `components/webrtc-qr-pairing.html`, a reusable host/joining-device pairing UI and controller based on the connection flow hardened in Wireless Sensor v1.0.0.
- Added manual QR/copy signaling with `iceServers: []`, complete ICE gathering before QR generation, candidate diagnostics, stale-attempt cleanup, and delayed joining-side Answer creation.
- Added low-resolution camera handling, native `BarcodeDetector` with embedded `jsQR` fallback, chunked QR transfer, and pre-connect Answer regeneration.
- Added `examples/dependencies.webrtc-qr.json` with pinned `qrcode-generator` and `jsqr` assets for the standalone build pipeline.
- Added bilingual WebRTC pairing documentation, custom DataChannel hooks, protocol-prefix customization, privacy wording, limitations, and real-device release tests.
- Updated template guidance so future apps reuse the canonical WebRTC pairing component instead of rebuilding manual signaling from scratch.

## 1.0 - Smartphone bottom-tab page switching - 2026-08-24

- Extended `components/mobile-bottom-bar.html` with a canonical mobile page-tab mode using `data-mobile-page-target`.
- Added `.app-mobile-page` / `.is-mobile-active` behavior: smartphones show only the selected page while desktop keeps every section in normal document flow.
- Added `showPage()` / `currentPage()` APIs so app workflows can switch tabs programmatically.
- Kept the existing section-scroll (`data-mobile-target`) and workflow-action (`data-mobile-action`) modes for backward compatibility.
- Updated LLM/product guidance to prefer bottom-tab page switching for long smartphone tools that naturally divide into 3-5 groups.

## 1.0 - Browser-Kitty UX and asset pipeline hardening - 2026-08-20

- Removed the second Base64 layer around the complete embedded asset bundle; asset payloads are now Base64-encoded exactly once.
- Added per-asset `none` / `gzip` / `auto` compression, async decompression APIs, and per-asset original/stored byte metadata.
- Added `build-size-report.json` plus configurable warning-only readable/self-extract size budgets.
- Added reusable Toast + Undo, compact popover menu, preset + custom numeric setting, and async source-generation/state components.
- Updated starter export UX with a user-editable output filename, fixed extension handling, invalid-character sanitization, and fallback naming.
- Added template rules for source-change invalidation, stale async result rejection, explicit heavy-processing phases, mobile preview/control proximity, portrait media geometry/orientation, and compact advanced settings.
- Added finished-app README guidance and repository checks for the new components and asset-bundle contract.


## 1.0 - Reusable mobile bottom navigation / action bar - 2026-08-19

- Added `components/mobile-bottom-bar.html` as the canonical fixed smartphone navigation / workflow action pattern.
- Added safe-area-aware 3-5 item layout, icon + label controls, native disabled states, section scrolling, active-section tracking, and application action hooks.
- Documented when to use a bottom bar versus an in-flow primary button, including the pattern of enabling Save / Share only after a valid result exists.
- Updated LLM guidance, product UX guidance, bilingual README files, and repository checks so future apps discover and reuse the component instead of rebuilding it ad hoc.

## 1.0 - Portable PowerShell build verification - 2026-08-17

- Removed the builder's dependency on `Get-FileHash` and now calculate file SHA-256 hashes through the .NET cryptography API.
- Replaced `::new()` constructor syntax in self-extract build/verification scripts with older-compatible construction syntax.
- Changed standalone placeholder verification to reject only the real build placeholders instead of every `__UPPERCASE__` runtime identifier.
- Added repository regression guards so future template changes cannot reintroduce `Get-FileHash`, `::new()`, or the generic placeholder false positive.

## 1.0 - Self-extract loader robustness - 2026-08-17

- Made `scripts/build-self-extract.ps1` ASCII-only so Windows PowerShell 5.1 cannot corrupt Japanese loader text when the script is stored as BOM-less UTF-8.
- Encoded non-ASCII loader copy and application titles into ASCII-safe HTML character references / JavaScript Unicode escapes.
- Inherited the embedded favicon from the normal standalone HTML into `dist/index.self-extract.html`.
- Added regression checks for ASCII-only loader output, embedded favicon presence and exact favicon inheritance, and the existing byte-for-byte gzip payload restoration.
- Added a repository guard that rejects non-ASCII text in the self-extract builder source.

## 1.0 - Reusable mobile confirmation component - 2026-08-15

- Added `components/confirm-dialog.html`, a dependency-free Promise-based confirmation dialog.
- Added centered desktop and safe-area-aware smartphone bottom-sheet presentations.
- Added destructive-action styling, backdrop/Esc cancellation, keyboard focus handling, and focus restoration.
- Integrated the confirmation component into the starter Clear action as the recommended pattern.
- Added bilingual reusable-component documentation and updated LLM guidance to prefer it over `window.confirm()`.

## 1.0 - Self-extracting build - 2026-08-05

- Added `dist/index.self-extract.html`, generated by gzip-compressing the normal standalone HTML.
- Added native browser restoration with `DecompressionStream`, no runtime dependency, and no network access.
- Added byte-for-byte payload verification, size/hash manifest, CI artifact upload, and documentation.
- Kept `dist/index.html` as the default GitHub Pages entry point.

## 1.0 - Pages setup fix - 2026-08-05

- Prevented the first GitHub Actions run from failing when GitHub Pages has not been enabled yet.
- Added a Pages preflight check and a clear workflow summary with the one-time setup steps.
- Kept the generated standalone HTML available as a normal Actions artifact even when deployment is skipped.

## 1.0 - 2026-08-05

- Promoted the template to version 1.0.
- Removed the filled backgrounds and borders from the header language and help controls.
- Kept the compact bilingual help dialog and the PDF Organizer-inspired light interface.
- Added LLM guidance requiring help content to stay synchronized with application behavior.

All notable changes to this template are documented here.

## 0.3.0 - 2026-08-05

- Added a compact upper-right help button modeled after PDF Organizer.
- Added a bilingual native dialog for usage, privacy, limitations, and offline notes.

## [0.1.0] - 2026-08-04

### Added

- Generic single-HTML builder with exact npm package and asset embedding.
- SHA-256 dependency manifest.
- Runtime no-network Content Security Policy.
- Responsive bilingual starter interface with local persistence and export.
- GitHub Actions for build validation and GitHub Pages deployment.
- LLM implementation contract, product specification, architecture, and workflow guides.
