// Nodevision/ApplicationSystem/public/panels/workspaceParts/workspaceActivePanels.mjs
// This module tracks the active Nodevision workspace panel and exposes highlight helpers used by layout and toolbar modules.

import { logStatus } from "../../StatusBar.mjs";
import { setStatus } from "../../StatusBar.mjs";
import { activatePanelTab, getActivePanelTab } from "../panelTabs.mjs";

export function highlightActiveCell(cell) {
  document.querySelectorAll(".panel-cell").forEach((candidate) => {
    candidate.classList.remove("active-panel");
    candidate.style.outline = "";
  });
  if (cell) cell.classList.add("active-panel");
}

export function activatePanelCell(cell, { announce = true } = {}) {
  if (!cell) return null;
  const activeTab = getActivePanelTab(cell);
  if (activeTab) {
    activatePanelTab(cell, activeTab.tabId, { announce });
    return cell;
  }
  window.activeCell = cell;
  const panelId = cell.dataset.id || cell.dataset.panelId || "Unknown";
  const panelClass = cell.dataset.panelClass || "InfoPanel";
  window.activePanel = panelId;
  window.activePanelClass = panelClass;
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.activePanelType = panelClass;
  if (announce) {
    logStatus("Active panel: " + panelId + " (" + panelClass + ")");
    setStatus("Active panel", panelId + " (" + panelClass + ")");
  }
  highlightActiveCell(cell);
  window.dispatchEvent(new CustomEvent("activePanelChanged", { detail: { panel: panelId, cell, panelClass } }));
  return cell;
}

export function clearActivePanelSelection({ announce = true } = {}) {
  window.activeCell = null;
  window.activePanel = "";
  window.activePanelClass = "";
  window.__nvActivePanelElement = null;
  window.__nvLastActiveZoomPanPanel = null;
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.activePanelType = "";
  highlightActiveCell(null);
  if (announce) {
    logStatus("No active panel");
    setStatus("Active panel", "None");
  }
  window.dispatchEvent(new CustomEvent("activePanelChanged", { detail: { panel: null, cell: null, panelClass: "" } }));
}

if (typeof window !== "undefined") window.highlightActiveCell = highlightActiveCell;
