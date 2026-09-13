// Nodevision/ApplicationSystem/public/panels/workspaceParts/workspaceActiveFile.mjs
// This module resolves the active Notebook file path for editor and viewer panel requests in the Nodevision workspace.

import { getActivePanelTab } from "../panelTabs.mjs";
import { normalizeNotebookPath } from "./workspacePaths.mjs";
import { normalizePanelIdentifier, resolvePanelCell } from "./workspacePrimitives.mjs";

export function panelCellLooksLikeEditor(cell) {
  const activeTab = getActivePanelTab(cell);
  const panelClass = String(activeTab?.panelClass || cell?.dataset?.panelClass || "").toLowerCase();
  const panelType = normalizePanelIdentifier(activeTab?.panelType || cell?.dataset?.id || cell?.dataset?.panelId || "");
  return panelClass === "editorpanel" || panelType === "CodeEditor" || panelType === "GraphicalEditor";
}

function activeWorkspacePanelLooksLikeEditor() {
  const activeCell = resolvePanelCell(window.activeCell);
  if (panelCellLooksLikeEditor(activeCell)) return true;
  const panelClass = String(window.activePanelClass || "").toLowerCase();
  const panelType = normalizePanelIdentifier(window.activePanel || "");
  return panelClass === "editorpanel" || panelType === "CodeEditor" || panelType === "GraphicalEditor";
}

export function isEditorPanelRequest(panelType = "", panelClass = "") {
  const normalizedType = normalizePanelIdentifier(panelType) || panelType;
  return String(panelClass || "").toLowerCase() === "editorpanel" || normalizedType === "CodeEditor" || normalizedType === "GraphicalEditor";
}

export function resolveActiveFilePath(preferredPath = null, options = {}) {
  const state = window.NodevisionState || {};
  const selectedCandidates = [window.selectedFilePath, state.selectedFile];
  const activeEditorCandidates = [state.activeEditorFilePath, window.__nvCodeEditorActivePath, window.__nvMarkdownActivePath, window.__nvWysiwygActivePath, window.__nvHtmlEditorActivePath, window.__nvSvgEditorActivePath];
  const renderedCandidates = [window.currentActiveFilePath, state.activeFileViewPath, window.ActiveNode, window.filePath];
  const editorRequest = isEditorPanelRequest(options.panelType, options.panelClass);
  const candidates = editorRequest && !activeWorkspacePanelLooksLikeEditor()
    ? [preferredPath, ...selectedCandidates, ...activeEditorCandidates, ...renderedCandidates]
    : [preferredPath, ...activeEditorCandidates, ...renderedCandidates, ...selectedCandidates];
  for (const candidate of candidates) {
    const normalized = normalizeNotebookPath(candidate);
    if (normalized) return normalized;
  }
  return "";
}
