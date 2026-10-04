// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/RehydrateLayoutCanvases.mjs
// This module implements rehydrate Layout Canvases behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { presentHtmlAttribute } from "/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlPresentation.mjs";
import { attachCanvasTools } from "./AttachCanvasTools.mjs";
import { ensureCanvasResizeHandles, appendEditorHandlesToItem, makeCanvasItemInteractive } from "./AppendEditorHandlesToItem.mjs";
import { makeLayoutCanvasResizable } from "./MakeLayoutCanvasResizable.mjs";

// Rehydrate Layout Canvases operations.
export function rehydrateLayoutCanvases(wysiwyg, editorFilePath) {
  const canvases = wysiwyg.querySelectorAll(".nv-layout-canvas");
  canvases.forEach(canvas => {
    presentHtmlAttribute(canvas, "contenteditable", "false");
    attachCanvasTools(canvas, editorFilePath);
    ensureCanvasResizeHandles(canvas);
    makeLayoutCanvasResizable(canvas);
    canvas.querySelectorAll(".nv-canvas-item").forEach(item => {
      appendEditorHandlesToItem(item);
      makeCanvasItemInteractive(item, canvas);
    });
  });
}

export function getPrevNode(root, node) {
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

export function getNextNode(root, node) {
  if (!node) return null;
  if (node.firstChild) return node.firstChild;
  let n = node;
  while (n && n !== root) {
    if (n.nextSibling) return n.nextSibling;
    n = n.parentNode;
  }
  return null;
}

export function findAdjacentCanvas(root, range, direction) {
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
  const skipEmptyText = n => {
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

export function registerCanvasDeletionHotkeys(wysiwyg) {
  const onKeyDown = e => {
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
