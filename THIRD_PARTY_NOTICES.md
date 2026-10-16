# Third-party notices

The optional similar-photo candidate and face-position features bundle the pinned runtime and models below. They are used only after the user starts the corresponding feature. The original-byte ZIP writer, synthetic image fixtures, worker adapter and ordinary grouping code are project code under the repository's MIT license. No WASM asset is included.

The app foundation comes from ttomohisa/htmlapps-template (MIT); its copyright and license remain in LICENSE.

Development-only browser tests use Playwright 1.57.0 (Apache-2.0), distributed through npm. Its source and license are at https://github.com/microsoft/playwright/tree/v1.57.0. Chromium installed for test execution is not embedded in or redistributed with the application.

The optional fixture regeneration script uses Pillow. Pillow is not a runtime or build dependency, and no Pillow code is embedded in the distributed HTML.


## Bundled opt-in embedding runtime and model

- TensorFlow.js 4.22.0 ES2017 UMD: Copyright 2024 Google LLC. Apache-2.0. Source: https://github.com/tensorflow/tfjs/tree/tfjs-v4.22.0 . The exact npm tarball is pinned in `dependencies.lock.json`; `dependencies.json` declares the unmodified `dist/tf.es2017.min.js` asset. Its additional reviewed file hash is in `assets/embedding/manifest.json`.
- Google MobileNet V1 0.25 224 feature-vector TFJS model, version 2: Apache-2.0. Source: https://www.kaggle.com/models/google/mobilenet-v1/tfJs/025-224-feature-vector/2 . Google's official Kaggle model-instance metadata identifies instance 1517, version 1814 and Apache 2.0; the evidence URL, upstream archive hash, input/output contract and exact local model/weight hashes are preserved in `assets/embedding/manifest.json`. The unmodified 45,887-byte model JSON and 841,360-byte weights are checked in. They are not downloaded at runtime or silently refreshed during a build.
- Full Apache-2.0 text: `assets/embedding/LICENSE.TensorFlow.js.txt`. Additional bundled long 4.0.0 (Apache-2.0), seedrandom 3.0.5 (MIT, Copyright 2019 David Bau) and Alea (MIT, Copyright 2010 Johannes Baagoe) notices are preserved verbatim in `assets/embedding/THIRD_PARTY.TFJS.txt`.

The runtime, model, license and notices are embedded into both single-HTML release variants. The builder rejects missing files, size changes and SHA-256 mismatches. Runtime and model bytes stay unchanged; the first-party worker adapter explicitly selects CPU execution. Its lexical `WebAssembly` argument is undefined so the bundled long.js JavaScript arithmetic is selected. Global browser WebAssembly and the restrictive Content Security Policy are not changed. TFJS code is never loaded on the main UI thread, and no image, model or embedding is sent to a server.

## Development-only embedding experiment

`experiments/embedding/` contains separate developer harnesses and research records. Those harnesses, research photos, and MediaPipe assets are not included in the app build or deployed preview; the explicitly approved TFJS runtime/model listed above are now also packaged for the opt-in product feature.

- MediaPipe Tasks Vision 0.10.35: Google / MediaPipe, Apache-2.0. Exact npm tarball and individual JS/WASM SHA-256 values are locked in `experiments/embedding/dependencies.json`.
- MobileNetV3 Small image embedder float32 model v1: MediaPipe; its embedded TFLITE_METADATA license explicitly identifies Apache License Version 2.0. The same manifest records the official model URL and SHA-256.
- The pinned upstream Apache license text is included at `experiments/embedding/LICENSE.Apache-2.0.txt` and embedded in generated experimental HTML. Upstream JS/WASM/model bytes are unmodified; the version-specific byte-loading adapter and test harness are project code.

