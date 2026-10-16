# Isolated offline image-embedding feasibility experiment

> **Current scope — 2026-10-16:** v0.5 product integration is approved only as an explicit, bounded similar-photo candidate search with review, Apply and Undo; default grouping remains non-ML. Earlier “adoption unapproved” or “not integrated” statements below describe their historical research stage. Those evaluations remain unchanged evidence and do not validate the product’s 480px thumbnail preprocessing or physical-phone cost. Product acceptance results must be recorded separately when actually run; this scope update does not claim those checks have passed. See [APP_SPEC.md](../../APP_SPEC.md#19-v05任意候補検索の承認済み実装範囲2026-10-16).

This developer experiment is not included in the distributed Best Shot Picker app, its normal build, Pages, or PR preview. It does not read user photos. The production grouping thresholds stay unchanged, and every Keep choice remains explicit.

## Decision and gates

**Model adoption is not approved.** Four project-authored fixtures test integration, and a licensed 51-photo controlled-lighting pilot now provides narrow photographic evidence. Representative consumer-burst grouping, population false-group risk, the planned 50/200-group corpus, and physical Android/iPhone performance remain unverified. A self-similarity of 1 or successful inference does not demonstrate useful grouping.

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

The measured synthetic candidate is 1,565,843 bytes, about 89% smaller than the 14,130,687-byte MediaPipe harness. This is an isolated harness comparison, not a model-shipped app size. Both default-CSP standalone forms now run CPU inference successfully in CI; detailed results and limits follow below.

Reproduce with `npm run experiment:tfjs:build`, wrap `test-results/embedding-tfjs/index.html` and `photo-pilot.html` using the unchanged canonical PowerShell self-extract builder, then run `npm run experiment:tfjs:test`. CI performs these steps and uploads only JSON evidence and text-only experiment screenshots, not model HTML or original public photos.

### Licensed real-photo pilot and limits

`photo-pilot.json` fixes 51 original published JPEGs: 17 staged object/material scenes under three real lighting directions (0, 12, 24), from [MIT CSAIL's Multi-Illumination dataset](https://projects.csail.mit.edu/illumination/). Authors: Lukas Murmann, Michael Gharbi, Miika Aittala and Fredo Durand (ICCV 2019). The official data section explicitly links all data to [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Files are downloaded only during developer builds and SHA-256 checked; the repository contains provenance and hashes, not the photographs. Published mip3 JPEGs are unmodified, with model resizing performed only in memory.

Scene selection is fixed in source order, with every fifth available staged scene from 16 through 100. Subsequent mannequin-head scenes were excluded during visual screening. The first eight scenes form the development set and the remaining nine are held out. Same-scene labels come from the published scene identifiers, not from consumer preference judgments. All images lack trusted burst-time labels; no capture times are invented.

The pilot compares the unchanged non-ML predicate with cosine-only and a conservative visual-guarded hybrid. A fixed cosine grid is selected on development scenes only: maximize recovered positive pairs subject to zero observed false groups, breaking ties toward the higher threshold. The selected threshold is frozen before evaluating the holdout scenes. Complete-link grouping avoids transitive similarity bridges. Reports retain false-group counts/denominators, pair recall and false joined pairs separately. The Wilson interval is explicitly descriptive: independence of data-dependent predicted groups is not established, so it is not a population confidence bound or evidence for the 1% release gate.

This is a useful real-photograph lighting stress test, not a representative consumer-burst benchmark. It has a static camera, shared calibration objects/backgrounds, few related indoor scenes, and no family, child, pet, outdoor burst, human-preference or physical-phone validation. A held-out gain on this pilot alone cannot authorize shipping a model. The original 50/200-case diversity and false-group/device gates remain open.

Other investigated corpora are not silently substituted: Tanks and Temples' official license page contains contradictory commercial/redistribution clauses despite a CC BY heading; HPatches/LLFF code licenses alone do not establish rights to all external image downloads. Those assets are not used.

### Measured extended result

[Retained measurements and pair evidence](tfjs-results-2026-10-16.json) come from head `65d6bf1`, [CI run 38889459860](https://github.com/ttomohisa/htmlapps-best-shot-picker/actions/runs/38889459860), Chromium 143 on Linux x64. Readable and canonical self-extract `file://` forms both complete CPU inference, including all 51 photos, with identical cosine outputs and evaluation. The invalid model preserves baseline groups. Normal inference has no HTTP(S) requests, intercepted networking attempts, CSP violations or page errors, and disposes all model tensors. Separate negative controls confirm that eval, Function, WASM compilation and network access remain blocked in both forms. No CSP change was needed.

Default WebGL is unavailable on this runner (`HAS_WEBGL=false`, version 0). Separate software-allowed WebGL2 cases succeed in both forms and differ from CPU cosine values by at most 0.000000362. TensorFlow.js's [context policy](https://github.com/tensorflow/tfjs/blob/tfjs-v4.22.0/tfjs-backend-webgl/src/canvas_util.ts) normally rejects major performance caveats; the isolated diagnostic enables its existing software-rendering option. This does not establish hardware-GPU availability or speed. Chromium warns that automatic software fallback is deprecated; no unsafe SwiftShader/browser flag is added. CPU remains the candidate's portable tested path.

On this run, ten synthetic warm CPU inferences had p50/p95 of 99.1/102.9 ms (readable) and 99.4/100.4 ms (wrapped), with about 3.1 ms model initialization. The photo page's CPU warm p50 was 103.5 ms. These are single-run desktop CI observations, not phone performance, and are not a controlled speed comparison with the earlier MediaPipe run. The 51-photo research page is 5,625,176 bytes readable and 5,583,799 bytes wrapped; its public photos account for much of the extra size.

Development-only selection chose cosine threshold 0.85 for both model strategies. It is frozen; the holdout result has not been used to lower it. On the nine held-out scenes (27 photos, 27 same-scene pairs, 324 different-scene pairs):

| Strategy | Recovered same-scene pairs | Mixed-scene groups / all predicted groups | False joined pairs |
| --- | ---: | ---: | ---: |
| Existing conservative no-time baseline | 0 / 27 | 0 / 27 | 0 |
| Cosine only | 27 / 27 | 0 / 9 | 0 |
| Guarded hybrid | 13 / 27 | 0 / 16 | 0 |
| Fixed visual guard without cosine, post-hoc diagnostic | 13 / 27 | 1 / 15 | 1 |

The last row reuses the already fixed visual guard without retuning. It diagnoses model contribution after seeing the initial result; it is not a new confirmatory holdout. The hybrid rejects the guard-only false join (different scenes 56 and 61 under lighting 24, cosine about 0.766) while preserving the recovered pairs. Cosine-only performs best on this narrow pilot, but that is not a basis for choosing a broad production policy. The baseline has no trusted burst timestamps here and intentionally applies its strict no-time thresholds. Do not translate this result into a general accuracy percentage or a demonstrated <1% false-group risk.

**Next gate:** freeze this candidate and protocol, then obtain a new, substantially more diverse labeled scene/burst set plus physical Android/iPhone measurements. Keep existing product grouping and explicit Keep behavior unchanged while collecting that evidence.

## Independent HDR+ burst holdout

The next experiment uses actual first/last frames from Google's [HDR+ Burst Photography Dataset](https://www.hdrplusdata.org/dataset.html), under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). This is a separate corpus, not another split of the MIT lighting data. `burst-holdout.json` fixes source object generations, raw and derivative hashes, scene labels, rendering parameters and selection limitations before inference. Raw photographs and rendered PNGs remain in ignored caches, outside Git, Pages and normal app previews. Derived images retain CC BY-SA 4.0 and full attribution in the isolated HTML; the runtime/model licenses remain separate.

`evaluateFrozen` rejects protocol changes. Cosine 0.85, the existing visual guard and ID-sorted greedy complete-link partitioning are frozen from the earlier pilot; external labels cannot tune thresholds or pick a strategy. Reports expose false mixed-scene groups against both all groups and joined (non-singleton) groups, plus recovered positive pairs and false negative-scene joins. The baseline here is the unchanged non-ML pair predicate under the shared ID-sorted protocol; the app-order baselineGroups/fallbackGroups fields separately test preservation and can have different partitions. These counts do not establish a population false-group bound. A zero joined-group denominator is null, not zero risk.

The bounded acquisition selects the 20 smallest first/last DNG pairs in the curated 153-burst release (279,559,788 raw bytes before any scene-review exclusions). This explicitly biases camera, compression, detail and noise conditions. The frozen final set has 18 bursts / 36 frames (250,789,472 raw bytes), after excluding a second beach view and a second restaurant view that overlap other settings. Burst IDs establish positive pairs; assistant visual scene review establishes provisional cross-burst labels before model inference. This is not independent human ground truth. Raw files are developed with pinned rawpy/LibRaw settings, oriented, converted to 8-bit sRGB and resized to at most 512 pixels. This tests rendered public burst frames, not direct DNG support in the app, and not phone-produced JPEG color processing.

The research harness decodes one image at a time and releases its image source before continuing. It records baseline preparation, model/runtime initialization, per-image inference, decode/yield overhead, pair evaluation, long tasks and limited tensor accounting. Tensor samples are taken after execute/dataSync but before the outer tf.tidy cleanup, so they include retained preprocessing/output tensors. They exclude transient activations, browser caches and native allocations; they are not peak process-memory measurements. The embedded corpus itself also has overhead unlike a production File-based session.

CI runs both `file://` standalone forms, an invalid-model fallback, and a separate 4× CPU-throttled Linux Chromium case at 390×844 CSS pixels. That synthetic stress condition is neither phone emulation nor a phone-speed estimate. Physical Android/iPhone, representative family/pet/action diversity, and the original release gates remain unresolved. No production adoption follows automatically from a favorable result.

Reproduce on Linux x86_64 with Python 3.12 and the normal Node test dependencies:

```sh
python -m pip install -r experiments/embedding/burst-render.requirements.txt
npm run experiment:burst:acquire
npm run experiment:burst:build
pwsh -NoProfile -File scripts/check-powershell-syntax.ps1
pwsh -NoProfile -File scripts/build-self-extract.ps1 -InputPath test-results/embedding-burst/index.html -OutputPath test-results/embedding-burst/index.self-extract.html
npm run experiment:burst:test
```

Acquisition is hash-checked and fails closed if source bytes or rendered derivatives drift. Do not update hashes merely to make CI pass. CI publishes JSON evidence only, not the photographs or research HTML. Results and the adoption decision will be recorded after the exact-commit browser run; implementation of the harness alone is not evidence of successful inference.

### Measured external result and integration decision

[Retained raw pair evidence and cost measurements](burst-results-2026-10-16.json) come from commit `c172517`, [CI run 38932756664](https://github.com/ttomohisa/htmlapps-best-shot-picker/actions/runs/38932756664), Chromium 143.0.7499.4 on Linux x86_64. All 36 source derivatives reproduced exactly in CI. Normal and canonical self-extract `file://` forms completed CPU inference with identical evaluation; the 4× throttled case agreed. Runtime HTTP requests, intercepted network attempts, CSP violations and page errors were zero. The deliberately broken model preserved fixture-order fallback groups and disposed all model tensors. Existing product browser and build regressions also passed.

On 18 positive burst pairs and 612 cross-scene negative pairs, under the fixed ID-sorted comparison protocol:

| Predicate | Recovered burst pairs | Mixed groups / all groups | Mixed groups / joined groups | False joined pairs |
| --- | ---: | ---: | ---: | ---: |
| Unchanged non-ML | 11 / 18 | 0 / 25 | 0 / 11 | 0 |
| Frozen cosine only | 18 / 18 | 0 / 18 | 0 / 18 | 0 |
| Frozen guarded hybrid | 17 / 18 | 0 / 19 | 0 / 17 | 0 |

This is a new, narrow real-burst benefit: the guarded model recovers six additional pairs without an observed false join. The missed pair is the dim ornate interior. It is not a general accuracy claim, a <1% population-risk demonstration, or a basis for switching to cosine-only. No threshold or corpus label was tuned on these outputs.

The readable case measured 424.5 ms baseline preparation, 4.6 ms baseline grouping, 155.5 ms runtime load and 73.4 ms model initialization. Its extra 36-photo decode/inference/yield pass took 5,119.1 ms, with per-image inference p50/p95 of 131.2/142.6 ms. The wrapped case's extra pass took 5,270.1 ms. Under 4× CPU throttling, the extra pass took 23,304.8 ms, with inference p50/p95 of 606.2/727.9 ms. These are phase measurements in an isolated harness, not a controlled product speed ratio or phone benchmark. The 15.5 MB research HTML includes approximately 10.5 MB of public PNG fixture bytes and is not the shipped app or proposed model-only bundle size.

**Integration decision: keep the model out of the product.** The benefit justifies continuing a bounded prototype, but this synchronous main-thread adapter already blocks for materially longer than an interactive frame budget. The Long Task API reported only a subset of these continuations; its logged maxima are incomplete observations, not a worst-case UI pause bound. Retained per-image synchronous timings expose that limitation. Next implementation work should isolate inference in a worker or a genuinely interruptible path and test cancellation, stale-result rejection, manual grouping/Keep preservation and failure recovery before any opt-in product integration. Physical Android/iPhone measurements and broader independent labels remain open gates. Repeating the same favorable corpus is not a substitute.

## Off-main-thread adapter prototype (isolated)

`worker-client.js` owns one Blob worker, one generation and at most one pending request. Runtime source and model bytes come only from the existing hash-pinned embedded assets. Weights and bounded RGB inputs transfer ownership; normalized Float64 vectors transfer back. The CPU tensor preprocessing is unchanged. The worker never receives a photo-session state object, Keep flags, originals, or permission to apply groups.

Cancellation immediately terminates the worker, rejects the current operation, clears listeners/timers and revokes its source URL. It does not wait for synchronous inference to cooperate. Late generation/job responses are ignored. Timeout, initialization failure and message failures close the client; restart requires a fresh instance. Successful completion disposes the model, reports remaining tensors and terminates the worker. Abrupt termination releases the worker realm but cannot provide a post-termination tensor census. The client applies backpressure rather than accumulating pixel buffers.

The separate `worker-build.cjs` produces no product artifacts. Both research forms retain the exact existing CSP, including `connect-src 'none'`, with no `unsafe-eval`, WASM exception, or remote script imports. Browser checks compare all 630 cosine scores and the frozen evaluation against PR #5 evidence, and test real worker cancellation/restart. Unit tests additionally inject late callbacks and resource failures. The same-run baseline and worker harnesses record 16 ms main-thread timer lateness throughout setup/inference; this complements, rather than repairs, incomplete Long Task observations. Throughput, timer lateness, sampled tensor bytes and physical-device memory/latency are distinct measurements. The 4x stress case requests CDP page throttling; effective throttling of the separate worker thread is not independently calibrated, so it must not be interpreted as a calibrated worker slowdown.

After the preceding burst reproduction steps:

```sh
npm run experiment:worker:build
pwsh -NoProfile -File scripts/build-self-extract.ps1 -InputPath test-results/embedding-worker/index.html -OutputPath test-results/embedding-worker/index.self-extract.html
npm run experiment:worker:test
```

This is an implementation gate toward an opt-in feature, not a product integration. Browser measurements and review must be recorded before any adoption decision. Physical Android/iPhone performance, broader independent consumer-photo labels, product generation/state wiring and user-facing opt-in/cancel behavior remain open.

### Worker result: 2026-10-16

`worker-results-2026-10-16.json` retains the evidence from commit `a12bf30b0b149f87618b8abc2beb56af77b6fb0a`, [CI run 38938563741](https://github.com/ttomohisa/htmlapps-best-shot-picker/actions/runs/38938563741), artifact `12061953187`, Chromium 143.0.7499.4 on Linux x64. All 630 cosine scores match the previous frozen main-thread result exactly. The guarded result remains 17/18 positive pairs with zero observed cross-scene joins; this is unchanged evidence, not an additional independent accuracy sample.

In the unthrottled readable case, the 36-photo pass took 5,298.1 ms versus 5,245.7 ms on the same-run main-thread path. Main-thread 16 ms timer lateness p95 changed from 138.8 ms to 0.2 ms (observed maximum 186.5 ms to 49.6 ms). The wrapped worker pass took 5,650.0 ms, with timer-lateness p95 4.0 ms versus 135.2 ms in the wrapped main-thread case. This supports separating inference from UI work; it does not make inference itself faster or establish a worst-case UI latency bound. Raw timer samples were not retained, only the measured summary distribution and sample counts.

Under the page's requested 4x throttle, timer-lateness p95 was 30.6 ms for the worker harness versus 745.2 ms for the main-thread harness. The worker's effective throttle is uncalibrated, so its 6.25 s pass versus 23.83 s must not be described as a same-CPU speedup or phone estimate. Both normal forms passed actual initialization/inference cancellation, restart, zero-pending-job and worker/URL cleanup checks. Graceful disposal reported zero tensors. The 0–0.1 ms cancellation figures measure rejection settlement, not complete native-memory reclamation. Negative controls confirmed worker eval, WASM compilation and network access remained blocked.

**Next bounded product milestone:** an explicitly opt-in suggestions preview, with no automatic group application, a small initial batch limit, one worker/one active input, visible progress/cancel, and a deliberate Apply action. New input, reset or manual group edits must invalidate the suggestion generation; applying suggestions must preserve Keep flags and original ZIP bytes. Unsupported/failed/cancelled inference must return to the existing non-ML experience without partial updates. The initial population must be labeled experimental; physical Android/iPhone performance and broader independently labeled consumer-photo accuracy are still unmeasured, so this evidence does not justify default-on or broad mobile claims. Product wiring and browser acceptance tests are the next implementation, not another threshold-tuning round on this corpus.
