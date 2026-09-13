// Nodevision/ApplicationSystem/public/panels/workspaceParts/workspacePanelLoader.mjs
// This module resolves, mounts, replaces, and cleans up Nodevision workspace panel modules and panel tabs.

import { findPanelTabMatch, openPanelTabInCell, closePanelTabsInCell } from "../panelTabs.mjs";
import { ensurePanelEdgeSplitHandles, ensureWorkspaceEdgeSplitHandles } from "./workspaceEdgeHandles.mjs";
import { activatePanelCell, highlightActiveCell } from "./workspaceActivePanels.mjs";
import { ensureWorkspace, makePanelCell } from "./workspaceCells.mjs";
import { createPanelRow, normalizePanelIdentifier, resolvePanelCell, setCellIdentity } from "./workspacePrimitives.mjs";
import { resolveActiveFilePath } from "./workspaceActiveFile.mjs";
import { rebuildLayoutDividersForContainer } from "./workspaceDividers.mjs";

export function panelCellContentChildren(cell) {
  return Array.from(cell?.children || []).filter((child) => !child.classList?.contains("panel-edge-split-handle") && !child.classList?.contains("nv-panel-tab-shell"));
}

export function isEmptyOrPlaceholderPanelCell(cell) {
  const children = panelCellContentChildren(cell);
  if (children.length === 0) return true;
  return children.every((child) => child.classList?.contains("panel-split-placeholder") || child.classList?.contains("panel-resize-placeholder"));
}

export function cleanupPanelCells(root) {
  for (const cell of Array.from(root?.querySelectorAll?.(".panel-cell") || [])) {
    closePanelTabsInCell(cell, { force: true });
    if (typeof cell.cleanup === "function") {
      try { cell.cleanup(); } catch (err) { console.warn("Panel cleanup failed before workspace replacement:", err); }
    }
    cell.cleanup = null;
  }
}

export async function replacePanelInCell(cell, panelId, panelClass = "InfoPanel", panelVars = {}) {
  if (!cell || !panelId) return null;
  setCellIdentity(cell, { id: panelId, panelClass });
  activatePanelCell(cell, { announce: false });
  await loadPanelIntoCell(panelId, { id: panelId, displayName: panelId, panelClass, ...panelVars });
  ensurePanelEdgeSplitHandles(cell);
  highlightActiveCell(cell);
  return cell;
}

function panelModuleSearchPaths(panelType, panelClassValue = "") {
  const panelClass = String(panelClassValue || "").toLowerCase();
  const preferredFolder = { editorpanel: "EditorPanels", infopanel: "InfoPanels", viewpanel: "ViewPanels", controlpanel: "ControlPanels" }[panelClass];
  return [...new Set([
    preferredFolder ? "/PanelInstances/" + preferredFolder + "/" + panelType + ".mjs" : null,
    "/PanelInstances/" + panelType + ".mjs",
    "/PanelInstances/EditorPanels/" + panelType + ".mjs",
    "/PanelInstances/InfoPanels/" + panelType + ".mjs",
    "/PanelInstances/ViewPanels/" + panelType + ".mjs",
    "/PanelInstances/ControlPanels/" + panelType + ".mjs",
    "/panels/" + panelType + ".mjs",
  ].filter(Boolean))];
}

async function resolvePanelModule(panelType, panelClassValue = "") {
  for (const path of panelModuleSearchPaths(panelType, panelClassValue)) {
    try {
      console.log("Import: Trying to import panel:", path);
      if (!window.__nvModuleCacheBust) window.__nvModuleCacheBust = Date.now();
      const candidateModule = await import(path + (path.includes("?") ? "&" : "?") + "v=" + window.__nvModuleCacheBust);
      if (typeof candidateModule.setupPanel !== "function") {
        console.warn("Warning: Panel module has no setupPanel(), trying next candidate:", path);
        continue;
      }
      console.log("Loaded: Successfully imported:", path);
      return candidateModule;
    } catch {}
  }
  console.warn("Warning: No panel module with setupPanel found for", panelType);
  return null;
}

