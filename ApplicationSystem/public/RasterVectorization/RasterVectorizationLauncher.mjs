// Nodevision/ApplicationSystem/public/RasterVectorization/RasterVectorizationLauncher.mjs
// This module opens the PNG-to-SVG vectorization overlay from viewer and toolbar entry points. It centralizes active PNG path resolution so File menu and PNG viewer commands use the same conversion workflow.

import { openNodevisionOverlayPanel } from "../TemplateSystem/NodevisionOverlayPanel.mjs";
import { loadImageData } from "./RasterImageLoader.mjs";
import { normalizeNotebookPath } from "./RasterVectorizationWorkflow.mjs";

export function isPngPath(pathValue = "") {
  return normalizeNotebookPath(pathValue).toLowerCase().endsWith(".png");
}

export function resolveActivePngPath(preferredPath = "") {
  const state = window.NodevisionState || {};
  const candidates = [
    preferredPath,
    state.activeFileViewPath,
    state.activeEditorFilePath,
    window.currentActiveFilePath,
    window.filePath,
    window.selectedFilePath,
    state.selectedFile,
  ];
  for (const candidate of candidates) {
    const clean = normalizeNotebookPath(candidate);
    if (clean && isPngPath(clean)) return clean;
  }
  return "";
}

export async function openPngVectorizationOverlay(pathValue, options = {}) {
  const sourcePath = resolveActivePngPath(pathValue);
  if (!sourcePath) throw new Error("Open or select a PNG file before converting to SVG.");
  const imageData = await loadImageData(sourcePath, options.serverBase || "/Notebook");
  return openNodevisionOverlayPanel("RasterVectorizationOverlay", { sourcePath, imageData }, { panelClass: "InfoPanel" });
}
