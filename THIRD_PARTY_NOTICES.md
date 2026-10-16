# Third-party notices

Best Shot Picker v0.1.0 has no third-party runtime dependencies, model weights, or WASM assets. The original-byte ZIP writer and synthetic image fixtures are project code under the repository's MIT license.

The app foundation comes from ttomohisa/htmlapps-template (MIT); its copyright and license remain in LICENSE.

Development-only browser tests use Playwright 1.57.0 (Apache-2.0), distributed through npm. Its source and license are at https://github.com/microsoft/playwright/tree/v1.57.0. Chromium installed for test execution is not embedded in or redistributed with the application.

The optional fixture regeneration script uses Pillow. Pillow is not a runtime or build dependency, and no Pillow code is embedded in the distributed HTML.


## Development-only embedding experiment

The distributed Best Shot Picker HTML has no third-party runtime dependency. `experiments/embedding/` is a separate developer experiment and is not included in the app build or deployed preview.

- MediaPipe Tasks Vision 0.10.35: Google / MediaPipe, Apache-2.0. Exact npm tarball and individual JS/WASM SHA-256 values are locked in `experiments/embedding/dependencies.json`.
- MobileNetV3 Small image embedder float32 model v1: MediaPipe; its embedded TFLITE_METADATA license explicitly identifies Apache License Version 2.0. The same manifest records the official model URL and SHA-256.
- The pinned upstream Apache license text is included at `experiments/embedding/LICENSE.Apache-2.0.txt` and embedded in generated experimental HTML. Upstream JS/WASM/model bytes are unmodified; the version-specific byte-loading adapter and test harness are project code.

[Runtime source/license](https://github.com/google-ai-edge/mediapipe/tree/v0.10.35) · [Model overview](https://developers.google.com/edge/mediapipe/solutions/vision/image_embedder)

### Extended TFJS feasibility experiment (development only)

- TensorFlow.js 4.22.0 ES2017 UMD, Apache-2.0. Official npm tarball and exact asset are pinned in `experiments/embedding/tfjs.dependencies.json`.
- Google MobileNet V1 0.25 224 feature-vector TFJS model version 2, Apache-2.0, independently verified from the official Google/Kaggle model-instance metadata (instance 1517, version 1814). Model and runtime are not distributed in the app.
- Included long 4.0.0 (Apache-2.0), seedrandom 3.0.5 (MIT, Copyright 2019 David Bau) and Alea (MIT, Copyright 2010 Johannes Baagøe) notices are preserved in `experiments/embedding/THIRD_PARTY.TFJS.txt`, with the full Apache text in `LICENSE.TensorFlow.js.txt`.
- The research pilot downloads 51 unmodified published JPEGs from Lukas Murmann, Michael Gharbi, Miika Aittala and Fredo Durand, *A Multi-Illumination Dataset of Indoor Object Appearance*, ICCV 2019. Source: https://projects.csail.mit.edu/illumination/ . Image data: CC BY 4.0, https://creativecommons.org/licenses/by/4.0/ . Source URLs, exact hashes and selection are recorded in `photo-pilot.json`. No image files are committed or included in the app; input resizing occurs only during evaluation in memory.
