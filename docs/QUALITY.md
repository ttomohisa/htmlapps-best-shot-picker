# Relative technical hints (v0.3 development)

## Scope

A comparison candidate is optional evidence to inspect, not a kept photo, aesthetic judgment, best expression, face score, or detected blur cause. No absolute quality score is shown. The user chooses every original for export. Original bytes, group order and A/B selections do not change when a candidate appears.

`src/quality.js` provides pure `measure(rgba, width, height)` and `recommend([{ id, metrics }])` helpers. Configuration version `relative-detail-v1` defines conservative engineering thresholds; none is a calibrated photographic-accuracy claim.

## Measurements

The application sequentially resamples each existing oriented thumbnail to a common 160-pixel long edge, preserving aspect ratio and never upscaling. A temporary RGBA canvas is released after each measurement. Alpha is composited onto white for numeric stability, while meaningful transparency causes abstention. Export does not use this canvas.

Luminance is binomial-smoothed before Sobel gradient energy is calculated and normalized by luminance variance. Near-white (≥250/255) and near-black (≤5/255) luminance fractions are reported. These are pixel proportions, not proof that an exposure was wrong. Dark-pixel fraction never independently lowers a ranking. An 8×8 spatial/color summary, four-by-four local detail and smoothing residual support conservative comparison guards.

## Abstention and reasons

All members must have compatible, complete, versioned metrics. Dimension/aspect, coarse spatial/color and mean-light/chroma differences can suppress comparison even after a manual merge. Small, flat, line-art-like, noise-dominated or transparent samples are flagged. These guards can miss true comparisons and do not recognize subjects or guarantee that images show the same scene.

A stronger-detail candidate requires at least a 30% relative and 0.002 normalized difference from the runner-up, no meaningful local-detail regression and no conflicting near-white increase. With equivalent detail (within 12%), a near-white reduction of at least four percentage points can supply the alternative reason. Exact copies, close results, competing evidence and missing members yield no candidate. The full threshold values live in `CONFIG`; tests cover their intended boundaries.

UI reasons deliberately say “stronger detail signal in the reduced preview” and “fewer near-white pixels”, not “the best photo” or a confirmed cause of blur. Noise, shallow depth of field, line art, lighting and composition may still mislead these heuristics. Inspect the originals.

## State safety

Per-photo metric failure does not reject the original image or prevent manual comparison/export. Analysis commits metrics and groups only after session, input and group revisions match. Cancellation, reset, more input or group editing invalidate delayed work. The current group membership determines the candidate on every render; Undo patches contain only group IDs/membership, never old candidate or Keep state. Retry performs measurements again.

## Evidence and remaining gates

Unit and browser checks use authored synthetic pixels only. Synthetic controlled smoothing demonstrates an expected direction of the measurement, not agreement with human photo preferences. The real-photo recommendation agreement rate is **unmeasured**. The v0.2 minimum 50 human-labeled photographic comparison cases, false-group/recall gate and actual Android/iPhone checks remain open. The feature must not be described as validated AI quality or a final-release accuracy guarantee.

No model, runtime package, telemetry or external data request is added. All metric data stays in the current browser session and is discarded on reload/reset.
