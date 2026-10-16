/* Best Shot Picker v0.1: dependency-free, browser-local image headers and original-byte ZIP. */
(function (root) {
  'use strict';

  const encoder = new TextEncoder();
  const CHUNK_BYTES = 1024 * 1024;
  const MAX_NAME_BYTES = 240;
  // All-ones fields are ZIP64 sentinels. Never write them or silently wrap a ZIP32 field.
  const ZIP32_MAX = 0xfffffffe;
  const ZIP32_MAX_FILES = 65534;
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

  function checkAbort(signal) {
    if (signal && signal.aborted) {
      const error = new Error('Export cancelled. Your original photos and selection are unchanged.');
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
    return failure('ZIP_LIMIT', 'This selection exceeds the ZIP32 limit. Export fewer photos in smaller groups. ZIP64 and split archives are not available in this version.');
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
        const part = entry.file.slice(offset, end);
        if (!part || part.size !== end - offset || typeof part.arrayBuffer !== 'function') {
          throw failure('INVALID_FILE', 'The original file could not be read completely. Add the photo again and retry.');
        }
        const bytes = new Uint8Array(await part.arrayBuffer());
        checkAbort(signal);
        if (bytes.length !== end - offset) throw failure('INVALID_FILE', 'An original file read was incomplete. Retry the export.');
        value = crcUpdate(value, bytes);
        processedBytes += bytes.length;
        report('reading', entry.name);
        await nextTurn();
        checkAbort(signal);
      }
      // Validate the actual Blob brand and length rather than allowing object-to-string coercion.
      let original;
      try { original = Blob.prototype.slice.call(entry.file, 0, entry.size); }
      catch (_) { throw failure('INVALID_FILE', 'The selected original is not a readable File or Blob.'); }
      if (original.size !== entry.size) throw failure('INVALID_FILE', 'The original file size changed. Add it again and retry.');
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
    const archive = new Blob([...parts, ...central, end], { type: 'application/zip' });
    if (archive.size !== localSize + centralSize + 22) throw failure('INVALID_FILE', 'Archive size verification failed. Retry with a smaller selection.');
    report('complete', '');
    return archive;
  }

  function imageError() {
    return failure('INVALID_IMAGE', 'The image header is empty, damaged, or incomplete.');
  }

  function dimensions(format, width, height, orientation) {
    if (width !== null && height !== null) {
      if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw imageError();
      if (width > MAX_IMAGE_AXIS || height > MAX_IMAGE_AXIS || width * height > MAX_IMAGE_PIXELS) {
        throw failure('IMAGE_TOO_LARGE', 'This image exceeds the safe preview limit (100 megapixels or 32,768 pixels on either side). Use a smaller image.');
      }
    }
    return { format, width, height, orientation: orientation || 1 };
  }

  function ascii(bytes, start, length) {
    let value = '';
    for (let i = start; i < start + length && i < bytes.length; i++) value += String.fromCharCode(bytes[i]);
    return value;
  }

  // Only IFD0 Orientation is needed. A corrupt/unsupported EXIF block must not crash intake.
  function exifOrientation(bytes, start, end) {
    if (end - start < 14 || ascii(bytes, start, 6) !== 'Exif\0\0') return 1;
    const tiff = start + 6, order = ascii(bytes, tiff, 2);
    if (order !== 'II' && order !== 'MM') return 1;
    const little = order === 'II', view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint16(tiff + 2, little) !== 42) return 1;
    const offset = view.getUint32(tiff + 4, little);
    if (offset < 8 || offset > end - tiff - 2) return 1;
    const ifd = tiff + offset, count = view.getUint16(ifd, little);
    if (count > Math.floor((end - ifd - 2) / 12)) return 1;
    for (let n = 0; n < count; n++) {
      const entry = ifd + 2 + n * 12;
      if (view.getUint16(entry, little) === 0x0112 && view.getUint16(entry + 2, little) === 3 && view.getUint32(entry + 4, little) === 1) {
        const value = view.getUint16(entry + 8, little);
        return value >= 1 && value <= 8 ? value : 1;
      }
    }
    return 1;
  }

  /**
   * Inspect a bounded prefix, not a full decoder/security validator. JPEG dimensions can
   * be null when a large metadata segment crosses the prefix. Always browser-decode next,
   * check decoded dimensions, and keep encoded versus oriented dimensions distinct.
   */
  function inspectImageHeader(input) {
    let bytes;
    if (input instanceof ArrayBuffer) bytes = new Uint8Array(input);
    else if (ArrayBuffer.isView(input)) bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    else throw imageError();
    if (bytes.length < 4) throw imageError();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      let cursor = 2, width = null, height = null, orientation = 1;
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
        if (marker === 0xe1 && ascii(bytes, cursor + 2, 6) === 'Exif\0\0') orientation = exifOrientation(bytes, cursor + 2, end);
        if ((marker >= 0xc0 && marker <= 0xcf) && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          if (length < 8 || bytes[cursor + 7] < 1 || length !== 8 + 3 * bytes[cursor + 7]) throw imageError();
          height = view.getUint16(cursor + 3, false);
          width = view.getUint16(cursor + 5, false);
          dimensions('jpeg', width, height, orientation);
        }
        cursor = end;
      }
      return dimensions('jpeg', width, height, orientation);
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

  const api = Object.freeze({ sanitizeFilename, zipFilename, uniqueNames, createZip, inspectImageHeader });
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BestShotCore = api;
})(typeof window !== 'undefined' ? window : null);
