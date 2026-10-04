// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/IsVirtualEditorPath.mjs
// This module implements is Virtual Editor Path behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { normalizePath, stripQueryAndHash, normalizeNotebookPathInput, dirname, resolveRelativePath } from "./MakeLayoutCanvasResizable.mjs";
import { NOTEBOOK_PREFIX } from "./EnsureHTMLLayoutStyles.mjs";
import { getRelativeNotebookReference } from "/utils/notebookPath.mjs";
import { buildImageContextFromElement } from "./BuildImageContextFromElement.mjs";
import { mimeTypeFromImageFilename } from "./GetNotebookPathFromSourceInput.mjs";
import { htmlSourceProvenanceFor } from "/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlPresentation.mjs";

// Is Virtual Editor Path operations.
export function isVirtualEditorPath(filePath = "") {
  return String(filePath || "").startsWith("__epub_virtual__/");
}

export function sanitizeImageFilename(name = "") {
  const clean = String(name || "").replace(/[^\w.\-]+/g, "_").replace(/^_+|_+$/g, "");
  if (clean) return clean;
  return `image-${Date.now()}.png`;
}

export function inferExtensionFromMime(mime = "") {
  const clean = String(mime || "").toLowerCase();
  const map = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/bmp": "bmp",
    "image/svg+xml": "svg"
  };
  return map[clean] || "";
}

export function inferExtensionFromPath(pathLike = "") {
  const clean = normalizePath(stripQueryAndHash(pathLike));
  const idx = clean.lastIndexOf(".");
  if (idx === -1) return "";
  return clean.slice(idx + 1).toLowerCase();
}

export function ensureFilenameExtension(filename = "", mimeType = "") {
  const current = inferExtensionFromPath(filename);
  if (current) return filename;
  const ext = inferExtensionFromMime(mimeType) || "png";
  return `${filename}.${ext}`;
}

export function getDefaultNotebookImageDir(editorFilePath = "") {
  const normalizedEditorPath = normalizeNotebookPathInput(editorFilePath);
  if (isVirtualEditorPath(normalizedEditorPath)) {
    const activeFile = normalizeNotebookPathInput(window.NodevisionState?.activeEditorFilePath || window.currentActiveFilePath || "");
    const activeDir = dirname(activeFile);
    return activeDir || "images";
  }
  return dirname(normalizedEditorPath);
}

export function encodeNotebookUrl(notebookPath = "") {
  const parts = normalizeNotebookPathInput(notebookPath).split("/").filter(Boolean).map(segment => encodeURIComponent(segment));
  return `${NOTEBOOK_PREFIX}${parts.join("/")}`;
}

export function sourceFromNotebookPath(notebookPath = "", editorFilePath = "") {
  const normalized = normalizeNotebookPathInput(notebookPath);
  if (!normalized) return "";
  const mode = window.NodevisionState?.currentMode || "";
  if (mode === "EPUBediting" || isVirtualEditorPath(editorFilePath)) {
    return encodeNotebookUrl(normalized);
  }
  return getRelativeNotebookReference({
    sourcePath: editorFilePath,
    targetPath: normalized
  });
}

export async function resolveEditorImageDisplay(imageEl, editorFilePath) {
  if (!(imageEl instanceof HTMLImageElement)) return null;
  const originalSrc = String(imageEl.getAttribute("src") || imageEl.currentSrc || "").trim();
  if (!originalSrc) return null;
  const context = buildImageContextFromElement(imageEl, editorFilePath);
  if (context.linkedNotebookPath) {
    const displaySrc = encodeNotebookUrl(context.linkedNotebookPath);
    if (displaySrc && displaySrc !== originalSrc) {
      return {
        displaySrc,
        savedValue: originalSrc
      };
    }
    return null;
  }
  if (!isVirtualEditorPath(editorFilePath)) return null;
  const epubContext = window.NodevisionState?.epubImageContext;
  if (!epubContext || !epubContext.zip) return null;
  const baseDir = epubContext.chapterDir || "";
  const href = context.src || originalSrc;
  const targetPath = resolveRelativePath(baseDir, href);
  if (!targetPath) return null;
  const entry = epubContext.zip.file(targetPath);
  if (!entry) return null;
  const buffer = await entry.async("arraybuffer");
  const mimeType = mimeTypeFromImageFilename(targetPath);
  const blob = new Blob([buffer], {
    type: mimeType || undefined
  });
  const blobUrl = URL.createObjectURL(blob);
  if (!blobUrl) return null;
  return {
    displaySrc: blobUrl,
    savedValue: originalSrc,
    blobUrl
  };
}

export async function hydrateEditorImage(imageEl, editorFilePath) {
  if (!(imageEl instanceof HTMLImageElement)) return;
  const provenance = htmlSourceProvenanceFor(imageEl),
    source = imageEl.getAttribute("src");
  const displayInfo = await resolveEditorImageDisplay(imageEl, editorFilePath);
  if (!displayInfo?.displaySrc) return;
  if (!provenance || !imageEl.isConnected || imageEl.getAttribute("src") !== source) {
    if (displayInfo.blobUrl) URL.revokeObjectURL(displayInfo.blobUrl);
    return;
  }
  if (provenance) provenance.resolveAttribute(imageEl, "src", displayInfo.displaySrc);
}

export async function hydrateEditorImages(root, editorFilePath) {
  if (!root) return;
  const images = Array.from(root.querySelectorAll("img"));
  for (const image of images) {
    try {
      await hydrateEditorImage(image, editorFilePath);
    } catch (err) {
      console.warn("Failed to hydrate editor image:", err);
    }
  }
}
