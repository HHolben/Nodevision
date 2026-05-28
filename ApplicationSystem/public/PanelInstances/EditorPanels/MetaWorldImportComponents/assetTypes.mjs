// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/MetaWorldImportComponents/assetTypes.mjs
// This file classifies Notebook assets and builds small preview fragments for the Meta World import panel.

export const PREVIEWABLE_IMAGE_TYPES = new Set(["billboard"]);

export function cleanNotebookPath(path = "") {
  return String(path || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^Notebook\//i, "");
}

export function selectedWorldPath() {
  const raw = window.VRWorldContext?.currentWorldPath
    || window.NodevisionState?.selectedFile
    || window.selectedFilePath
    || "";
  return cleanNotebookPath(raw);
}

export function isHtmlWorldPath(path = "") {
  return /\.html?$/i.test(cleanNotebookPath(path));
}

export function typeLabel(type = "") {
  if (type === "billboard") return "Image billboard";
  if (type === "model") return "3D model";
  if (type === "audio") return "Spatial audio";
  if (type === "video") return "Video screen";
  return "Asset";
}

export function createPreview(asset) {
  const preview = document.createElement("div");
  preview.className = "nv-mw-import-preview";
  if (PREVIEWABLE_IMAGE_TYPES.has(asset.type)) {
    const img = document.createElement("img");
    img.alt = "";
    img.loading = "lazy";
    img.src = asset.path;
    preview.appendChild(img);
    return preview;
  }
  preview.textContent = typeLabel(asset.type);
  preview.classList.add("nv-mw-import-preview--placeholder");
  return preview;
}
