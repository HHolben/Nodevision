// Nodevision/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditor.mjs
// This file populates the panel with the HTML editor.

import { updateToolbarState } from "./../../../panels/createToolbar.mjs";
import { createPanelDOM } from "./../../../panels/panelFactory.mjs";

const NOTEBOOK_PREFIX = "/Notebook/";
const RASTER_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp"]);
const SVG_IMAGE_EXTENSIONS = new Set(["svg"]);
const NEW_IMAGE_MIME_BY_EXTENSION = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
};
const NEW_IMAGE_DEFAULT_DISPLAY_WIDTH = 320;
const NEW_IMAGE_DEFAULT_DISPLAY_HEIGHT = 240;
const lastSelectionRangeByEditor = new WeakMap();

function ensureHTMLLayoutStyles() {
  if (document.getElementById("nv-html-layout-style")) return;
  const style = document.createElement("style");
  style.id = "nv-html-layout-style";
  style.textContent = `
    .nv-layout-canvas {
      position: relative;
      min-height: 260px;
      border: 1px dashed #9a9a9a;
      background-image:
        linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px);
      background-size: 20px 20px;
      margin: 12px 0;
      padding: 12px;
    }
    .nv-layout-canvas .nv-resize-handle {
      position: absolute;
      width: 10px;
      height: 10px;
      border: 1px solid #555;
      border-radius: 50%;
      background: #fff;
      z-index: 8;
      transform: translate(-50%, -50%);
    }
    .nv-layout-canvas .nv-resize-handle[data-dir="n"] { left: 50%; top: 0%; cursor: n-resize; }
    .nv-layout-canvas .nv-resize-handle[data-dir="s"] { left: 50%; top: 100%; cursor: s-resize; }
    .nv-layout-canvas .nv-resize-handle[data-dir="e"] { left: 100%; top: 50%; cursor: e-resize; }
    .nv-layout-canvas .nv-resize-handle[data-dir="w"] { left: 0%; top: 50%; cursor: w-resize; }
    .nv-layout-canvas .nv-resize-handle[data-dir="ne"] { left: 100%; top: 0%; cursor: ne-resize; }
    .nv-layout-canvas .nv-resize-handle[data-dir="nw"] { left: 0%; top: 0%; cursor: nw-resize; }
    .nv-layout-canvas .nv-resize-handle[data-dir="se"] { left: 100%; top: 100%; cursor: se-resize; }
    .nv-layout-canvas .nv-resize-handle[data-dir="sw"] { left: 0%; top: 100%; cursor: sw-resize; }
    .nv-layout-canvas .nv-canvas-tools {
      position: absolute;
      top: 8px;
      right: 8px;
      display: flex;
      gap: 6px;
      z-index: 1000;
    }
    .nv-layout-canvas .nv-canvas-tools button {
      border: 1px solid #777;
      background: #f6f6f6;
      font-size: 12px;
      padding: 2px 8px;
      cursor: pointer;
    }
    .nv-canvas-item {
      position: absolute;
      border: 1px solid #aaa;
      background: #fff;
      min-width: 80px;
      min-height: 40px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      transform-origin: center center;
      touch-action: none;
    }
    .nv-canvas-item .nv-item-content {
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      padding: 8px;
      overflow: auto;
    }
    .nv-canvas-item .nv-item-content[contenteditable="true"] {
      outline: none;
      cursor: text;
    }
    .nv-canvas-item .nv-item-content img,
    .nv-canvas-item .nv-item-content svg,
    .nv-canvas-item .nv-item-content video {
      display: block;
      max-width: 100%;
      height: auto;
      pointer-events: none;
    }
    .nv-canvas-item .nv-resize-handle {
      position: absolute;
      width: 10px;
      height: 10px;
      border: 1px solid #555;
      border-radius: 50%;
      background: #fff;
      z-index: 6;
      transform: translate(-50%, -50%);
    }
    .nv-canvas-item .nv-resize-handle[data-dir="n"] { left: 50%; top: 0%; cursor: n-resize; }
    .nv-canvas-item .nv-resize-handle[data-dir="s"] { left: 50%; top: 100%; cursor: s-resize; }
    .nv-canvas-item .nv-resize-handle[data-dir="e"] { left: 100%; top: 50%; cursor: e-resize; }
    .nv-canvas-item .nv-resize-handle[data-dir="w"] { left: 0%; top: 50%; cursor: w-resize; }
    .nv-canvas-item .nv-resize-handle[data-dir="ne"] { left: 100%; top: 0%; cursor: ne-resize; }
    .nv-canvas-item .nv-resize-handle[data-dir="nw"] { left: 0%; top: 0%; cursor: nw-resize; }
    .nv-canvas-item .nv-resize-handle[data-dir="se"] { left: 100%; top: 100%; cursor: se-resize; }
    .nv-canvas-item .nv-resize-handle[data-dir="sw"] { left: 0%; top: 100%; cursor: sw-resize; }
    .nv-canvas-item .nv-rotate-handle {
      position: absolute;
      left: 50%;
      top: -18px;
      width: 12px;
      height: 12px;
      border: 1px solid #2d5eaa;
      border-radius: 50%;
      background: #e9f1ff;
      transform: translate(-50%, -50%);
      cursor: grab;
      z-index: 7;
    }
    .nv-canvas-item .nv-edge-grab {
      position: absolute;
      user-select: none;
      z-index: 5;
      background: transparent;
    }
    .nv-canvas-item .nv-edge-grab[data-edge="n"],
    .nv-canvas-item .nv-edge-grab[data-edge="s"] {
      left: 8px;
      right: 8px;
      height: 8px;
      cursor: move;
    }
    .nv-canvas-item .nv-edge-grab[data-edge="n"] { top: -4px; }
    .nv-canvas-item .nv-edge-grab[data-edge="s"] { bottom: -4px; }
    .nv-canvas-item .nv-edge-grab[data-edge="e"],
    .nv-canvas-item .nv-edge-grab[data-edge="w"] {
      top: 8px;
      bottom: 8px;
      width: 8px;
      cursor: move;
    }
    .nv-canvas-item .nv-edge-grab[data-edge="e"] { right: -4px; }
    .nv-canvas-item .nv-edge-grab[data-edge="w"] { left: -4px; }
    .nv-canvas-item:focus-within,
    .nv-canvas-item:hover {
      border-color: #4b7fd1;
    }
    #wysiwyg img.nv-selected-image {
      outline: 2px solid #2f80ff;
      outline-offset: 2px;
    }
    .nv-image-corner-handle {
      position: fixed;
      width: 12px;
      height: 12px;
      border: 1px solid #2f80ff;
      border-radius: 50%;
      background: #ffffff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      transform: translate(-50%, -50%);
      z-index: 26000;
      cursor: nwse-resize;
      touch-action: none;
    }
    .nv-image-corner-handle[data-corner="ne"],
    .nv-image-corner-handle[data-corner="sw"] {
      cursor: nesw-resize;
    }
    #wysiwyg .nv-canvas-item.nv-selected-image-item {
      border-color: #2f80ff;
      box-shadow: 0 0 0 2px rgba(47, 128, 255, 0.3);
    }
    #wysiwyg .nv-inline-embedded-panel {
      position: relative;
      border: 1px solid #6a7f9c;
      background: #fff;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
      box-sizing: border-box;
      overflow: hidden;
    }
    #wysiwyg .nv-inline-embedded-panel-header {
      min-height: 24px;
      height: 24px;
      padding: 0 6px;
      background: linear-gradient(#dde9f8, #c9d9ee);
      border-bottom: 1px solid #97abc5;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      user-select: none;
    }
    #wysiwyg .nv-inline-embedded-panel-title {
      font: 11px monospace;
      color: #15324f;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
    }
    #wysiwyg .nv-inline-embedded-panel-controls {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }
    #wysiwyg .nv-inline-embedded-panel-controls button {
      font: 11px monospace;
      padding: 1px 8px;
      border: 1px solid #355b7f;
      background: #e8f3ff;
      color: #0f2740;
      cursor: pointer;
    }
    #wysiwyg .nv-inline-embedded-panel-content {
      position: absolute;
      top: 24px;
      right: 0;
      bottom: 0;
      left: 0;
      overflow: hidden;
      background: #fff;
    }
  `;
  document.head.appendChild(style);
}

function isNodeInsideEditor(wysiwyg, node) {
  if (!wysiwyg || !node) return false;
  return node === wysiwyg || (node instanceof Node && wysiwyg.contains(node));
}

function isRangeInsideEditor(wysiwyg, range) {
  if (!wysiwyg || !range) return false;
  return isNodeInsideEditor(wysiwyg, range.startContainer) &&
    isNodeInsideEditor(wysiwyg, range.endContainer);
}

function getCurrentSelectionRangeInEditor(wysiwyg) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!isRangeInsideEditor(wysiwyg, range)) return null;
  return range.cloneRange();
}

function rememberCurrentSelectionRange(wysiwyg) {
  const range = getCurrentSelectionRangeInEditor(wysiwyg);
  if (range) {
    lastSelectionRangeByEditor.set(wysiwyg, range);
  }
}

function getRememberedSelectionRange(wysiwyg) {
  const saved = lastSelectionRangeByEditor.get(wysiwyg);
  if (!saved) return null;
  if (!isRangeInsideEditor(wysiwyg, saved)) return null;
  return saved.cloneRange();
}

function applySelectionRange(range) {
  if (!range) return false;
  const sel = window.getSelection();
  if (!sel) return false;
  sel.removeAllRanges();
  sel.addRange(range);
  return true;
}

function insertNodeAtCaret(wysiwyg, node, options = {}) {
  const preferredRange = options?.preferredRange || null;
  const range = (isRangeInsideEditor(wysiwyg, preferredRange) ? preferredRange.cloneRange() : null) ||
    getRememberedSelectionRange(wysiwyg) ||
    getCurrentSelectionRangeInEditor(wysiwyg);

  if (range) {
    try {
      applySelectionRange(range);
      wysiwyg.focus();
      range.deleteContents();
      range.insertNode(node);
      range.setStartAfter(node);
      range.setEndAfter(node);
      applySelectionRange(range);
      rememberCurrentSelectionRange(wysiwyg);
      return;
    } catch (err) {
      console.warn("insertNodeAtCaret fallback append due to range error:", err);
    }
  }

  wysiwyg.appendChild(node);
  const fallbackRange = document.createRange();
  fallbackRange.setStartAfter(node);
  fallbackRange.setEndAfter(node);
  applySelectionRange(fallbackRange);
  rememberCurrentSelectionRange(wysiwyg);
}

function registerCaretTracking(wysiwyg) {
  if (!wysiwyg) return () => {};

  const capture = () => {
    rememberCurrentSelectionRange(wysiwyg);
  };

  const onSelectionChange = () => {
    capture();
  };

  document.addEventListener("selectionchange", onSelectionChange);
  wysiwyg.addEventListener("mouseup", capture);
  wysiwyg.addEventListener("keyup", capture);
  wysiwyg.addEventListener("input", capture);
  wysiwyg.addEventListener("focus", capture);
  capture();

  return () => {
    document.removeEventListener("selectionchange", onSelectionChange);
    wysiwyg.removeEventListener("mouseup", capture);
    wysiwyg.removeEventListener("keyup", capture);
    wysiwyg.removeEventListener("input", capture);
    wysiwyg.removeEventListener("focus", capture);
    lastSelectionRangeByEditor.delete(wysiwyg);
  };
}

