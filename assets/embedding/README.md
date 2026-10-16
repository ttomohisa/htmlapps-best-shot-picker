# Pinned offline embedding assets

This directory holds the reviewed Google MobileNet V1 0.25 224 feature-vector model (version 2), full Apache-2.0 license and preserved third-party notices. The upstream model and weight bytes are unchanged. `manifest.json` records the upstream archive and license-evidence URLs plus exact local byte counts and SHA-256 hashes. The URLs are provenance only; neither the product nor its build fetches them.

TensorFlow.js 4.22.0 uses the standard npm declaration in `dependencies.json` and tarball lock in `dependencies.lock.json`. The builder independently checks the reviewed runtime file hash from this directory's manifest, so a changed extracted cache fails closed even when its tarball is intact. Intentional upgrades must review and update the runtime/model together; the dependency update policy is manual.

The canonical PowerShell builder gzip-embeds these files and `src/embedding-worker.js` into the normal `StandaloneAssets` bundle:

| Dependency | Key | Consumer |
| --- | --- | --- |
| `tfjs` | `runtime` | `textAsync`, only after explicit opt-in |
| `mobilenet-v1` | `model` | `textAsync` then JSON parse |
| `mobilenet-v1` | `weights` | `bytesAsync`, copy before transferring to worker |
| `mobilenet-v1` | `license`, `notices` | `textAsync`, local help disclosure |
| `embedding-worker` | `worker` | `textAsync`, first-party worker source |

Only the client wrapper is a main-page script. The TFJS runtime remains inert compressed data until the user starts candidate search. The client combines runtime/worker sources into one Blob worker, explicitly uses the CPU backend, disables external worker I/O, and supports bounded sequential inference, cancellation, generation/job guards, timeouts and cleanup. The unchanged page CSP blocks runtime connections and does not allow eval or WASM evaluation.

Run static/hash and client lifecycle regression tests with:

    node --test tests/embedding-packaging.test.cjs tests/embedding-product-client.test.cjs

For the canonical-build, both-form, corruption/missing-file checks, set `BSP_PACKAGING_BUILD_TESTS=1` and run the packaging test. `PWSH` may specify a PowerShell executable; otherwise it uses `pwsh`. Run with a previously cached exact npm archive and `tar.exe` available (the production builder's normal requirements). This integration test copies inputs to a temporary directory, runs the PowerShell syntax preflight first, builds both forms, verifies embedded hashes, and checks deliberate model/runtime/archive corruption without altering the working checkout.
