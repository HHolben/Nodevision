// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/hyperlinkSelection.mjs
// This module tracks whether the active HTML editor caret or selection intersects a hyperlink so shared toolbar visibility can stay contextual.

import { updateToolbarState } from "/panels/createToolbar.mjs";
import { findSourceHyperlinkContext } from "./sourceHyperlinkTools.mjs";

const EDITABLE_HTML_MODES = new Set(["HTMLediting", "EPUBediting"]);
let installed = false;
let pendingRefresh = false;
let lastElement = null;
let lastHref = "";
let lastText = "";

function currentMode() {
  return String(window.NodevisionState?.currentMode || window.currentMode || "");
}

function elementFromNode(node) {
  if (node instanceof Element) return node;
  return node?.parentElement instanceof Element ? node.parentElement : null;
}

function isToolbarElement(node) {
  const el = elementFromNode(node);
  return Boolean(el?.closest?.("#global-toolbar, #sub-toolbar, .toolbar-dropdown-panel"));
}

export function getActiveHtmlEditorElement() {
  const editor = window.HTMLWysiwygTools?.getEditorElement?.();
  if (editor?.isContentEditable && editor.isConnected) return editor;
  return document.querySelector("#wysiwyg[contenteditable='true']");
}

export function hyperlinkFromNode(node, editor = getActiveHtmlEditorElement()) {
  if (!editor) return null;
  const el = elementFromNode(node);
  const link = el?.closest?.("a[href]") || null;
  return link && editor.contains(link) ? link : null;
}

function selectionTouchesEditor(selection, editor) {
  if (!selection || !selection.rangeCount || !editor) return false;
  const range = selection.getRangeAt(0);
  return editor.contains(range.commonAncestorContainer) ||
    editor.contains(selection.anchorNode) ||
    editor.contains(selection.focusNode);
}

export function findHyperlinkFromSelection(editor = getActiveHtmlEditorElement()) {
  if (!editor || !EDITABLE_HTML_MODES.has(currentMode())) return null;
  const selection = window.getSelection?.();
  const activeLink = hyperlinkFromNode(document.activeElement, editor);
  if (!selection?.rangeCount || !selectionTouchesEditor(selection, editor)) return activeLink;

  const range = selection.getRangeAt(0);
  const direct = hyperlinkFromNode(selection.anchorNode, editor) ||
    hyperlinkFromNode(selection.focusNode, editor) ||
    hyperlinkFromNode(range.commonAncestorContainer, editor);
  if (direct) return direct;
  if (selection.isCollapsed) return activeLink;

  for (const link of editor.querySelectorAll("a[href]")) {
    try {
      if (range.intersectsNode(link)) return link;
    } catch {
      // Ignore detached nodes encountered during editor rerenders.
    }
  }
  return activeLink;
}

export function selectedHyperlinkContext() {
  const link = findHyperlinkFromSelection();
  if (!link) return findSourceHyperlinkContext();
  return {
    kind: "dom",
    element: link,
    href: link.getAttribute("href") || "",
    text: link.textContent || "",
  };
}

export function publishHyperlinkSelection(context) {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.activeHtmlHyperlinkContext = context || null;
  updateToolbarState({
    htmlHyperlinkSelected: Boolean(context),
    htmlHyperlinkHref: context?.href || null,
  });
}

export function refreshHyperlinkSelectionState({ force = false } = {}) {
  const context = selectedHyperlinkContext();
  const element = context?.element || null;
  const href = context?.href || "";
  const text = context?.text || "";
  const sourceKey = context?.range
    ? String(context.kind || "source") + ":" + context.range.start + ":" + context.range.end
    : "";
  if (!force && (element || sourceKey) === lastElement && href === lastHref && text === lastText) return context;
  lastElement = element || sourceKey;
  lastHref = href;
  lastText = text;
  publishHyperlinkSelection(context);
  return context;
}

function scheduleRefresh(event) {
  if (isToolbarElement(event?.target) || isToolbarElement(document.activeElement)) return;
  if (pendingRefresh) return;
  pendingRefresh = true;
  requestAnimationFrame(() => {
    pendingRefresh = false;
    refreshHyperlinkSelectionState();
  });
}

export function installHyperlinkSelectionTracking() {
  if (installed) return;
  installed = true;
  document.addEventListener("selectionchange", scheduleRefresh);
  document.addEventListener("keyup", scheduleRefresh, true);
  document.addEventListener("mouseup", scheduleRefresh, true);
  document.addEventListener("focusin", scheduleRefresh, true);
  document.addEventListener("input", scheduleRefresh, true);
  window.addEventListener("activePanelChanged", () => refreshHyperlinkSelectionState({ force: true }));
  refreshHyperlinkSelectionState({ force: true });
}
