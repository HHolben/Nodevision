// Nodevision/ApplicationSystem/public/Sessions/SketchFocusExport.mjs
// This module converts Sketch Focus stroke models into SVG, PNG, JPG, or GIF payloads suitable for the normal Nodevision Notebook save API.

import { bytesToBase64, createGrayscalePalette, encodeGif } from "/Shared/GifEncoder.mjs";
import { renderSketchToCanvas } from "./SketchFocusRenderer.mjs";
import { serializeSketchSvg } from "./SketchFocusSvgExport.mjs";

export async function exportSketch(sketch, format, options = {}) {
  const cleanFormat = String(format || "png").toLowerCase();
  if (cleanFormat === "svg") {
    const content = serializeSketchSvg(sketch, { profile: options.svgProfile, title: options.title });
    return { format: "svg", mimeType: "image/svg+xml", encoding: "utf8", content, bytes: null };
  }
  if (cleanFormat === "gif") return exportGif(sketch, options);
  const mimeType = cleanFormat === "jpg" ? "image/jpeg" : "image/png";
  const canvas = createCanvasForExport(sketch, options);
  if (cleanFormat === "png" && Number(options.grayLevels || 256) < 256) quantizeCanvasGray(canvas, options.grayLevels);
  const blob = await canvasToBlob(canvas, mimeType, cleanFormat === "jpg" ? Number(options.quality || 0.9) : undefined);
  return { format: cleanFormat, mimeType, encoding: "base64", content: await blobToBase64(blob), bytes: blob.size };
}

export function createCanvasForExport(sketch, options = {}) {
  const canvas = document.createElement("canvas");
  renderSketchToCanvas(canvas, sketch, { scale: Number(options.scale || 1), alpha: false });
  return canvas;
}

export function quantizeCanvasGray(canvas, levels = 256) {
  const count = Math.max(2, Math.min(256, Math.round(Number(levels) || 256)));
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const gray = Math.round((imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3);
    const value = Math.round((Math.round((gray / 255) * (count - 1)) / (count - 1)) * 255);
    imageData.data[i] = value;
    imageData.data[i + 1] = value;
    imageData.data[i + 2] = value;
  }
  ctx.putImageData(imageData, 0, 0);
  return true;
}

export function exportGif(sketch, options = {}) {
  const canvas = createCanvasForExport(sketch, { scale: Number(options.scale || 1) });
  const levels = Math.max(2, Math.min(256, Math.round(Number(options.grayLevels || 256))));
  quantizeCanvasGray(canvas, levels);
  const bytes = encodeGif([{ canvas, delayMs: 100, grayscale: true }], canvas.width, canvas.height, {
    palette: createGrayscalePalette(levels),
  });
  return {
    format: "gif",
    mimeType: "image/gif",
    encoding: "base64",
    content: bytesToBase64(bytes),
    bytes: bytes.length,
  };
}

export function formatOptionsDefaults(format) {
  const clean = String(format || "").toLowerCase();
  if (clean === "svg") return { svgProfile: "balanced" };
  if (clean === "png") return { scale: 1, grayLevels: 256 };
  if (clean === "jpg") return { scale: 1, quality: 0.9 };
  if (clean === "gif") return { scale: 1, grayLevels: 256 };
  return {};
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas export failed."));
    }, mimeType, quality);
  });
}

async function blobToBase64(blob) {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  return bytesToBase64(buffer);
}
