// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/GetImageEditorDescriptor.mjs
// This module implements get Image Editor Descriptor behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { inferExtensionFromPath, getDefaultNotebookImageDir, ensureFilenameExtension, sanitizeImageFilename, sourceFromNotebookPath } from "./IsVirtualEditorPath.mjs";
import { SVG_IMAGE_EXTENSIONS, RASTER_IMAGE_EXTENSIONS, NEW_IMAGE_MIME_BY_EXTENSION, NEW_IMAGE_DEFAULT_DISPLAY_WIDTH, NEW_IMAGE_DEFAULT_DISPLAY_HEIGHT } from "./EnsureHTMLLayoutStyles.mjs";
import { normalizeNotebookPathInput } from "./MakeLayoutCanvasResizable.mjs";
import { applyFallbackReferencesToElement } from "/utils/referenceFallbacks.mjs";
import { classifyImageChoice, pickLocalImageFile, readFileAsDataUrl, saveNotebookImageFromDataUrl } from "./PickLocalImageFile.mjs";
import { clearImageTextSelection } from "../HtmlImageText.mjs";
import { presentHtmlClass } from "/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlPresentation.mjs";

// Get Image Editor Descriptor operations.
export function getImageEditorDescriptor(linkedNotebookPath = "") {
  const ext = inferExtensionFromPath(linkedNotebookPath);
  if (SVG_IMAGE_EXTENSIONS.has(ext)) {
    return {
      label: "SVG Editor",
      modulePath: "/PanelInstances/EditorPanels/GraphicalEditors/SVGeditor.mjs"
    };
  }
  if (RASTER_IMAGE_EXTENSIONS.has(ext)) {
    return {
      label: "Image Editor",
      modulePath: "/PanelInstances/EditorPanels/GraphicalEditors/PNGeditor.mjs"
    };
  }
  return null;
}

export function getImageEditorMode(linkedNotebookPath = "") {
  const ext = inferExtensionFromPath(linkedNotebookPath);
  if (SVG_IMAGE_EXTENSIONS.has(ext)) return "SVG Editing";
  if (RASTER_IMAGE_EXTENSIONS.has(ext)) return "PNGediting";
  return "GraphicalEditor";
}

export function buildTemporaryImageEditPath(editorFilePath = "", extension = "png") {
  const ext = String(extension || "png").toLowerCase();
  const safeExt = NEW_IMAGE_MIME_BY_EXTENSION[ext] ? ext : "png";
  const defaultDir = getDefaultNotebookImageDir(editorFilePath);
  const tempName = `nv-inline-edit-${Date.now()}-${Math.floor(Math.random() * 1e6)}.${safeExt}`;
  return normalizeNotebookPathInput([defaultDir, tempName].filter(Boolean).join("/"));
}

export function decorateInsertedImage(img, insertion) {
  if (!(img instanceof HTMLImageElement)) return img;
  img.classList.add("nv-editable-image");
  // Preserve crisp nearest-neighbor scaling by default (good for pixel art).
  img.style.imageRendering = "pixelated";
  if (insertion?.mode === "inline-new" || insertion?.mode === "referenced-new") {
    // Keep a consistent on-page size for newly generated images,
    // independent from pixel resolution chosen at creation time.
    img.style.width = `${NEW_IMAGE_DEFAULT_DISPLAY_WIDTH}px`;
    img.style.height = `${NEW_IMAGE_DEFAULT_DISPLAY_HEIGHT}px`;
  }
  if (Array.isArray(insertion?.fallbacks)) {
    applyFallbackReferencesToElement(img, insertion.fallbacks, {
      primary: insertion.src
    });
  }
  if (insertion?.linkedNotebookPath) {
    img.setAttribute("data-nv-linked-path", normalizeNotebookPathInput(insertion.linkedNotebookPath));
  } else {
    img.removeAttribute("data-nv-linked-path");
  }
  return img;
}

export async function chooseImageInsertion(editorFilePath = "") {
  const choice = classifyImageChoice(prompt("Insert image mode:\n1) Linked Notebook image (upload and save file)\n2) Inline image (embed in document)\n3) Existing Notebook image path\n4) External URL", "1"));
  if (choice === "linked-upload") {
    const file = await pickLocalImageFile();
    if (!file) return null;
    const dataUrl = await readFileAsDataUrl(file);
    const defaultDir = getDefaultNotebookImageDir(editorFilePath);
    const defaultName = ensureFilenameExtension(sanitizeImageFilename(file.name), file.type);
    const defaultPath = [defaultDir, defaultName].filter(Boolean).join("/");
    const entered = prompt("Save linked image under Notebook path:", defaultPath);
    if (!entered) return null;
    const notebookPath = normalizeNotebookPathInput(entered);
    if (!notebookPath) return null;
    try {
      await saveNotebookImageFromDataUrl(notebookPath, dataUrl);
    } catch (err) {
      alert(`Failed to save linked image: ${err.message}`);
      return null;
    }
    return {
      src: sourceFromNotebookPath(notebookPath, editorFilePath),
      linkedNotebookPath: notebookPath,
      mode: "linked-upload"
    };
  }
  if (choice === "inline") {
    const file = await pickLocalImageFile();
    if (!file) return null;
    const dataUrl = await readFileAsDataUrl(file);
    return {
      src: dataUrl,
      linkedNotebookPath: "",
      mode: "inline"
    };
  }
  if (choice === "existing-notebook") {
    const entered = prompt("Notebook image path (example: images/photo.png):", "");
    if (!entered) return null;
    const notebookPath = normalizeNotebookPathInput(entered);
    if (!notebookPath) return null;
    return {
      src: sourceFromNotebookPath(notebookPath, editorFilePath),
      linkedNotebookPath: notebookPath,
      mode: "existing-notebook"
    };
  }
  const external = prompt("External image URL:", "https://");
  if (!external || !external.trim()) return null;
  return {
    src: external.trim(),
    linkedNotebookPath: "",
    mode: "external-url"
  };
}

export function markSelectedImage(wysiwyg, imageEl) {
  clearImageTextSelection(wysiwyg);
  wysiwyg.querySelectorAll(".nv-selected-image").forEach(img => {
    presentHtmlClass(img, "nv-selected-image", false);
  });
  wysiwyg.querySelectorAll(".nv-selected-image-item").forEach(item => {
    presentHtmlClass(item, "nv-selected-image-item", false);
  });
  if (!(imageEl instanceof HTMLImageElement)) return;
  presentHtmlClass(imageEl, "nv-selected-image", true);
  const canvasItem = imageEl.closest(".nv-canvas-item");
  if (canvasItem) presentHtmlClass(canvasItem, "nv-selected-image-item", true);
}

export function markSelectedAudio(wysiwyg, audioEl) {
  wysiwyg.querySelectorAll(".nv-selected-audio").forEach(el => {
    presentHtmlClass(el, "nv-selected-audio", false);
  });
  if (!(audioEl instanceof HTMLAudioElement)) return;
  presentHtmlClass(audioEl, "nv-selected-audio", true);
}
