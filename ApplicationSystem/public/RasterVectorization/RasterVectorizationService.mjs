// Nodevision/ApplicationSystem/public/RasterVectorization/RasterVectorizationService.mjs
// This module exposes the reusable local raster-to-SVG vectorization service for Nodevision. It coordinates option normalization, raster preprocessing, mask tracing, SVG construction, and preview job coalescing without depending on PNG-viewer UI details.

import { normalizeVectorizationOptions, previewScaleForSize } from "./RasterVectorizationOptions.mjs";
import { preprocessRaster } from "./RasterPreprocess.mjs";
import { traceMaskToPaths } from "./RasterTrace.mjs";
import { buildVectorSvg, vectorizationStatistics } from "./RasterSvgBuilder.mjs";
import { applySourceColors } from "./RasterColorAnalysis.mjs";
import { traceColorRegions } from "./RasterColorRegionTrace.mjs";

let previewSerial = 0;

function downsampleImageData(imageData, scale) {
  if (scale >= 0.999) return imageData;
  const width = Math.max(1, Math.round(imageData.width * scale));
  const height = Math.max(1, Math.round(imageData.height * scale));
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(imageData.width - 1, Math.floor(x / scale));
      const sy = Math.min(imageData.height - 1, Math.floor(y / scale));
      const src = (sy * imageData.width + sx) * 4;
      const dst = (y * width + x) * 4;
      out[dst] = imageData.data[src]; out[dst + 1] = imageData.data[src + 1]; out[dst + 2] = imageData.data[src + 2]; out[dst + 3] = imageData.data[src + 3];
    }
  }
  return { width, height, data: out };
}

export function vectorizeRaster(imageData, options = {}) {
  if (!imageData?.data || !imageData.width || !imageData.height) throw new Error("ImageData is required for vectorization.");
  const normalized = normalizeVectorizationOptions(options);
  const preprocessed = preprocessRaster(imageData, normalized);
  const traced = normalized.mode === "color"
    ? traceColorRegions(imageData, normalized)
    : traceMaskToPaths(preprocessed.mask, preprocessed.width, preprocessed.height, normalized);
  const paths = applySourceColors(traced.paths, imageData, traced.mask, normalized);
  const svg = buildVectorSvg({ width: imageData.width, height: imageData.height, paths, options: normalized, title: options.title || "Vectorized raster" });
  const statistics = vectorizationStatistics(paths, svg, { components: traced.components, mode: normalized.mode, colorized: normalized.colorizeFromSource, rectanglePaths: traced.rectanglePaths, coverageRatio: traced.coverageRatio, colors: traced.colors, smallRegions: traced.smallRegions, initialRegions: traced.initialRegions, finalRegions: traced.finalRegions, mergedRegions: traced.mergedRegions, paletteSize: traced.paletteSize });
  return { svg, width: imageData.width, height: imageData.height, paths, statistics, processedImageData: preprocessed.processedImageData, options: normalized };
}

export function vectorizeRasterPreview(imageData, options = {}) {
  const scale = previewScaleForSize(imageData?.width, imageData?.height, options.maxPreviewSide || 700);
  return { ...vectorizeRaster(downsampleImageData(imageData, scale), options), previewScale: scale };
}

export function scheduleVectorizationPreview(imageData, options, callback, delay = 160) {
  const serial = ++previewSerial;
  const timer = setTimeout(() => {
    if (serial !== previewSerial) return;
    Promise.resolve().then(() => vectorizeRasterPreview(imageData, options)).then((result) => {
      if (serial === previewSerial) callback(null, result);
    }).catch((error) => { if (serial === previewSerial) callback(error); });
  }, delay);
  return () => { clearTimeout(timer); if (serial === previewSerial) previewSerial += 1; };
}

export function processedImageDataToDataUrl(imageData) {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  canvas.getContext("2d").putImageData(new ImageData(imageData.data, imageData.width, imageData.height), 0, 0);
  return canvas.toDataURL("image/png");
}
