/* Display-only geometry. Coordinates follow the browser-oriented original image. */
(function (root) {
  'use strict';
  const CONFIG = Object.freeze({ maxFaces: 6, sampleLongEdge: 1024, padding: 1.8, maxZoom: 4 });
  const positive = value => Number.isFinite(value) && value > 0;
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  function dimensions(width, height, integer = false) {
    if (!positive(width) || !positive(height) || (integer && (!Number.isInteger(width) || !Number.isInteger(height)))) throw new TypeError('Invalid image dimensions');
  }
  function checkedBox(box) {
    if (!box || !['xMin', 'yMin', 'xMax', 'yMax'].every(key => Number.isFinite(box[key])) || box.xMax <= box.xMin || box.yMax <= box.yMin) throw new TypeError('Invalid face box');
    for (const key of ['width', 'height']) if (box[key] !== undefined && !positive(box[key])) throw new TypeError('Invalid face extent');
    return box;
  }
  function normalizeFaces(faces, width, height) {
    dimensions(width, height, true);
    if (!Array.isArray(faces) || faces.length > CONFIG.maxFaces) throw new TypeError('Invalid face results');
    return Array.from(faces, face => {
      const box = checkedBox(face?.box);
      if (box.xMin < 0 || box.yMin < 0 || box.xMax > width || box.yMax > height) throw new TypeError('Face outside image');
      const xMin = box.xMin / width, yMin = box.yMin / height;
      const xMax = box.xMax / width, yMax = box.yMax / height;
      if (xMax <= xMin || yMax <= yMin) throw new TypeError('Face outside image');
      return Object.freeze({ xMin, yMin, xMax, yMax, width: xMax - xMin, height: yMax - yMin });
    });
  }
  function faceView(face, originalWidth, originalHeight, viewportWidth, viewportHeight) {
    dimensions(originalWidth, originalHeight); dimensions(viewportWidth, viewportHeight);
    checkedBox(face);
    if (face.xMin < 0 || face.yMin < 0 || face.xMax > 1 || face.yMax > 1) throw new TypeError('Face outside normalized image');
    // Padding gives the face context. Up to 400% matches the existing manual zoom.
    const fit = Math.min(1, viewportWidth / originalWidth, viewportHeight / originalHeight);
    const scale = Math.max(fit, Math.min(CONFIG.maxZoom,
      viewportWidth / (originalWidth * (face.xMax - face.xMin) * CONFIG.padding),
      viewportHeight / (originalHeight * (face.yMax - face.yMin) * CONFIG.padding)));
    const width = originalWidth * scale, height = originalHeight * scale;
    return Object.freeze({ scale, width, height,
      insetX: Math.max(0, (viewportWidth - width) / 2), insetY: Math.max(0, (viewportHeight - height) / 2),
      left: clamp((face.xMin + face.xMax) * width / 2 - viewportWidth / 2, 0, Math.max(0, width - viewportWidth)),
      top: clamp((face.yMin + face.yMax) * height / 2 - viewportHeight / 2, 0, Math.max(0, height - viewportHeight)) });
  }
  const api = Object.freeze({ CONFIG, normalizeFaces, faceView });
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BestShotFaceGeometry = api;
})(typeof window !== 'undefined' ? window : null);
