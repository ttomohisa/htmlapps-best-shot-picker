/* Best Shot Picker: dependency-free, browser-local metadata, exact duplicates and original-byte ZIP. */
(function (root) {
  'use strict';

  const encoder = new TextEncoder();
  const CHUNK_BYTES = 1024 * 1024;
  const MAX_NAME_BYTES = 240;
  // All-ones fields are ZIP64 sentinels. Never write them or silently wrap a ZIP32 field.
  const ZIP32_MAX = 0xfffffffe;
  const ZIP32_MAX_FILES = 65534;
  // Plans own only original File references and metadata. Completed archives are never cached.
  const ZIP_BATCH_PLANS = new WeakMap();
  // Only frozen allowlisted snapshots created here can reach the list serializers.
  const SELECTION_LISTS = new WeakSet();
  const MAX_IMAGE_PIXELS = 100000000;
  const MAX_IMAGE_AXIS = 32768;
  const RESERVED_NAME = /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i;
  const CRC_TABLE = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let value = n;
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
    CRC_TABLE[n] = value >>> 0;
  }

  function failure(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  // Only bounded diagnostic categories cross into the UI, never a provider's
  // message, URL, path or stack. A readable thumbnail is not a byte snapshot.
  function zipFailure(code, cause, fileIndex, totalFiles) {
    const error = failure(code, code === 'ZIP_READ_FAILED' ? 'An original photo could not be read for ZIP export.' : 'The ZIP archive could not be assembled.');
    const names = ['NotReadableError', 'NotFoundError', 'SecurityError', 'AbortError', 'QuotaExceededError', 'TypeError', 'RangeError'];
    error.reason = cause?.code === 'INVALID_FILE' ? 'INVALID_FILE' : names.includes(cause?.name) ? cause.name : 'Error';
    if (Number.isInteger(fileIndex)) { error.fileIndex = fileIndex; error.totalFiles = totalFiles; }
    return error;
  }

  function checkAbort(signal) {
    if (signal && signal.aborted) {
      const error = new Error('Operation cancelled. Your original photos and selection are unchanged.');
      error.name = 'AbortError';
      error.code = 'ABORT_ERR';
      throw error;
    }
  }

  function nextTurn() {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  function cleanName(value) {
    // Flatten both platform path conventions before stripping filename metacharacters.
    let name = String(value == null ? '' : value).normalize('NFC').trim().split(/[\\/]/).pop();
    name = name.replace(/[<>:"|?*\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '')
      .replace(/^[.\s]+|[.\s]+$/g, '');
    // TextEncoder replaces lone surrogates; doing so explicitly keeps name comparisons honest.
    name = Array.from(name, char => {
      const point = char.codePointAt(0);
      return point >= 0xd800 && point <= 0xdfff ? '_' : char;
    }).join('');
    if (RESERVED_NAME.test(name)) name = '_' + name;
    return name;
  }

  function splitExtension(name) {
    const dot = name.lastIndexOf('.');
    return dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
  }

  function fitName(stem, extension, suffix) {
    const tail = (suffix || '') + extension;
    const budget = MAX_NAME_BYTES - encoder.encode(tail).length;
    if (budget < 1) throw failure('INVALID_FILENAME', 'The filename extension is too long. Rename this file and try again.');
    let result = '', used = 0;
    for (const char of stem) {
      const length = encoder.encode(char).length;
      if (used + length > budget) break;
      result += char;
      used += length;
    }
    const name = (result.replace(/[.\s]+$/g, '') || '_') + tail;
    // Truncation can itself turn a longer stem into a reserved DOS device name.
    return RESERVED_NAME.test(name) ? fitName('_' + stem, extension, suffix) : name;
  }

  /** Safe, flat, NFC filename, at most 240 UTF-8 bytes; preserves its final extension. */
  function sanitizeFilename(name, fallback) {
    const cleaned = cleanName(name) || cleanName(fallback == null ? 'image' : fallback) || 'image';
    const [stem, extension] = splitExtension(cleaned);
    return fitName(stem, extension, '');
  }

  /** Safe editable output name, with exactly one trailing .zip extension. */
  function zipFilename(name, fallback) {
    const stripZip = value => cleanName(value).replace(/(?:\.zip)+$/i, '').replace(/[.\s]+$/g, '');
    const stem = stripZip(name) || stripZip(fallback == null ? 'best-shot-picker.zip' : fallback) || 'best-shot-picker';
    return fitName(stem, '.zip', '');
  }

  /** Safe editable output base with a stable, UTF-8-budgeted independent-part suffix. */
  function zipBatchFilename(base, index, total) {
    if (!Number.isSafeInteger(total) || total < 1 || !Number.isSafeInteger(index) || index < 0 || index >= total) {
      throw failure('INVALID_ZIP_BATCH', 'Choose a valid ZIP part from the current export plan.');
    }
    const name = zipFilename(base);
    if (total === 1) return name;
    const width = Math.max(3, String(total).length);
    const suffix = '-part-' + String(index + 1).padStart(width, '0') + '-of-' + String(total).padStart(width, '0');
    return fitName(name.slice(0, -4), '.zip', suffix);
  }

  function checkSelectionFormat(format) {
    if (format !== 'json' && format !== 'csv') {
      throw failure('INVALID_SELECTION_FORMAT', 'Choose JSON or CSV for the selection list.');
    }
  }

  /** Optional list download name, derived from the same editable ZIP base. */
  function selectionListFilename(base, format) {
    checkSelectionFormat(format);
    return fitName(zipFilename(base).slice(0, -4), '.' + format, '-selection');
  }

  function collisionKey(name) {
    // Conservative Unicode case folding also avoids sharp-s / sigma extraction collisions.
    return name.normalize('NFC').toUpperCase().toLowerCase().normalize('NFC');
  }

  /** File[] -> string[] in input order. No originals are changed or silently deduplicated. */
  function uniqueNames(files) {
    const used = new Set(), nextSuffix = new Map();
    return Array.from(files, (file, index) => {
      const original = sanitizeFilename(file && file.name, 'image-' + (index + 1));
      const [stem, extension] = splitExtension(original);
      const baseKey = collisionKey(original);
      let candidate = original, number = nextSuffix.get(baseKey) || 2;
      while (used.has(collisionKey(candidate))) {
        candidate = fitName(stem, extension, '-' + number++);
      }
      nextSuffix.set(baseKey, number);
      used.add(collisionKey(candidate));
      return candidate;
    });
  }

  function crcUpdate(value, bytes) {
    for (let i = 0; i < bytes.length; i++) value = (value >>> 8) ^ CRC_TABLE[(value ^ bytes[i]) & 255];
    return value >>> 0;
  }

  function zipLimit() {
    return failure('ZIP_LIMIT', 'This selection exceeds the ZIP32 limit. Export fewer photos or use smaller independent ZIP batches. ZIP64 is not available.');
  }

  function dosDateTime(timestamp) {
    let date = new Date(Number.isFinite(timestamp) ? timestamp : 0);
    if (!Number.isFinite(date.getTime()) || date.getFullYear() < 1980) date = new Date(1980, 0, 1);
    if (date.getFullYear() > 2107) date = new Date(2107, 11, 31, 23, 59, 58);
    return {
      date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
      time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
    };
  }

  function makeHeader(entry, checksum, central) {
    const bytes = new Uint8Array((central ? 46 : 30) + entry.encodedName.length);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, central ? 0x02014b50 : 0x04034b50, true);
    if (central) view.setUint16(4, 20, true); // DOS creator, version 2.0.
    const start = central ? 6 : 4;
    view.setUint16(start, 20, true); // Version needed.
    view.setUint16(start + 2, 0x0800, true); // UTF-8 names; no data descriptor/encryption.
    view.setUint16(start + 4, 0, true); // STORE: original bytes, no compression or re-encoding.
    view.setUint16(start + 6, entry.time, true);
    view.setUint16(start + 8, entry.date, true);
    view.setUint32(start + 10, checksum, true);
    view.setUint32(start + 14, entry.size, true);
    view.setUint32(start + 18, entry.size, true);
    view.setUint16(start + 22, entry.encodedName.length, true);
    if (central) view.setUint32(42, entry.offset, true);
    bytes.set(entry.encodedName, central ? 46 : 30);
    return bytes;
  }

  /**
   * Plan complete independent STORE ZIPs without reading original bytes. maxBytes is
   * an explicit integer budget (22..0xfffffffe), including both UTF-8 filename copies,
   * local headers, central directory and each part's 22-byte end record. Original
   * files are never split. Greedy boundaries preserve the ordered File snapshot.
   * Names are assigned once across the whole selection, so extracting every part
   * into one folder cannot overwrite another selected entry.
   *
   * The frozen public plan/descriptors expose byte totals, names and input ranges;
   * private entries retain fixed sizes/timestamps and original immutable File bytes.
   * A plan is session-local and cannot be cloned/serialized to export later.
   */
  function planZipBatches(files, options) {
    const maxBytes = options && typeof options === 'object' && !Array.isArray(options) ? options.maxBytes : null;
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 22 || maxBytes > ZIP32_MAX) {
      throw failure('INVALID_ZIP_OPTIONS', 'Choose a whole-number ZIP byte budget between 22 and 4,294,967,294 bytes.');
    }
    const inputs = Array.from(files || []);
    if (!inputs.length) throw failure('EMPTY_SELECTION', 'Choose at least one photo to export.');
    const snapshots = inputs.map(file => {
      const size = file && file.size;
      if (!file || !Number.isSafeInteger(size) || size < 0 || typeof file.slice !== 'function') {
        throw failure('INVALID_FILE', 'A selected original file is unavailable. Add the photo again and retry.');
      }
      return { file, size, name: file.name, ...dosDateTime(file.lastModified) };
    });
    const names = Object.freeze(uniqueNames(snapshots)), batches = [], privateBatches = [];
    let entries = [], startIndex = 0, localSize = 0, centralSize = 0, batchBytes = 0;
    let totalBytes = 0, estimatedBytes = 0;
    function finishBatch() {
      const archiveBytes = localSize + centralSize + 22;
      batches.push(Object.freeze({
        index: batches.length, startIndex, endIndex: startIndex + entries.length,
        totalFiles: entries.length, totalBytes: batchBytes, estimatedBytes: archiveBytes,
        names: Object.freeze(names.slice(startIndex, startIndex + entries.length))
      }));
      privateBatches.push({ entries, localSize, centralSize, totalBytes: batchBytes });
      estimatedBytes += archiveBytes;
      if (!Number.isSafeInteger(estimatedBytes)) throw zipLimit();
      startIndex += entries.length;
      entries = []; localSize = 0; centralSize = 0; batchBytes = 0;
    }
    snapshots.forEach((snapshot, index) => {
      const encodedName = encoder.encode(names[index]);
      const overhead = 76 + 2 * encodedName.length + 22;
      // Compare by subtraction so even an excessively large safe-integer input
      // cannot round into an accepted budget or produce misleading size metadata.
      if (snapshot.size > maxBytes - overhead) {
        const error = failure('ZIP_FILE_TOO_LARGE', 'An original photo cannot fit in one ZIP part. Choose a larger byte budget or save this photo separately; originals are never split.');
        Object.assign(error, {
          fileIndex: index, fileName: names[index], size: snapshot.size, maxBytes,
          requiredBytes: snapshot.size <= Number.MAX_SAFE_INTEGER - overhead ? snapshot.size + overhead : null
        });
        throw error;
      }
      const localBytes = 30 + encodedName.length + snapshot.size, directoryBytes = 46 + encodedName.length;
      if (entries.length && (entries.length === ZIP32_MAX_FILES || localSize + centralSize + localBytes + directoryBytes + 22 > maxBytes)) {
        finishBatch();
      }
      entries.push(Object.freeze({
        ...snapshot, originalName: typeof snapshot.name === 'string' ? snapshot.name : null,
        name: names[index], encodedName, offset: localSize
      }));
      localSize += localBytes; centralSize += directoryBytes; batchBytes += snapshot.size;
      totalBytes += snapshot.size;
      if (!Number.isSafeInteger(totalBytes)) throw zipLimit();
    });
    finishBatch();
    const plan = Object.freeze({ maxBytes, totalFiles: inputs.length, totalBytes, estimatedBytes, names, batches: Object.freeze(batches) });
    ZIP_BATCH_PLANS.set(plan, privateBatches);
    return plan;
  }

  /**
   * Metadata-only description of a kept-file ZIP plan, not proof of download or
   * disk saving. The caller chooses current Keep or an existing batch snapshot.
   * Read only the private plan's captured scalar fields, never the live File or
   * photo record. In particular, originalName preserves File.name without NFC
   * normalization, while zipEntryName is the already assigned global safe name.
   */
  function createSelectionList(plan, baseName, snapshotSource) {
    const batches = ZIP_BATCH_PLANS.get(plan);
    if (!batches) throw failure('INVALID_ZIP_PLAN', 'Create a new ZIP export plan from the selected original photos.');
    if (snapshotSource !== 'current_keep' && snapshotSource !== 'zip_batch_plan') {
      throw failure('INVALID_SELECTION_SOURCE', 'Choose the current selection or the active ZIP batch plan.');
    }
    // A normal single-ZIP selection must never acquire invented independent parts.
    if (snapshotSource === 'current_keep' && batches.length !== 1) throw zipLimit();
    const base = zipFilename(baseName), rows = [];
    batches.forEach((batch, index) => {
      const archiveName = zipBatchFilename(base, index, batches.length);
      for (const entry of batch.entries) {
        if (typeof entry.originalName !== 'string') {
          throw failure('INVALID_SELECTION_LIST', 'A selected original filename is unavailable. Add the photo again and retry.');
        }
        rows.push(Object.freeze({
          selectionIndex: rows.length + 1,
          originalName: entry.originalName,
          zipEntryName: entry.name,
          zipArchiveName: archiveName,
          zipPart: index + 1,
          sizeBytes: entry.size
        }));
      }
    });
    const list = Object.freeze({ schemaVersion: 1, scope: 'kept-zip-plan', snapshotSource, rows: Object.freeze(rows) });
    SELECTION_LISTS.add(list);
    return list;
  }

  function selectionDisplayName(name) {
    // CSV is an explicit display representation, not an exact filename codec.
    // Keep a literal alphabetic prefix on every filename, including benign names;
    // expose backslashes, controls and bidi formatting rather than hiding them.
    // No CSV strategy guarantees safety in every spreadsheet/downstream workflow.
    return 'file: ' + name.replace(/[\\\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028-\u202e\u2066-\u206f\ufeff]/g,
      char => char === '\\' ? '\\\\' : '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'));
  }

  /** Deterministic local text only; never adds a list entry to an image ZIP. */
  function serializeSelectionList(list, format) {
    checkSelectionFormat(format);
    if (!SELECTION_LISTS.has(list)) {
      throw failure('INVALID_SELECTION_LIST', 'Create a selection list from the current ZIP export plan.');
    }
    if (format === 'json') return JSON.stringify(list, null, 2) + '\n';
    const quote = value => '"' + String(value).replace(/"/g, '""') + '"';
    const lines = [[
      'schemaVersion', 'scope', 'snapshotSource', 'selectionIndex', 'originalName_display',
      'zipEntryName_display', 'zipArchiveName_display', 'zipPart', 'sizeBytes'
    ].map(quote).join(',')];
    for (const row of list.rows) {
      lines.push([
        list.schemaVersion, list.scope, list.snapshotSource, row.selectionIndex,
        selectionDisplayName(row.originalName), selectionDisplayName(row.zipEntryName),
        selectionDisplayName(row.zipArchiveName), row.zipPart, row.sizeBytes
      ].map(quote).join(','));
    }
    return '\ufeff' + lines.join('\r\n') + '\r\n';
  }

  /**
   * Materialize only the requested independent part. Progress uses the existing
   * createZip contract, local to that part. Callers own/discard each returned Blob
   * before starting another; no download, output queue or archive cache is created.
   * The same plan can retry any failed/cancelled part with unchanged entry names.
   */
  async function createZipBatch(plan, index, options) {
    options = options || {};
    checkAbort(options.signal);
    const batches = ZIP_BATCH_PLANS.get(plan);
    if (!batches) throw failure('INVALID_ZIP_PLAN', 'Create a new ZIP export plan from the selected original photos.');
    if (!Number.isSafeInteger(index) || index < 0 || index >= batches.length) {
      throw failure('INVALID_ZIP_BATCH', 'Choose a valid ZIP part from the current export plan.');
    }
    return writeZip(batches[index], options);
  }

  /**
   * File[] -> Promise<Blob>. CRC reads are bounded to 1 MiB, then yield to the UI.
   * The archive retains the original immutable Blob parts, not whole-file ArrayBuffers.
   * This is memory-conscious Blob assembly, not a streaming-to-disk/ZIP64 implementation.
   * Progress: {phase,processedBytes,totalBytes,completedFiles,totalFiles,currentName}.
   * Throws AbortError on cancellation; errors have .code for localized UI handling.
   */
  async function createZip(files, options) {
    options = options || {};
    const signal = options.signal;
    checkAbort(signal);
    const inputs = Array.from(files || []);
    if (!inputs.length) throw failure('EMPTY_SELECTION', 'Choose at least one photo to export.');
    if (inputs.length > ZIP32_MAX_FILES) throw zipLimit();
    const names = uniqueNames(inputs);
    let localSize = 0, centralSize = 0, totalBytes = 0;
    const entries = inputs.map((file, index) => {
      if (!file || !Number.isSafeInteger(file.size) || file.size < 0 || typeof file.slice !== 'function') {
        throw failure('INVALID_FILE', 'A selected original file is unavailable. Add the photo again and retry.');
      }
      if (file.size > ZIP32_MAX) throw zipLimit();
      const encodedName = encoder.encode(names[index]);
      if (encodedName.length > 65535) throw zipLimit();
      const entry = { file, size: file.size, name: names[index], encodedName, offset: localSize, ...dosDateTime(file.lastModified) };
      localSize += 30 + encodedName.length + file.size;
      centralSize += 46 + encodedName.length;
      totalBytes += file.size;
      if (localSize > ZIP32_MAX || centralSize > ZIP32_MAX || localSize + centralSize + 22 > ZIP32_MAX) throw zipLimit();
      return entry;
    });
    return writeZip({ entries, localSize, centralSize, totalBytes }, options);
  }

  // Shared byte writer: single ZIP and independent batches use identical CRC,
  // bounded reads, original Blob assembly, ZIP headers and cancellation behavior.
  async function writeZip(prepared, options) {
    const { entries, localSize, centralSize, totalBytes } = prepared;
    const signal = options.signal;
    const parts = [], central = [];
    let processedBytes = 0, completedFiles = 0;
    const report = (phase, currentName) => {
      checkAbort(signal);
      if (typeof options.onProgress === 'function') options.onProgress({
        phase, processedBytes, totalBytes, completedFiles, totalFiles: entries.length, currentName
      });
      checkAbort(signal);
    };
    report('reading', entries[0].name);
    await nextTurn();
    checkAbort(signal);
    for (const entry of entries) {
      let value = 0xffffffff;
      for (let offset = 0; offset < entry.size; offset += CHUNK_BYTES) {
        checkAbort(signal);
        const end = Math.min(entry.size, offset + CHUNK_BYTES);
        let bytes;
        try {
          const part = entry.file.slice(offset, end);
          if (!part || part.size !== end - offset || typeof part.arrayBuffer !== 'function') {
            throw failure('INVALID_FILE', 'Incomplete original slice.');
          }
          bytes = new Uint8Array(await part.arrayBuffer());
          if (bytes.length !== end - offset) throw failure('INVALID_FILE', 'Incomplete original read.');
        } catch (error) {
          checkAbort(signal);
          throw zipFailure('ZIP_READ_FAILED', error, completedFiles, entries.length);
        }
        checkAbort(signal);
        value = crcUpdate(value, bytes);
        processedBytes += bytes.length;
        report('reading', entry.name);
        await nextTurn();
        checkAbort(signal);
      }
      // Validate the actual Blob brand and length rather than allowing object-to-string coercion.
      let original;
      try {
        original = Blob.prototype.slice.call(entry.file, 0, entry.size);
        if (original.size !== entry.size) throw failure('INVALID_FILE', 'Original size changed.');
      } catch (error) {
        checkAbort(signal);
        throw zipFailure('ZIP_READ_FAILED', error, completedFiles, entries.length);
      }
      const checksum = (value ^ 0xffffffff) >>> 0;
      parts.push(makeHeader(entry, checksum, false), original);
      central.push(makeHeader(entry, checksum, true));
      completedFiles++;
      report('reading', entry.name);
      // Also yield for zero-byte files, so every entry is cancellable.
      await nextTurn();
      checkAbort(signal);
    }
    const end = new Uint8Array(22), view = new DataView(end.buffer);
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(8, entries.length, true);
    view.setUint16(10, entries.length, true);
    view.setUint32(12, centralSize, true);
    view.setUint32(16, localSize, true);
    let archive;
    try {
      archive = new Blob([...parts, ...central, end], { type: 'application/zip' });
      if (archive.size !== localSize + centralSize + 22) throw failure('INVALID_FILE', 'Archive size verification failed.');
    } catch (error) { throw zipFailure('ZIP_BUILD_FAILED', error); }
    report('complete', '');
    return archive;
  }

  function imageError() {
    return failure('INVALID_IMAGE', 'The image header is empty, damaged, or incomplete.');
  }

  function dimensions(format, width, height, orientation, captureTime = null) {
    if (width !== null && height !== null) {
      if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw imageError();
      if (width > MAX_IMAGE_AXIS || height > MAX_IMAGE_AXIS || width * height > MAX_IMAGE_PIXELS) {
        throw failure('IMAGE_TOO_LARGE', 'This image exceeds the safe preview limit (100 megapixels or 32,768 pixels on either side). Use a smaller image.');
      }
    }
    return { format, width, height, orientation: orientation || 1, captureTime };
  }

  function ascii(bytes, start, length) {
    let value = '';
    for (let i = start; i < start + length && i < bytes.length; i++) value += String.fromCharCode(bytes[i]);
    return value;
  }

  // Read only Orientation and the six capture-time tags. Never follow GPS, MakerNote,
  // thumbnail/next-IFD or arbitrary directory links. All offsets stay inside this APP1.
  function exifMetadata(bytes, start, end) {
    const result = { orientation: null, captureTime: null };
    if (end - start < 14 || ascii(bytes, start, 6) !== 'Exif\0\0') return result;
    const tiff = start + 6, order = ascii(bytes, tiff, 2);
    if (order !== 'II' && order !== 'MM') return result;
    const little = order === 'II', view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint16(tiff + 2, little) !== 42) return result;
    function entries(offset) {
      if (offset < 8 || offset > end - tiff - 2) return [];
      const ifd = tiff + offset, count = view.getUint16(ifd, little);
      if (count > Math.floor((end - ifd - 2) / 12)) return [];
      return Array.from({ length: count }, (_, n) => ifd + 2 + n * 12);
    }
    const ifdOffset = view.getUint32(tiff + 4, little);
    let exifOffset = null;
    for (const entry of entries(ifdOffset)) {
      const tag = view.getUint16(entry, little), type = view.getUint16(entry + 2, little), count = view.getUint32(entry + 4, little);
      if (tag === 0x0112 && type === 3 && count === 1 && result.orientation === null) {
        const value = view.getUint16(entry + 8, little);
        if (value >= 1 && value <= 8) result.orientation = value;
      }
      if (tag === 0x8769 && type === 4 && count === 1 && exifOffset === null) exifOffset = view.getUint32(entry + 8, little);
    }
    if (exifOffset === null || exifOffset === ifdOffset) return result;
    const tags = new Map(), wanted = new Set([0x9003, 0x9004, 0x9011, 0x9012, 0x9291, 0x9292]);
    for (const entry of entries(exifOffset)) {
      const tag = view.getUint16(entry, little);
      if (!wanted.has(tag)) continue;
      if (tags.has(tag)) { tags.set(tag, null); continue; } // Ambiguous duplicate tags are not trusted.
      tags.set(tag, null);
      const count = view.getUint32(entry + 4, little);
      if (view.getUint16(entry + 2, little) !== 2 || count < 2 || count > 64) continue;
      const offset = count <= 4 ? entry + 8 : tiff + view.getUint32(entry + 8, little);
      if (offset < tiff + 8 || offset > end - count || bytes[offset + count - 1] !== 0) continue;
      const value = ascii(bytes, offset, count - 1);
      if (!/^[\x20-\x7e]*$/.test(value)) continue;
      tags.set(tag, value);
    }
    result.captureTime = captureTimestamp(tags, true) || captureTimestamp(tags, false);
    return result;
  }

  function captureTimestamp(tags, original) {
    const raw = tags.get(original ? 0x9003 : 0x9004);
    const match = typeof raw === 'string' && /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(raw);
    if (!match) return null;
    const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
    // setUTCFullYear avoids Date.UTC's special treatment of years 0..99. No local timezone or DST guessing.
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day); date.setUTCHours(hour, minute, second, 0);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    const rawSubsecond = (tags.get(original ? 0x9291 : 0x9292) || '').trimEnd();
    const subsecond = /^\d+$/.test(rawSubsecond) ? rawSubsecond : '';
    let valueMs = date.getTime() + (subsecond ? Number(subsecond.slice(0, 3).padEnd(3, '0')) : 0);
    const rawOffset = tags.get(original ? 0x9011 : 0x9012);
    const offset = typeof rawOffset === 'string' && /^([+-])(\d{2}):(\d{2})$/.exec(rawOffset);
    const validOffset = offset && Number(offset[2]) <= 23 && Number(offset[3]) <= 59;
    const result = { valueMs, domain: validOffset ? 'instant' : 'wall', source: original ? 'exif-original' : 'exif-digitized', display: `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}${subsecond ? '.' + subsecond : ''}` };
    if (validOffset) {
      result.offsetMinutes = (Number(offset[2]) * 60 + Number(offset[3])) * (offset[1] === '-' ? -1 : 1);
      result.valueMs -= result.offsetMinutes * 60000;
      result.display += rawOffset;
    }
    return result;
  }

  /**
   * Inspect a bounded prefix, not a full decoder/security validator. JPEG dimensions can
   * be null when a large metadata segment crosses the prefix. Always browser-decode next,
   * check decoded dimensions, and keep encoded versus oriented dimensions distinct.
   * captureTime is null without valid JPEG EXIF original/digitized time. Its valueMs
   * is an epoch instant only for domain='instant'. For domain='wall' it encodes UTC
   * components solely for wall-clock comparisons: never apply the host timezone or
   * compare it directly with instant/File.lastModified values. Subseconds are truncated
   * to millisecond precision in valueMs; display retains their recorded precision.
   */
  function inspectImageHeader(input) {
    let bytes;
    if (input instanceof ArrayBuffer) bytes = new Uint8Array(input);
    else if (ArrayBuffer.isView(input)) bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    else throw imageError();
    if (bytes.length < 4) throw imageError();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      let cursor = 2, width = null, height = null, orientation = 1, captureTime = null;
      while (cursor < bytes.length) {
        if (bytes[cursor++] !== 0xff) throw imageError();
        while (cursor < bytes.length && bytes[cursor] === 0xff) cursor++;
        if (cursor >= bytes.length) break;
        const marker = bytes[cursor++];
        if (marker === 0xd9 || marker === 0xda) break;
        if (marker === 0x00 || marker === 0xd8) throw imageError();
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
        if (cursor + 2 > bytes.length) break;
        const length = view.getUint16(cursor, false);
        if (length < 2) throw imageError();
        const end = cursor + length;
        if (end > bytes.length) break; // Caller may intentionally provide only a header prefix.
        if (marker === 0xe1 && ascii(bytes, cursor + 2, 6) === 'Exif\0\0') {
          const metadata = exifMetadata(bytes, cursor + 2, end);
          if (metadata.orientation !== null) orientation = metadata.orientation;
          if (metadata.captureTime && (!captureTime || (captureTime.source !== 'exif-original' && metadata.captureTime.source === 'exif-original'))) captureTime = metadata.captureTime;
        }
        if ((marker >= 0xc0 && marker <= 0xcf) && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          if (length < 8 || bytes[cursor + 7] < 1 || length !== 8 + 3 * bytes[cursor + 7]) throw imageError();
          height = view.getUint16(cursor + 3, false);
          width = view.getUint16(cursor + 5, false);
          dimensions('jpeg', width, height, orientation);
        }
        cursor = end;
      }
      return dimensions('jpeg', width, height, orientation, captureTime);
    }
    if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG') {
      const signature = [137, 80, 78, 71, 13, 10, 26, 10];
      if (bytes.length < 33 || !signature.every((value, index) => bytes[index] === value) || view.getUint32(8, false) !== 13 || ascii(bytes, 12, 4) !== 'IHDR') throw imageError();
      const depths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
      if (!depths[bytes[25]] || !depths[bytes[25]].includes(bytes[24]) || bytes[26] !== 0 || bytes[27] !== 0 || bytes[28] > 1) throw imageError();
      if (((crcUpdate(0xffffffff, bytes.subarray(12, 29)) ^ 0xffffffff) >>> 0) !== view.getUint32(29, false)) throw imageError();
      return dimensions('png', view.getUint32(16, false), view.getUint32(20, false), 1);
    }
    if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
      if (bytes.length < 20) throw imageError();
      const declaredEnd = view.getUint32(4, true) + 8;
      if (declaredEnd < 20) throw imageError();
      let cursor = 12, width = null, height = null;
      while (cursor + 8 <= bytes.length && cursor + 8 <= declaredEnd) {
        const type = ascii(bytes, cursor, 4), length = view.getUint32(cursor + 4, true), start = cursor + 8;
        const end = start + length;
        if (end > declaredEnd) throw imageError();
        if (type === 'ANIM' || type === 'ANMF') throw failure('ANIMATED_IMAGE', 'Animated WebP is not supported. Choose a still JPEG, PNG, or WebP image.');
        if (type === 'VP8X') {
          if (length !== 10 || start + 10 > bytes.length) throw imageError();
          if (bytes[start] & 2) throw failure('ANIMATED_IMAGE', 'Animated WebP is not supported. Choose a still JPEG, PNG, or WebP image.');
          width = 1 + bytes[start + 4] + (bytes[start + 5] << 8) + (bytes[start + 6] << 16);
          height = 1 + bytes[start + 7] + (bytes[start + 8] << 8) + (bytes[start + 9] << 16);
        } else if (type === 'VP8 ' && width === null) {
          if (length < 10 || start + 10 > bytes.length || (bytes[start] & 1) || bytes[start + 3] !== 0x9d || bytes[start + 4] !== 0x01 || bytes[start + 5] !== 0x2a) throw imageError();
          width = view.getUint16(start + 6, true) & 0x3fff;
          height = view.getUint16(start + 8, true) & 0x3fff;
        } else if (type === 'VP8L' && width === null) {
          if (length < 5 || start + 5 > bytes.length || bytes[start] !== 0x2f || bytes[start + 4] >> 5) throw imageError();
          const bits = view.getUint32(start + 1, true);
          width = (bits & 0x3fff) + 1;
          height = ((bits >>> 14) & 0x3fff) + 1;
        }
        cursor = end + (length & 1);
      }
      if (width === null || height === null) throw imageError();
      return dimensions('webp', width, height, 1);
    }
    throw failure('UNSUPPORTED_IMAGE', 'This format is not supported. Choose a JPEG, PNG, or still WebP image.');
  }

  /**
   * Analyze immutable File/Blob records without changing records or selections.
   * Only equal-size candidates are hashed, one at a time. Native SHA-256 needs a
   * full buffer, so maxHashBytes is a PER-FILE budget (64 MiB by default), not a
   * collection size limit. Equal digests are then verified with 1 MiB byte reads.
   * digest has WebCrypto's (algorithm, ArrayBuffer) signature; null means unavailable.
   * Statuses: unique-size, checked, duplicate, skipped-large, unavailable, failed.
   * checked means successfully examined, not proof of uniqueness against failed/skipped peers.
   * Progress never exposes a partial duplicate set. On abort, no result is returned.
   */
  async function findExactDuplicates(records, options = {}) {
    const { signal, onProgress, maxHashBytes = 64 * 1024 * 1024 } = options;
    checkAbort(signal);
    if (!Number.isSafeInteger(maxHashBytes) || maxHashBytes < 0) throw failure('INVALID_BUDGET', 'maxHashBytes must be a non-negative safe integer.');
    const subtle = (root ? root.crypto : globalThis.crypto)?.subtle;
    const digest = options.digest === undefined ? (subtle && subtle.digest.bind(subtle)) : options.digest;
    const ids = new Set(), statuses = Object.create(null), bySize = new Map();
    const input = Array.from(records, record => {
      if (!record || typeof record.id !== 'string' || !record.id || ids.has(record.id)) throw failure('INVALID_RECORD', 'Each record needs a unique non-empty string id.');
      ids.add(record.id);
      const item = { id: record.id, file: record.file, size: record.size };
      statuses[item.id] = 'failed';
      try {
        // Brand-check and use the native immutable size, not a caller-supplied size alone.
        const actualSize = Object.getOwnPropertyDescriptor(Blob.prototype, 'size').get.call(item.file);
        if (!Number.isSafeInteger(item.size) || item.size < 0 || item.size !== actualSize) return item;
        if (!bySize.has(item.size)) bySize.set(item.size, []);
        bySize.get(item.size).push(item);
        statuses[item.id] = 'checked';
      } catch { /* A bad record cannot prevent other originals from being used. */ }
      return item;
    });
    let completedFiles = 0;
    function progress(phase, currentId = null) {
      checkAbort(signal);
      if (typeof onProgress === 'function') onProgress({ phase, currentId, completedFiles, totalFiles: input.length });
      checkAbort(signal);
    }
    async function read(item, start, end) {
      checkAbort(signal);
      let buffer;
      try {
        buffer = await item.file.slice(start, end).arrayBuffer();
        if (!(buffer instanceof ArrayBuffer) || buffer.byteLength !== end - start) throw new Error('Incomplete file read.');
      } catch (cause) {
        checkAbort(signal);
        const error = failure('READ_FAILED', 'Could not read this original for duplicate analysis.');
        error.recordId = item.id;
        throw error;
      }
      checkAbort(signal);
      return buffer;
    }
    const byHash = new Map();
    for (const item of input) {
      checkAbort(signal);
      if (statuses[item.id] !== 'failed') {
        if (bySize.get(item.size).length < 2) statuses[item.id] = 'unique-size';
        else if (item.size > maxHashBytes) statuses[item.id] = 'skipped-large';
        else if (typeof digest !== 'function') statuses[item.id] = 'unavailable';
        else {
          progress('hashing', item.id);
          let hash;
          try {
            // No hash buffer is retained once its digest resolves, and no cache can outlive the caller's session.
            const bytes = await read(item, 0, item.size);
            const result = await digest('SHA-256', bytes);
            checkAbort(signal); // A native digest cannot itself be aborted.
            const value = result instanceof ArrayBuffer ? new Uint8Array(result) : ArrayBuffer.isView(result) ? new Uint8Array(result.buffer, result.byteOffset, result.byteLength) : null;
            if (!value || value.length !== 32) throw new Error('Invalid SHA-256 digest.');
            hash = `${item.size}:` + Array.from(value, byte => byte.toString(16).padStart(2, '0')).join('');
          } catch {
            checkAbort(signal);
            statuses[item.id] = 'failed';
          }
          if (hash) {
            if (!byHash.has(hash)) byHash.set(hash, []);
            byHash.get(hash).push(item);
          }
        }
      }
      completedFiles++;
      progress('hashing', item.id);
      await nextTurn();
    }
    async function equalBytes(left, right) {
      for (let start = 0; start < left.size; start += CHUNK_BYTES) {
        const end = Math.min(left.size, start + CHUNK_BYTES);
        const a = new Uint8Array(await read(left, start, end));
        const b = new Uint8Array(await read(right, start, end));
        for (let n = 0; n < a.length; n++) if (a[n] !== b[n]) return false;
        progress('comparing', right.id);
        await nextTurn();
        checkAbort(signal);
      }
      return true;
    }
    const groups = [];
    for (const bucket of byHash.values()) {
      if (bucket.length < 2) continue;
      const classes = [];
      for (const item of bucket) {
        progress('comparing', item.id);
        let matched = false;
        for (const group of classes) {
          // If a representative becomes unreadable, remove it and retry against a
          // surviving verified member. Failed reads must never imply equal bytes.
          while (group.length && statuses[item.id] !== 'failed') {
            const representative = group[0];
            try {
              if (await equalBytes(representative, item)) { group.push(item); matched = true; }
              break;
            } catch (error) {
              checkAbort(signal);
              if (error.code !== 'READ_FAILED') throw error;
              statuses[error.recordId] = 'failed';
              if (error.recordId === representative.id) group.shift();
            }
          }
          if (matched || statuses[item.id] === 'failed') break;
        }
        if (!matched && statuses[item.id] !== 'failed') classes.push([item]);
        await nextTurn();
        checkAbort(signal);
      }
      groups.push(...classes.filter(group => group.length > 1));
    }
    const order = new Map(input.map((item, n) => [item.id, n]));
    const sets = groups.map(group => group.map(item => item.id)).sort((a, b) => order.get(a[0]) - order.get(b[0]));
    for (const set of sets) for (const id of set) statuses[id] = 'duplicate';
    progress('complete');
    return { sets, statuses };
  }

  const api = Object.freeze({ sanitizeFilename, zipFilename, zipBatchFilename, selectionListFilename, uniqueNames, planZipBatches, createSelectionList, serializeSelectionList, createZipBatch, createZip, inspectImageHeader, findExactDuplicates });
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BestShotCore = api;
})(typeof window !== 'undefined' ? window : null);
