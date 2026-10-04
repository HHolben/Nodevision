// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/MakeLayoutCanvasResizable.mjs
// This module implements make Layout Canvas Resizable behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { presentHtmlAttribute } from "/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlPresentation.mjs";
import { createOnResizeStartHandler } from "./CreateOnResizeStartHandler.mjs";
import { appendEditorHandlesToItem } from "./AppendEditorHandlesToItem.mjs";
import { NOTEBOOK_PREFIX } from "./EnsureHTMLLayoutStyles.mjs";
import { normalizeNotebookRelativePath, normalizeNotebookFilePath } from "/utils/notebookPath.mjs";
import { notebookPathFromPickedFile } from "/ToolbarJSONfiles/insertMediaCommon.mjs";

// Make Layout Canvas Resizable operations.
export function makeLayoutCanvasResizable(canvas) {
  if (canvas.dataset.nvResizable === "true") return;
  presentHtmlAttribute(canvas, "data-nv-resizable", "true");
  const minWidth = 200;
  const minHeight = 160;
  const onResizeStart = createOnResizeStartHandler({
    get canvas() {
      return canvas;
    },
    get minWidth() {
      return minWidth;
    },
    get minHeight() {
      return minHeight;
    }
  });
  canvas.querySelectorAll(".nv-canvas-resize-handle").forEach(handle => {
    handle.addEventListener("pointerdown", e => onResizeStart(handle, e));
  });
}

export function createCanvasItem({
  typeLabel,
  x = 24,
  y = 24,
  width = 220,
  height = 120,
  contentNode,
  editable = false
}) {
  const item = document.createElement("div");
  item.className = "nv-canvas-item";
  item.style.left = `${x}px`;
  item.style.top = `${y}px`;
  item.style.width = `${width}px`;
  item.style.height = `${height}px`;
  item.dataset.rotation = "0";
  const content = document.createElement("div");
  content.className = "nv-item-content";
  if (editable) {
    content.setAttribute("contenteditable", "true");
  } else {
    content.setAttribute("contenteditable", "false");
  }
  content.appendChild(contentNode);
  item.appendChild(content);
  appendEditorHandlesToItem(item);
  return item;
}

export function safeDecode(value = "") {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function normalizePathSlashes(value = "") {
  return String(value).replace(/\\/g, "/");
}

export function stripQueryAndHash(value = "") {
  const q = value.indexOf("?");
  const h = value.indexOf("#");
  const stop = [q, h].filter(idx => idx >= 0).sort((a, b) => a - b)[0];
  return stop === undefined ? value : value.slice(0, stop);
}

export function normalizePath(pathLike = "") {
  const raw = normalizePathSlashes(stripQueryAndHash(String(pathLike).trim()));
  const parts = raw.split("/");
  const out = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (out.length > 0) out.pop();
      continue;
    }
    out.push(part);
  }
  return out.join("/");
}

export function dirname(pathLike = "") {
  const clean = normalizePath(pathLike);
  const idx = clean.lastIndexOf("/");
  return idx === -1 ? "" : clean.slice(0, idx);
}

export function resolveRelativePath(baseDir = "", href = "") {
  const target = String(href || "").trim();
  if (!target) return "";
  if (/^(https?:)?\/\//i.test(target) || target.startsWith("data:")) {
    return target;
  }
  if (target.startsWith("/")) {
    return normalizePath(target.replace(/^\/+/, ""));
  }
  return normalizePath([baseDir, target].filter(Boolean).join("/"));
}

export function normalizeNotebookPathInput(inputPath = "") {
  const raw = String(inputPath || "").trim();
  if (!raw) return "";
  if (/^(https?:)?\/\//i.test(raw)) {
    try {
      const url = new URL(raw, window.location.origin);
      if (url.origin === window.location.origin && url.pathname.startsWith(NOTEBOOK_PREFIX)) {
        return normalizeNotebookRelativePath(url.pathname);
      }
    } catch {
      return "";
    }
    return "";
  }
  return normalizeNotebookFilePath(raw);
}

export function notebookPathFromPickedImageFile(file) {
  return normalizeNotebookPathInput(notebookPathFromPickedFile(file));
}

export function sameNotebookImagePath(left = "", right = "") {
  return normalizeNotebookPathInput(left).toLowerCase() === normalizeNotebookPathInput(right).toLowerCase();
}

export function isExternalOrNonNotebookAbsoluteSource(input = "") {
  const clean = String(input || "").trim();
  if (!clean) return false;
  if (clean.startsWith("data:")) return true;
  if (/^(https?:)?\/\//i.test(clean)) {
    try {
      const url = new URL(clean, window.location.origin);
      return url.origin !== window.location.origin || !url.pathname.startsWith(NOTEBOOK_PREFIX);
    } catch {
      return true;
    }
  }
  return clean.startsWith("/") && !clean.replace(/^\/+/, "").toLowerCase().startsWith("notebook/");
}
