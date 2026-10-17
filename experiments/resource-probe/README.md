# Manual synthetic 12MP resource probe

This is a developer diagnostic for original-plan v0.7 / APP_SPEC §13.2. It is **not automatic PR CI** and does not add new product behavior. Keep `tests/performance.browser.cjs` unchanged: that 32×24 PNG profile isolates DOM/session scaling; this separate profile observes full-size decoding and recovery. Existing small regression suites remain responsible for edge cases, multi-part ZIP boundaries, localization, layouts, and engines. Add an ordinary regression only when a reproduced product bug supplies a small useful case.

## Run deliberately

Linux, Node 22+, the repo's pinned Playwright Chromium, Python 3.12+ and `requirements.txt` are required. Install the declared tools from their official registries, then run the canonical PowerShell syntax preflight and repository build. No app source/API replacement is used.

```sh
python3 -m pip install -r experiments/resource-probe/requirements.txt
node experiments/resource-probe/self-test.cjs
node experiments/resource-probe/browser.cjs                         # 4 only
BSP_RESOURCE_MAX_COUNT=100 node experiments/resource-probe/browser.cjs # 4, then 100
```

Alternatively, manually run **Validate standalone HTML**, select profile `resource`, and select `max_count` `4` or `100` on the intended branch. The default profile stays `validation`. Resource mode skips the unrelated regression/model suites and runs only this diagnostic; a `pull_request` event never runs it. GitHub's manual workflow must already exist on the default branch; select the feature branch containing this implementation. The test only builds and checks artifacts; it does not deploy anything.

A requested 100-photo run first generates four photos and checks **both** canonical HTML forms. Only after both pass does it generate or import 100. A failed/unsupported/stopped first stage ends the run. No 500/1,000 option, repetitions or viewport matrix are added. Outputs are under `test-results/resource-probe/`: JSON report, exact input manifests, extracted-output hashes, downloaded ZIPs, and failure screenshots when possible. GitHub keeps diagnostic artifacts for 14 days. Save the report with its exact commit/run/artifact hashes if longer retention is needed.

## Fixed scope and diagnostic stops

- Inputs: 4000×3000 / 3000×4000 RGB geometry, alternating orientations and JPEG/PNG/static WebP, generated one at a time. No real photos, people, EXIF, GPS or personal data. Encoded bytes are hash-pinned per run; Pillow and codec versions are in each manifest. Coarse geometric tiles compress well, so these are **not photographic-entropy or real-photo throughput measurements**.
- At most 8 MiB encoded per original and 256 MiB per corpus. The 4-photo fixture corpus is about 0.9 MiB with the recorded local codec versions; exact bytes are recorded rather than assumed portable across codecs.
- Every browser case stops after 180 seconds. Fixture generation has a separate 180-second timeout. The manual job has a 20-minute outer timeout.
- Linux `/proc` samples every 500 ms. Stop on missing required measurements, browser plus descendant plus Node controller summed RSS above 2 GiB, or host `MemAvailable` below 1 GiB. A sample is checked before input and after the flow. This is a conservative **sampled diagnostic stop line**, not an OS-enforced memory limit: shared RSS is double-counted, short-lived peaks can be missed, and usage may overshoot between samples. The report does not claim peak unique memory or a product capacity limit. Do not run alongside other heavy work.
- On a stop, close/terminate the test-owned browser, mark the case failed/incomplete, save available diagnostics, and do not continue to 100. Do not simply raise the budget or report a timeout as a safe product limit.

## Observed user flow

At four photos, request cancellation after the first actual photo card while import is still active. Require a partial import (1–3 retained photos), then reset. A machine that finishes before cancellation is observed produces an incomplete/failed diagnostic rather than fabricated cancellation evidence. Existing deterministic mocked-race tests provide separate cancellation regression coverage.

For each case: real file input → sequential import/default analysis → verify no automatic Keep and all comparison choices → decode JPEG/PNG/WebP in A at their full intrinsic dimensions → Keep three, Undo, restore → user-named single ZIP → independently inspect CRC/SHA-256 of every original → acknowledge it before a one-part independent batch ZIP → inspect its originals → finish → reset → later one-photo input → reset again. The one-part batch here is a save-path check, not another multi-part/capacity test. All HTTP(S) requests are blocked/audited, CSP violations/page errors fail, and optional models stay unused.

Timing includes Playwright file-input transfer through completed analysis. An observational 50 ms heartbeat and long-task observer record gaps/counts, with overhead. There is no speed threshold or claim that low RSS proves memory reclamation. Both cases use desktop Chromium at 1360×900; no physical phone, Safari, photographic grouping/quality accuracy, real-photo codec throughput, or safe ZIP size is established.

## Results and next decision

Record success **or failure**, exact commit, generated artifact/fixture hashes, OS/CPU/browser, input count/formats/dimensions/bytes, durations, sampled memory and stopping phase. If a product fault appears, reduce to the smallest reproduction before changing app code or adding a default regression. Physical Android/iPhone 100/500, PC 1,000 and a separately licensed, independently labeled photographic corpus remain distinct open gates.