[Runtime source/license](https://github.com/google-ai-edge/mediapipe/tree/v0.10.35) · [Model overview](https://developers.google.com/edge/mediapipe/solutions/vision/image_embedder)

### Extended TFJS feasibility experiment (development only)

- TensorFlow.js 4.22.0 ES2017 UMD, Apache-2.0. Official npm tarball and exact asset are pinned in `experiments/embedding/tfjs.dependencies.json`.
- Google MobileNet V1 0.25 224 feature-vector TFJS model version 2, Apache-2.0, independently verified from the official Google/Kaggle model-instance metadata (instance 1517, version 1814). The research harness is not distributed in the app; the same reviewed runtime/model are now used by the opt-in product feature above.
- Included long 4.0.0 (Apache-2.0), seedrandom 3.0.5 (MIT, Copyright 2019 David Bau) and Alea (MIT, Copyright 2010 Johannes Baagøe) notices are preserved in `experiments/embedding/THIRD_PARTY.TFJS.txt`, with the full Apache text in `LICENSE.TensorFlow.js.txt`.
- The research pilot downloads 51 unmodified published JPEGs from Lukas Murmann, Michael Gharbi, Miika Aittala and Fredo Durand, *A Multi-Illumination Dataset of Indoor Object Appearance*, ICCV 2019. Source: https://projects.csail.mit.edu/illumination/ . Image data: CC BY 4.0, https://creativecommons.org/licenses/by/4.0/ . Source URLs, exact hashes and selection are recorded in `photo-pilot.json`. No image files are committed or included in the app; input resizing occurs only during evaluation in memory.

## Developer-only HDR+ burst evaluation

The isolated external holdout references the HDR+ Burst Photography Dataset by Samuel W. Hasinoff, Dillon Sharlet, Ryan Geiss, Andrew Adams, Jonathan T. Barron, Florian Kainz, Jiawen Chen, and Marc Levoy, “Burst photography for high dynamic range and low-light imaging on mobile cameras,” ACM Transactions on Graphics 35(6), 2016. Official source: https://www.hdrplusdata.org/dataset.html . The data is licensed CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/ . Fixed raw development, orientation, sRGB conversion and downscaling create derived PNGs under the same CC BY-SA 4.0 license. The exact transformation and source/derivative hashes are recorded in `experiments/embedding/burst-holdout.json`.

No source or derived photos are committed or included in the distributed application. Developer-only rawpy 0.25.1 (MIT, with bundled LibRaw notices), NumPy 2.2.6 (BSD-3-Clause), and Pillow 11.3.0 (MIT-CMU) are installed for rendering; no renderer code or native library is bundled in the application or experimental HTML. See their official installed package licenses and upstream projects: https://github.com/letmaik/rawpy , https://numpy.org/ , https://python-pillow.org/ . Model/runtime notices above are independent of dataset permissions.


## Bundled opt-in face-position detector

- @tensorflow-models/face-detection 1.0.3: Copyright 2024 Google LLC, Apache-2.0. Original UMD bundle is pinned and retained under `assets/face-detection/`. Source: https://github.com/tensorflow/tfjs-models/tree/master/face-detection . Exact npm archive, integrity and extracted asset hashes: `assets/face-detection/manifest.json`.
- MediaPipe face-detection short TFJS model version 1: Apache-2.0. Source: https://www.kaggle.com/models/mediapipe/face-detection/tfJs/short/1 . Official Kaggle instance 1324, version 1579, identifies the exact version's license; model JSON and weight hashes are independently pinned. The full-range model is used only by the isolated developer probe and is not bundled in the product.
- Bundled tslib 2.4.0 helpers: Microsoft Corporation, 0BSD. The complete notice is retained in `assets/face-detection/THIRD_PARTY_NOTICES.txt`; full Apache text is also embedded.
- The feature reuses the single TensorFlow.js runtime described above. It adds no MediaPipe WASM runtime, external model download or security-policy exception. Model output is used only for user-selected face zoom, not identification, eye state or photo ranking.

## Development-only face photographs

Face Research Lab London Set, Lisa DeBruine and Benedict Jones, version 5, CC BY 4.0: https://doi.org/10.6084/m9.figshare.5047666.v5 and https://creativecommons.org/licenses/by/4.0/ . Creator metadata describes adult subjects and signed lab/web-study consent. The fixed development evaluation uses resizing and derived approximate face rectangles, recorded in `experiments/face-detection/photo-*`. Attribute these derived annotation/evaluation materials to that source. Photos, demographic/rating CSVs and photo screenshots are not included in the repository, product or public CI artifacts. An explicit CI acquisition step uses the images only on local-file browser pages; none are uploaded to the HTTPS preview.

The official MediaPipe test portrait is a separate positive regression fixture. The `mediapipe/tasks/testdata/vision/BUILD` package declares Apache-2.0 and `third_party/external_files.bzl` pins its image bytes: https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/testdata/vision/BUILD . It is acquired into ignored test cache, never bundled or shown in public test screenshots. Its upstream golden is not an independent accuracy label.
