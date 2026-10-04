// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/cartoonToolsParts/Uid.mjs
// This module implements uid behavior for the cartoonTools feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { getActiveCartoonFrame } from "./ApplyGapToPanel.mjs";
import { presentHtmlAttribute } from "/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlPresentation.mjs";

// Uid operations.
export const CARTOON_STYLE_ID = "nv-cartoon-panel-editor-styles";

export const DEFAULT_WIDTH = "min(100%, 760px)";

export const DEFAULT_HEIGHT = "420px";

export const DEFAULT_GAP = 12;

export function uid(prefix = "nv-cartoon") {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 10000).toString(36)}`;
}

export function pxNumber(value, fallback = DEFAULT_GAP) {
  const parsed = Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(96, parsed));
}

export function getEditorRoot() {
  const registered = window.__nvCartoonEditorRoot;
  if (registered?.isConnected) return registered;
  return document.querySelector("#wysiwyg[contenteditable='true']");
}

export function elementFromNode(node) {
  return node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
}

export function isFrameInEditor(frame, wysiwyg = getEditorRoot()) {
  return Boolean(frame && frame.isConnected && wysiwyg && wysiwyg.contains(frame) && frame.matches?.("[data-nv-cartoon-frame]"));
}

export function isPanelInEditor(panel, wysiwyg = getEditorRoot()) {
  return Boolean(panel && panel.isConnected && wysiwyg && wysiwyg.contains(panel) && panel.matches?.("[data-nv-cartoon-panel]"));
}

export function selectedFrameFromSelection() {
  const wysiwyg = getEditorRoot();
  const sel = window.getSelection?.();
  if (!wysiwyg || !sel || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  if (!wysiwyg.contains(range.commonAncestorContainer)) return null;
  return elementFromNode(range.startContainer)?.closest?.("[data-nv-cartoon-frame]") || null;
}

export function findPanelFromSelection() {
  const wysiwyg = getEditorRoot();
  const sel = window.getSelection?.();
  if (!wysiwyg || !sel || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  if (!wysiwyg.contains(range.commonAncestorContainer)) return null;
  return elementFromNode(range.startContainer)?.closest?.("[data-nv-cartoon-panel]") || null;
}

export function firstCartoonPanel() {
  return getEditorRoot()?.querySelector?.("[data-nv-cartoon-panel]") || null;
}

export function activePanelFromFrame(frame = getActiveCartoonFrame()) {
  const panel = frame?.closest?.("[data-nv-cartoon-panel]");
  if (isPanelInEditor(panel)) return panel;
  const saved = window.__nvHtmlCartoonActivePanel;
  if (isPanelInEditor(saved)) return saved;
  const selected = findPanelFromSelection();
  if (isPanelInEditor(selected)) return selected;
  return firstCartoonPanel();
}

export function focusFrame(frame) {
  if (!frame) return;
  frame.focus?.({
    preventScroll: true
  });
  const sel = window.getSelection?.();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(frame);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
  window.HTMLWysiwygTools?.saveCurrentSelection?.();
}

export function markDirty() {
  window.HTMLWysiwygTools?.markDirty?.();
  getEditorRoot()?.dispatchEvent(new Event("input", {
    bubbles: true
  }));
}

export function showToolbar() {
  window.dispatchEvent?.(new CustomEvent("nv-show-subtoolbar", {
    detail: {
      heading: "Cartoon Panel",
      force: true,
      toggle: false
    }
  }));
}

export function frameStyle() {
  return ["flex:1 1 0", "min-width:48px", "min-height:48px", "background:#fff", "border:2px solid #111", "box-sizing:border-box", "overflow:auto", "padding:8px", "outline:none", "color:#111"].join(";");
}

export function layoutStyle(direction = "row") {
  return ["display:flex", `flex-direction:${direction}`, "gap:var(--nv-cartoon-panel-gap, 12px)", "width:100%", "height:100%", "box-sizing:border-box", "min-width:0", "min-height:0"].join(";");
}

export function rootStyle({
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  gap = DEFAULT_GAP
} = {}) {
  return ["position:relative", `width:${width}`, `height:${height}`, "min-width:240px", "min-height:180px", "margin:16px 0", "padding:12px", "background:#fff", "border:2px solid #111", "box-sizing:border-box", "overflow:hidden", `--nv-cartoon-panel-gap:${pxNumber(gap)}px`].join(";");
}

export function createFrame({
  html = ""
} = {}) {
  const frame = document.createElement("div");
  frame.className = "nv-cartoon-frame";
  frame.setAttribute("data-nv-cartoon-frame", "");
  presentHtmlAttribute(frame, "contenteditable", "true");
  frame.setAttribute("style", frameStyle());
  frame.innerHTML = html;
  return frame;
}

export function createSplit(orientation = "vertical") {
  const split = document.createElement("div");
  split.className = "nv-cartoon-split";
  split.setAttribute("data-nv-cartoon-split", "");
  split.dataset.orientation = orientation === "horizontal" ? "horizontal" : "vertical";
  split.setAttribute("style", layoutStyle(split.dataset.orientation === "horizontal" ? "column" : "row"));
  return split;
}
