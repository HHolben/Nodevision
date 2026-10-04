// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/cartoonToolsParts/ApplyGapToPanel.mjs
// This module implements apply Gap To Panel behavior for the cartoonTools feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { pxNumber, DEFAULT_GAP, activePanelFromFrame, markDirty, getEditorRoot, isFrameInEditor, findPanelFromSelection, firstCartoonPanel, selectedFrameFromSelection, focusFrame, showToolbar, createFrame, createSplit } from "./Uid.mjs";
import { syncLayoutStyle, ensureStyles, hydrateCartoonPanel, createRootPanel, serializeNode } from "./CreateRootPanel.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";
import { presentHtmlAttribute } from "/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlPresentation.mjs";
import { insertHtmlAtCaret } from "/ToolbarJSONfiles/insertMediaCommon.mjs";

// Apply Gap To Panel operations.
export function applyGapToPanel(panel, gap) {
  if (!panel) return;
  const px = pxNumber(gap);
  panel.dataset.panelGap = String(px);
  panel.style.setProperty("--nv-cartoon-panel-gap", `${px}px`);
  panel.querySelectorAll("[data-nv-cartoon-layout], [data-nv-cartoon-split]").forEach(syncLayoutStyle);
}

export function getDefaultCartoonGap() {
  return pxNumber(window.__nvCartoonDefaultGap, DEFAULT_GAP);
}

export function setDefaultCartoonGap(value, {
  applyToActive = true
} = {}) {
  const gap = pxNumber(value);
  window.__nvCartoonDefaultGap = gap;
  if (applyToActive) {
    const panel = activePanelFromFrame();
    if (panel) applyGapToPanel(panel, gap);
  }
  updateToolbarState({
    htmlCartoonGap: gap
  });
  window.dispatchEvent?.(new CustomEvent("nv-cartoon-gap-changed", {
    detail: {
      gap
    }
  }));
  markDirty();
  return gap;
}

export function setActiveCartoonFrame(frame) {
  const wysiwyg = getEditorRoot();
  const previousFrame = window.__nvHtmlCartoonActiveFrame || null;
  const previousPanel = window.__nvHtmlCartoonActivePanel || null;
  const active = isFrameInEditor(frame, wysiwyg) ? frame : null;
  wysiwyg?.querySelectorAll?.("[data-nv-cartoon-selected]").forEach(el => {
    if (el !== active) presentHtmlAttribute(el, "data-nv-cartoon-selected", null);
  });
  if (active) presentHtmlAttribute(active, "data-nv-cartoon-selected", "true");
  window.__nvHtmlCartoonActiveFrame = active;
  window.__nvHtmlCartoonActivePanel = active?.closest?.("[data-nv-cartoon-panel]") || findPanelFromSelection() || firstCartoonPanel();
  const activeGap = pxNumber(window.__nvHtmlCartoonActivePanel?.dataset?.panelGap, getDefaultCartoonGap());
  const changed = previousFrame !== active || previousPanel !== window.__nvHtmlCartoonActivePanel || window.NodevisionState?.htmlCartoonSelected !== Boolean(active) || window.NodevisionState?.htmlCartoonGap !== activeGap;
  if (changed) {
    updateToolbarState({
      htmlCartoonSelected: Boolean(active),
      htmlCartoonGap: activeGap
    });
    window.dispatchEvent?.(new CustomEvent("nv-cartoon-selection-changed", {
      detail: {
        frame: active,
        panel: window.__nvHtmlCartoonActivePanel || null,
        selected: Boolean(active)
      }
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
  if (target?.parentElement) target.after(next);else (panel.querySelector("[data-nv-cartoon-layout]") || panel).appendChild(next);
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
  presentHtmlAttribute(frame, "data-nv-cartoon-selected", null);
  frame.replaceWith(split);
  split.append(frame, blank);
  setActiveCartoonFrame(blank);
  focusFrame(blank);
  showToolbar();
  markDirty();
  return true;
}