function getActiveLayoutCanvas(wysiwyg) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const node = sel.getRangeAt(0).commonAncestorContainer;
  const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  const canvas = el && el.closest ? el.closest(".nv-layout-canvas") : null;
  return canvas && wysiwyg.contains(canvas) ? canvas : null;
}

function markEditorOnly(el) {
  if (!el) return el;
  el.classList.add("nv-editor-only");
  el.setAttribute("data-editor-only", "true");
  return el;
}

function appendEditorHandlesToItem(item) {
  if (!item.querySelector(".nv-rotate-handle")) {
    const rotate = document.createElement("div");
    rotate.className = "nv-rotate-handle";
    rotate.title = "Rotate";
    markEditorOnly(rotate);
    item.appendChild(rotate);
  }

  if (item.querySelectorAll(".nv-resize-handle").length === 0) {
    const resizeDirs = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
    resizeDirs.forEach((dir) => {
      const h = document.createElement("div");
      h.className = "nv-resize-handle";
      h.dataset.dir = dir;
      markEditorOnly(h);
      item.appendChild(h);
    });
  }

  if (item.querySelectorAll(".nv-edge-grab").length === 0) {
    ["n", "s", "e", "w"].forEach((edge) => {
      const edgeGrab = document.createElement("div");
      edgeGrab.className = "nv-edge-grab";
      edgeGrab.dataset.edge = edge;
      markEditorOnly(edgeGrab);
      item.appendChild(edgeGrab);
    });
  }
}

function makeCanvasItemInteractive(item, canvas) {
  if (item.dataset.nvInteractive === "true") return;
  item.dataset.nvInteractive = "true";
  const minWidth = 80;
  const minHeight = 50;

  const getRotation = () => Number(item.dataset.rotation || 0);
  const applyRotation = (deg) => {
    item.dataset.rotation = String(deg);
    item.style.transform = `rotate(${deg}deg)`;
  };

  const startDrag = (startEvt) => {
    startEvt.preventDefault();
    const canvasRect = canvas.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const startX = startEvt.clientX;
    const startY = startEvt.clientY;
    const initialLeft = itemRect.left - canvasRect.left;
    const initialTop = itemRect.top - canvasRect.top;

    const onMove = (moveEvt) => {
      const nextLeft = Math.max(0, initialLeft + (moveEvt.clientX - startX));
      const nextTop = Math.max(0, initialTop + (moveEvt.clientY - startY));
      item.style.left = `${nextLeft}px`;
      item.style.top = `${nextTop}px`;
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  item.querySelectorAll(".nv-edge-grab").forEach((edge) => {
    edge.addEventListener("pointerdown", startDrag);
  });

  item.querySelectorAll(".nv-resize-handle").forEach((handle) => {
    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const dir = handle.dataset.dir || "se";
      const startX = e.clientX;
      const startY = e.clientY;
      const startLeft = parseFloat(item.style.left) || 0;
      const startTop = parseFloat(item.style.top) || 0;
      const startWidth = item.offsetWidth;
      const startHeight = item.offsetHeight;

      const onMove = (moveEvt) => {
        const dx = moveEvt.clientX - startX;
        const dy = moveEvt.clientY - startY;

        let nextLeft = startLeft;
        let nextTop = startTop;
        let nextWidth = startWidth;
        let nextHeight = startHeight;

        if (dir.includes("e")) nextWidth = Math.max(minWidth, startWidth + dx);
        if (dir.includes("s")) nextHeight = Math.max(minHeight, startHeight + dy);
        if (dir.includes("w")) {
          nextWidth = Math.max(minWidth, startWidth - dx);
          nextLeft = startLeft + (startWidth - nextWidth);
        }
        if (dir.includes("n")) {
          nextHeight = Math.max(minHeight, startHeight - dy);
          nextTop = startTop + (startHeight - nextHeight);
        }

        item.style.left = `${nextLeft}px`;
        item.style.top = `${nextTop}px`;
        item.style.width = `${nextWidth}px`;
        item.style.height = `${nextHeight}px`;
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
  });

  const rotateHandle = item.querySelector(".nv-rotate-handle");
  if (rotateHandle) {
    rotateHandle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const itemRect = item.getBoundingClientRect();
      const cx = itemRect.left + itemRect.width / 2;
      const cy = itemRect.top + itemRect.height / 2;
      const startRotation = getRotation();
      const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx);

      const onMove = (moveEvt) => {
        const angle = Math.atan2(moveEvt.clientY - cy, moveEvt.clientX - cx);
        const deg = startRotation + ((angle - startAngle) * 180 / Math.PI);
        applyRotation(Math.round(deg));
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
  }

  applyRotation(getRotation());
}

function ensureCanvasResizeHandles(canvas) {
  if (canvas.querySelectorAll(".nv-canvas-resize-handle").length > 0) return;
  const resizeDirs = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
  resizeDirs.forEach((dir) => {
    const h = document.createElement("div");
    h.className = "nv-resize-handle nv-canvas-resize-handle";
    h.dataset.dir = dir;
    markEditorOnly(h);
    canvas.appendChild(h);
  });
}

function makeLayoutCanvasResizable(canvas) {
  if (canvas.dataset.nvResizable === "true") return;
  canvas.dataset.nvResizable = "true";
  const minWidth = 200;
  const minHeight = 160;

  const onResizeStart = (handle, startEvt) => {
    startEvt.preventDefault();
    const dir = handle.dataset.dir || "se";
    const startX = startEvt.clientX;
    const startY = startEvt.clientY;
    const startWidth = canvas.offsetWidth;
    const startHeight = canvas.offsetHeight;
    const styles = window.getComputedStyle(canvas);
    const startMarginLeft = parseFloat(styles.marginLeft) || 0;
    const startMarginTop = parseFloat(styles.marginTop) || 0;

    canvas.style.width = `${startWidth}px`;
    canvas.style.height = `${startHeight}px`;

    const onMove = (moveEvt) => {
      const dx = moveEvt.clientX - startX;
      const dy = moveEvt.clientY - startY;

      let nextWidth = startWidth;
      let nextHeight = startHeight;
      let nextMarginLeft = startMarginLeft;
      let nextMarginTop = startMarginTop;

      if (dir.includes("e")) nextWidth = Math.max(minWidth, startWidth + dx);
      if (dir.includes("s")) nextHeight = Math.max(minHeight, startHeight + dy);
      if (dir.includes("w")) {
        nextWidth = Math.max(minWidth, startWidth - dx);
        nextMarginLeft = startMarginLeft + (startWidth - nextWidth);
      }
      if (dir.includes("n")) {
        nextHeight = Math.max(minHeight, startHeight - dy);
        nextMarginTop = startMarginTop + (startHeight - nextHeight);
      }

      canvas.style.width = `${nextWidth}px`;
      canvas.style.height = `${nextHeight}px`;
      canvas.style.marginLeft = `${nextMarginLeft}px`;
      canvas.style.marginTop = `${nextMarginTop}px`;
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  canvas.querySelectorAll(".nv-canvas-resize-handle").forEach((handle) => {
    handle.addEventListener("pointerdown", (e) => onResizeStart(handle, e));
  });
}

function createCanvasItem({
  typeLabel,
  x = 24,
  y = 24,
  width = 220,
  height = 120,
  contentNode,
  editable = false,
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

function safeDecode(value = "") {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizePathSlashes(value = "") {
  return String(value).replace(/\\/g, "/");
}

function stripQueryAndHash(value = "") {
  const q = value.indexOf("?");
  const h = value.indexOf("#");
  const stop = [q, h].filter((idx) => idx >= 0).sort((a, b) => a - b)[0];
  return stop === undefined ? value : value.slice(0, stop);
}

function normalizePath(pathLike = "") {
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

function dirname(pathLike = "") {
  const clean = normalizePath(pathLike);
  const idx = clean.lastIndexOf("/");
  return idx === -1 ? "" : clean.slice(0, idx);
}

function resolveRelativePath(baseDir = "", href = "") {
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

function relativePath(fromDir = "", toPath = "") {
  const from = normalizePath(fromDir).split("/").filter(Boolean);
  const to = normalizePath(toPath).split("/").filter(Boolean);
  let i = 0;
  while (i < from.length && i < to.length && from[i] === to[i]) i += 1;
  const up = new Array(Math.max(0, from.length - i)).fill("..");
  const down = to.slice(i);
  const rel = [...up, ...down].join("/");
  return rel || (to[to.length - 1] || "");
}

function normalizeNotebookPathInput(inputPath = "") {
  let clean = normalizePathSlashes(safeDecode(String(inputPath || "").trim()));
  if (!clean) return "";
  clean = clean.replace(/^https?:\/\/[^/]+/i, "");
  clean = clean.replace(/^\/+/, "");
  clean = clean.replace(/^.*\/Notebook\//i, "");
  clean = clean.replace(/^Notebook\//i, "");
  clean = stripQueryAndHash(clean);
  return normalizePath(clean);
}

function isVirtualEditorPath(filePath = "") {
  return String(filePath || "").startsWith("__epub_virtual__/");
}

function sanitizeImageFilename(name = "") {
  const clean = String(name || "").replace(/[^\w.\-]+/g, "_").replace(/^_+|_+$/g, "");
  if (clean) return clean;
  return `image-${Date.now()}.png`;
}

function inferExtensionFromMime(mime = "") {
  const clean = String(mime || "").toLowerCase();
  const map = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/bmp": "bmp",
    "image/svg+xml": "svg",
  };
  return map[clean] || "";
}

function inferExtensionFromPath(pathLike = "") {
  const clean = normalizePath(stripQueryAndHash(pathLike));
  const idx = clean.lastIndexOf(".");
  if (idx === -1) return "";
  return clean.slice(idx + 1).toLowerCase();
}

function ensureFilenameExtension(filename = "", mimeType = "") {
  const current = inferExtensionFromPath(filename);
  if (current) return filename;
  const ext = inferExtensionFromMime(mimeType) || "png";
  return `${filename}.${ext}`;
}

function getDefaultNotebookImageDir(editorFilePath = "") {
  const normalizedEditorPath = normalizeNotebookPathInput(editorFilePath);
  if (isVirtualEditorPath(normalizedEditorPath)) {
    const activeFile = normalizeNotebookPathInput(
      window.NodevisionState?.activeEditorFilePath ||
      window.currentActiveFilePath ||
      ""
    );
    const activeDir = dirname(activeFile);
    return activeDir || "images";
  }
  return dirname(normalizedEditorPath);
}

function encodeNotebookUrl(notebookPath = "") {
  const parts = normalizeNotebookPathInput(notebookPath)
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment));
  return `${NOTEBOOK_PREFIX}${parts.join("/")}`;
}

function sourceFromNotebookPath(notebookPath = "", editorFilePath = "") {
  const normalized = normalizeNotebookPathInput(notebookPath);
  if (!normalized) return "";

  const mode = window.NodevisionState?.currentMode || "";
  if (mode === "EPUBediting" || isVirtualEditorPath(editorFilePath)) {
    return encodeNotebookUrl(normalized);
  }

  const fromDir = dirname(normalizeNotebookPathInput(editorFilePath));
  return relativePath(fromDir, normalized);
}

async function pickLocalImageFile() {
  return new Promise((resolve) => {
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = "image/*";
    picker.style.display = "none";
    document.body.appendChild(picker);

    const cleanup = () => {
      if (picker.parentNode) picker.parentNode.removeChild(picker);
    };

    picker.addEventListener("change", () => {
      const file = picker.files && picker.files[0];
      cleanup();
      resolve(file || null);
    }, { once: true });

    picker.click();
  });
}

async function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Image read failed"));
      }
    };
    reader.onerror = () => reject(new Error("Unable to read image file"));
    reader.readAsDataURL(file);
  });
}

function parseDataUrl(value = "") {
  const match = /^data:([^;,]+)?;base64,(.*)$/i.exec(String(value || ""));
  if (!match) return null;
  return {
    mimeType: match[1] || "application/octet-stream",
    base64: match[2] || "",
  };
}

async function saveNotebookImageFromDataUrl(notebookPath, dataUrl) {
  const normalizedPath = normalizeNotebookPathInput(notebookPath);
  const parsed = parseDataUrl(dataUrl);
  if (!normalizedPath || !parsed) {
    throw new Error("Invalid image save request");
  }

  const res = await fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: normalizedPath,
      content: parsed.base64,
      encoding: "base64",
      mimeType: parsed.mimeType,
    }),
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.success) {
    throw new Error(payload?.error || `${res.status} ${res.statusText}`);
  }

  return normalizedPath;
}

async function saveNotebookText(notebookPath, content, mimeType = "text/plain") {
  const normalizedPath = normalizeNotebookPathInput(notebookPath);
  if (!normalizedPath) {
    throw new Error("Invalid text save request");
  }

  const res = await fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: normalizedPath,
      content: String(content || ""),
      encoding: "utf8",
      mimeType,
    }),
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.success) {
    throw new Error(payload?.error || `${res.status} ${res.statusText}`);
  }

  return normalizedPath;
}

