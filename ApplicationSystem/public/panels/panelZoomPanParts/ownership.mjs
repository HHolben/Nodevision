// Nodevision/ApplicationSystem/public/panels/panelZoomPanParts/ownership.mjs
// This module resolves panel ownership and remembers workspace activation for panel viewport commands.

import { LAST_PANEL_KEY, ACTIVE_PANEL_MEMORY_KEY, LOCAL_ZOOM_SCOPE_SELECTOR } from "./constants.mjs";

export function isTargetElement(el) {
  if (!el?.isConnected || !el.classList) return false;
  return el.classList.contains("panel") ||
    el.classList.contains("panel-cell") ||
    el.classList.contains("panel-content") ||
    el.classList.contains("nv-panel-tab-content");
}

export function getDirectChildByClass(parent, className) {
  if (!parent?.children?.length || !className) return null;
  return Array.from(parent.children).find((child) => child?.classList?.contains(className)) || null;
}

export function panelFromCell(cell) {
  if (!cell?.isConnected || !cell.classList?.contains("panel-cell")) return null;
  const tabState = cell.__nvPanelTabs || null;
  const activeTab = tabState?.tabs?.find?.((tab) => tab.tabId === tabState.activeTabId) || null;
  if (activeTab?.contentElement?.isConnected) return activeTab.contentElement;
  return getDirectChildByClass(cell, "panel") || cell;
}

export function findPanelByIdentity(identity = "") {
  const value = String(identity || "").trim();
  if (!value || typeof document === "undefined") return null;
  const panel = Array.from(document.querySelectorAll(".panel")).find((candidate) =>
    candidate?.dataset?.instanceName === value ||
    candidate?.dataset?.instanceId === value ||
    candidate?.dataset?.panelClass === value
  );
  if (isTargetElement(panel)) return panel;

  const cell = Array.from(document.querySelectorAll(".panel-cell")).find((candidate) =>
    candidate?.dataset?.id === value ||
    candidate?.dataset?.panelId === value ||
    candidate?.dataset?.panelClass === value
  );
  return panelFromCell(cell);
}

export function queryPanelFromActiveCell() {
  const activeRef = window.activeCell;
  if (activeRef?.isConnected) {
    if (activeRef.classList?.contains("panel-cell")) return panelFromCell(activeRef);
    if (isTargetElement(activeRef) && !activeRef.classList?.contains("panel-cell")) {
      return activeRef;
    }
    const nearestPanel = activeRef.closest?.(".panel");
    if (nearestPanel?.isConnected) {
      return nearestPanel;
    }
    const activeCell = activeRef.classList?.contains("panel-cell")
      ? activeRef
      : activeRef.closest?.(".panel-cell");
    if (activeCell?.isConnected) {
      return panelFromCell(activeCell);
    }
  }

  const highlightedCell = document.querySelector(".panel-cell.active-panel");
  if (highlightedCell?.isConnected) {
    return panelFromCell(highlightedCell);
  }
  return null;
}

export function rememberPanel(panel) {
  if (!isTargetElement(panel)) return;
  window[LAST_PANEL_KEY] = panel;
}

export function rememberPanelFromActiveEvent(event) {
  const detail = event?.detail || {};
  if (!detail.panel && !detail.cell) {
    window[LAST_PANEL_KEY] = null;
    window.__nvActivePanelElement = null;
    return;
  }
  const panel = panelFromCell(detail.cell) ||
    findPanelByIdentity(detail.panel) ||
    findPanelByIdentity(window.activePanel);
  if (panel) rememberPanel(panel);
}

export function bindPanelActivationMemory() {
  if (typeof window === "undefined" || window[ACTIVE_PANEL_MEMORY_KEY]) return;
  window.addEventListener("activePanelChanged", rememberPanelFromActiveEvent);
  window[ACTIVE_PANEL_MEMORY_KEY] = true;
}

export function getActivePanelElement() {
  bindPanelActivationMemory();
  const fromCell = queryPanelFromActiveCell();
  if (fromCell) {
    rememberPanel(fromCell);
    return fromCell;
  }
  const explicit = window.__nvActivePanelElement;
  if (isTargetElement(explicit)) {
    rememberPanel(explicit);
    return explicit;
  }
  const activePanelName = window.activePanel;
  if (typeof activePanelName === "string" && activePanelName.trim()) {
    const fallback = Array.from(document.querySelectorAll(".panel"))
      .find((panel) => panel?.dataset?.instanceName === activePanelName);
    if (fallback?.isConnected) {
      rememberPanel(fallback);
      return fallback;
    }
    const fallbackCell = Array.from(document.querySelectorAll(".panel-cell"))
      .find((cell) => cell?.dataset?.id === activePanelName);
    if (fallbackCell?.isConnected) {
      rememberPanel(fallbackCell);
      return fallbackCell;
    }
  }
  return null;
}

export function getPanelElementFromElement(element) {
  const start = element?.nodeType === 1 ? element : null;
  if (!start) return null;

  const panel = start.closest?.(".panel, .nv-panel-tab-content");
  if (isTargetElement(panel)) return panel;

  const cell = start.closest?.(".panel-cell");
  if (!isTargetElement(cell)) return null;

  return panelFromCell(cell);
}

export function getPanelElementFromEvent(event) {
  return getPanelElementFromElement(event?.target);
}

export function eventUsesLocalZoomScope(event) {
  const target = event?.target?.nodeType === 1 ? event.target : null;
  return Boolean(target?.closest?.(LOCAL_ZOOM_SCOPE_SELECTOR));
}
