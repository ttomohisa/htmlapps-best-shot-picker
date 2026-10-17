# Planned selected-file lists

v0.7.1 implements the optional BSP-044 list as separate JSON or CSV downloads. The details section starts closed. No list is generated implicitly, added to ZIPs, persisted, uploaded, or used to restore a session.

## Snapshot and field boundary

Current single-ZIP mode takes a synchronous snapshot of current Keep and the requested ZIP name when the list button is pressed. It is not a receipt for an earlier export. Smaller-ZIP mode requires a reviewed plan and uses its frozen original names, global entry names, archive names and part ranges. Later Keep changes, Undo, imports, group edits, language switches, retries and part advancement cannot change that list.

JSON contains `schemaVersion`, `scope`, `snapshotSource`, and `rows`. Rows contain only `selectionIndex`, `originalName`, `zipEntryName`, `zipArchiveName`, `zipPart`, and `sizeBytes`. All indices are one-based. `originalName` preserves the original `File.name`; no folder metadata such as `webkitRelativePath` is read. JSON preserves whitespace, control characters and Unicode normalization differences through JSON escaping. ZIP names remain the writer's safe assigned names. Group IDs, unselected filenames, EXIF/GPS, all timestamps, image dimensions, quality/face data, hashes, thumbnails and image bytes are excluded.

The list shows planned files and requested names, not verified completed disk writes. Browsers may rename downloaded copies. Filenames themselves can contain personal information.

## Display-oriented CSV

CSV repeats the schema/scope/source fields per row. Its filename columns end in `_display`; every filename value begins with literal `file: `. Backslashes, control and bidi-control characters are represented visibly. Every cell is quoted, embedded quotes are doubled, records use CRLF, and UTF-8 includes a BOM. JSON is the exact-name interchange format; CSV is deliberately a display format.

The fixed ordinary-text prefix avoids depending on spreadsheet interpretation of leading apostrophes or tabs. It is not a guarantee for every spreadsheet, later edit, or re-save. Current [OWASP CSV Injection guidance](https://community.owasp.org/attacks/CSV_Injection) explicitly warns that quoting/escape approaches can fail after Excel save/reopen and that no universal CSV sanitization works for all consumers. Record quoting follows [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180.html). Actual Excel/LibreOffice application behavior has not been measured for this release.

## Resources and verification

Only allowlisted metadata is copied; list generation performs no original-byte read, image decode, model initialization or network access. Text-download URLs have a separate lifetime from ZIP URLs and cannot mark a ZIP saved or trigger its previous-download acknowledgement. They remain briefly valid for requested downloads, then expire; reset clears the visible list status without immediately revoking an already requested list.

Required regression coverage: exact JSON round trips and dangerous/control/Unicode filename fixtures; strict CSV shape and fixed text prefixes; no extra metadata; original-name/ZIP-name/part mapping; frozen batch results after live edits, cancellation and advancement; ordinary ZIP contents unchanged; both standalone forms and the exact owned preview; narrow EN/JA controls and no runtime network. Candidate exact-head CI and preview results must be recorded when completed; these requirements are not a pass claim.
