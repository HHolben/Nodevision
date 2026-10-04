// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/BuildImageContextFromElement.mjs
// This module implements build Image Context From Element behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { htmlSourceProvenanceFor } from "/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlPresentation.mjs";
import { normalizeNotebookPathInput } from "./MakeLayoutCanvasResizable.mjs";
import { inferExtensionFromMime, inferExtensionFromPath, isVirtualEditorPath } from "./IsVirtualEditorPath.mjs";
import { parseDataUrl } from "./PickLocalImageFile.mjs";
import { resolveNotebookReference } from "/utils/notebookPath.mjs";

// Build Image Context From Element operations.
export function buildImageContextFromElement(imageEl, editorFilePath = "") {
  if (!(imageEl instanceof HTMLImageElement)) return null;
  const rawSrc = htmlSourceProvenanceFor(imageEl)?.sourceAttribute(imageEl, "src") ?? imageEl.getAttribute("src") ?? "";
  const explicitLinked = normalizeNotebookPathInput(imageEl.getAttribute("data-nv-linked-path") || "");
  const source = String(rawSrc || "").trim();
  const context = {
    element: imageEl,
    src: source,
    linkedNotebookPath: "",
    isInline: false,
    isExternal: false,
    extension: ""
  };
  if (!source) return context;
  if (source.startsWith("data:image/")) {
    context.isInline = true;
    context.extension = inferExtensionFromMime(parseDataUrl(source)?.mimeType || "");
    return context;
  }
  if (explicitLinked) {
    context.linkedNotebookPath = explicitLinked;
    context.extension = inferExtensionFromPath(explicitLinked);
    return context;
  }
  if (/^(https?:)?\/\//i.test(source)) {
    try {
      const url = new URL(source, window.location.origin);
      if (url.origin === window.location.origin && url.pathname.startsWith("/Notebook/")) {
        const notebookPath = normalizeNotebookPathInput(url.pathname);
        context.linkedNotebookPath = notebookPath;
        context.extension = inferExtensionFromPath(notebookPath);
      } else {
        context.isExternal = true;
      }
    } catch {
      context.isExternal = true;
    }
    return context;
  }
  if (source.startsWith("/Notebook/") || source.startsWith("Notebook/")) {
    const notebookPath = normalizeNotebookPathInput(source);
    context.linkedNotebookPath = notebookPath;
    context.extension = inferExtensionFromPath(notebookPath);
    return context;
  }
  if (isVirtualEditorPath(editorFilePath)) {
    context.isExternal = true;
    return context;
  }
  const resolved = resolveNotebookReference({
    sourcePath: editorFilePath,
    reference: source
  });
  if (resolved) {
    context.linkedNotebookPath = resolved;
    context.extension = inferExtensionFromPath(context.linkedNotebookPath);
  }
  return context;
}

export function findClickedAudio(target) {
  if (!(target instanceof Element)) return null;
  const direct = target.closest("audio");
  if (direct instanceof HTMLAudioElement) return direct;
  return null;
}

export function buildAudioContextFromElement(audioEl, editorFilePath = "") {
  if (!(audioEl instanceof HTMLAudioElement)) return null;
  const rawSrc = audioEl.getAttribute("src") || audioEl.currentSrc || "";
  const explicitLinked = normalizeNotebookPathInput(audioEl.getAttribute("data-nv-linked-path") || "");
  const source = String(rawSrc || "").trim();
  const context = {
    element: audioEl,
    src: source,
    linkedNotebookPath: "",
    isInline: false,
    isExternal: false,
    extension: ""
  };
  if (!source && explicitLinked) {
    context.linkedNotebookPath = explicitLinked;
    context.extension = inferExtensionFromPath(explicitLinked);
    return context;
  }
  if (!source) return context;
  if (source.startsWith("data:audio/")) {
    context.isInline = true;
    context.extension = inferExtensionFromMime(parseDataUrl(source)?.mimeType || "");
    return context;
  }
  if (explicitLinked) {
    context.linkedNotebookPath = explicitLinked;
    context.extension = inferExtensionFromPath(explicitLinked);
    return context;
  }
  if (/^(https?:)?\/\//i.test(source)) {
    try {
      const url = new URL(source, window.location.origin);
      if (url.origin === window.location.origin && url.pathname.startsWith("/Notebook/")) {
        const notebookPath = normalizeNotebookPathInput(url.pathname);
        context.linkedNotebookPath = notebookPath;
        context.extension = inferExtensionFromPath(notebookPath);
      } else {
        context.isExternal = true;
      }
    } catch {
      context.isExternal = true;
    }
    return context;
  }
  if (source.startsWith("/Notebook/") || source.startsWith("Notebook/")) {
    const notebookPath = normalizeNotebookPathInput(source);
    context.linkedNotebookPath = notebookPath;
    context.extension = inferExtensionFromPath(notebookPath);
    return context;
  }
  if (isVirtualEditorPath(editorFilePath)) {
    context.isExternal = true;
    return context;
  }
  const resolved = resolveNotebookReference({
    sourcePath: editorFilePath,
    reference: source
  });
  if (resolved) {
    context.linkedNotebookPath = resolved;
    context.extension = inferExtensionFromPath(context.linkedNotebookPath);
  }
  return context;
}