function classifyImageChoice(rawChoice = "") {
  const choice = String(rawChoice || "").trim().toLowerCase();
  if (!choice) return "linked-upload";
  if (choice === "1" || choice.startsWith("linked")) return "linked-upload";
  if (choice === "2" || choice.startsWith("inline")) return "inline";
  if (choice === "3" || choice.startsWith("existing")) return "existing-notebook";
  if (choice === "4" || choice.startsWith("external")) return "external-url";
  return "linked-upload";
}

function buildImageContextFromElement(imageEl, editorFilePath = "") {
  if (!(imageEl instanceof HTMLImageElement)) return null;
  const rawSrc = imageEl.getAttribute("src") || imageEl.currentSrc || "";
  const explicitLinked = normalizeNotebookPathInput(imageEl.getAttribute("data-nv-linked-path") || "");
  const source = String(rawSrc || "").trim();

  const context = {
    element: imageEl,
    src: source,
    linkedNotebookPath: "",
    isInline: false,
    isExternal: false,
    extension: "",
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

  const editorDir = dirname(normalizeNotebookPathInput(editorFilePath));
  const resolved = resolveRelativePath(editorDir, source);
  if (resolved) {
    context.linkedNotebookPath = normalizeNotebookPathInput(resolved);
    context.extension = inferExtensionFromPath(context.linkedNotebookPath);
  }
  return context;
}

function getImageEditorDescriptor(linkedNotebookPath = "") {
  const ext = inferExtensionFromPath(linkedNotebookPath);
  if (SVG_IMAGE_EXTENSIONS.has(ext)) {
    return {
      label: "SVG Editor",
      modulePath: "/PanelInstances/EditorPanels/GraphicalEditors/SVGeditor.mjs",
    };
  }
  if (RASTER_IMAGE_EXTENSIONS.has(ext)) {
    return {
      label: "Image Editor",
      modulePath: "/PanelInstances/EditorPanels/GraphicalEditors/PNGeditor.mjs",
    };
  }
  return null;
}

function getImageEditorMode(linkedNotebookPath = "") {
  const ext = inferExtensionFromPath(linkedNotebookPath);
  if (SVG_IMAGE_EXTENSIONS.has(ext)) return "SVG Editing";
  if (RASTER_IMAGE_EXTENSIONS.has(ext)) return "PNGediting";
  return "GraphicalEditor";
}

function buildTemporaryImageEditPath(editorFilePath = "", extension = "png") {
  const ext = String(extension || "png").toLowerCase();
  const safeExt = NEW_IMAGE_MIME_BY_EXTENSION[ext] ? ext : "png";
  const defaultDir = getDefaultNotebookImageDir(editorFilePath);
  const tempName = `nv-inline-edit-${Date.now()}-${Math.floor(Math.random() * 1e6)}.${safeExt}`;
  return normalizeNotebookPathInput([defaultDir, tempName].filter(Boolean).join("/"));
}

function decorateInsertedImage(img, insertion) {
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
  if (insertion?.linkedNotebookPath) {
    img.setAttribute("data-nv-linked-path", normalizeNotebookPathInput(insertion.linkedNotebookPath));
  } else {
    img.removeAttribute("data-nv-linked-path");
  }
  return img;
}

async function chooseImageInsertion(editorFilePath = "") {
  const choice = classifyImageChoice(prompt(
    "Insert image mode:\n1) Linked Notebook image (upload and save file)\n2) Inline image (embed in document)\n3) Existing Notebook image path\n4) External URL",
    "1"
  ));

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
      mode: "linked-upload",
    };
  }

  if (choice === "inline") {
    const file = await pickLocalImageFile();
    if (!file) return null;
    const dataUrl = await readFileAsDataUrl(file);
    return {
      src: dataUrl,
      linkedNotebookPath: "",
      mode: "inline",
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
      mode: "existing-notebook",
    };
  }

  const external = prompt("External image URL:", "https://");
  if (!external || !external.trim()) return null;
  return {
    src: external.trim(),
    linkedNotebookPath: "",
    mode: "external-url",
  };
}

function markSelectedImage(wysiwyg, imageEl) {
  wysiwyg.querySelectorAll(".nv-selected-image").forEach((img) => {
    img.classList.remove("nv-selected-image");
  });
  wysiwyg.querySelectorAll(".nv-selected-image-item").forEach((item) => {
    item.classList.remove("nv-selected-image-item");
  });

  if (!(imageEl instanceof HTMLImageElement)) return;
  imageEl.classList.add("nv-selected-image");
  const canvasItem = imageEl.closest(".nv-canvas-item");
  if (canvasItem) canvasItem.classList.add("nv-selected-image-item");
}

function updateSelectedImageState(context) {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.activeHtmlImageContext = context || null;
  updateToolbarState({
    htmlImageSelected: Boolean(context && context.element),
    htmlImagePath: context?.linkedNotebookPath || null,
  });
}

async function openCropModalForImage(sourceUrl) {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = sourceUrl;

  await new Promise((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Unable to load image for crop"));
  });

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText = [
      "position:fixed",
      "inset:0",
      "background:rgba(0,0,0,0.6)",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "z-index:25050",
    ].join(";");

    const box = document.createElement("div");
    box.style.cssText = "background:#fff;padding:10px;max-width:90vw;max-height:90vh;overflow:auto;";

    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.style.cssText = "max-width:80vw;max-height:70vh;cursor:crosshair;border:1px solid #999;";
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);

    let startX = 0;
    let startY = 0;
    let endX = 0;
    let endY = 0;
    let selecting = false;

    function redrawSelection() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0);
      const x = Math.min(startX, endX);
      const y = Math.min(startY, endY);
      const w = Math.abs(endX - startX);
      const h = Math.abs(endY - startY);
      if (w > 0 && h > 0) {
        ctx.strokeStyle = "#e02020";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
      }
    }

    canvas.addEventListener("mousedown", (evt) => {
      const rect = canvas.getBoundingClientRect();
      selecting = true;
      startX = evt.clientX - rect.left;
      startY = evt.clientY - rect.top;
      endX = startX;
      endY = startY;
    });

    canvas.addEventListener("mousemove", (evt) => {
      if (!selecting) return;
      const rect = canvas.getBoundingClientRect();
      endX = evt.clientX - rect.left;
      endY = evt.clientY - rect.top;
      redrawSelection();
    });

    canvas.addEventListener("mouseup", () => {
      selecting = false;
      redrawSelection();
    });

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:8px;margin-top:8px;";

    const cropBtn = document.createElement("button");
    cropBtn.type = "button";
    cropBtn.textContent = "Crop";
    cropBtn.addEventListener("click", () => {
      const x = Math.round(Math.min(startX, endX));
      const y = Math.round(Math.min(startY, endY));
      const w = Math.round(Math.abs(endX - startX));
      const h = Math.round(Math.abs(endY - startY));
      if (!w || !h) {
        alert("Select an area to crop.");
        return;
      }
      const out = document.createElement("canvas");
      out.width = w;
      out.height = h;
      const outCtx = out.getContext("2d");
      outCtx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
      document.body.removeChild(overlay);
      resolve(out.toDataURL("image/png"));
    });

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => {
      document.body.removeChild(overlay);
      resolve(null);
    });

    actions.appendChild(cropBtn);
    actions.appendChild(cancelBtn);
    box.appendChild(canvas);
    box.appendChild(actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  });
}

function findClickedImage(target) {
  if (!(target instanceof Element)) return null;
  const direct = target.closest("img");
  if (direct instanceof HTMLImageElement) return direct;
  const item = target.closest(".nv-canvas-item");
  if (!item) return null;
  const nested = item.querySelector("img");
  return nested instanceof HTMLImageElement ? nested : null;
}

function attachUndockedDragBehavior(container, header) {
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;
  let activePointerId = null;
  let hasWindowDragListeners = false;
  header.style.touchAction = "none";

  const onPointerMove = (evt) => {
    if (!dragging || evt.pointerId !== activePointerId) return;
    container.style.left = `${evt.clientX - offsetX}px`;
    container.style.top = `${evt.clientY - offsetY}px`;
  };

  const endDrag = (evt) => {
    if (!dragging || evt.pointerId !== activePointerId) return;
    dragging = false;
    container.style.userSelect = "";
    container.style.willChange = "";
    try {
      header.releasePointerCapture?.(evt.pointerId);
    } catch (_) {
      // No-op: window listeners handle cleanup as fallback.
    }
    activePointerId = null;
    removeWindowDragListeners();
  };

  const onWindowBlur = () => {
    if (!dragging) return;
    dragging = false;
    container.style.userSelect = "";
    container.style.willChange = "";
    activePointerId = null;
    removeWindowDragListeners();
  };

  function addWindowDragListeners() {
    if (hasWindowDragListeners) return;
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", endDrag, true);
    window.addEventListener("pointercancel", endDrag, true);
    window.addEventListener("blur", onWindowBlur);
    hasWindowDragListeners = true;
  }

  function removeWindowDragListeners() {
    if (!hasWindowDragListeners) return;
    window.removeEventListener("pointermove", onPointerMove, true);
    window.removeEventListener("pointerup", endDrag, true);
    window.removeEventListener("pointercancel", endDrag, true);
    window.removeEventListener("blur", onWindowBlur);
    hasWindowDragListeners = false;
  }

  header.addEventListener("pointerdown", (evt) => {
    if (evt.target?.closest?.("button, a, input, select, textarea")) return;
    dragging = true;
    activePointerId = evt.pointerId;
    const rect = container.getBoundingClientRect();
    offsetX = evt.clientX - rect.left;
    offsetY = evt.clientY - rect.top;
    container.style.userSelect = "none";
    container.style.willChange = "left, top";
    addWindowDragListeners();
    try {
      header.setPointerCapture?.(evt.pointerId);
    } catch (_) {
      // No-op: window listeners still keep drag active.
    }
    evt.preventDefault();
  });
}

