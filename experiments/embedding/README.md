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

## Extended smaller-runtime comparison

The initial MediaPipe result is not the end of the investigation. A separate candidate uses the official TensorFlow.js 4.22.0 ES2017 browser bundle and Google MobileNet V1 0.25 224 feature-vector TFJS model version 2. The model weights have their own Apache-2.0 evidence from the exact Google/Kaggle model instance, independently of the runtime. Hashes, artifact endpoints and input/output contracts are in `tfjs.dependencies.json`; the source audit is retained in `tfjs-research.json`.

This candidate uses only CPU/WebGL inference and in-memory model loading. The unmodified bundle includes long.js's optional tiny WASM arithmetic accelerator. A lexical `WebAssembly = undefined` parameter around that one UMD invocation selects its existing JavaScript fallback; global WebAssembly remains unchanged. The canonical self-extract builder and both default/product CSPs are unchanged. Tests must demonstrate that JavaScript `eval`, `Function`, WASM compilation and network access remain blocked. The legacy non-ES2017 bundle is deliberately avoided because its regenerator fallback can call `Function`.

Full Apache-2.0 and the bundled seedrandom/Alea MIT notices are embedded in each experimental file. `LICENSE.TensorFlow.js.txt` and `THIRD_PARTY.TFJS.txt` retain the upstream texts. No TensorFlow.js runtime, model, public photo or experimental page is added to the app, normal PR preview or Pages.

The local synthetic candidate builds to about 1.57 MB, compared with the earlier roughly 14.1 MB MediaPipe harness. This is a build-size result, not yet a device-speed or photographic-quality result. The first extended browser/held-out evaluation is pending CI.

Reproduce with `npm run experiment:tfjs:build`, wrap `test-results/embedding-tfjs/index.html` and `photo-pilot.html` using the unchanged canonical PowerShell self-extract builder, then run `npm run experiment:tfjs:test`. CI performs these steps and uploads only JSON evidence and text-only experiment screenshots, not model HTML or original public photos.

### Licensed real-photo pilot and limits

`photo-pilot.json` fixes 51 original published JPEGs: 17 staged object/material scenes under three real lighting directions (0, 12, 24), from [MIT CSAIL's Multi-Illumination dataset](https://projects.csail.mit.edu/illumination/). Authors: Lukas Murmann, Michael Gharbi, Miika Aittala and Fredo Durand (ICCV 2019). The official data section explicitly links all data to [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Files are downloaded only during developer builds and SHA-256 checked; the repository contains provenance and hashes, not the photographs. Published mip3 JPEGs are unmodified, with model resizing performed only in memory.

Scene selection is fixed in source order, with every fifth available staged scene from 16 through 100. Subsequent mannequin-head scenes were excluded during visual screening. The first eight scenes form the development set and the remaining nine are held out. Same-scene labels come from the published scene identifiers, not from consumer preference judgments. All images lack trusted burst-time labels; no capture times are invented.

The pilot compares the unchanged non-ML predicate with cosine-only and a conservative visual-guarded hybrid. A fixed cosine grid is selected on development scenes only: maximize recovered positive pairs subject to zero observed false groups, breaking ties toward the higher threshold. The selected threshold is frozen before evaluating the holdout scenes. Complete-link grouping avoids transitive similarity bridges. Reports retain false-group counts/denominators, pair recall and false joined pairs separately. The Wilson interval is explicitly descriptive: independence of data-dependent predicted groups is not established, so it is not a population confidence bound or evidence for the 1% release gate.

This is a useful real-photograph lighting stress test, not a representative consumer-burst benchmark. It has a static camera, shared calibration objects/backgrounds, few related indoor scenes, and no family, child, pet, outdoor burst, human-preference or physical-phone validation. A held-out gain on this pilot alone cannot authorize shipping a model. The original 50/200-case diversity and false-group/device gates remain open.

Other investigated corpora are not silently substituted: Tanks and Temples' official license page contains contradictory commercial/redistribution clauses despite a CC BY heading; HPatches/LLFF code licenses alone do not establish rights to all external image downloads. Those assets are not used.
