/* Relative image evidence only. No face, blur-cause, aesthetic or selection inference. */
(function (root) {
  'use strict';
  // Versioned, deliberately conservative engineering defaults. Synthetic tests are
  // regression evidence, not calibrated real-photo accuracy or a quality score.
  const CONFIG = Object.freeze({
    version: 'relative-detail-v1', sampleLongEdge: 160, minSampleAxis: 32,
    minLumaDeviation: 0.025, minSharpness: 0.0003, maxNoiseRatio: 0.24,
    lineArtTopFourRatio: 0.98, maxTransparencyRatio: 0.005,
    highlightLevel: 250 / 255, darkLevel: 5 / 255,
    maxAspectDelta: 0.01, maxSignatureDistance: 0.35,
    maxRgbDistance: 0.12, maxMeanLumaDelta: 0.12, maxChromaDelta: 0.045,
    minDetailRatio: 1.3, minDetailGap: 0.002,
    equivalentDetailRatio: 1.12, minHighlightGap: 0.04,
    maxHighlightRegression: 0.015, minTileEnergyShare: 0.025,
    maxTileRegression: 0.2, maxSpatialRegressions: 0
  });
  function settings(config) {
    const value = { ...CONFIG, ...config };
    if (typeof value.version !== 'string' || !value.version) throw new TypeError('Invalid quality metric version.');
    for (const key of Object.keys(CONFIG)) if (key !== 'version' && (!Number.isFinite(value[key]) || value[key] < 0)) throw new TypeError(`Invalid quality setting: ${key}`);
    if (!Number.isInteger(value.sampleLongEdge) || value.sampleLongEdge < 8 || value.sampleLongEdge > 512 || !Number.isInteger(value.minSampleAxis) || value.minSampleAxis < 8 || value.minSampleAxis > value.sampleLongEdge || value.minDetailRatio <= 1 || value.equivalentDetailRatio < 1) throw new TypeError('Invalid quality sampling or relative comparison settings.');
    return value;
  }
  const cell = (x, y, width, height, side) => Math.min(side - 1, Math.floor(y * side / height)) * side + Math.min(side - 1, Math.floor(x * side / width));

  /**
   * Measure an already oriented, aspect-preserving RGBA sample. Callers use a
   * common 160-pixel long edge without upscaling. Smaller samples are measurable
   * but flagged, so they cannot provide a recommendation. Alpha is composited on
   * white only for stable measurements; transparency causes abstention.
   */
  function measure(rgba, width, height, config = CONFIG) {
    const c = settings(config);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 8 || height < 8 || width > c.sampleLongEdge || height > c.sampleLongEdge || !rgba || rgba.length !== width * height * 4) throw new TypeError('Expected bounded, oriented RGBA pixels at the configured sample resolution.');
    const n = width * height, luma = new Float64Array(n), smooth = new Float64Array(n);
    const histogram = new Uint32Array(32), rgb = new Float64Array(64 * 3), counts = new Uint32Array(64);
    let total = 0, square = 0, clipped = 0, dark = 0, transparent = 0, chroma = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y * width + x, start = i * 4;
      for (let k = 0; k < 4; k++) if (!Number.isFinite(rgba[start + k]) || rgba[start + k] < 0 || rgba[start + k] > 255) throw new TypeError('RGBA channels must be finite byte values.');
      const alpha = rgba[start + 3] / 255;
      const r = rgba[start] / 255 * alpha + 1 - alpha, g = rgba[start + 1] / 255 * alpha + 1 - alpha, b = rgba[start + 2] / 255 * alpha + 1 - alpha;
      const value = .2126 * r + .7152 * g + .0722 * b;
      luma[i] = value; total += value; square += value * value;
      if (value >= c.highlightLevel) clipped++;
      if (value <= c.darkLevel) dark++;
      if (alpha < 250 / 255) transparent++;
      chroma += Math.max(r, g, b) - Math.min(r, g, b);
      histogram[Math.min(31, Math.floor(value * 32))]++;
      const index = cell(x, y, width, height, 8); counts[index]++;
      rgb[index * 3] += r; rgb[index * 3 + 1] += g; rgb[index * 3 + 2] += b;
    }
    const mean = total / n, variance = Math.max(0, square / n - mean * mean), deviation = Math.sqrt(variance);
    // Binomial 3x3 smoothing reduces single-pixel noise before Sobel energy.
    const weights = [1, 2, 1];
    let residual = 0, interior = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += luma[Math.min(height - 1, Math.max(0, y + dy)) * width + Math.min(width - 1, Math.max(0, x + dx))] * weights[dy + 1] * weights[dx + 1];
      const i = y * width + x; smooth[i] = sum / 16;
      if (x > 0 && x < width - 1 && y > 0 && y < height - 1) { residual += (luma[i] - smooth[i]) ** 2; interior++; }
    }
    const tileEnergy = new Float64Array(16), tileCounts = new Uint32Array(16);
    let energy = 0, measured = 0;
    for (let y = 2; y < height - 2; y++) for (let x = 2; x < width - 2; x++) {
      const i = y * width + x;
      const gx = (smooth[i - width + 1] + 2 * smooth[i + 1] + smooth[i + width + 1] - smooth[i - width - 1] - 2 * smooth[i - 1] - smooth[i + width - 1]) / 8;
      const gy = (smooth[i + width - 1] + 2 * smooth[i + width] + smooth[i + width + 1] - smooth[i - width - 1] - 2 * smooth[i - width] - smooth[i - width + 1]) / 8;
      const value = gx * gx + gy * gy, index = cell(x, y, width, height, 4);
      energy += value; measured++; tileEnergy[index] += value; tileCounts[index]++;
    }
    // Normalize contrast, not brightness: a dim but structured scene is not penalized.
    const denominator = Math.max(variance, 1e-12);
    const sharpness = energy / measured / denominator;
    const noiseRatio = Math.min(1, residual / interior / denominator);
    const signatureRgb = Array.from(rgb, (value, i) => value / counts[Math.floor(i / 3)]);
    const signatureLuma = Array.from({ length: 64 }, (_, i) => (.2126 * signatureRgb[i * 3] + .7152 * signatureRgb[i * 3 + 1] + .0722 * signatureRgb[i * 3 + 2] - mean) / Math.max(deviation, 1e-6));
    const detail = Array.from(tileEnergy, (value, i) => value / Math.max(1, tileCounts[i]) / denominator);
    const topFour = Array.from(histogram).sort((a, b) => b - a).slice(0, 4).reduce((a, b) => a + b, 0) / n;
    const flags = [];
    if (Math.max(width, height) !== c.sampleLongEdge || Math.min(width, height) < c.minSampleAxis) flags.push('small-sample');
    if (deviation < c.minLumaDeviation || sharpness < c.minSharpness) flags.push('low-information');
    if (deviation >= c.minLumaDeviation && topFour >= c.lineArtTopFourRatio) flags.push('line-art');
    if (noiseRatio > c.maxNoiseRatio) flags.push('noise');
    if (transparent / n > c.maxTransparencyRatio) flags.push('transparency');
    return { version: c.version, width, height, aspect: width / height, sharpness, highlightRatio: clipped / n, darkRatio: dark / n, noiseRatio, lumaDeviation: deviation, flags, signature: { rgb: signatureRgb, luma: signatureLuma, detail, meanLuma: mean, meanChroma: chroma / n } };
  }

  function valid(metrics, c) {
    if (!metrics || metrics.version !== c.version || !Number.isInteger(metrics.width) || !Number.isInteger(metrics.height) || metrics.width < 8 || metrics.height < 8 || metrics.width > c.sampleLongEdge || metrics.height > c.sampleLongEdge || !Number.isFinite(metrics.aspect) || Math.abs(metrics.aspect - metrics.width / metrics.height) > 1e-9 || !Array.isArray(metrics.flags)) return false;
    for (const key of ['sharpness', 'highlightRatio', 'darkRatio', 'noiseRatio', 'lumaDeviation']) if (!Number.isFinite(metrics[key]) || metrics[key] < 0) return false;
    for (const key of ['highlightRatio', 'darkRatio', 'noiseRatio']) if (metrics[key] > 1) return false;
    if (metrics.lumaDeviation > .5 + 1e-9) return false;
    const signature = metrics.signature;
    if (!signature || !Number.isFinite(signature.meanLuma) || signature.meanLuma < 0 || signature.meanLuma > 1 || !Number.isFinite(signature.meanChroma) || signature.meanChroma < 0 || signature.meanChroma > 1) return false;
    // Array.from materializes holes: a sparse array is missing evidence, not zero distance.
    return [['rgb', 192], ['luma', 64], ['detail', 16]].every(([key, size]) => Array.isArray(signature[key]) && signature[key].length === size && Array.from(signature[key]).every(value => Number.isFinite(value) && (key === 'luma' || value >= 0) && (key !== 'rgb' || value <= 1)));
  }
  function comparable(a, b, c) {
    if (a.width !== b.width || a.height !== b.height || Math.max(a.aspect, b.aspect) / Math.min(a.aspect, b.aspect) - 1 > c.maxAspectDelta) return false;
    const x = a.signature, y = b.signature;
    if (Math.abs(x.meanLuma - y.meanLuma) > c.maxMeanLumaDelta || Math.abs(x.meanChroma - y.meanChroma) > c.maxChromaDelta) return false;
    const rgbDistance = x.rgb.reduce((sum, value, i) => sum + Math.abs(value - y.rgb[i]), 0) / x.rgb.length;
    const spatialDistance = Math.sqrt(x.luma.reduce((sum, value, i) => sum + (value - y.luma[i]) ** 2, 0) / x.luma.length);
    return rgbDistance <= c.maxRgbDistance && spatialDistance <= c.maxSignatureDistance;
  }
  function spatiallyConsistent(candidate, other, c) {
    const a = candidate.signature.detail, b = other.signature.detail, total = b.reduce((sum, value) => sum + value, 0);
    let regressions = 0;
    for (let i = 0; i < b.length; i++) if (b[i] >= total * c.minTileEnergyShare && a[i] < b[i] * (1 - c.maxTileRegression)) regressions++;
    return regressions <= c.maxSpatialRegressions;
  }
  const abstain = status => ({ candidateId: null, reasons: [], status });
  /**
   * Rank only a complete, mutually comparable group. No aggregate score, inferred
   * focus cause or automatic kept state. Coarse composition and tile-detail guards
   * are conservative evidence checks, not scene/subject recognition guarantees.
   */
  function recommend(records, config = CONFIG) {
    const c = settings(config);
    if (!Array.isArray(records) || records.length < 2) return abstain('insufficient');
    const ids = new Set();
    for (const record of records) {
      if (!record || typeof record.id !== 'string' || !record.id || ids.has(record.id) || !valid(record.metrics, c)) return abstain('insufficient');
      ids.add(record.id);
    }
    for (let i = 0; i < records.length; i++) for (let j = i + 1; j < records.length; j++) if (!comparable(records[i].metrics, records[j].metrics, c)) return abstain('incomparable');
    if (records.some(({ metrics: m }) => m.flags.length || Math.max(m.width, m.height) !== c.sampleLongEdge || Math.min(m.width, m.height) < c.minSampleAxis || m.lumaDeviation < c.minLumaDeviation || m.sharpness < c.minSharpness || m.noiseRatio > c.maxNoiseRatio)) return abstain('uncertain');
    const detailOrder = [...records].sort((a, b) => b.metrics.sharpness - a.metrics.sharpness);
    const best = detailOrder[0], next = detailOrder[1];
    if (best.metrics.sharpness >= next.metrics.sharpness * c.minDetailRatio && best.metrics.sharpness - next.metrics.sharpness >= c.minDetailGap) {
      for (const other of detailOrder.slice(1)) if (!spatiallyConsistent(best.metrics, other.metrics, c) || best.metrics.highlightRatio > other.metrics.highlightRatio + c.maxHighlightRegression) return abstain('uncertain');
      const reasons = ['clearer-detail'];
      if (detailOrder.slice(1).every(other => other.metrics.highlightRatio - best.metrics.highlightRatio >= c.minHighlightGap)) reasons.push('less-highlight-clipping');
      return { candidateId: best.id, reasons, status: 'candidate' };
    }
    // Highlight clipping can distinguish otherwise equivalent measurements, but it
    // never outweighs a detail tradeoff. Dark-pixel ratio is informational only.
    const highlightOrder = [...records].sort((a, b) => a.metrics.highlightRatio - b.metrics.highlightRatio);
    const leastClipped = highlightOrder[0];
    const allEquivalent = detailOrder[0].metrics.sharpness <= detailOrder.at(-1).metrics.sharpness * c.equivalentDetailRatio;
    if (allEquivalent && highlightOrder[1].metrics.highlightRatio - leastClipped.metrics.highlightRatio >= c.minHighlightGap && highlightOrder.slice(1).every(other => spatiallyConsistent(leastClipped.metrics, other.metrics, c))) return { candidateId: leastClipped.id, reasons: ['less-highlight-clipping'], status: 'candidate' };
    return abstain('near-tie');
  }
  const api = Object.freeze({ CONFIG, measure, recommend });
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BestShotQuality = api;
})(typeof window !== 'undefined' ? window : null);