function createUndockedEditorPanel(title = "Image Editor") {
  const floatingEl = document.createElement("div");
  floatingEl.className = "undocked-panel-float";
  floatingEl.style.left = `${Math.max(20, Math.round(window.innerWidth * 0.2))}px`;
  floatingEl.style.top = `${Math.max(20, Math.round(window.innerHeight * 0.15))}px`;

  const header = document.createElement("div");
  header.className = "undocked-panel-header";

  const titleSpan = document.createElement("span");
  titleSpan.textContent = title;
  header.appendChild(titleSpan);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "Close";
  closeBtn.style.cssText = "font:11px monospace;padding:2px 8px;border:1px solid #666;background:#eee;cursor:pointer;display:none;";
  header.appendChild(closeBtn);

  const body = document.createElement("div");
  body.className = "undocked-panel-body";
  body.style.padding = "0";

  floatingEl.appendChild(header);
  floatingEl.appendChild(body);
  document.body.appendChild(floatingEl);
  attachUndockedDragBehavior(floatingEl, header);

  return { floatingEl, body, closeBtn };
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to convert blob to data URL"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read blob"));
    reader.readAsDataURL(blob);
  });
}

function getNotebookPathFromSourceInput(rawSource = "", editorFilePath = "") {
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

  const editorDir = dirname(normalizeNotebookPathInput(editorFilePath));
  return normalizeNotebookPathInput(resolveRelativePath(editorDir, source));
}

