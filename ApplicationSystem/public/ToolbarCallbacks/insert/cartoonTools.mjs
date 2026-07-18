// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/cartoonTools.mjs
// HTML editor comic strip helpers for static-safe cartoon panel markup.

import { updateToolbarState } from "/panels/createToolbar.mjs";
import { insertHtmlAtCaret } from "/ToolbarJSONfiles/insertMediaCommon.mjs";

const CARTOON_STYLE_ID = "nv-cartoon-panel-editor-styles";
const DEFAULT_WIDTH = "min(100%, 760px)";
const DEFAULT_HEIGHT = "420px";
const DEFAULT_GAP = 12;

function uid(prefix = "nv-cartoon") {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 10000).toString(36)}`;
}

function pxNumber(value, fallback = DEFAULT_GAP) {
  const parsed = Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(96, parsed));
}

function getEditorRoot() {
  const registered = window.__nvCartoonEditorRoot;
  if (registered?.isConnected) return registered;
  return document.querySelector("#wysiwyg[contenteditable='true']");
}

function elementFromNode(node) {
  return node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
}

function isFrameInEditor(frame, wysiwyg = getEditorRoot()) {
  return Boolean(frame && frame.isConnected && wysiwyg && wysiwyg.contains(frame) && frame.matches?.("[data-nv-cartoon-frame]"));
}

function isPanelInEditor(panel, wysiwyg = getEditorRoot()) {
  return Boolean(panel && panel.isConnected && wysiwyg && wysiwyg.contains(panel) && panel.matches?.("[data-nv-cartoon-panel]"));
}

function selectedFrameFromSelection() {
  const wysiwyg = getEditorRoot();
  const sel = window.getSelection?.();
  if (!wysiwyg || !sel || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  if (!wysiwyg.contains(range.commonAncestorContainer)) return null;
  return elementFromNode(range.startContainer)?.closest?.("[data-nv-cartoon-frame]") || null;
}

function findPanelFromSelection() {
  const wysiwyg = getEditorRoot();
  const sel = window.getSelection?.();
  if (!wysiwyg || !sel || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  if (!wysiwyg.contains(range.commonAncestorContainer)) return null;
  return elementFromNode(range.startContainer)?.closest?.("[data-nv-cartoon-panel]") || null;
}

function firstCartoonPanel() {
  return getEditorRoot()?.querySelector?.("[data-nv-cartoon-panel]") || null;
}

function activePanelFromFrame(frame = getActiveCartoonFrame()) {
  const panel = frame?.closest?.("[data-nv-cartoon-panel]");
  if (isPanelInEditor(panel)) return panel;
  const saved = window.__nvHtmlCartoonActivePanel;
  if (isPanelInEditor(saved)) return saved;
  const selected = findPanelFromSelection();
  if (isPanelInEditor(selected)) return selected;
  return firstCartoonPanel();
}

function focusFrame(frame) {
  if (!frame) return;
  frame.focus?.({ preventScroll: true });
  const sel = window.getSelection?.();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(frame);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
  window.HTMLWysiwygTools?.saveCurrentSelection?.();
}

function markDirty() {
  window.HTMLWysiwygTools?.markDirty?.();
  getEditorRoot()?.dispatchEvent(new Event("input", { bubbles: true }));
}

function showToolbar() {
  window.dispatchEvent?.(new CustomEvent("nv-show-subtoolbar", {
    detail: { heading: "Cartoon Panel", force: true, toggle: false },
  }));
}

function frameStyle() {
  return [
    "flex:1 1 0",
    "min-width:48px",
    "min-height:48px",
    "background:#fff",
    "border:2px solid #111",
    "box-sizing:border-box",
    "overflow:auto",
    "padding:8px",
    "outline:none",
    "color:#111",
  ].join(";");
}

function layoutStyle(direction = "row") {
  return [
    "display:flex",
    `flex-direction:${direction}`,
    "gap:var(--nv-cartoon-panel-gap, 12px)",
    "width:100%",
    "height:100%",
    "box-sizing:border-box",
    "min-width:0",
    "min-height:0",
  ].join(";");
}

function rootStyle({ width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT, gap = DEFAULT_GAP } = {}) {
  return [
    "position:relative",
    `width:${width}`,
    `height:${height}`,
    "min-width:240px",
    "min-height:180px",
    "margin:16px 0",
    "padding:12px",
    "background:#fff",
    "border:2px solid #111",
    "box-sizing:border-box",
    "overflow:hidden",
    `--nv-cartoon-panel-gap:${pxNumber(gap)}px`,
  ].join(";");
}

function createFrame({ html = "" } = {}) {
  const frame = document.createElement("div");
  frame.className = "nv-cartoon-frame";
  frame.setAttribute("data-nv-cartoon-frame", "");
  frame.setAttribute("contenteditable", "true");
  frame.setAttribute("style", frameStyle());
  frame.innerHTML = html;
  return frame;
}

function createSplit(orientation = "vertical") {
  const split = document.createElement("div");
  split.className = "nv-cartoon-split";
  split.setAttribute("data-nv-cartoon-split", "");
  split.dataset.orientation = orientation === "horizontal" ? "horizontal" : "vertical";
  split.setAttribute("style", layoutStyle(split.dataset.orientation === "horizontal" ? "column" : "row"));
  return split;
}

function createRootPanel({ id = uid(), gap = getDefaultCartoonGap() } = {}) {
  const root = document.createElement("div");
  root.id = id;
  root.className = "nv-cartoon-panel";
  root.setAttribute("data-nv-cartoon-panel", "");
  root.setAttribute("data-nv-resizable", "");
  root.setAttribute("contenteditable", "false");
  root.dataset.panelGap = String(pxNumber(gap));
  root.setAttribute("style", rootStyle({ gap }));

  const layout = document.createElement("div");
  layout.className = "nv-cartoon-layout";
  layout.setAttribute("data-nv-cartoon-layout", "");
  layout.dataset.orientation = "vertical";
  layout.setAttribute("style", layoutStyle("row"));
  layout.appendChild(createFrame());
  root.appendChild(layout);
  return root;
}

function serializeNode(node) {
  const wrapper = document.createElement("div");
  wrapper.appendChild(node);
  return wrapper.innerHTML;
}

function syncLayoutStyle(el) {
  if (!el?.matches?.("[data-nv-cartoon-layout], [data-nv-cartoon-split]")) return;
  const direction = el.dataset.orientation === "horizontal" ? "column" : "row";
  el.setAttribute("style", layoutStyle(direction));
}

function hydrateFrame(frame) {
  if (!frame) return;
  frame.classList.add("nv-cartoon-frame");
  frame.setAttribute("data-nv-cartoon-frame", "");
  frame.setAttribute("contenteditable", "true");
  frame.style.flex = frame.style.flex || "1 1 0";
  frame.style.minWidth = frame.style.minWidth || "48px";
  frame.style.minHeight = frame.style.minHeight || "48px";
  frame.style.background = frame.style.background || "#fff";
  frame.style.border = frame.style.border || "2px solid #111";
  frame.style.boxSizing = "border-box";
  frame.style.overflow = frame.style.overflow || "auto";
  frame.style.padding = frame.style.padding || "8px";
  frame.style.outline = "none";
}

function hydrateCartoonPanel(panel) {
  if (!panel) return;
  panel.classList.add("nv-cartoon-panel");
  panel.setAttribute("data-nv-cartoon-panel", "");
  panel.setAttribute("data-nv-resizable", "");
  panel.setAttribute("contenteditable", "false");
  const gap = pxNumber(panel.dataset.panelGap || panel.style.getPropertyValue("--nv-cartoon-panel-gap"), getDefaultCartoonGap());
  panel.dataset.panelGap = String(gap);
  panel.style.setProperty("--nv-cartoon-panel-gap", `${gap}px`);
  panel.style.position = panel.style.position || "relative";
  panel.style.width = panel.style.width || DEFAULT_WIDTH;
  panel.style.height = panel.style.height || DEFAULT_HEIGHT;
  panel.style.minWidth = panel.style.minWidth || "240px";
  panel.style.minHeight = panel.style.minHeight || "180px";
  panel.style.background = panel.style.background || "#fff";
  panel.style.border = panel.style.border || "2px solid #111";
  panel.style.boxSizing = "border-box";
  panel.style.overflow = panel.style.overflow || "hidden";
  panel.style.padding = panel.style.padding || "12px";

  const layout = panel.querySelector(":scope > [data-nv-cartoon-layout]") || panel.querySelector("[data-nv-cartoon-layout]");
  if (layout) syncLayoutStyle(layout);
  panel.querySelectorAll("[data-nv-cartoon-split]").forEach(syncLayoutStyle);
  panel.querySelectorAll("[data-nv-cartoon-frame]").forEach(hydrateFrame);
  if (!panel.querySelector("[data-nv-cartoon-frame]")) {
    const targetLayout = layout || panel;
    targetLayout.appendChild(createFrame());
  }
  installResizeHandle(panel);
}

function ensureStyles() {
  if (document.getElementById(CARTOON_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = CARTOON_STYLE_ID;
  style.textContent = `
    [data-nv-cartoon-panel] {
      user-select: none;
    }
    [data-nv-cartoon-frame] {
      user-select: text;
    }
    [data-nv-cartoon-frame][data-nv-cartoon-selected="true"] {
      box-shadow: inset 0 0 0 3px #2563eb;
    }
    [data-nv-cartoon-resize-handle] {
      position: absolute;
      right: 0;
      bottom: 0;
      width: 18px;
      height: 18px;
      z-index: 5;
      cursor: nwse-resize;
      background:
        linear-gradient(135deg, transparent 0 45%, rgba(17,17,17,.64) 46% 54%, transparent 55%),
        linear-gradient(135deg, transparent 0 66%, rgba(17,17,17,.64) 67% 75%, transparent 76%);
    }
  `;
  document.head.appendChild(style);
}

function installResizeHandle(panel) {
  if (!panel || panel.querySelector(":scope > [data-nv-cartoon-resize-handle]")) return;
  const handle = document.createElement("span");
  handle.className = "nv-editor-only";
  handle.setAttribute("data-nv-cartoon-resize-handle", "");
  handle.setAttribute("contenteditable", "false");
  handle.title = "Resize cartoon panel";
  panel.appendChild(handle);
  handle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveCartoonFrame(panel.querySelector("[data-nv-cartoon-frame]"));
    const editor = getEditorRoot();
    const start = panel.getBoundingClientRect();
    const editorRect = editor?.getBoundingClientRect?.() || { width: window.innerWidth };
    const startX = event.clientX;
    const startY = event.clientY;
    const maxWidth = Math.max(240, (editorRect.width || window.innerWidth) - 24);
    const move = (moveEvent) => {
      const width = Math.min(maxWidth, Math.max(240, start.width + moveEvent.clientX - startX));
      const height = Math.max(180, start.height + moveEvent.clientY - startY);
      panel.style.width = `${Math.round(width)}px`;
      panel.style.height = `${Math.round(height)}px`;
      markDirty();
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      markDirty();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  });
}

function simplifyLayout(node) {
  if (!node) return;
  Array.from(node.querySelectorAll("[data-nv-cartoon-split]")).reverse().forEach((split) => {
    const children = Array.from(split.children).filter((child) => child.matches?.("[data-nv-cartoon-frame], [data-nv-cartoon-split]"));
    if (children.length !== 1) return;
    split.replaceWith(children[0]);
  });
}

function applyGapToPanel(panel, gap) {
  if (!panel) return;
  const px = pxNumber(gap);
  panel.dataset.panelGap = String(px);
  panel.style.setProperty("--nv-cartoon-panel-gap", `${px}px`);
  panel.querySelectorAll("[data-nv-cartoon-layout], [data-nv-cartoon-split]").forEach(syncLayoutStyle);
}

export function getDefaultCartoonGap() {
  return pxNumber(window.__nvCartoonDefaultGap, DEFAULT_GAP);
}

export function setDefaultCartoonGap(value, { applyToActive = true } = {}) {
  const gap = pxNumber(value);
  window.__nvCartoonDefaultGap = gap;
  if (applyToActive) {
    const panel = activePanelFromFrame();
    if (panel) applyGapToPanel(panel, gap);
  }
  updateToolbarState({ htmlCartoonGap: gap });
  window.dispatchEvent?.(new CustomEvent("nv-cartoon-gap-changed", { detail: { gap } }));
  markDirty();
  return gap;
}

export function setActiveCartoonFrame(frame) {
  const wysiwyg = getEditorRoot();
  const previousFrame = window.__nvHtmlCartoonActiveFrame || null;
  const previousPanel = window.__nvHtmlCartoonActivePanel || null;
  const active = isFrameInEditor(frame, wysiwyg) ? frame : null;
  wysiwyg?.querySelectorAll?.("[data-nv-cartoon-selected]").forEach((el) => {
    if (el !== active) el.removeAttribute("data-nv-cartoon-selected");
  });
  if (active) active.setAttribute("data-nv-cartoon-selected", "true");
  window.__nvHtmlCartoonActiveFrame = active;
  window.__nvHtmlCartoonActivePanel = active?.closest?.("[data-nv-cartoon-panel]") || findPanelFromSelection() || firstCartoonPanel();
  const activeGap = pxNumber(window.__nvHtmlCartoonActivePanel?.dataset?.panelGap, getDefaultCartoonGap());
  const changed = previousFrame !== active ||
    previousPanel !== window.__nvHtmlCartoonActivePanel ||
    window.NodevisionState?.htmlCartoonSelected !== Boolean(active) ||
    window.NodevisionState?.htmlCartoonGap !== activeGap;
  if (changed) {
    updateToolbarState({
      htmlCartoonSelected: Boolean(active),
      htmlCartoonGap: activeGap,
    });
    window.dispatchEvent?.(new CustomEvent("nv-cartoon-selection-changed", {
      detail: {
        frame: active,
        panel: window.__nvHtmlCartoonActivePanel || null,
        selected: Boolean(active),
      },
    }));
  }
  return active;
}

export function getActiveCartoonFrame() {
  const wysiwyg = getEditorRoot();
  const saved = window.__nvHtmlCartoonActiveFrame;
  if (isFrameInEditor(saved, wysiwyg)) return saved;
  const selected = selectedFrameFromSelection();
  return selected ? setActiveCartoonFrame(selected) : null;
}

export function hydrateAllCartoonPanels(wysiwyg = getEditorRoot()) {
  if (!wysiwyg) return;
  ensureStyles();
  wysiwyg.querySelectorAll("[data-nv-cartoon-panel]").forEach(hydrateCartoonPanel);
}

export function insertCartoonPanelAtCaret() {
  const wysiwyg = getEditorRoot();
  if (!wysiwyg) {
    alert("Open an HTML document to insert a cartoon panel.");
    return false;
  }
  ensureStyles();
  const root = createRootPanel();
  insertHtmlAtCaret(serializeNode(root));
  const inserted = document.getElementById(root.id) || wysiwyg.querySelector(`[id="${root.id}"]`);
  hydrateAllCartoonPanels(wysiwyg);
  setActiveCartoonFrame(inserted?.querySelector?.("[data-nv-cartoon-frame]") || null);
  focusFrame(getActiveCartoonFrame());
  showToolbar();
  markDirty();
  return true;
}

export function insertCartoonFrame() {
  const frame = getActiveCartoonFrame();
  const panel = activePanelFromFrame(frame);
  if (!panel) {
    alert("Insert or select a cartoon panel first.");
    return false;
  }
  hydrateCartoonPanel(panel);
  const next = createFrame();
  const target = frame || panel.querySelector("[data-nv-cartoon-frame]");
  if (target?.parentElement) target.after(next);
  else (panel.querySelector("[data-nv-cartoon-layout]") || panel).appendChild(next);
  setActiveCartoonFrame(next);
  focusFrame(next);
  showToolbar();
  markDirty();
  return true;
}

export function splitSelectedCartoonFrame(orientation = "vertical") {
  const frame = getActiveCartoonFrame();
  if (!frame) {
    alert("Select a cartoon panel cell first.");
    return false;
  }
  const split = createSplit(orientation);
  const blank = createFrame();
  frame.removeAttribute("data-nv-cartoon-selected");
  frame.replaceWith(split);
  split.append(frame, blank);
  setActiveCartoonFrame(blank);
  focusFrame(blank);
  showToolbar();
  markDirty();
  return true;
}

export function deleteSelectedCartoonFrame() {
  const frame = getActiveCartoonFrame();
  if (!frame) {
    alert("Select a cartoon panel cell first.");
    return false;
  }
  const panel = frame.closest("[data-nv-cartoon-panel]");
  const frames = Array.from(panel?.querySelectorAll?.("[data-nv-cartoon-frame]") || []);
  if (frames.length <= 1) {
    frame.innerHTML = "";
    setActiveCartoonFrame(frame);
    focusFrame(frame);
    markDirty();
    return true;
  }
  const parent = frame.parentElement;
  const candidate = frames[frames.indexOf(frame) + 1] || frames[frames.indexOf(frame) - 1] || null;
  frame.remove();
  simplifyLayout(parent);
  simplifyLayout(panel);
  setActiveCartoonFrame(candidate?.isConnected ? candidate : panel.querySelector("[data-nv-cartoon-frame]"));
  focusFrame(getActiveCartoonFrame());
  showToolbar();
  markDirty();
  return true;
}

export function installCartoonEditingBehavior(wysiwyg = getEditorRoot()) {
  if (!wysiwyg) return () => {};
  ensureStyles();
  window.__nvCartoonEditorRoot = wysiwyg;
  hydrateAllCartoonPanels(wysiwyg);

  const updateFromNode = (node) => {
    const el = elementFromNode(node);
    const frame = el?.closest?.("[data-nv-cartoon-frame]") || null;
    if (frame && wysiwyg.contains(frame)) {
      setActiveCartoonFrame(frame);
      return true;
    }
    const panel = el?.closest?.("[data-nv-cartoon-panel]") || null;
    if (panel && wysiwyg.contains(panel)) {
      setActiveCartoonFrame(panel.querySelector("[data-nv-cartoon-frame]"));
      showToolbar();
      return true;
    }
    return false;
  };

  const onPointerDown = (event) => {
    hydrateAllCartoonPanels(wysiwyg);
    if (!updateFromNode(event.target)) setActiveCartoonFrame(null);
  };
  const onFocusIn = (event) => updateFromNode(event.target);
  const onSelectionChange = () => {
    const selection = window.getSelection?.();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (!range || !wysiwyg.contains(range.commonAncestorContainer)) return;
    if (!updateFromNode(range.startContainer)) setActiveCartoonFrame(null);
  };
  const observer = new MutationObserver(() => hydrateAllCartoonPanels(wysiwyg));

  wysiwyg.addEventListener("pointerdown", onPointerDown, true);
  wysiwyg.addEventListener("click", onPointerDown, true);
  wysiwyg.addEventListener("focusin", onFocusIn);
  document.addEventListener("selectionchange", onSelectionChange);
  observer.observe(wysiwyg, { childList: true, subtree: true });

  return () => {
    wysiwyg.removeEventListener("pointerdown", onPointerDown, true);
    wysiwyg.removeEventListener("click", onPointerDown, true);
    wysiwyg.removeEventListener("focusin", onFocusIn);
    document.removeEventListener("selectionchange", onSelectionChange);
    observer.disconnect();
    wysiwyg.querySelectorAll("[data-nv-cartoon-selected]").forEach((el) => el.removeAttribute("data-nv-cartoon-selected"));
    wysiwyg.querySelectorAll("[data-nv-cartoon-resize-handle]").forEach((el) => el.remove());
    if (window.__nvCartoonEditorRoot === wysiwyg) window.__nvCartoonEditorRoot = null;
    if (window.__nvHtmlCartoonActiveFrame && wysiwyg.contains(window.__nvHtmlCartoonActiveFrame)) {
      window.__nvHtmlCartoonActiveFrame = null;
      window.__nvHtmlCartoonActivePanel = null;
    }
    updateToolbarState({ htmlCartoonSelected: false });
  };
}
