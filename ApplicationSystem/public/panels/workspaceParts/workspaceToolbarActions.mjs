// Nodevision/ApplicationSystem/public/panels/workspaceParts/workspaceToolbarActions.mjs
// This module installs the global toolbarAction listener that replaces or activates Nodevision workspace panels.

import { activatePanelTab, getActivePanelTab } from "../panelTabs.mjs";
import { activatePanelCell } from "./workspaceActivePanels.mjs";
import { resolveActiveFilePath } from "./workspaceActiveFile.mjs";
import { findPanelTabMatch, isEmptyOrPlaceholderPanelCell, replacePanelInCell } from "./workspacePanelLoader.mjs";
import { joinNotebookPath, normalizeNotebookPath } from "./workspacePaths.mjs";
import { normalizePanelIdentifier, resolvePanelCell } from "./workspacePrimitives.mjs";
import { openDirectoryEditingWorkspace, selectedDirectoryPathForEditorRequest, shouldOpenDirectoryEditingWorkspace } from "./workspaceSpecialLayouts.mjs";

function shouldGuardToolbarEditorSwitch(detail, panelId, panelClass) {
  if (detail?.__nvGuardedEditorSwitch) return false;
  if (String(panelClass || "").toLowerCase() !== "editorpanel") return false;
  if (typeof window.__nvGuardEditorSwitch !== "function") return false;
  const currentId = normalizePanelIdentifier(window.activeCell?.dataset?.id || window.activePanel || "") || "";
  const activeTab = getActivePanelTab(resolvePanelCell(window.activeCell));
  const nextPath = normalizeNotebookPath(detail?.panelVars?.filePath || detail?.filePath || "");
  const currentPath = normalizeNotebookPath(activeTab?.resourcePath || window.__nvCodeEditorActivePath || window.currentActiveFilePath || "");
  if (currentId === panelId && (!nextPath || nextPath === currentPath)) return false;
  return Boolean(window.NodevisionState?.fileIsDirty || window.__nvCodeEditorDirty);
}

function replayGuardedToolbarAction(detail = {}) {
  window.dispatchEvent(new CustomEvent("toolbarAction", { detail: { ...detail, __nvGuardedEditorSwitch: true } }));
}

export function installWorkspaceToolbarActions() {
  if (window.__nvWorkspaceToolbarActionsInstalled) return;
  window.__nvWorkspaceToolbarActionsInstalled = true;
  window.addEventListener("toolbarAction", async (e) => {
    const { id, type, replaceActive, panelVars = {} } = e.detail || {};
    const normalizedId = normalizePanelIdentifier(id) || id;
    if (normalizedId !== id) console.log(`Alias: toolbarAction alias: ${id} -> ${normalizedId}`);
    const panelClass = type || "InfoPanel";
    if (shouldOpenDirectoryEditingWorkspace(e.detail, normalizedId, panelClass)) {
      const directoryPath = selectedDirectoryPathForEditorRequest(e.detail);
      const openWorkspace = () => openDirectoryEditingWorkspace(directoryPath, { originCell: window.activeCell });
      if (!e.detail?.__nvGuardedEditorSwitch && typeof window.__nvGuardEditorSwitch === "function") window.__nvGuardEditorSwitch(joinNotebookPath(directoryPath, "index.html"), openWorkspace);
      else await openWorkspace();
      return;
    }
    if (shouldGuardToolbarEditorSwitch(e.detail, normalizedId, panelClass)) {
      const nextPath = resolveActiveFilePath(e.detail?.panelVars?.filePath || e.detail?.filePath, { panelType: normalizedId, panelClass });
      window.__nvGuardEditorSwitch(nextPath, () => replayGuardedToolbarAction(e.detail));
      return;
    }
    const activeCell = resolvePanelCell(window.activeCell);
    if (activeCell && (replaceActive || isEmptyOrPlaceholderPanelCell(activeCell))) {
      await replacePanelInCell(activeCell, normalizedId, panelClass, panelVars);
      console.log(`Replaced active panel with "${normalizedId}" (${panelClass})`);
      return;
    }
    const existingMatch = findPanelTabMatch({ panelType: normalizedId, panelClass, panelVars });
    if (existingMatch) {
      existingMatch.cell.style.display = "flex";
      activatePanelTab(existingMatch.cell, existingMatch.tab.tabId, { announce: false });
      console.log("Panel: Panel tab already exists, activated:", normalizedId);
      return;
    }
    const existingCell = document.querySelector("[data-id=\"" + normalizedId + "\"]");
    if (existingCell && !existingCell.__nvPanelTabs) {
      existingCell.style.display = "flex";
      activatePanelCell(existingCell, { announce: false });
      console.log("Panel: Panel already exists, activated:", normalizedId);
      return;
    }
    if (!activeCell) {
      console.warn("No active cell selected to replace with toolbar panel.");
      return;
    }
    await replacePanelInCell(activeCell, normalizedId, panelClass, panelVars);
  });
}
