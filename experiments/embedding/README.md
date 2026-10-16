# Isolated offline image-embedding feasibility experiment

This developer experiment is not included in the distributed Best Shot Picker app, its normal build, Pages, or PR preview. It does not read user photos. The production grouping thresholds stay unchanged, and every Keep choice remains explicit.

## Decision and gates

**Model adoption is not approved.** The four project-authored landscape/texture fixtures exercise integration, not photographic quality. Human-labeled photographic grouping improvement, false-group rate, the planned 50/200-group corpus, and physical Android/iPhone performance remain unmeasured. A self-similarity of 1 or successful inference does not demonstrate useful grouping.

The experiment records existing non-ML decisions and cosine values for the same fixtures, initialization time, first/warm inference times, build sizes, invalid-model fallback, and both standalone forms. It does not relax grouping or select photographs. If the canonical self-extract wrapper's CSP blocks WASM, the report retains that adoption blocker rather than claiming success. No broad `unsafe-eval` or production CSP change is introduced.

## Pinned inputs and licensing

`dependencies.json` records exact URLs, versions and SHA-256 hashes. The build refuses changed package, JS/WASM, model or license bytes before embedding them. There are no `latest` URLs.

- `@mediapipe/tasks-vision` 0.10.35, Apache-2.0; SIMD and scalar classic loader/WASM pairs.
- MobileNetV3 Small image embedder float32 v1, 4,117,670 bytes, input 224×224 RGB, output 1,024 values. Its embedded TFLITE_METADATA identifies author MediaPipe and Apache License Version 2.0 independently of the runtime license.
- Upstream license text and source attribution are included in the generated experimental HTML. Original runtime and model assets are unmodified.

Official sources: [web guide](https://developers.google.com/edge/mediapipe/solutions/vision/image_embedder/web_js), [model overview](https://developers.google.com/edge/mediapipe/solutions/vision/image_embedder), [pinned graph runner](https://github.com/google-ai-edge/mediapipe/blob/v0.10.35/mediapipe/web/graph_runner/graph_runner.ts), [pinned runtime license](https://github.com/google-ai-edge/mediapipe/blob/v0.10.35/LICENSE).

## Privacy and compatibility boundary

All assets are downloaded only by the developer build, verified, gzip-compressed and embedded once. At execution, `modelAssetBuffer` supplies weights and the version-pinned `Module.wasmBinary` adapter supplies WASM bytes. Empty loader paths prevent URL-based script loading. The adapter depends on internal MediaPipe/Emscripten behavior and must be revalidated for any version change.

The experimental page retains `connect-src 'none'` and permits only narrow WASM compilation with `wasm-unsafe-eval`. Network APIs are intercepted before runtime initialization, browser routing aborts HTTP(S), and tests inspect attempts, requests, CSP violations and page errors. CPU inference may still require the browser's WebGL image-input path; initialization failure is recorded while non-ML grouping stays usable.

The October 16 audit found no logger plumbing or telemetry endpoint in the pinned 0.10.35 JS, but this static result is not a proof of every execution path. The separate 1.1.1 release declares metrics transmission and contains a logging endpoint. No public disable option was identified. This is why this experiment pins the audited version rather than silently upgrading; do not describe MediaPipe in general as telemetry-free. [Official task privacy notice](https://developers.google.com/edge/mediapipe/solutions/tasks).

## Reproduce

After the normal test dependencies are installed:

```sh
npm ci
npx playwright install chromium
npm run experiment:embedding:build
pwsh -NoProfile -File scripts/check-powershell-syntax.ps1
pwsh -NoProfile -File scripts/build-self-extract.ps1 -InputPath test-results/embedding/index.html -OutputPath test-results/embedding/index.self-extract.html
npm run experiment:embedding:test
```

The generated files stay under ignored `test-results/embedding/`, and downloaded assets under ignored `.cache/embedding-evaluation/`. CI publishes only JSON measurements and actual test-page screenshots, not the large experimental model HTML. Browser evidence distinguishes readable SIMD/scalar, a deliberately broken model, and the canonical self-extract wrapper. See [validation](../../docs/VALIDATION.md) for completed results and limitations.

## Recorded decision (October 16, 2026)

[The retained CI measurements](results-2026-10-16.json) from head `159beb1` show readable `file://` inference works in both SIMD and scalar Chromium paths, with no HTTP(S) requests, intercepted network attempts, page errors or CSP violations. The deliberately invalid model preserves the baseline groups. The canonical self-extract wrapper builds successfully in CI but **blocks WASM compilation with its outer CSP**; fallback groups remain intact. This is an observed model-adoption blocker.

The experiment is 14,130,687 bytes readable and 14,170,041 bytes wrapped, compared with the model-free application's roughly 170 KB / 70 KB. Four synthetic images are too few to justify this size or change grouping. On this one Linux x64 CI Chromium run, initialization was about 304 ms; ten warm inferences had p50/p95 of 5.5/7.9 ms SIMD and 14.1/14.6 ms scalar. These are runner measurements, not phone performance or throughput guarantees. The two intended synthetic pairs already pass non-ML grouping, so these results demonstrate no additional grouping benefit.

Subsequent checks also record baseline image-decode/feature-preparation and grouping time separately, and assert SIMD/scalar cosine agreement. Those timings measure different phases and must not be presented as a controlled end-to-end speedup. Keep the production model excluded until the wrapper, real-photo benefit, false-group and physical-device gates are resolved.
