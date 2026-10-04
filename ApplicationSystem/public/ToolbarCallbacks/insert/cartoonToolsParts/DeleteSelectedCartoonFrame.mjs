// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/cartoonToolsParts/DeleteSelectedCartoonFrame.mjs
// This module implements delete Selected Cartoon Frame behavior for the cartoonTools feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { getActiveCartoonFrame, setActiveCartoonFrame, hydrateAllCartoonPanels } from "./ApplyGapToPanel.mjs";
import { focusFrame, markDirty, showToolbar, getEditorRoot, elementFromNode } from "./Uid.mjs";
import { simplifyLayout, ensureStyles } from "./CreateRootPanel.mjs";
import { presentHtmlAttribute } from "/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlPresentation.mjs";
import { isHtmlEditorChrome } from "/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlSourceProvenance.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";

// Delete Selected Cartoon Frame operations.
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
  const updateFromNode = node => {
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
  const onPointerDown = event => {
    hydrateAllCartoonPanels(wysiwyg);
    if (!updateFromNode(event.target)) setActiveCartoonFrame(null);
  };
  const onFocusIn = event => updateFromNode(event.target);
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
  observer.observe(wysiwyg, {
    childList: true,
    subtree: true
  });
  return () => {
    wysiwyg.removeEventListener("pointerdown", onPointerDown, true);
    wysiwyg.removeEventListener("click", onPointerDown, true);
    wysiwyg.removeEventListener("focusin", onFocusIn);
    document.removeEventListener("selectionchange", onSelectionChange);
    observer.disconnect();
    wysiwyg.querySelectorAll("[data-nv-cartoon-selected]").forEach(el => presentHtmlAttribute(el, "data-nv-cartoon-selected", null));
    wysiwyg.querySelectorAll("[data-nv-cartoon-resize-handle]").forEach(el => {
      if (isHtmlEditorChrome(el)) el.remove();
    });
    if (window.__nvCartoonEditorRoot === wysiwyg) window.__nvCartoonEditorRoot = null;
    if (window.__nvHtmlCartoonActiveFrame && wysiwyg.contains(window.__nvHtmlCartoonActiveFrame)) {
      window.__nvHtmlCartoonActiveFrame = null;
      window.__nvHtmlCartoonActivePanel = null;
    }
    updateToolbarState({
      htmlCartoonSelected: false
    });
  };
}

export function createAddEventListenerPointerdownHandler(owner) {
  return event => {
    event.preventDefault();
    event.stopPropagation();
    setActiveCartoonFrame(owner.panel.querySelector("[data-nv-cartoon-frame]"));
    const editor = getEditorRoot();
    const start = owner.panel.getBoundingClientRect();
    const editorRect = editor?.getBoundingClientRect?.() || {
      width: window.innerWidth
    };
    const startX = event.clientX;
    const startY = event.clientY;
    const maxWidth = Math.max(240, (editorRect.width || window.innerWidth) - 24);
    const move = moveEvent => {
      const width = Math.min(maxWidth, Math.max(240, start.width + moveEvent.clientX - startX));
      const height = Math.max(180, start.height + moveEvent.clientY - startY);
      owner.panel.style.width = `${Math.round(width)}px`;
      owner.panel.style.height = `${Math.round(height)}px`;
      markDirty();
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      markDirty();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, {
      once: true
    });
  };
}
