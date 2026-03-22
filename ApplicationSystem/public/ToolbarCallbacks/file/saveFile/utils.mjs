// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/saveFile/utils.mjs
// This file defines helper utilities for the saveFile toolbar callback in Nodevision. It resolves active file paths, saves content via the API, and notifies listeners after writes.

const RASTER_EDITING_MODES = new Set([
  "PNGediting",
  "JPGediting",
  "JPEGediting",
  "GIFediting",
  "BMPediting",
  "WEBPediting",
]);

const RASTER_FILE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "bmp", "webp"]);

export function resolveFilePath(preferredPath) {
  return (
    preferredPath ||
    window.NodevisionState?.activeEditorFilePath ||
    window.currentActiveFilePath ||
    window.filePath ||
    window.selectedFilePath ||
    window.NodevisionState?.selectedFile ||
    null
  );
}

export async function saveViaApi(payload) {
  const normalize = (value) =>
    String(value || "")
      .trim()
      .replace(/\\/g, "/")
      .replace(/[?#].*$/, "");

  const isServerDataLoginBackground = (pathValue) => {
    const clean = normalize(pathValue).replace(/^\/+/, "");
    return clean === "ServerData/NotebookLoginBackground.svg";
  };

  const endpoint = isServerDataLoginBackground(payload?.path)
    ? "/api/serverData/save"
    : "/api/save";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok || !data?.success) {
    const detail = data?.error || `${res.status} ${res.statusText}`;
    throw new Error(detail);
  }

  return data;
}

export async function saveRasterCanvas(filePath) {
  const canvas = window.rasterCanvas;
  if (!(canvas instanceof HTMLCanvasElement)) return false;

  if (typeof window.saveRasterImage === "function") {
    if (window.saveRasterImage.length >= 2) {
      await window.saveRasterImage(canvas, filePath);
    } else {
      await window.saveRasterImage(filePath);
    }
    return true;
  }

  const dataURL = canvas.toDataURL("image/png");
  const base64Data = dataURL.replace(/^data:image\/png;base64,/, "");
  await saveViaApi({
    path: filePath,
    content: base64Data,
    encoding: "base64",
    mimeType: "image/png",
  });
  return true;
}

export function getFileExtension(pathValue = "") {
  const clean = String(pathValue || "").trim().replace(/[?#].*$/, "");
  const dot = clean.lastIndexOf(".");
  if (dot === -1) return "";
  return clean.slice(dot + 1).toLowerCase();
}

export function notifyFileSaved(path) {
  if (!path || typeof window === "undefined" || typeof window.dispatchEvent !== "function") return false;

  window.dispatchEvent(
    new CustomEvent("nodevision-file-saved", {
      detail: { filePath: path },
    }),
  );
  return true;
}

export function isRasterContext({ mode, fileExt, inWysiwygEditor } = {}) {
  const isRasterPath = RASTER_FILE_EXTENSIONS.has(fileExt);
  const isRasterMode = RASTER_EDITING_MODES.has(mode);
  const canSaveRasterCanvas =
    (isRasterMode || (isRasterPath && !inWysiwygEditor)) && !window.NodevisionState?.htmlImageEditingInline;
  return { canSaveRasterCanvas, isRasterMode, isRasterPath };
}
