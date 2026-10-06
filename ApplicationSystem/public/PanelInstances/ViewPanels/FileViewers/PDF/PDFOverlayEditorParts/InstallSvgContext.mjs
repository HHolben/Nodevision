// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/PDF/PDFOverlayEditorParts/InstallSvgContext.mjs
// This module implements install svg context operations for PDFOverlayEditor, preserving the existing document and instance ownership contracts.

import { updateToolbarState } from "/panels/createToolbar.mjs";
import { setMode, insertShape, applyCurrentStyleToSelection, duplicateSelection, copySelection, pasteSelection, arrangeSelection } from "./DuplicateSelection.mjs";
import { appendAnnotation, currentStyle, clearSelection, deleteSelection, updateSelectionBox, selectElement } from "./FetchAnnotationText.mjs";
import { setDirty, UI_ATTR, saveAnnotations } from "./SVG_NS.mjs";

export function installSvgContext(workspace) {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.currentMode = workspace.editable ? "SVG Editing" : "PDF Viewing";
  if (workspace.editable) {
    updateToolbarState({
      currentMode: "SVG Editing",
      fileIsDirty: workspace.dirty,
      selectedFile: workspace.filePath,
    });
  }

  const ctx = {
    svgRoot: workspace.activeSvg,
    setMode: (mode) => setMode(workspace, mode),
    insertShape: (kind) => insertShape(workspace, kind),
    layers: {
      appendToActiveLayer(node) {
        return appendAnnotation(workspace, node);
      },
    },
    getCurrentStyleDefaults() {
      return currentStyle(workspace);
    },
    applyCurrentStyleToSelection: () => applyCurrentStyleToSelection(workspace),
    setFillColor(value) {
      workspace.styleState.fill = String(value || workspace.styleState.fill);
      if (workspace.selectedElement) workspace.selectedElement.setAttribute("fill", workspace.styleState.fill);
      setDirty(workspace, true);
    },
    setStrokeColor(value) {
      workspace.styleState.stroke = String(value || workspace.styleState.stroke);
      if (workspace.selectedElement) workspace.selectedElement.setAttribute("stroke", workspace.styleState.stroke);
      setDirty(workspace, true);
    },
    setStrokeWidth(value) {
      workspace.styleState.strokeWidth = String(value || workspace.styleState.strokeWidth);
      if (workspace.selectedElement) workspace.selectedElement.setAttribute("stroke-width", workspace.styleState.strokeWidth);
      setDirty(workspace, true);
    },
    clearSelection: () => clearSelection(workspace),
    deleteSelection: () => deleteSelection(workspace),
    duplicateSelection: () => duplicateSelection(workspace),
    copySelection: () => copySelection(workspace),
    pasteSelection: (dx = 20, dy = 20) => pasteSelection(workspace, dx, dy),
    arrangeSelection: (direction) => arrangeSelection(workspace, direction),
    alignSelection: () => false,
    groupSelection: () => false,
    ungroupSelection: () => false,
    moveSelectionBy(dx = 0, dy = 0) {
      const el = workspace.selectedElement;
      if (!el) return false;
      const base = el.getAttribute("transform") || "";
      el.setAttribute("transform", ("translate(" + (Number(dx) || 0) + " " + (Number(dy) || 0) + ") " + base).trim());
      updateSelectionBox(workspace);
      setDirty(workspace, true);
      return true;
    },
    getSelectedElement: () => workspace.selectedElement,
    getSelectedElements: () => workspace.selectedElement ? [workspace.selectedElement] : [],
    setSelection(elements = []) {
      return selectElement(workspace, elements[0] || null);
    },
    selectAll() {
      const first = workspace.activeAnnotationLayer?.querySelector?.(":scope > *:not([" + UI_ATTR + "])");
      if (first) selectElement(workspace, first);
    },
  };

  window.SVGEditorContext = ctx;
  window.selectSVGElement = (element) => selectElement(workspace, element);
}

export function installEditorHooks(workspace) {
  if (!workspace.editable) return;
  window.__nvPdfEditorActivePath = workspace.filePath;
  window.saveWYSIWYGFile = async () => saveAnnotations(workspace);
  window.currentSavePDFAnnotations = async () => saveAnnotations(workspace);
}
