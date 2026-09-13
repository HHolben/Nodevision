// Nodevision/ApplicationSystem/public/RasterVectorization/RasterColorRegionTrace.mjs
// Palette-first Color Region segmentation. Opaque pixels are quantized, small noisy regions are absorbed into neighbors, and final palette regions are traced as coherent contours.

import { labDistance, buildPalette, nearestPaletteIndex } from "./RasterPalette.mjs";
import { traceMaskToPaths } from "./RasterTrace.mjs";

function opaqueMask(imageData) {
  const mask = new Uint8Array(imageData.width * imageData.height);
  let count = 0;
  for (let i = 0, p = 0; i < imageData.data.length; i += 4, p += 1) if (imageData.data[i + 3] > 8) { mask[p] = 1; count += 1; }
  return { mask, count };
}

function assignLabels(imageData, palette, opaque) {
  const labels = new Int16Array(imageData.width * imageData.height).fill(-1);
  for (let i = 0, p = 0; i < imageData.data.length; i += 4, p += 1) {
    if (!opaque[p]) continue;
    labels[p] = nearestPaletteIndex([imageData.data[i], imageData.data[i + 1], imageData.data[i + 2]], palette);
  }
  return labels;
}

function neighbors(p, width, height) {
  const x = p % width, y = Math.floor(p / width), out = [];
  if (x > 0) out.push(p - 1);
  if (x + 1 < width) out.push(p + 1);
  if (y > 0) out.push(p - width);
  if (y + 1 < height) out.push(p + width);
  return out;
}

function components(labels, width, height) {
  const seen = new Uint8Array(labels.length), out = [];
  for (let start = 0; start < labels.length; start += 1) {
    const label = labels[start];
    if (label < 0 || seen[start]) continue;
    const queue = [start], pixels = [], boundary = new Map();
    seen[start] = 1;
    for (let q = 0; q < queue.length; q += 1) {
      const p = queue[q]; pixels.push(p);
      for (const n of neighbors(p, width, height)) {
        if (labels[n] === label && !seen[n]) { seen[n] = 1; queue.push(n); }
        else if (labels[n] >= 0 && labels[n] !== label) boundary.set(labels[n], (boundary.get(labels[n]) || 0) + 1);
      }
    }
    out.push({ label, pixels, area: pixels.length, boundary });
  }
  return out;
}

function isFineDarkDetail(component, palette, minArea) {
  if (component.area < Math.max(2, minArea / 4)) return false;
  const lab = palette[component.label].lab;
  let maxContrast = 0;
  for (const n of component.boundary.keys()) maxContrast = Math.max(maxContrast, labDistance(lab, palette[n].lab));
  return lab[0] < 0.42 && maxContrast > 0.18;
}

function bestNeighbor(component, palette) {
  let best = -1, score = -Infinity;
  for (const [label, shared] of component.boundary.entries()) {
    const d = labDistance(palette[component.label].lab, palette[label].lab);
    const s = shared * 2 - d * 18;
    if (s > score) { score = s; best = label; }
  }
  return best;
}

function absorbSmallRegions(labels, width, height, palette, options) {
  const minArea = Math.max(1, Math.round(options.regionMinArea || options.minFeatureSize * 6 || 12));
  let merged = 0;
  for (let pass = 0; pass < 3; pass += 1) {
    let changed = false;
    for (const component of components(labels, width, height)) {
      if (component.area >= minArea || isFineDarkDetail(component, palette, minArea)) continue;
      const target = bestNeighbor(component, palette);
      if (target < 0) continue;
      component.pixels.forEach((p) => { labels[p] = target; });
      merged += 1; changed = true;
    }
    if (!changed) break;
  }
  return merged;
}

function removeBackground(labels, palette, opaqueCount, policy) {
  if (policy !== "remove-light" && policy !== "remove-dark") return 0;
  const counts = new Map();
  for (const label of labels) if (label >= 0) counts.set(label, (counts.get(label) || 0) + 1);
  let removed = 0;
  for (const [label, count] of counts.entries()) {
    if (count / Math.max(1, opaqueCount) < 0.15) continue;
    const light = palette[label].lab[0];
    const remove = policy === "remove-light" ? light > 0.86 : light < 0.12;
    if (remove) for (let p = 0; p < labels.length; p += 1) if (labels[p] === label) { labels[p] = -1; removed += 1; }
  }
  return removed;
}

function traceLabels(labels, width, height, palette, options) {
  const paths = [], regionMask = new Uint8Array(labels.length), labelsUsed = new Set();
  for (let label = 0; label < palette.length; label += 1) {
    const mask = new Uint8Array(labels.length);
    let pixels = 0;
    for (let p = 0; p < labels.length; p += 1) if (labels[p] === label) { mask[p] = 1; pixels += 1; regionMask[p] = 1; }
    if (!pixels) continue;
    labelsUsed.add(label);
    const traced = traceMaskToPaths(mask, width, height, { ...options, minFeatureSize: 1 });
    for (const path of traced.paths) { path.fill = palette[label].fill; path.paletteLabel = label; path.lockFill = true; paths.push(path); }
  }
  return { paths, regionMask, labelsUsed };
}

export function traceColorRegions(imageData, options = {}) {
  const opaque = opaqueMask(imageData);
  const palette = buildPalette(imageData, options.colorMaxColors);
  const labels = assignLabels(imageData, palette, opaque.mask);
  const removedPixels = removeBackground(labels, palette, opaque.count, options.backgroundPolicy);
  const initialRegions = components(labels, imageData.width, imageData.height).length;
  const mergedRegions = absorbSmallRegions(labels, imageData.width, imageData.height, palette, options);
  const finalRegions = components(labels, imageData.width, imageData.height).length;
  const traced = traceLabels(labels, imageData.width, imageData.height, palette, options);
  const covered = traced.regionMask.reduce((sum, value) => sum + value, 0);
  return { paths: traced.paths, mask: traced.regionMask, components: traced.paths.map((p, i) => ({ id: i + 1, pixels: p.pixels?.length || 0 })), coverageRatio: opaque.count ? covered / opaque.count : 1, colors: traced.labelsUsed.size, paletteSize: palette.length, initialRegions, finalRegions, mergedRegions, removedPixels, smallRegions: mergedRegions, rectanglePaths: traced.paths.filter((path) => path.loops?.length === 1 && path.loops[0].length === 4).length };
}
