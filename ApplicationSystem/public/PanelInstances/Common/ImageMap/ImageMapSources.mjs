// Nodevision/ApplicationSystem/public/PanelInstances/Common/ImageMap/ImageMapSources.mjs
// This module prepares Notebook image sources and blank image files for the reusable image map editor.

import {
  dirname,
  getActiveEditorNotebookPath,
  joinNotebookPath,
  normalizeNotebookPath,
  notebookHrefFromPath,
} from "/ToolbarJSONfiles/insertMediaCommon.mjs";
import {
  notebookSourceFromPath,
  saveNotebookBinaryFromDataUrl,
} from "/ToolbarJSONfiles/insertMediaIO.mjs";

export const IMAGE_MAP_IMAGE_EXTS = Object.freeze(["png", "svg", "jpg", "jpeg", "gif", "webp", "bmp"]);

// ------------------------------
// Source paths
// ------------------------------
function sanitizeName(name = "") {
  return String(name || "").trim().replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || `image-map-${Date.now()}.svg`;
}

export function imageMapEditorPath() {
  return getActiveEditorNotebookPath();
}

export function imageMapSourceFromNotebookPath(notebookPath = "", editorPath = imageMapEditorPath()) {
  const normalized = normalizeNotebookPath(notebookPath);
  if (!normalized) return null;
  return {
    savedSrc: notebookSourceFromPath(normalized, editorPath),
    previewSrc: notebookHrefFromPath(normalized),
    linkedNotebookPath: normalized,
  };
}

export function isSupportedImageMapImage(pathValue = "") {
  const clean = String(pathValue || "").split(/[?#]/)[0].toLowerCase();
  const ext = clean.includes(".") ? clean.split(".").pop() : "";
  return IMAGE_MAP_IMAGE_EXTS.includes(ext);
}

export function imageMapHrefFromNotebookPath(notebookPath = "", editorPath = imageMapEditorPath(), options = {}) {
  const normalized = normalizeNotebookPath(notebookPath);
  if (!normalized) return "";
  const href = notebookSourceFromPath(normalized, editorPath);
  return options.isDirectory && href && !href.endsWith("/") ? href + "/" : href;
}

// ------------------------------
// Blank image creation
// ------------------------------
function utf8ToBase64(value = "") {
  const bytes = new TextEncoder().encode(String(value));
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function blankSvgDataUrl(width, height) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"></svg>`;
  return `data:image/svg+xml;base64,${utf8ToBase64(svg)}`;
}

function blankPngDataUrl(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas.toDataURL("image/png");
}

function clampDimension(value, fallback = 512) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(4096, Math.max(1, number));
}

function ensureImageExtension(fileName = "", format = "svg") {
  const cleanFormat = String(format || "svg").toLowerCase() === "png" ? "png" : "svg";
  const cleanName = sanitizeName(fileName || `image-map-${Date.now()}.${cleanFormat}`);
  const baseName = cleanName.replace(/\.[a-z0-9]+$/i, "") || `image-map-${Date.now()}`;
  return `${baseName}.${cleanFormat}`;
}

function mimeFromFormat(format = "svg") {
  const clean = String(format || "svg").toLowerCase();
  if (clean === "svg") return "image/svg+xml";
  if (clean === "jpg" || clean === "jpeg") return "image/jpeg";
  if (clean === "gif") return "image/gif";
  if (clean === "webp") return "image/webp";
  if (clean === "bmp") return "image/bmp";
  return "image/png";
}

export async function createBlankNotebookImage(options = {}) {
  const editorPath = options.editorPath || imageMapEditorPath();
  const format = String(options.format || "svg").toLowerCase() === "png" ? "png" : "svg";
  const width = clampDimension(options.width);
  const height = clampDimension(options.height);
  const fileName = ensureImageExtension(options.fileName, format);
  const targetPath = normalizeNotebookPath(joinNotebookPath(dirname(editorPath), fileName));
  const dataUrl = format === "png" ? blankPngDataUrl(width, height) : blankSvgDataUrl(width, height);
  await saveNotebookBinaryFromDataUrl(targetPath, dataUrl, mimeFromFormat(format));
  return imageMapSourceFromNotebookPath(targetPath, editorPath);
}
