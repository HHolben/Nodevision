// Nodevision/ApplicationSystem/public/RasterVectorization/RasterPreprocess.mjs
// This module converts ImageData into cleaned black-and-white raster masks for Nodevision vectorization. It keeps preprocessing deterministic and separate from SVG path construction so future raster viewers can reuse the same pipeline.

function contrastGray(gray, contrast) {
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  return Math.max(0, Math.min(255, factor * (gray - 128) + 128));
}

function sourceGray(data, index) {
  const alpha = data[index + 3] / 255;
  const gray = 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
  return 255 * (1 - alpha) + gray * alpha;
}

function neighborCount(mask, width, height, x, y) {
  let count = 0;
  for (let yy = y - 1; yy <= y + 1; yy += 1) {
    for (let xx = x - 1; xx <= x + 1; xx += 1) {
      if (xx === x && yy === y) continue;
      if (xx >= 0 && yy >= 0 && xx < width && yy < height && mask[yy * width + xx]) count += 1;
    }
  }
  return count;
}

function cleanupSpecks(mask, width, height, passes) {
  let current = mask;
  for (let pass = 0; pass < passes; pass += 1) {
    const next = current.slice();
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = y * width + x;
        const count = neighborCount(current, width, height, x, y);
        if (current[i] && count <= 1) next[i] = 0;
        else if (!current[i] && count >= 7) next[i] = 1;
      }
    }
    current = next;
  }
  return current;
}

function morph(mask, width, height, amount) {
  let current = mask;
  const passes = Math.abs(amount);
  for (let pass = 0; pass < passes; pass += 1) {
    const next = current.slice();
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = y * width + x;
        const count = neighborCount(current, width, height, x, y);
        if (amount > 0 && count > 0) next[i] = 1;
        if (amount < 0 && count < 8) next[i] = 0;
      }
    }
    current = next;
  }
  return current;
}

export function preprocessRaster(imageData, options) {
  const { width, height, data } = imageData;
  const out = new Uint8ClampedArray(width * height * 4);
  let mask = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const adjusted = contrastGray(sourceGray(data, i), options.contrast);
    const dark = options.invert ? adjusted > options.threshold : adjusted < options.threshold;
    mask[p] = dark ? 1 : 0;
  }
  if (options.cleanup > 0) mask = cleanupSpecks(mask, width, height, options.cleanup);
  if (options.boldness !== 0) mask = morph(mask, width, height, options.boldness);
  for (let p = 0, i = 0; p < mask.length; p += 1, i += 4) {
    const value = mask[p] ? 0 : 255;
    out[i] = value; out[i + 1] = value; out[i + 2] = value; out[i + 3] = 255;
  }
  return { width, height, mask, processedImageData: { width, height, data: out } };
}
