# Third-party notices

Best Shot Picker v0.1.0 has no third-party runtime dependencies, model weights, or WASM assets. The original-byte ZIP writer and synthetic image fixtures are project code under the repository's MIT license.

The app foundation comes from ttomohisa/htmlapps-template (MIT); its copyright and license remain in LICENSE.

Development-only browser tests use Playwright 1.57.0 (Apache-2.0), distributed through npm. Its source and license are at https://github.com/microsoft/playwright/tree/v1.57.0. Chromium installed for test execution is not embedded in or redistributed with the application.

The optional fixture regeneration script uses Pillow. Pillow is not a runtime or build dependency, and no Pillow code is embedded in the distributed HTML.
