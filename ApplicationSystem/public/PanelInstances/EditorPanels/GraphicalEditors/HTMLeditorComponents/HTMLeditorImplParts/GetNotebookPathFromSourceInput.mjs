// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/GetNotebookPathFromSourceInput.mjs
// This module implements get Notebook Path From Source Input behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { normalizeNotebookPathInput } from "./MakeLayoutCanvasResizable.mjs";
import { isVirtualEditorPath, encodeNotebookUrl, sanitizeImageFilename, inferExtensionFromPath } from "./IsVirtualEditorPath.mjs";
import { resolveNotebookReference } from "/utils/notebookPath.mjs";
import { readBlobAsDataUrl } from "./FindClickedImage.mjs";
import { NEW_IMAGE_MIME_BY_EXTENSION } from "./EnsureHTMLLayoutStyles.mjs";
import { createPanelDOM } from "../../../../../panels/panelFactory.mjs";

// Get Notebook Path From Source Input operations.
export function getNotebookPathFromSourceInput(rawSource = "", editorFilePath = "") {
  const source = String(rawSource || "").trim();
  if (!source || source.startsWith("data:")) return "";
  if (/^(https?:)?\/\//i.test(source)) {
    try {
      const url = new URL(source, window.location.origin);
      if (url.origin === window.location.origin && url.pathname.startsWith("/Notebook/")) {
        return normalizeNotebookPathInput(url.pathname);
      }
    } catch {
      return "";
    }
    return "";
  }
  if (source.startsWith("/Notebook/") || source.startsWith("Notebook/") || source.startsWith("/")) {
    return normalizeNotebookPathInput(source);
  }
  if (isVirtualEditorPath(editorFilePath)) {
    return normalizeNotebookPathInput(source);
  }
  return resolveNotebookReference({
    sourcePath: editorFilePath,
    reference: source
  }) || "";
}

export async function sourceInputToInlineDataUrl(rawSource = "", editorFilePath = "") {
  const source = String(rawSource || "").trim();
  if (!source) throw new Error("Source is required");
  if (source.startsWith("data:image/")) return source;
  const notebookPath = getNotebookPathFromSourceInput(source, editorFilePath);
  const fetchUrl = notebookPath ? encodeNotebookUrl(notebookPath) : source;
  const res = await fetch(fetchUrl, {
    cache: "no-store"
  });
  if (!res.ok) {
    throw new Error(`Failed to load image source (${res.status} ${res.statusText})`);
  }
  const blob = await res.blob();
  return readBlobAsDataUrl(blob);
}

export function clampImageDimension(rawValue, fallback = 512) {
  const parsed = Number.parseInt(String(rawValue || "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(4096, parsed);
}

export function normalizeNewImageFormat(rawFormat = "") {
  const format = String(rawFormat || "").trim().toLowerCase();
  return format === "svg" ? "svg" : "png";
}

export function normalizeNewImageFilename(rawName = "", preferredFormat = "png") {
  const format = normalizeNewImageFormat(preferredFormat);
  const fallback = `image-${Date.now()}.${format}`;
  let name = sanitizeImageFilename(String(rawName || "").trim() || fallback);
  if (!inferExtensionFromPath(name)) {
    name = `${name}.${format}`;
  }
  const ext = inferExtensionFromPath(name);
  if (!NEW_IMAGE_MIME_BY_EXTENSION[ext] || ext !== "png" && ext !== "svg") {
    name = `${name.replace(/\.[^.]+$/, "") || `image-${Date.now()}`}.${format}`;
  }
  return name;
}

export function mimeTypeFromImageFilename(filename = "") {
  const ext = inferExtensionFromPath(filename);
  return NEW_IMAGE_MIME_BY_EXTENSION[ext] || "image/png";
}

export function utf8ToBase64(value = "") {
  const bytes = new TextEncoder().encode(String(value));
  let binary = "";
  bytes.forEach(b => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

export function createGeneratedImageDataUrl(format = "png", width = 512, height = 512) {
  const normalizedFormat = normalizeNewImageFormat(format);
  const mimeType = normalizedFormat === "svg" ? "image/svg+xml" : "image/png";
  if (mimeType === "image/svg+xml") {
    const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"></svg>`;
    return `data:image/svg+xml;base64,${utf8ToBase64(svgMarkup)}`;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create image canvas.");
  }
  return canvas.toDataURL(mimeType);
}

export async function createInsertImagePanel(displayName = "Insert Image") {
  const instanceId = "nv-insert-image-panel";
  const existing = document.querySelector(`.panel[data-instance-id="${instanceId}"]`);
  if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
  const panelInst = await createPanelDOM("InsertImageFormPanel", instanceId, "GenericPanel", {
    displayName
  });
  document.body.appendChild(panelInst.panel);
  panelInst.panel.__nvDefaultDockCell = window.activeCell && window.activeCell.classList?.contains("panel-cell") ? window.activeCell : null;
  if (panelInst.dockBtn && typeof panelInst.dockBtn.click === "function") {
    panelInst.dockBtn.click();
  }
  panelInst.panel.style.width = "min(560px, 88vw)";
  panelInst.panel.style.height = "auto";
  panelInst.panel.style.maxHeight = "min(560px, 82vh)";
  panelInst.panel.style.left = `${Math.max(20, Math.round(window.innerWidth * 0.2))}px`;
  panelInst.panel.style.top = `${Math.max(20, Math.round(window.innerHeight * 0.15))}px`;
  panelInst.panel.style.zIndex = "23000";
  panelInst.panel.style.pointerEvents = "auto";
  panelInst.content.style.padding = "10px";
  panelInst.content.style.background = "#f8f8f8";
  panelInst.content.style.overflow = "auto";
  panelInst.content.innerHTML = "";
  return {
    panelEl: panelInst.panel,
    body: panelInst.content,
    closeBtn: panelInst.closeBtn
  };
}
