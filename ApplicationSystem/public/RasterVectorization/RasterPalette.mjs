// Nodevision/ApplicationSystem/public/RasterVectorization/RasterPalette.mjs
// Deterministic OKLab palette quantization for Color Region vectorization.

function srgbToLinear(v) {
  const c = Math.max(0, Math.min(1, v / 255));
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(v) {
  const c = Math.max(0, Math.min(1, v));
  return Math.round((c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055) * 255);
}

export function rgbToOklab(r, g, b) {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

function oklabToRgb([L, A, B]) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)];
}

function hexByte(v) { return v.toString(16).padStart(2, "0"); }
function rgbHex(rgb) { return "#" + rgb.map(hexByte).join(""); }
function dist(a, b) { return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2; }

function samples(imageData, max = 12000) {
  const out = [], total = imageData.width * imageData.height;
  const step = Math.max(1, Math.floor(total / max));
  for (let p = 0, i = 0; p < total; p += step, i = p * 4) {
    if (imageData.data[i + 3] > 8) out.push(rgbToOklab(imageData.data[i], imageData.data[i + 1], imageData.data[i + 2]));
  }
  out.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  return out;
}

export function buildPalette(imageData, maxColors = 12) {
  const pts = samples(imageData);
  const k = Math.max(2, Math.min(32, Math.round(Number(maxColors) || 12), pts.length || 2));
  let centers = Array.from({ length: k }, (_, i) => pts[Math.min(pts.length - 1, Math.floor(((i + 0.5) * pts.length) / k))] || [1, 0, 0]);
  for (let iter = 0; iter < 8; iter += 1) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (const p of pts) {
      let best = 0, bestD = Infinity;
      for (let i = 0; i < centers.length; i += 1) { const d = dist(p, centers[i]); if (d < bestD) { bestD = d; best = i; } }
      sums[best][0] += p[0]; sums[best][1] += p[1]; sums[best][2] += p[2]; sums[best][3] += 1;
    }
    centers = centers.map((c, i) => sums[i][3] ? [sums[i][0] / sums[i][3], sums[i][1] / sums[i][3], sums[i][2] / sums[i][3]] : c);
  }
  return centers.map((lab, index) => ({ index, lab, rgb: oklabToRgb(lab), fill: rgbHex(oklabToRgb(lab)) }));
}

export function nearestPaletteIndex(rgb, palette) {
  const lab = rgbToOklab(rgb[0], rgb[1], rgb[2]);
  let best = 0, bestD = Infinity;
  for (let i = 0; i < palette.length; i += 1) { const d = dist(lab, palette[i].lab); if (d < bestD) { bestD = d; best = i; } }
  return best;
}

export function labDistance(a, b) { return Math.sqrt(dist(a, b)); }
