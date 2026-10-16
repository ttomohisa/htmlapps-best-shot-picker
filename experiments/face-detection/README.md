# Optional face-zoom adoption probe

This directory is an isolated evaluation. It is not loaded by the product builder. The candidate is face-position navigation for the current two comparison photos, requested explicitly by the user. Eye state, identity matching, ranking, grouping and Keep decisions are outside scope.

## Pinned candidate

- Existing TensorFlow.js 4.22.0 runtime, pure-JavaScript CPU, disposable worker.
- `@tensorflow-models/face-detection` 1.0.3 public TFJS API, in-memory IOHandler, Tensor3D input.
- Official MediaPipe short-range TFJS version 1, default score threshold 0.5 and NMS IoU 0.3, maxFaces 6. Full-range is a diagnostic comparator, not an automatic fallback.
- Exact code/weight integrity, URLs and separate Apache-2.0 model evidence: `dependencies.json`. Runtime/third-party notices are retained in generated harnesses.
- Exact product CSP, no network access at runtime and no extra eval/WASM permission.

## Gates before product adoption

1. Exact asset provenance, permissions and notices.
2. Actual browser CPU/offline/CSP validation, with negative controls; no inference on the main thread.
3. Cancellation, stale jobs, failures and disposal terminate workers and revoke object URLs. Upstream inference exceptions can retain preprocessing tensors even after detector disposal, so reuse after failure is prohibited.
4. A fixed, lawfully usable photographic evaluation, separate from synthetic technical checks. No threshold tuning on the fixed set.
5. End-to-end comparison coordinates/orientation, manual fallback, keyboard/mobile layout, and original File/Keep/manual groups/ZIP invariants.

No model should be shipped solely because synthetic pixels run successfully. Browser and physical-phone performance are distinct; a CSS mobile viewport or CPU throttling is not a measured phone.

## Development-only photographic evaluation

The Face Research Lab London Set, Lisa DeBruine and Benedict Jones, version 5, is published under CC BY 4.0. Its creators state that all 102 subjects are adults and gave signed consent for lab/web studies with original or altered images. Only image archives and necessary geometric templates are used; demographics and ratings CSVs are excluded. The images are neither product assets nor public repository fixtures.

Sources:
- https://doi.org/10.6084/m9.figshare.5047666.v5
- https://api.figshare.com/v2/articles/5047666/versions/5
- https://debruine.github.io/webmorphR.stim/
- https://creativecommons.org/licenses/by/4.0/

The frozen sample is 12 evenly spaced entries in the sorted official neutral-front archive. Six of those subjects also contribute left-three-quarter and profile photographs: 24 photos, 12 independent subjects, not 24 independent subjects. Approximate face rectangles are annotated by blinded assistant visual inspection; this is not expert human gold. The creator's frontal eye-center templates provide an additional independent geometric check. A useful frontal crop requires IoU ≥0.5 with the approximate rectangle and inclusion of both labelled eye centers. At least 11/12 frontal images must pass. Pose misses and unwanted candidates are reported separately; no tuning or relabelling after results.

The creator also publishes CC0 self-photographs with size/position/rotation/distance variations. Those are separate repeated-person geometry cases, never extra independent accuracy samples. Resizing and derived annotations must be identified in results. This small controlled set cannot establish consumer-photo accuracy, multi-person coverage, demographic parity, or real-phone performance.

One official MediaPipe portrait and its upstream golden box are used only for positive-path regression. The official `vision/BUILD` marks its test-data package Apache-2.0; `external_files.bzl` pins its image hash. An upstream model-derived golden is not independent photographic ground truth.

- https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/testdata/vision/BUILD
- https://github.com/google-ai-edge/mediapipe/blob/master/third_party/external_files.bzl

## Results status

Node VM technical results are separate from browser validation. Both models execute without dynamic string/WASM generation, with normal disposal returning to zero tensors. The short synthetic-inference range was 449–643 ms; full was 2819–3286 ms in the development Node environment. These are not phone estimates or peak-memory measurements. TFJS logical tensor memory is not process-memory reclamation.

The official portrait positive path detected one face at original and resized dimensions with both models, stable tensor counts, and normal disposal to zero. No broad accuracy conclusion follows from that single regression fixture. Browser and frozen photographic results will be recorded after actual execution, not inferred from this probe.

### Fixed photograph result (2026-10-16)

The frozen short-model evaluation completed on Node 24.19.0:

- Frontal: 12/12 useful crops (box IoU ≥0.5 and both creator-labelled eye centers inside), meeting the predeclared ≥11/12 criterion.
- Three-quarter: 6/6 exploratory box matches. Profile: 6/6 exploratory box matches. Eye containment is unassessed for these pose photographs because creator eye labels were unavailable.
- All 24 photos produced exactly one finite, in-bounds candidate; no extra candidates were observed. These are positive single-face images, so this is not a measured negative-image false-positive rate.
- Minimum observed box IoU across this sample: 0.6443. Inference range: 453–589 ms. Input conversion/resizing used Pillow RGB/BILINEAR to a 1024-pixel long edge; browser-canvas parity is not established by this run.
- Live tensors remained at the loaded baseline; normal disposal returned to zero. No network attempts were observed.

Independent review rechecked source/label hashes, original eye points, deterministic sampling and scoring arithmetic. This does not replace expert labels or expand the small controlled evaluation's scope. Actual browser and end-to-end product gates are still required.