async function sourceInputToInlineDataUrl(rawSource = "", editorFilePath = "") {
  const source = String(rawSource || "").trim();
  if (!source) throw new Error("Source is required");
  if (source.startsWith("data:image/")) return source;

  const notebookPath = getNotebookPathFromSourceInput(source, editorFilePath);
  const fetchUrl = notebookPath ? encodeNotebookUrl(notebookPath) : source;

  const res = await fetch(fetchUrl, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load image source (${res.status} ${res.statusText})`);
  }
  const blob = await res.blob();
  return readBlobAsDataUrl(blob);
}

function clampImageDimension(rawValue, fallback = 512) {
  const parsed = Number.parseInt(String(rawValue || "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(4096, parsed);
}

function normalizeNewImageFormat(rawFormat = "") {
  const format = String(rawFormat || "").trim().toLowerCase();
  return format === "svg" ? "svg" : "png";
}

function normalizeNewImageFilename(rawName = "", preferredFormat = "png") {
  const format = normalizeNewImageFormat(preferredFormat);
  const fallback = `image-${Date.now()}.${format}`;
  let name = sanitizeImageFilename(String(rawName || "").trim() || fallback);
  if (!inferExtensionFromPath(name)) {
    name = `${name}.${format}`;
  }
  const ext = inferExtensionFromPath(name);
  if (!NEW_IMAGE_MIME_BY_EXTENSION[ext] || (ext !== "png" && ext !== "svg")) {
    name = `${name.replace(/\.[^.]+$/, "") || `image-${Date.now()}`}.${format}`;
  }
  return name;
}

function mimeTypeFromImageFilename(filename = "") {
  const ext = inferExtensionFromPath(filename);
  return NEW_IMAGE_MIME_BY_EXTENSION[ext] || "image/png";
}

function utf8ToBase64(value = "") {
  const bytes = new TextEncoder().encode(String(value));
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function createGeneratedImageDataUrl(format = "png", width = 512, height = 512) {
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

async function createInsertImagePanel() {
  const instanceId = "nv-insert-image-panel";
  const existing = document.querySelector(`.panel[data-instance-id="${instanceId}"]`);
  if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

  const panelInst = await createPanelDOM(
    "InsertImageFormPanel",
    instanceId,
    "GenericPanel",
    { displayName: "Insert Image" }
  );

  document.body.appendChild(panelInst.panel);
  panelInst.panel.__nvDefaultDockCell = (
    window.activeCell &&
    window.activeCell.classList?.contains("panel-cell")
  ) ? window.activeCell : null;
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
    closeBtn: panelInst.closeBtn,
  };
}

async function openInsertImageForm(wysiwyg, editorFilePath, preferredInsertRange = null) {
  const panel = await createInsertImagePanel();
  const defaultDir = getDefaultNotebookImageDir(editorFilePath);

  const form = document.createElement("form");
  form.style.cssText = "display:flex;flex-direction:column;gap:10px;font:12px monospace;";

  form.innerHTML = `
    <fieldset style="border:1px solid #c6c6c6;padding:8px;">
      <legend>Image Source</legend>
      <label style="display:block;margin-bottom:6px;">
        <input type="radio" name="nv-image-source" value="new" checked />
        New Image
      </label>
      <label style="display:block;">
        <input type="radio" name="nv-image-source" value="existing" />
        Existing Image
      </label>
    </fieldset>

    <fieldset style="border:1px solid #c6c6c6;padding:8px;">
      <legend>Storage Mode</legend>
      <label style="display:block;margin-bottom:6px;">
        <input type="radio" name="nv-image-storage" value="referenced" checked />
        Referenced (src points to file path)
      </label>
      <label style="display:block;">
        <input type="radio" name="nv-image-storage" value="inline" />
        Inline (embed as data URL)
      </label>
    </fieldset>

    <div id="nv-new-image-fields" style="display:flex;flex-direction:column;gap:8px;">
      <label>
        New Image Format
        <select id="nv-insert-new-format" style="display:block;width:100%;margin-top:4px;">
          <option value="png" selected>PNG</option>
          <option value="svg">SVG</option>
        </select>
      </label>
      <label id="nv-new-name-row">
        New Image File Name
        <input id="nv-insert-new-name" type="text" placeholder="image.png" style="display:block;width:100%;margin-top:4px;" />
      </label>
      <div style="display:flex;gap:8px;align-items:flex-end;">
        <label style="flex:1;">
          Width (px)
          <input id="nv-insert-new-width" type="number" min="1" max="4096" value="512" style="display:block;width:100%;margin-top:4px;" />
        </label>
        <label style="flex:1;">
          Height (px)
          <input id="nv-insert-new-height" type="number" min="1" max="4096" value="512" style="display:block;width:100%;margin-top:4px;" />
        </label>
      </div>
      <div id="nv-new-referenced-target" style="font-size:11px;color:#4b4b4b;"></div>
    </div>

    <div id="nv-existing-image-fields" style="display:none;flex-direction:column;gap:8px;">
      <label>
        Existing Source (Notebook path or URL)
        <input id="nv-insert-existing-source" type="text" placeholder="images/example.png or https://..." style="display:block;width:100%;margin-top:4px;" />
      </label>
    </div>

    <div id="nv-insert-image-error" style="color:#b00020;min-height:16px;"></div>

    <div style="display:flex;justify-content:flex-end;gap:8px;">
      <button type="button" id="nv-insert-cancel">Cancel</button>
      <button type="submit" id="nv-insert-apply">Insert</button>
    </div>
  `;

  panel.body.appendChild(form);

  const sourceRadios = Array.from(form.querySelectorAll('input[name="nv-image-source"]'));
  const storageRadios = Array.from(form.querySelectorAll('input[name="nv-image-storage"]'));
  const newFields = form.querySelector("#nv-new-image-fields");
  const existingFields = form.querySelector("#nv-existing-image-fields");
  const newFormatSelect = form.querySelector("#nv-insert-new-format");
  const newNameRow = form.querySelector("#nv-new-name-row");
  const newNameInput = form.querySelector("#nv-insert-new-name");
  const newWidthInput = form.querySelector("#nv-insert-new-width");
  const newHeightInput = form.querySelector("#nv-insert-new-height");
  const newReferencedTarget = form.querySelector("#nv-new-referenced-target");
  const existingSourceInput = form.querySelector("#nv-insert-existing-source");
  const errorEl = form.querySelector("#nv-insert-image-error");
  const cancelBtn = form.querySelector("#nv-insert-cancel");
  const applyBtn = form.querySelector("#nv-insert-apply");

  const closePanel = () => {
    if (panel.panelEl.parentNode) panel.panelEl.parentNode.removeChild(panel.panelEl);
  };

  panel.closeBtn.addEventListener("click", closePanel, { once: true });
  cancelBtn.addEventListener("click", closePanel);

  const selectedValue = (radios) => {
    const checked = radios.find((radio) => radio.checked);
    return checked ? checked.value : "";
  };

  const updateReferencedTargetHint = () => {
    const sourceMode = selectedValue(sourceRadios);
    const storageMode = selectedValue(storageRadios);
    if (sourceMode !== "new" || storageMode !== "referenced") {
      newReferencedTarget.textContent = "";
      return;
    }
    const format = normalizeNewImageFormat(newFormatSelect.value);
    const filename = normalizeNewImageFilename(newNameInput.value, format);
    const notebookPath = normalizeNotebookPathInput([defaultDir, filename].filter(Boolean).join("/"));
    newReferencedTarget.textContent = notebookPath
      ? `Will save to: ${notebookPath}`
      : "Will save to the current editor folder.";
  };

  const syncVisibility = () => {
    const sourceMode = selectedValue(sourceRadios);
    const storageMode = selectedValue(storageRadios);
    newFields.style.display = sourceMode === "new" ? "flex" : "none";
    existingFields.style.display = sourceMode === "existing" ? "flex" : "none";
    if (newNameRow) {
      newNameRow.style.display = (sourceMode === "new" && storageMode === "referenced") ? "block" : "none";
    }
    updateReferencedTargetHint();
  };

  sourceRadios.forEach((radio) => radio.addEventListener("change", syncVisibility));
  storageRadios.forEach((radio) => radio.addEventListener("change", syncVisibility));
  newFormatSelect.addEventListener("change", () => {
    const format = normalizeNewImageFormat(newFormatSelect.value);
    const current = String(newNameInput.value || "").trim();
    if (!current) {
      newNameInput.value = `image-${Date.now()}.${format}`;
    } else {
      const base = current.replace(/\.[^.]+$/, "");
      newNameInput.value = `${base}.${format}`;
    }
    updateReferencedTargetHint();
  });
  newNameInput.addEventListener("input", updateReferencedTargetHint);

  if (!newNameInput.value.trim()) {
    const format = normalizeNewImageFormat(newFormatSelect.value);
    newNameInput.value = `image-${Date.now()}.${format}`;
  }
  syncVisibility();

  form.addEventListener("submit", async (evt) => {
    evt.preventDefault();
    errorEl.textContent = "";
    applyBtn.disabled = true;

    try {
      const sourceMode = selectedValue(sourceRadios);
      const storageMode = selectedValue(storageRadios);
      let insertion = null;

      if (sourceMode === "new") {
        const format = normalizeNewImageFormat(newFormatSelect.value);
        const filename = normalizeNewImageFilename(newNameInput.value, format);
        const width = clampImageDimension(newWidthInput.value, 512);
        const height = clampImageDimension(newHeightInput.value, 512);
        const dataUrl = createGeneratedImageDataUrl(format, width, height);

        if (storageMode === "inline") {
          insertion = { src: dataUrl, linkedNotebookPath: "", mode: "inline-new" };
        } else {
          const notebookPath = normalizeNotebookPathInput([defaultDir, filename].filter(Boolean).join("/"));
          if (!notebookPath) throw new Error("Could not resolve referenced image path.");
          await saveNotebookImageFromDataUrl(notebookPath, dataUrl);
          insertion = {
            src: sourceFromNotebookPath(notebookPath, editorFilePath),
            linkedNotebookPath: notebookPath,
            mode: "referenced-new",
          };
        }
      } else {
        const existingSource = String(existingSourceInput.value || "").trim();
        if (!existingSource) throw new Error("Enter an existing image source.");

        if (storageMode === "inline") {
          const inlineDataUrl = await sourceInputToInlineDataUrl(existingSource, editorFilePath);
          insertion = { src: inlineDataUrl, linkedNotebookPath: "", mode: "inline-existing" };
        } else {
          const notebookPath = getNotebookPathFromSourceInput(existingSource, editorFilePath);
          if (notebookPath) {
            insertion = {
              src: sourceFromNotebookPath(notebookPath, editorFilePath),
              linkedNotebookPath: notebookPath,
              mode: "referenced-existing",
            };
          } else {
            insertion = { src: existingSource, linkedNotebookPath: "", mode: "referenced-existing" };
          }
        }
      }

      const img = createImageElementFromInsertion(insertion);
      if (!img) throw new Error("Failed to prepare image insertion.");
      insertNodeAtCaret(wysiwyg, img, { preferredRange: preferredInsertRange });
      markSelectedImage(wysiwyg, img);
      updateSelectedImageState(buildImageContextFromElement(img, editorFilePath));
      closePanel();
    } catch (err) {
      errorEl.textContent = err?.message || String(err);
    } finally {
      applyBtn.disabled = false;
    }
  });
}

async function ensureLinkedImageForEditor(context, editorFilePath) {
  if (!context) return null;
  if (context.linkedNotebookPath) return context.linkedNotebookPath;
  if (!context.isInline) return null;

  const dataUrl = context.element?.getAttribute("src") || "";
  if (!dataUrl.startsWith("data:image/")) return null;

  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;

  const defaultDir = getDefaultNotebookImageDir(editorFilePath);
  const ext = inferExtensionFromMime(parsed.mimeType) || "png";
  const suggested = [defaultDir, `image-${Date.now()}.${ext}`].filter(Boolean).join("/");
  const entered = prompt("Save inline image to Notebook before opening editor:", suggested);
  if (!entered) return null;
  const notebookPath = normalizeNotebookPathInput(entered);
  if (!notebookPath) return null;
  await saveNotebookImageFromDataUrl(notebookPath, dataUrl);

  context.element.setAttribute("src", sourceFromNotebookPath(notebookPath, editorFilePath));
  context.element.setAttribute("data-nv-linked-path", notebookPath);
  context.linkedNotebookPath = notebookPath;
  context.isInline = false;
  return notebookPath;
}

async function prepareImageForUndockedEditor(context, editorFilePath) {
  if (!context?.element) return null;

  const linkedPath = context.linkedNotebookPath || "";
  if (linkedPath) {
    return {
      editorPath: linkedPath,
      temporaryPath: null,
    };
  }

  const source = context.element.getAttribute("src") || context.element.currentSrc || "";
  if (!source.startsWith("data:image/")) return null;

  const parsed = parseDataUrl(source);
  const extension = inferExtensionFromMime(parsed?.mimeType || "") || context.extension || "png";
  const temporaryPath = buildTemporaryImageEditPath(editorFilePath, extension);
  await saveNotebookImageFromDataUrl(temporaryPath, source);
  return {
    editorPath: temporaryPath,
    temporaryPath,
  };
}

function registerImageInteractionTools(wysiwyg, editorFilePath) {
  let inlineEditorSession = null;
  let selectedImageForHandles = null;
  let selectedImageLoadListener = null;
  let handleSyncRaf = 0;
  let removed = false;

  const cornerHandles = new Map();
  const cornerOrder = ["nw", "ne", "sw", "se"];

  const readImageRotation = (imageEl) => {
    if (!(imageEl instanceof HTMLImageElement)) return 0;
    const fromDataset = Number.parseFloat(imageEl.dataset.nvImageRotation || "");
    if (Number.isFinite(fromDataset)) return fromDataset;
    const styleTransform = String(imageEl.style.transform || "");
    const match = styleTransform.match(/rotate\(([-\d.]+)deg\)/i);
    if (!match) return 0;
    const parsed = Number.parseFloat(match[1]);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const applyImageRotation = (imageEl, degrees) => {
    if (!(imageEl instanceof HTMLImageElement)) return;
    const rounded = Math.round(Number(degrees || 0) * 100) / 100;
    imageEl.dataset.nvImageRotation = String(rounded);
    const styleTransform = String(imageEl.style.transform || "");
    const withoutRotate = styleTransform.replace(/rotate\([^)]*\)/gi, "").trim();
    imageEl.style.transformOrigin = "center center";
    imageEl.style.transform = `${withoutRotate}${withoutRotate ? " " : ""}rotate(${rounded}deg)`.trim();
  };

  const hideImageHandles = () => {
    cornerHandles.forEach((handle) => {
      handle.style.display = "none";
    });
  };

  const syncImageHandlesNow = () => {
    handleSyncRaf = 0;
    if (removed) return;
    const imageEl = selectedImageForHandles;
    if (!(imageEl instanceof HTMLImageElement) || !imageEl.isConnected) {
      hideImageHandles();
      return;
    }
    if (!wysiwyg.contains(imageEl)) {
      hideImageHandles();
      return;
    }
    if (imageEl.closest(".nv-canvas-item")) {
      hideImageHandles();
      return;
    }
    const rect = imageEl.getBoundingClientRect();
    if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width < 2 || rect.height < 2) {
      hideImageHandles();
      return;
    }

    const points = {
      nw: { x: rect.left, y: rect.top },
      ne: { x: rect.right, y: rect.top },
      sw: { x: rect.left, y: rect.bottom },
      se: { x: rect.right, y: rect.bottom },
    };

    cornerHandles.forEach((handle, corner) => {
      const pt = points[corner];
      handle.style.left = `${pt.x}px`;
      handle.style.top = `${pt.y}px`;
      handle.style.display = "block";
    });
  };

  const scheduleImageHandleSync = () => {
    if (handleSyncRaf) return;
    handleSyncRaf = window.requestAnimationFrame(syncImageHandlesNow);
  };

  const setSelectedImageForHandles = (imageEl) => {
    if (selectedImageForHandles && selectedImageLoadListener) {
      selectedImageForHandles.removeEventListener("load", selectedImageLoadListener);
    }
    selectedImageForHandles = null;
    selectedImageLoadListener = null;

    if (!(imageEl instanceof HTMLImageElement)) {
      hideImageHandles();
      return;
    }
    if (imageEl.closest(".nv-canvas-item")) {
      hideImageHandles();
      return;
    }

    selectedImageForHandles = imageEl;
    selectedImageLoadListener = () => scheduleImageHandleSync();
    imageEl.addEventListener("load", selectedImageLoadListener);
    scheduleImageHandleSync();
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const startCornerTransform = (startEvt) => {
    const imageEl = selectedImageForHandles;
    if (!(imageEl instanceof HTMLImageElement) || !imageEl.isConnected) return;
    if (imageEl.closest(".nv-canvas-item")) return;
    startEvt.preventDefault();
    startEvt.stopPropagation();

    const rect = imageEl.getBoundingClientRect();
    const centerX = rect.left + (rect.width / 2);
    const centerY = rect.top + (rect.height / 2);
    const startWidth = Math.max(1, imageEl.offsetWidth || rect.width || imageEl.naturalWidth || 1);
    const startHeight = Math.max(1, imageEl.offsetHeight || rect.height || imageEl.naturalHeight || 1);
    const aspect = startWidth / Math.max(1, startHeight);
    const startDistance = Math.max(8, Math.hypot(startEvt.clientX - centerX, startEvt.clientY - centerY));
    const startAngle = Math.atan2(startEvt.clientY - centerY, startEvt.clientX - centerX);
    const startRotation = readImageRotation(imageEl);
    const rotateMode = Boolean(startEvt.shiftKey);

    const onMove = (moveEvt) => {
      moveEvt.preventDefault();
      if (rotateMode) {
        const nextAngle = Math.atan2(moveEvt.clientY - centerY, moveEvt.clientX - centerX);
        let degrees = startRotation + ((nextAngle - startAngle) * 180 / Math.PI);
        if (moveEvt.shiftKey && moveEvt.ctrlKey) {
          degrees = Math.round(degrees / 45) * 45;
        }
        applyImageRotation(imageEl, degrees);
      } else {
        const nextDistance = Math.max(1, Math.hypot(moveEvt.clientX - centerX, moveEvt.clientY - centerY));
        const scale = nextDistance / startDistance;
        const nextWidth = clamp(startWidth * scale, 16, 4096);
        const nextHeight = clamp(nextWidth / Math.max(aspect, 0.01), 16, 4096);
        imageEl.style.width = `${Math.round(nextWidth)}px`;
        imageEl.style.height = `${Math.round(nextHeight)}px`;
        if (!imageEl.style.display || imageEl.style.display === "inline") {
          imageEl.style.display = "inline-block";
        }
      }
      scheduleImageHandleSync();
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
      scheduleImageHandleSync();
    };

    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
  };

  cornerOrder.forEach((corner) => {
    const handle = document.createElement("div");
    handle.className = "nv-image-corner-handle nv-editor-only";
    handle.dataset.corner = corner;
    handle.title = "Drag to resize evenly. Shift+drag to rotate. Ctrl+Shift snaps to 45deg.";
    handle.style.display = "none";
    handle.addEventListener("pointerdown", startCornerTransform);
    document.body.appendChild(handle);
    cornerHandles.set(corner, handle);
  });

  const onGlobalGeometryChange = () => scheduleImageHandleSync();
  window.addEventListener("resize", onGlobalGeometryChange);
  window.addEventListener("scroll", onGlobalGeometryChange, true);
  wysiwyg.addEventListener("scroll", onGlobalGeometryChange, true);
  wysiwyg.addEventListener("input", onGlobalGeometryChange);

  const showEditorSubToolbarForMode = (mode) => {
    let heading = "";
    if (mode === "PNGediting") heading = "Draw";
    if (mode === "SVG Editing") heading = "Edit";
    if (!heading) return;
    window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
      detail: {
        heading,
        force: false,
        toggle: false,
      },
    }));
  };

  const restoreGlobalEditorFileContext = (snapshot = {}) => {
    window.NodevisionState = window.NodevisionState || {};
    window.NodevisionState.selectedFile = snapshot.previousSelectedFile || null;
    window.NodevisionState.activeEditorFilePath = snapshot.previousActiveEditorFilePath || null;
    window.currentActiveFilePath = snapshot.previousCurrentActiveFilePath || null;
    window.filePath = snapshot.previousFilePath || null;
    window.selectedFilePath = snapshot.previousSelectedFilePath || null;
  };

  const restoreGlobalEditorRuntime = (snapshot = {}) => {
    window.getEditorHTML = snapshot.previousGetEditorHTML;
    window.setEditorHTML = snapshot.previousSetEditorHTML;
    window.saveWYSIWYGFile = snapshot.previousSaveWYSIWYGFile;
    window.selectSVGElement = snapshot.previousSelectSVGElement;
    window.SVGEditorContext = snapshot.previousSVGEditorContext;
    window.toggleSVGLayersPanel = snapshot.previousToggleSVGLayersPanel;
    window.rasterCanvas = snapshot.previousRasterCanvas || null;
  };

  const onClick = (evt) => {
    if (inlineEditorSession?.frame && inlineEditorSession.frame.contains(evt.target)) {
      return;
    }
    const imageEl = findClickedImage(evt.target);
    if (imageEl && wysiwyg.contains(imageEl)) {
      const context = buildImageContextFromElement(imageEl, editorFilePath);
      markSelectedImage(wysiwyg, imageEl);
      updateSelectedImageState(context);
      setSelectedImageForHandles(imageEl);
      return;
    }
    markSelectedImage(wysiwyg, null);
    updateSelectedImageState(null);
    setSelectedImageForHandles(null);
  };
  wysiwyg.addEventListener("click", onClick);

  const cropSelectedImage = async () => {
    const context = window.NodevisionState?.activeHtmlImageContext;
    if (!context?.element) {
      alert("Select an image first.");
      return;
    }

    let croppedDataUrl = null;
    try {
      croppedDataUrl = await openCropModalForImage(context.element.src);
    } catch (err) {
      alert(`Crop failed: ${err.message}`);
      return;
    }
    if (!croppedDataUrl) return;

    if (context.linkedNotebookPath) {
      const mode = prompt(
        "Save cropped result:\n1) Overwrite linked Notebook image\n2) Keep inline in this document",
        "1"
      );
      if (String(mode || "").trim() === "1") {
        try {
          await saveNotebookImageFromDataUrl(context.linkedNotebookPath, croppedDataUrl);
          context.element.setAttribute("src", sourceFromNotebookPath(context.linkedNotebookPath, editorFilePath));
          context.element.setAttribute("data-nv-linked-path", context.linkedNotebookPath);
        } catch (err) {
          alert(`Failed to overwrite linked image: ${err.message}`);
          return;
        }
      } else {
        context.element.setAttribute("src", croppedDataUrl);
        context.element.removeAttribute("data-nv-linked-path");
      }
    } else {
      context.element.setAttribute("src", croppedDataUrl);
      context.element.removeAttribute("data-nv-linked-path");
    }

    const refreshed = buildImageContextFromElement(context.element, editorFilePath);
    updateSelectedImageState(refreshed);
    markSelectedImage(wysiwyg, context.element);
    setSelectedImageForHandles(context.element);
  };

  const closeInlineImageEditor = async ({ applyChanges = true } = {}) => {
    const session = inlineEditorSession;
    if (!session) return;
    inlineEditorSession = null;

    if (applyChanges) {
      try {
        const ext = inferExtensionFromPath(session.editorPath);
        if (RASTER_IMAGE_EXTENSIONS.has(ext)) {
          const canvas = session.inlineRasterCanvas || window.rasterCanvas;
          if (canvas instanceof HTMLCanvasElement && session.host.contains(canvas)) {
            await saveNotebookImageFromDataUrl(session.editorPath, canvas.toDataURL("image/png"));
          }
        } else if (SVG_IMAGE_EXTENSIONS.has(ext)) {
          const serializer = session.inlineGetEditorHTML ||
            (typeof window.getEditorHTML === "function" ? window.getEditorHTML : null);
          if (typeof serializer === "function") {
            const svgMarkup = serializer();
            if (typeof svgMarkup === "string" && svgMarkup.trim()) {
              await saveNotebookText(session.editorPath, svgMarkup, "image/svg+xml");
            }
          }
        }
      } catch (err) {
        console.warn("Failed to save inline image editor changes:", err);
      }
    }

    if (typeof session.editorCleanup === "function") {
      try {
        session.editorCleanup();
      } catch (err) {
        console.warn("Inline image editor cleanup failed:", err);
      }
    }

    if (session.targetImage) {
      try {
        if (session.temporaryPath) {
          const inlineUpdated = await sourceInputToInlineDataUrl(
            encodeNotebookUrl(session.temporaryPath),
            editorFilePath,
          );
          session.targetImage.setAttribute("src", inlineUpdated);
          session.targetImage.removeAttribute("data-nv-linked-path");
        } else {
          const preservedSrc = String(session.originalSrcAttribute || "").trim();
          const fallbackSrc = sourceFromNotebookPath(session.editorPath, editorFilePath);
          session.targetImage.setAttribute("src", preservedSrc || fallbackSrc);
          session.targetImage.setAttribute(
            "data-nv-linked-path",
            normalizeNotebookPathInput(session.editorPath),
          );
        }
      } catch (err) {
        console.warn("Failed to sync edited image back into document:", err);
      }
    }

    if (session.frame?.isConnected && session.targetImage) {
      session.frame.replaceWith(session.targetImage);
    }

    restoreGlobalEditorFileContext(session);
    restoreGlobalEditorRuntime(session);
    window.NodevisionState.htmlImageEditingInline = false;
    window.NodevisionState.htmlInlineImageEditorMode = null;
    updateToolbarState({
      currentMode: session.previousMode,
      htmlImageSelected: Boolean(session.targetImage?.isConnected),
      htmlImagePath: session.temporaryPath ? null : session.editorPath,
      htmlImageEditingInline: false,
      htmlInlineImageEditorMode: null,
    });
    if (session.targetImage?.isConnected) {
      markSelectedImage(wysiwyg, session.targetImage);
      updateSelectedImageState(
        buildImageContextFromElement(session.targetImage, editorFilePath),
      );
      setSelectedImageForHandles(session.targetImage);
      window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
        detail: {
          heading: "Edit Image Here",
          force: false,
          toggle: false,
        },
      }));
    }
  };

  const toggleSelectedImageInlineEditor = async () => {
    const context = window.NodevisionState?.activeHtmlImageContext;
    if (!context?.element) {
      alert("Select an image first.");
      return;
    }

    const targetImage = context.element;
    if (inlineEditorSession?.targetImage === targetImage) {
      await closeInlineImageEditor({ applyChanges: true });
      return;
    }
    if (inlineEditorSession) {
      await closeInlineImageEditor({ applyChanges: true });
    }

    let prepared = null;
    try {
      prepared = await prepareImageForUndockedEditor(context, editorFilePath);
    } catch (err) {
      alert(`Failed to prepare image for editor: ${err.message}`);
      return;
    }
    if (!prepared?.editorPath) {
      alert("Selected image cannot be edited yet. Use a linked or inline Notebook-supported image.");
      return;
    }
    const linkedPath = prepared.editorPath;
    const temporaryPath = prepared.temporaryPath || null;

    const editorDescriptor = getImageEditorDescriptor(linkedPath);
    if (!editorDescriptor) {
      alert("No image editor is available for this file type.");
      return;
    }

    const targetRect = targetImage.getBoundingClientRect();
    const fallbackWidth = targetImage.clientWidth || targetImage.width || targetImage.naturalWidth || 320;
    const fallbackHeight = targetImage.clientHeight || targetImage.height || targetImage.naturalHeight || 240;
    const editorWidth = Math.max(80, Math.round(targetRect.width || fallbackWidth));
    const editorHeight = Math.max(80, Math.round(targetRect.height || fallbackHeight));
    const targetDisplay = window.getComputedStyle(targetImage).display;
    const frameDisplay = targetDisplay && targetDisplay !== "inline" ? targetDisplay : "inline-block";

    const frame = document.createElement("div");
    frame.className = "panel nv-inline-image-editor-frame nv-inline-embedded-panel";
    frame.dataset.nvPanelMode = "embedded";
    frame.dataset.panelClass = "EmbeddedPanel";
    frame.style.cssText = [
      "position:relative",
      `display:${frameDisplay}`,
      "vertical-align:middle",
      `width:${editorWidth}px`,
      `height:${editorHeight}px`,
      "max-width:100%",
      "overflow:hidden",
      "border:1px solid #6a7f9c",
      "background:#fff",
      "box-sizing:border-box",
    ].join(";");

    const panelHeader = document.createElement("div");
    panelHeader.className = "panel-header nv-inline-embedded-panel-header";
    const panelTitle = document.createElement("span");
    panelTitle.className = "nv-inline-embedded-panel-title";
    panelTitle.textContent = "Embedded Image Editor";
    panelHeader.appendChild(panelTitle);

    const panelControls = document.createElement("div");
    panelControls.className = "nv-inline-embedded-panel-controls";
    const finishBtn = document.createElement("button");
    finishBtn.type = "button";
    finishBtn.textContent = "Finish";
    finishBtn.addEventListener("click", () => {
      closeInlineImageEditor({ applyChanges: true });
    });
    panelControls.appendChild(finishBtn);
    panelHeader.appendChild(panelControls);
    frame.appendChild(panelHeader);

    const body = document.createElement("div");
    body.className = "nv-inline-embedded-panel-content";
    frame.appendChild(body);

    const host = document.createElement("div");
    host.className = "nv-inline-image-editor-host";
    host.style.cssText = "position:absolute;inset:0;overflow:hidden;";
    body.appendChild(host);

    if (targetImage.parentNode) {
      setSelectedImageForHandles(null);
      targetImage.replaceWith(frame);
    } else {
      alert("Unable to place inline editor for selected image.");
      return;
    }

    const previousMode = window.NodevisionState?.currentMode || "HTMLediting";
    const previousSelectedFile = window.NodevisionState?.selectedFile || null;
    const previousActiveEditorFilePath = window.NodevisionState?.activeEditorFilePath || null;
    const previousCurrentActiveFilePath = window.currentActiveFilePath || null;
    const previousFilePath = window.filePath || null;
    const previousSelectedFilePath = window.selectedFilePath || null;
    const previousGetEditorHTML = window.getEditorHTML;
    const previousSetEditorHTML = window.setEditorHTML;
    const previousSaveWYSIWYGFile = window.saveWYSIWYGFile;
    const previousSelectSVGElement = window.selectSVGElement;
    const previousSVGEditorContext = window.SVGEditorContext;
    const previousToggleSVGLayersPanel = window.toggleSVGLayersPanel;
    const previousRasterCanvas = window.rasterCanvas || null;

    const editorMode = getImageEditorMode(linkedPath);
    panelTitle.textContent = editorMode === "SVG Editing"
      ? "Embedded SVG Editor"
      : "Embedded Raster Editor";
    window.NodevisionState = window.NodevisionState || {};
    window.NodevisionState.currentMode = editorMode;
    window.NodevisionState.htmlImageEditingInline = true;
    window.NodevisionState.htmlInlineImageEditorMode = editorMode;
    updateToolbarState({
      currentMode: editorMode,
      htmlImageSelected: true,
      htmlImagePath: temporaryPath ? null : linkedPath,
      htmlImageEditingInline: true,
      htmlInlineImageEditorMode: editorMode,
    });
    showEditorSubToolbarForMode(editorMode);

    let editorCleanup = null;

    try {
      const mod = await import(editorDescriptor.modulePath);
      if (typeof mod.renderEditor !== "function") {
        throw new Error("Editor module missing renderEditor()");
      }
      const instance = await mod.renderEditor(linkedPath, host);
      const inlineGetEditorHTML = typeof window.getEditorHTML === "function"
        ? window.getEditorHTML
        : null;
      const inlineRasterCanvas = window.rasterCanvas instanceof HTMLCanvasElement
        ? window.rasterCanvas
        : host.querySelector("canvas");

      restoreGlobalEditorFileContext({
        previousSelectedFile,
        previousActiveEditorFilePath,
        previousCurrentActiveFilePath,
        previousFilePath,
        previousSelectedFilePath,
      });
      window.getEditorHTML = previousGetEditorHTML;
      window.setEditorHTML = previousSetEditorHTML;
      window.saveWYSIWYGFile = previousSaveWYSIWYGFile;
      window.selectSVGElement = previousSelectSVGElement;
      window.SVGEditorContext = previousSVGEditorContext;
      window.toggleSVGLayersPanel = previousToggleSVGLayersPanel;
      window.rasterCanvas = inlineRasterCanvas || null;
      window.NodevisionState.currentMode = editorMode;
      window.NodevisionState.htmlImageEditingInline = true;
      window.NodevisionState.htmlInlineImageEditorMode = editorMode;
      updateToolbarState({
        currentMode: editorMode,
        htmlImageSelected: true,
        htmlImagePath: temporaryPath ? null : linkedPath,
        htmlImageEditingInline: true,
        htmlInlineImageEditorMode: editorMode,
      });
      showEditorSubToolbarForMode(editorMode);

      if (editorMode === "PNGediting") {
        const inlineCanvas = inlineRasterCanvas || host.querySelector("canvas");
        if (inlineCanvas instanceof HTMLCanvasElement) {
          inlineCanvas.style.width = "100%";
          inlineCanvas.style.height = "100%";
          inlineCanvas.style.display = "block";
        }
      }
      if (instance && typeof instance.destroy === "function") {
        editorCleanup = instance.destroy;
      }
      inlineEditorSession = {
        targetImage,
        originalSrcAttribute: targetImage.getAttribute("src") || "",
        frame,
        host,
        editorPath: linkedPath,
        temporaryPath,
        previousMode,
        previousSelectedFile,
        previousActiveEditorFilePath,
        previousCurrentActiveFilePath,
        previousFilePath,
        previousSelectedFilePath,
        previousGetEditorHTML,
        previousSetEditorHTML,
        previousSaveWYSIWYGFile,
        previousSelectSVGElement,
        previousSVGEditorContext,
        previousToggleSVGLayersPanel,
        previousRasterCanvas,
        inlineGetEditorHTML,
        inlineRasterCanvas: inlineRasterCanvas || null,
        editorCleanup,
      };
    } catch (err) {
      if (frame.isConnected && targetImage) {
        frame.replaceWith(targetImage);
      }
      restoreGlobalEditorFileContext({
        previousSelectedFile,
        previousActiveEditorFilePath,
        previousCurrentActiveFilePath,
        previousFilePath,
        previousSelectedFilePath,
      });
      restoreGlobalEditorRuntime({
        previousGetEditorHTML,
        previousSetEditorHTML,
        previousSaveWYSIWYGFile,
        previousSelectSVGElement,
        previousSVGEditorContext,
        previousToggleSVGLayersPanel,
        previousRasterCanvas,
      });
      updateToolbarState({
        currentMode: previousMode,
        htmlImageSelected: true,
        htmlImagePath: context?.linkedNotebookPath || null,
        htmlImageEditingInline: false,
        htmlInlineImageEditorMode: null,
      });
      window.NodevisionState.htmlImageEditingInline = false;
      window.NodevisionState.htmlInlineImageEditorMode = null;
      if (targetImage?.isConnected) {
        setSelectedImageForHandles(targetImage);
      } else {
        setSelectedImageForHandles(null);
      }
      alert(`Failed to open editor: ${err.message}`);
    }
  };

  const openSelectedImageEditorUndocked = async () => {
    await toggleSelectedImageInlineEditor();
  };

  const finishInlineImageEditor = async () => {
    await closeInlineImageEditor({ applyChanges: true });
  };

  const cancelInlineImageEditor = async () => {
    await closeInlineImageEditor({ applyChanges: false });
  };

  return {
    cropSelectedImage,
    toggleSelectedImageInlineEditor,
    openSelectedImageEditorUndocked,
    finishInlineImageEditor,
    cancelInlineImageEditor,
    isInlineImageEditorOpen() {
      return Boolean(inlineEditorSession);
    },
    destroy() {
      void closeInlineImageEditor({ applyChanges: false });
      wysiwyg.removeEventListener("click", onClick);
      window.removeEventListener("resize", onGlobalGeometryChange);
      window.removeEventListener("scroll", onGlobalGeometryChange, true);
      wysiwyg.removeEventListener("scroll", onGlobalGeometryChange, true);
      wysiwyg.removeEventListener("input", onGlobalGeometryChange);
      if (handleSyncRaf) {
        window.cancelAnimationFrame(handleSyncRaf);
        handleSyncRaf = 0;
      }
      removed = true;
      setSelectedImageForHandles(null);
      cornerHandles.forEach((handle) => handle.remove());
      cornerHandles.clear();
      markSelectedImage(wysiwyg, null);
      updateSelectedImageState(null);
    },
  };
}

function createImageElementFromInsertion(insertion) {
  if (!insertion?.src) return null;
  const img = document.createElement("img");
  img.src = insertion.src;
  img.alt = "Inserted image";
  return decorateInsertedImage(img, insertion);
}

function attachCanvasTools(canvas, editorFilePath) {
  let tools = canvas.querySelector(".nv-canvas-tools");
  if (!tools) {
    tools = document.createElement("div");
    tools.className = "nv-canvas-tools";
    canvas.appendChild(tools);
  }
  markEditorOnly(tools);

  let addTextBtn = tools.querySelector('button[data-action="add-text"]');
  if (!addTextBtn) {
    addTextBtn = document.createElement("button");
    addTextBtn.type = "button";
    addTextBtn.dataset.action = "add-text";
    addTextBtn.textContent = "+ Text";
    tools.appendChild(addTextBtn);
  }

  let addImageBtn = tools.querySelector('button[data-action="add-image"]');
  if (!addImageBtn) {
    addImageBtn = document.createElement("button");
    addImageBtn.type = "button";
    addImageBtn.dataset.action = "add-image";
    addImageBtn.textContent = "+ Image";
    tools.appendChild(addImageBtn);
  }

  let hint = canvas.querySelector(".nv-canvas-hint");
  if (!hint) {
    hint = document.createElement("div");
    hint.className = "nv-canvas-hint";
    hint.textContent = "Layout canvas: add text/images and drag them to position.";
    hint.style.fontSize = "12px";
    hint.style.color = "#666";
    hint.style.marginTop = "2px";
    canvas.appendChild(hint);
  }
  markEditorOnly(hint);

  if (tools.dataset.nvBound !== "true") {
    const addTextBlock = () => {
      const content = document.createElement("div");
      content.textContent = "Edit this text";
      const item = createCanvasItem({
        typeLabel: "Text",
        x: 24 + canvas.querySelectorAll(".nv-canvas-item").length * 14,
        y: 36 + canvas.querySelectorAll(".nv-canvas-item").length * 14,
        width: 240,
        height: 120,
        contentNode: content,
        editable: true,
      });
      canvas.appendChild(item);
      makeCanvasItemInteractive(item, canvas);
      const editable = item.querySelector('.nv-item-content[contenteditable="true"]');
      if (editable) editable.focus();
    };

    const addImageBlock = async () => {
      const insertion = await chooseImageInsertion(editorFilePath);
      const img = createImageElementFromInsertion(insertion);
      if (!img) return;
      const item = createCanvasItem({
        typeLabel: "Media",
        x: 40 + canvas.querySelectorAll(".nv-canvas-item").length * 14,
        y: 48 + canvas.querySelectorAll(".nv-canvas-item").length * 14,
        width: 280,
        height: 200,
        contentNode: img,
        editable: false,
      });
      canvas.appendChild(item);
      makeCanvasItemInteractive(item, canvas);
    };

    addTextBtn.addEventListener("click", addTextBlock);
    addImageBtn.addEventListener("click", addImageBlock);
    tools.dataset.nvBound = "true";
  }
}

function registerHTMLLayoutTools(wysiwyg, editorFilePath) {
  const createLayoutCanvas = () => {
    const canvas = document.createElement("div");
    canvas.className = "nv-layout-canvas";
    canvas.setAttribute("contenteditable", "false");

    attachCanvasTools(canvas, editorFilePath);
    ensureCanvasResizeHandles(canvas);
    makeLayoutCanvasResizable(canvas);

    return canvas;
  };

  const insertLayoutCanvas = () => {
    const canvas = createLayoutCanvas();
    insertNodeAtCaret(wysiwyg, canvas);
    return canvas;
  };

  const insertPositionableImage = async () => {
    let canvas = getActiveLayoutCanvas(wysiwyg);
    if (!canvas) {
      canvas = insertLayoutCanvas();
    }

    const insertion = await chooseImageInsertion(editorFilePath);
    const img = createImageElementFromInsertion(insertion);
    if (!img) return;
    const item = createCanvasItem({
      typeLabel: "Media",
      x: 32 + canvas.querySelectorAll(".nv-canvas-item").length * 14,
      y: 44 + canvas.querySelectorAll(".nv-canvas-item").length * 14,
      width: 280,
      height: 200,
      contentNode: img,
      editable: false,
    });
    canvas.appendChild(item);
    makeCanvasItemInteractive(item, canvas);
  };

  const insertImageAtCaret = async () => {
    const preferredRange = getCurrentSelectionRangeInEditor(wysiwyg) ||
      getRememberedSelectionRange(wysiwyg);
    await openInsertImageForm(wysiwyg, editorFilePath, preferredRange);
  };

  window.HTMLWysiwygTools = {
    insertImageAtCaret,
    insertLayoutCanvas,
    insertPositionableImage,
  };
}

function rehydrateLayoutCanvases(wysiwyg, editorFilePath) {
  const canvases = wysiwyg.querySelectorAll(".nv-layout-canvas");
  canvases.forEach((canvas) => {
    canvas.setAttribute("contenteditable", "false");
    attachCanvasTools(canvas, editorFilePath);
    ensureCanvasResizeHandles(canvas);
    makeLayoutCanvasResizable(canvas);
    canvas.querySelectorAll(".nv-canvas-item").forEach((item) => {
      appendEditorHandlesToItem(item);
      makeCanvasItemInteractive(item, canvas);
    });
  });
}

function getPrevNode(root, node) {
  if (!node) return null;
  if (node.previousSibling) {
    let n = node.previousSibling;
    while (n && n.lastChild) n = n.lastChild;
    return n;
  }
  if (node.parentNode && node.parentNode !== root) {
    return getPrevNode(root, node.parentNode);
  }
  return null;
}

function getNextNode(root, node) {
  if (!node) return null;
  if (node.firstChild) return node.firstChild;
  let n = node;
  while (n && n !== root) {
    if (n.nextSibling) return n.nextSibling;
    n = n.parentNode;
  }
  return null;
}

function findAdjacentCanvas(root, range, direction) {
  let node = null;
  if (direction === "backward") {
    if (range.startContainer.nodeType === Node.TEXT_NODE) {
      if (range.startOffset > 0) return null;
      node = getPrevNode(root, range.startContainer);
    } else {
      const container = range.startContainer;
      if (container.childNodes && range.startOffset > 0) {
        node = container.childNodes[range.startOffset - 1];
        while (node && node.lastChild) node = node.lastChild;
      } else {
        node = getPrevNode(root, container);
      }
    }
  } else {
    if (range.startContainer.nodeType === Node.TEXT_NODE) {
      const text = range.startContainer;
      if (range.startOffset < (text.nodeValue || "").length) return null;
      node = getNextNode(root, text);
    } else {
      const container = range.startContainer;
      if (container.childNodes && range.startOffset < container.childNodes.length) {
        node = container.childNodes[range.startOffset];
      } else {
        node = getNextNode(root, container);
      }
    }
  }

  const skipEmptyText = (n) => {
    let current = n;
    while (current && current.nodeType === Node.TEXT_NODE && !(current.nodeValue || "").trim()) {
      current = direction === "backward" ? getPrevNode(root, current) : getNextNode(root, current);
    }
    return current;
  };

  const candidate = skipEmptyText(node);
  if (!candidate) return null;
  const element = candidate.nodeType === Node.ELEMENT_NODE ? candidate : candidate.parentElement;
  const canvas = element && element.closest ? element.closest(".nv-layout-canvas") : null;
  return canvas && root.contains(canvas) ? canvas : null;
}

function registerCanvasDeletionHotkeys(wysiwyg) {
  const onKeyDown = (e) => {
    if (e.key !== "Backspace" && e.key !== "Delete") return;
    const sel = window.getSelection();
    if (!sel || !sel.isCollapsed) return;
    const anchor = sel.anchorNode;
    if (!anchor) return;
    const anchorEl = anchor.nodeType === Node.ELEMENT_NODE ? anchor : anchor.parentElement;
    if (anchorEl && anchorEl.closest && anchorEl.closest(".nv-layout-canvas")) return;

    const range = sel.getRangeAt(0);
    const direction = e.key === "Backspace" ? "backward" : "forward";
    const target = findAdjacentCanvas(wysiwyg, range, direction);
    if (target) {
      e.preventDefault();
      target.remove();
    }
  };
  wysiwyg.addEventListener("keydown", onKeyDown);
  return () => wysiwyg.removeEventListener("keydown", onKeyDown);
}


// --------------------------------------------------
// Fallback Hotkeys (self-contained)
// --------------------------------------------------
function registerHTMLFallbackHotkeys(wysiwyg, filePath, rootElem) {
  const handlers = {
    "Control+s": (e) => {
      e.preventDefault();
      if (window.saveWYSIWYGFile) {
        window.saveWYSIWYGFile(filePath);
      }
      console.log("🔧 Fallback hotkey: Save");
    },

    "Control+b": (e) => {
      e.preventDefault();
      document.execCommand("bold");
      console.log("🔧 Fallback hotkey: Bold");
    },

    "Control+i": (e) => {
      e.preventDefault();
      document.execCommand("italic");
      console.log("🔧 Fallback hotkey: Italic");
    },

    "Control+u": (e) => {
      e.preventDefault();
      document.execCommand("underline");
      console.log("🔧 Fallback hotkey: Underline");
    },

    "Control+z": (e) => {
      e.preventDefault();
      document.execCommand("undo");
      console.log("🔧 Fallback hotkey: Undo");
    },

    "Control+Shift+z": (e) => {
      e.preventDefault();
      document.execCommand("redo");
      console.log("🔧 Fallback hotkey: Redo");
    }
  };

  const onKeyDown = (e) => {
    const key =
      (e.ctrlKey ? "Control+" : "") +
      (e.shiftKey ? "Shift+" : "") +
      e.key.toLowerCase();

    if (handlers[key]) {
      handlers[key](e);
    }
  };

  rootElem.addEventListener("keydown", onKeyDown);

  console.log("🔧 HTML Fallback Hotkeys Loaded");

  return () => rootElem.removeEventListener("keydown", onKeyDown);
}

const HTML_VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

const HTML_RAW_TEXT_TAGS = new Set(["script", "style", "pre", "textarea"]);

function formatHtmlMarkup(html = "") {
  const source = String(html || "");
  if (!source.trim()) return "";

  const tokens = source.split(/(<[^>]+>)/g).filter((token) => token.length > 0);
  const lines = [];
  let indentLevel = 0;
  let rawTextTag = null;

  function pushLine(value, level = indentLevel) {
    const trimmed = String(value || "").trim();
    if (!trimmed) return;
    lines.push(`${"  ".repeat(Math.max(level, 0))}${trimmed}`);
  }

  for (const token of tokens) {
    const isTag = token.startsWith("<") && token.endsWith(">");
    if (!isTag) {
      if (rawTextTag) {
        const rawLines = token.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        rawLines.forEach((line) => pushLine(line, indentLevel));
      } else {
        token
          .split(/\r?\n/)
          .map((line) => line.replace(/\s+/g, " ").trim())
          .filter(Boolean)
          .forEach((line) => pushLine(line, indentLevel));
      }
      continue;
    }

    if (token.startsWith("</")) {
      const closingMatch = token.match(/^<\/\s*([a-zA-Z0-9:-]+)/);
      const closingTag = closingMatch ? closingMatch[1].toLowerCase() : "";
      indentLevel = Math.max(indentLevel - 1, 0);
      pushLine(token, indentLevel);
      if (rawTextTag && closingTag === rawTextTag) {
        rawTextTag = null;
      }
      continue;
    }

    if (token.startsWith("<!")) {
      pushLine(token, 0);
      continue;
    }

    const openingMatch = token.match(/^<\s*([a-zA-Z0-9:-]+)/);
    const openingTag = openingMatch ? openingMatch[1].toLowerCase() : "";
    const selfClosing = token.endsWith("/>") || HTML_VOID_TAGS.has(openingTag);

    pushLine(token, indentLevel);
    if (!selfClosing) {
      indentLevel += 1;
      if (HTML_RAW_TEXT_TAGS.has(openingTag)) {
        rawTextTag = openingTag;
      }
    }
  }

  return lines.join("\n");
}

// --------------------------------------------------
// Main HTML Editor
// --------------------------------------------------

export async function renderEditor(filePath, container, options = {}) {
  if (!container) throw new Error("Container required");
  if (typeof container.__cleanupHTMLHotkeys === "function") {
    container.__cleanupHTMLHotkeys();
    container.__cleanupHTMLHotkeys = null;
  }
  if (typeof container.__cleanupHTMLCanvasDeletion === "function") {
    container.__cleanupHTMLCanvasDeletion();
    container.__cleanupHTMLCanvasDeletion = null;
  }
  if (typeof container.__cleanupHTMLImageTools === "function") {
    container.__cleanupHTMLImageTools();
    container.__cleanupHTMLImageTools = null;
  }
  if (typeof container.__cleanupHTMLCaretTracking === "function") {
    container.__cleanupHTMLCaretTracking();
    container.__cleanupHTMLCaretTracking = null;
  }
  container.innerHTML = "";
  ensureHTMLLayoutStyles();

  // Set mode
  const editorMode = options?.mode || "HTMLediting";
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.currentMode = editorMode;
  updateToolbarState({
    currentMode: editorMode,
    htmlImageSelected: false,
    htmlImagePath: null,
  });


  // Root container
  const wrapper = document.createElement("div");
  wrapper.id = "editor-root";
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.height = "100%";
  wrapper.style.width = "100%";
  container.appendChild(wrapper);

  // WYSIWYG editable area
  const wysiwyg = document.createElement("div");
  wysiwyg.id = "wysiwyg";
  wysiwyg.contentEditable = "true";
  wysiwyg.style.flex = "1";
  wysiwyg.style.overflow = "auto";
  wysiwyg.style.padding = "12px";
  wrapper.appendChild(wysiwyg);

  // Hidden script container
  const hidden = document.createElement("div");
  hidden.id = "hidden-elements";
  hidden.style.display = "none";
  wrapper.appendChild(hidden);
  registerHTMLLayoutTools(wysiwyg, filePath);
  const imageTools = registerImageInteractionTools(wysiwyg, filePath);
  Object.assign(window.HTMLWysiwygTools || {}, {
    cropSelectedImage: imageTools.cropSelectedImage,
    toggleSelectedImageInlineEditor: imageTools.toggleSelectedImageInlineEditor,
    openSelectedImageEditorUndocked: imageTools.openSelectedImageEditorUndocked,
    finishInlineImageEditor: imageTools.finishInlineImageEditor,
    cancelInlineImageEditor: imageTools.cancelInlineImageEditor,
    isInlineImageEditorOpen: imageTools.isInlineImageEditorOpen,
  });

  try {
    const res = await fetch(`/Notebook/${filePath}`);
    if (!res.ok) throw new Error(res.statusText);
    const htmlText = await res.text();

    // Parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");

    // Clone <head>
    const headClone = document.createElement("div");
    for (const el of doc.head.children) {
      if (el.tagName === "SCRIPT") {
        const placeholder = document.createElement("div");
        placeholder.dataset.script = el.textContent;
        hidden.appendChild(placeholder);
      } else {
        headClone.appendChild(el.cloneNode(true));
      }
    }
    wrapper.prepend(headClone);

    // Clone <body>
    for (const child of doc.body.children) {
      if (child.tagName === "SCRIPT") {
        const placeholder = document.createElement("div");
        placeholder.dataset.script = child.textContent;
        hidden.appendChild(placeholder);
      } else {
        wysiwyg.appendChild(child.cloneNode(true));
      }
    }

    // Saving function
    window.getEditorHTML = () => {
      const headContent = Array.from(headClone.children)
        .map(el => el.outerHTML)
        .join("\n");

      const bodyClone = wysiwyg.cloneNode(true);
      bodyClone.querySelectorAll(".nv-editor-only").forEach((el) => el.remove());
      bodyClone.querySelectorAll("[data-nv-interactive]").forEach((el) => {
        el.removeAttribute("data-nv-interactive");
      });
      bodyClone.querySelectorAll("[data-nv-resizable]").forEach((el) => {
        el.removeAttribute("data-nv-resizable");
      });
      const bodyContent = bodyClone.innerHTML;

      const scripts = Array.from(hidden.children)
        .map(el => `<script>${el.dataset.script}</script>`)
        .join("\n");

      const rawHtml = `<!DOCTYPE html><html><head>${headContent}</head><body>${bodyContent}${scripts}</body></html>`;
      return formatHtmlMarkup(rawHtml);
    };

    window.setEditorHTML = (html) => {
      const doc = parser.parseFromString(html, "text/html");
      wysiwyg.innerHTML = "";
      hidden.innerHTML = "";

      for (const el of doc.body.children) {
        if (el.tagName === "SCRIPT") {
          const placeholder = document.createElement("div");
          placeholder.dataset.script = el.textContent;
          hidden.appendChild(placeholder);
        } else {
          wysiwyg.appendChild(el.cloneNode(true));
        }
      }

      rehydrateLayoutCanvases(wysiwyg, filePath);
      markSelectedImage(wysiwyg, null);
      updateSelectedImageState(null);
    };

    window.saveWYSIWYGFile = async (path) => {
      const content = window.getEditorHTML();
      await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: path || filePath, content }),
      });
      console.log("Saved WYSIWYG file:", path || filePath);
    };

  } catch (err) {
    wrapper.innerHTML =
      `<div style="color:red;padding:12px">Failed to load file: ${err.message}</div>`;
    console.error(err);
  }

  rehydrateLayoutCanvases(wysiwyg, filePath);

  // --------------------------------------------------
  // Enable fallback hotkeys
  // --------------------------------------------------
  container.__cleanupHTMLHotkeys = registerHTMLFallbackHotkeys(wysiwyg, filePath, wrapper);
  container.__cleanupHTMLCanvasDeletion = registerCanvasDeletionHotkeys(wysiwyg);
  container.__cleanupHTMLImageTools = imageTools.destroy;
  container.__cleanupHTMLCaretTracking = registerCaretTracking(wysiwyg);
}
