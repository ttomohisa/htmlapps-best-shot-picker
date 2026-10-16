# APP_SPEC.md

This file is the product contract for the application created from this template. Replace the starter specification below before asking an LLM to build a new product.

## 1. Product identity

- **Working name:** Single HTML App Starter
- **One-sentence purpose:** Demonstrate the template's local-first, responsive, bilingual, single-file application foundation.
- **Primary users:** Developers and LLM coding agents starting a new browser utility.
- **Release artifacts:** `dist/index.html`, `dist/index.self-extract.html`, and a repository-root copy of the readable build named from `repository.name` with a leading `htmlapps-` removed

## 2. Problem and outcome

The starter must make the repository's constraints visible and testable without pretending to be a finished end-user product. A user can enter text, see basic counts, copy it, save it, and persist it locally.

A successful replacement app should state here:

- What concrete problem it solves.
- Who experiences the problem.
- What result the user gets in one session.
- Why a local single-HTML implementation is useful.

## 3. Core user flow

1. Open the page locally or through GitHub Pages.
2. Enter or paste text.
3. See character, word, and line counts update immediately.
4. Edit the suggested output filename, then copy or download the text.
5. Use Clear or Restore sample and undo the reversible change from the toast when needed.
6. Reload and recover the locally saved text.

## 4. Functional requirements

- Provide a responsive text area.
- Calculate Unicode-aware character count.
- Calculate approximate word and line counts.
- Copy text with a compatibility fallback.
- Download UTF-8 plain text with a user-editable output filename and a predictable `.txt` extension.
- Save the current text in local storage when available.
- Use the reusable `AppToast.show()` Undo pattern for reversible Clear / Restore sample operations. Reserve `AppConfirm.ask()` for irreversible or high-risk actions.
- Switch Japanese and English without reloading.
- Use a light-only interface; do not add a dark-mode or theme switcher.
- Expose build version, generation timestamp, and embedded dependency count.

## 5. Data and privacy

- Input text remains in browser memory and local storage.
- The app performs no runtime network request.
- There is no server-side storage, login, analytics, telemetry, or tracking.
- Download occurs only after a user action.

## 6. Non-goals

- Collaborative editing.
- Cloud synchronization.
- Rich text formatting.
- Server-side conversion.
- Account management.

## 7. UX and accessibility

- Mobile-first responsive layout from 320px upward.
- All controls have visible labels or accessible names.
- Keyboard focus is visible.
- Motion respects `prefers-reduced-motion`.
- Reversible changes provide a visible Undo action in the reusable toast.
- Irreversible or high-risk destructive actions use the reusable confirmation component, centered on desktop and presented as a safe-area-aware bottom sheet on smartphones.
- Status messages use an `aria-live` region.
- If the finished app needs persistent smartphone access to 3-5 sections or workflow actions, reuse `components/mobile-bottom-bar.html` rather than inventing another fixed bottom bar. For long multi-section tools, prefer its mobile page-tab mode (`data-mobile-page-target`) so tapping a bottom tab shows only that group on smartphones while desktop still shows all sections. Keep unavailable actions disabled until their prerequisites exist.

## 8. Performance expectations

- Initial UI should become interactive without network access.
- Input updates should remain smooth for at least 100,000 characters on a typical desktop browser.
- Avoid rebuilding large DOM sections on every keystroke.

## 9. Browser target

Current stable desktop and mobile versions of Chromium, Firefox, and Safari. Direct `file://` opening is required.

## 10. Acceptance criteria

- `build-standalone.ps1` produces the readable HTML, a gzip self-extracting variant, and an exact repository-root copy named from `repository.name` with a leading `htmlapps-` removed (for example `htmlapps-tap-counter` → `tap-counter.html`).
- Embedded asset bytes are Base64-encoded exactly once; the complete asset-bundle JSON is not wrapped in a second Base64 layer.
- Assets configured with `gzip` / `auto` can be read through the async embedded-asset API, and the build writes `build-size-report.json`.
- `scripts/verify-standalone.ps1` passes.
- The self-extract loader is ASCII-only, inherits the embedded favicon from the readable HTML, and restores the source HTML byte-for-byte.
- The generated HTML contains no unresolved build placeholder.
- The generated HTML contains no external script, stylesheet, frame, module import, or CSS asset URL.
- Runtime CSP includes `connect-src 'none'`.
- The full core user flow works after opening either generated HTML directly.
- No data leaves the page.
- Japanese and English copy both fit at 360px width.
- Clear happens immediately but offers Undo for long enough to recover the previous text.
- The output filename can be edited before download; invalid filename characters are sanitized and an empty name falls back to the app slug.

## 11. Open decisions for a new app

Replace these with explicit decisions before implementation:

- Maximum accepted input size.
- Supported input file types.
- Export file formats, default filename, editable filename behavior, sanitization, and extension rules.
- Persistence strategy and reset behavior.
- Undo/redo scope.
- Error and recovery behavior, including stale async-result invalidation when inputs can change during processing.
- Explicit async phases (`empty`, `ready`, `loading-runtime` if needed, `processing`, `result`, `error`) for heavy processing apps.
- Mobile relationship between previews and their directly related controls.
- Smartphone navigation model: bottom-tab page switching, section-scrolling bottom bar, workflow-action bar, or no fixed bottom bar.
- Media coordinate/orientation strategy when drawing overlays.
- Required third-party libraries.
- Whether the app intentionally needs peer-to-peer WebRTC. If so, decide whether the fully serverless same-LAN QR pairing component is appropriate, what DataChannels are required, and how paired-device data is described to users.
- Whether bilingual UI is required.

## In-app help

The upper-right header includes a compact help button. It opens a bilingual “使い方と注意事項” dialog containing:

- the real user workflow,
- privacy and local-processing behavior,
- limitations and data-loss risks,
- any browser or device constraints relevant to the app.

Acceptance criteria: help content is updated together with each user-facing behavior change, contains no leftover starter instructions, and remains fully scrollable at narrow smartphone widths / short viewport heights so the final item and close control are always reachable.

## WebRTC readiness requirement

When an app uses peer-to-peer WebRTC DataChannels, define which reliable channel represents application readiness. Custom channel layouts must set `readyChannelLabel`; do not define application-ready from ICE/PeerConnection `connected` alone.
