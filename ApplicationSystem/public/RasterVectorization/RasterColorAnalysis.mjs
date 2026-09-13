// Nodevision/ApplicationSystem/public/RasterVectorization/RasterColorAnalysis.mjs
// This module assigns source-derived colors to traced raster regions. It averages original PNG pixels in linear-light RGB with alpha weighting while using the trace mask to avoid bounding-box color contamination.

function srgbToLinear(value) {
  const channel = Math.max(0, Math.min(1, value / 255));
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value) {
  const channel = Math.max(0, Math.min(1, value));
  const srgb = channel <= 0.0031308 ? channel * 12.92 : 1.055 * (channel ** (1 / 2.4)) - 0.055;
  return Math.round(srgb * 255);
}

function hexByte(value) {
  return value.toString(16).padStart(2, "0");
}

function colorToHex(color) {
  return "#" + hexByte(color.r) + hexByte(color.g) + hexByte(color.b);
}

function pixelsFromRect(mask, rect, width, height) {
  const pixels = [];
  const left = Math.max(0, Math.floor(rect.x)), top = Math.max(0, Math.floor(rect.y));
  const right = Math.min(width, Math.ceil(rect.x + rect.w)), bottom = Math.min(height, Math.ceil(rect.y + rect.h));
  for (let y = top; y < bottom; y += 1) for (let x = left; x < right; x += 1) {
    const p = y * width + x;
    if (mask[p]) pixels.push(p);
  }
  return pixels;
}

export function averageSourceColorForRegion(imageData, mask, rect, regionPixels = null) {
  const { width, height, data } = imageData;
  const pixels = regionPixels || pixelsFromRect(mask, rect, width, height);
  let r = 0, g = 0, b = 0, alpha = 0, count = 0;
  for (const p of pixels) {
    if (!mask[p]) continue;
    const i = p * 4;
    const a = data[i + 3] / 255;
    count += 1;
    if (a <= 0) continue;
    r += srgbToLinear(data[i]) * a;
    g += srgbToLinear(data[i + 1]) * a;
    b += srgbToLinear(data[i + 2]) * a;
    alpha += a;
  }
  if (!count || alpha <= 0) return { fill: "#000", fillOpacity: 0, pixelCount: count };
  const color = { r: linearToSrgb(r / alpha), g: linearToSrgb(g / alpha), b: linearToSrgb(b / alpha) };
  return { fill: colorToHex(color), fillOpacity: Math.max(0, Math.min(1, alpha / count)), pixelCount: count };
}

export function applySourceColors(paths, imageData, mask, options = {}) {
  if (!options.colorizeFromSource) return paths;
  return paths.map((path) => {
    if (path.lockFill) return path;
    const color = averageSourceColorForRegion(imageData, mask, path.rect || { x: 0, y: 0, w: imageData.width, h: imageData.height }, path.pixels);
    const fillOpacity = options.preserveAlpha === false ? 1 : color.fillOpacity;
    return { ...path, fill: color.fill, fillOpacity, sourceColor: color };
  });
}