async function mountPanelModuleIntoElement(host, panelType, panelVars = {}, panelClassValue = "InfoPanel") {
  const module = await resolvePanelModule(panelType, panelClassValue);
  if (!module) {
    host.innerHTML = "<div class=\"panel-loading\">Panel module unavailable.</div>";
    return null;
  }
  const resolvedFilePath = resolveActiveFilePath(panelVars.filePath, { panelType, panelClass: panelClassValue });
  if (resolvedFilePath) host.dataset.currentFilePath = resolvedFilePath;
  else delete host.dataset.currentFilePath;
  const cleanup = await module.setupPanel(host, { ...panelVars, filePath: resolvedFilePath || null });
  if (typeof cleanup === "function") host.cleanup = cleanup;
  return cleanup;
}

export async function loadPanelIntoCell(panelType, panelVars = {}) {
  const cell = resolvePanelCell(window.activeCell) || window.activeCell;
  if (!cell?.classList?.contains?.("panel-cell")) {
    console.warn("Warning: No active cell selected for loading panel:", panelType);
    return null;
  }
  const requestedPanelType = panelType;
  const normalizedPanelType = normalizePanelIdentifier(panelType) || panelType;
  console.log("Panel Type:", requestedPanelType);
  if (requestedPanelType !== normalizedPanelType) console.log("Alias: Normalized panel type: " + requestedPanelType + " -> " + normalizedPanelType);
  const panelClass = panelVars.panelClass || cell.dataset.panelClass || "InfoPanel";
  const tab = await openPanelTabInCell(cell, {
    panelType: normalizedPanelType, panelClass, panelVars: { ...panelVars, panelClass },
    tabOrientation: panelVars.tabOrientation || cell.dataset.nvTabOrientation || "top",
    allowDuplicate: panelVars.allowDuplicateTab === true, tabId: panelVars.__nvTabId || panelVars.tabId || null,
    index: panelVars.__nvTabIndex,
  }, (host, vars) => mountPanelModuleIntoElement(host, normalizedPanelType, vars, panelClass));
  ensurePanelEdgeSplitHandles(cell);
  console.log("Loaded: Loaded panel tab:", normalizedPanelType);
  return tab;
}

export async function loadPanelIntoSpecificCell(cell, panelType, panelVars = {}) {
  if (!cell || !panelType) return;
  const previousActiveCell = window.activeCell;
  window.activeCell = cell;
  try { return await loadPanelIntoCell(panelType, panelVars); }
  finally { window.activeCell = previousActiveCell; }
}

export async function replaceWorkspaceWithPanel(panelType, panelVars = {}) {
  const workspace = ensureWorkspace();
  const normalizedPanelType = normalizePanelIdentifier(String(panelType || "").trim()) || String(panelType || "").trim();
  if (!normalizedPanelType) return null;
  const { panelClass = "InfoPanel", displayName = normalizedPanelType, ...remainingPanelVars } = panelVars || {};
  cleanupPanelCells(workspace);
  workspace.innerHTML = "";
  ensureWorkspaceEdgeSplitHandles(workspace);
  const row = createPanelRow("row", "1 1 auto");
  workspace.appendChild(row);
  const cell = makePanelCell("1 1 auto");
  setCellIdentity(cell, { id: normalizedPanelType, panelClass, flex: "1 1 auto" });
  row.appendChild(cell);
  window.activeCell = cell;
  window.activePanel = normalizedPanelType;
  window.activePanelClass = panelClass;
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.activePanelType = panelClass;
  await loadPanelIntoCell(normalizedPanelType, { id: normalizedPanelType, displayName, ...remainingPanelVars });
  rebuildLayoutDividersForContainer(row, false);
  highlightActiveCell(cell);
  return cell;
}

if (typeof window !== "undefined") window.__nvOpenPanelTab = (cell, panelType, panelClass = "InfoPanel", panelVars = {}) => {
  const targetCell = resolvePanelCell(cell) || cell;
  if (!targetCell?.classList?.contains?.("panel-cell")) return null;
  const previousActiveCell = window.activeCell;
  window.activeCell = targetCell;
  return Promise.resolve(loadPanelIntoCell(panelType, { ...panelVars, panelClass })).finally(() => {
    if (!window.activeCell || window.activeCell === targetCell) window.activeCell = targetCell;
    else window.activeCell = previousActiveCell || targetCell;
  });
};

export { findPanelTabMatch };
