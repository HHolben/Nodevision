// Nodevision/ApplicationSystem/public/Commands/handlers/ViewerCommands.mjs
// This module adapts viewer commands to Nodevision's existing FileView routing and state.

import { emitNodevisionEvent } from "../NodevisionEventRegistry.mjs";

function currentViewerPath() {
  return window.NodevisionState?.activeFileViewPath || window.currentActiveFilePath || window.selectedFilePath || "";
}

function activePanelCell() {
  const candidate = window.activeCell?.closest?.(".panel-cell") || window.activeCell;
  return candidate?.classList?.contains("panel-cell") ? candidate : null;
}

async function dispatchViewerOpen(path) {
  window.selectedFilePath = path;
  const cell = activePanelCell();
  if (cell && typeof window.__nvOpenPanelTab === "function") {
    return window.__nvOpenPanelTab(cell, "FileView", "ViewPanel", { filePath: path });
  }
  window.dispatchEvent(new CustomEvent("toolbarAction", { detail: { id: "FileView", type: "ViewPanel", replaceActive: false, panelVars: { filePath: path } } }));
  return null;
}

export async function openViewerCommand([path]) {
  const opened = await dispatchViewerOpen(path);
  let rendered = Boolean(opened);
  if (!opened && typeof window.updateViewPanel === "function") rendered = await window.updateViewPanel(path, { force: true });
  const detail = { path, rendered: rendered !== false };
  emitNodevisionEvent("viewer.opened", detail);
  return { ok: true, ...detail };
}

export function currentViewerFileCommand() {
  const path = currentViewerPath();
  return { path, hasFile: Boolean(path) };
}

export async function closeViewerCommand() {
  const path = currentViewerPath();
  if (window.activePanel === "FileView") {
    const mod = await import("/ToolbarCallbacks/view/closePanel.mjs");
    mod.closeActivePanel?.();
  }
  emitNodevisionEvent("viewer.closed", { path });
  return { ok: true, path };
}
