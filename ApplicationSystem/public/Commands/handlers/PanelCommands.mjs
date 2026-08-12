// Nodevision/ApplicationSystem/public/Commands/handlers/PanelCommands.mjs
// This module adapts panel commands to Nodevision's existing toolbar action and close-panel paths.

import { emitNodevisionEvent } from "../NodevisionEventRegistry.mjs";

function nextFrame() {
  return new Promise((resolve) => (globalThis.requestAnimationFrame || globalThis.setTimeout)(resolve, 0));
}

function dispatchToolbarAction(id, type = "InfoPanel", replaceActive = false) {
  window.dispatchEvent(new CustomEvent("toolbarAction", { detail: { id, type, replaceActive } }));
}

function panelDetail(panelId, panelClass = "InfoPanel") {
  return { panelId, panelClass, activePanel: window.activePanel || "", activePanelClass: window.activePanelClass || "" };
}

export async function openPanelCommand([panelId, panelClass = "InfoPanel"]) {
  dispatchToolbarAction(panelId, panelClass, false);
  await nextFrame();
  const detail = panelDetail(panelId, panelClass);
  emitNodevisionEvent("panel.opened", detail);
  return { ok: true, ...detail };
}

export async function closePanelCommand() {
  const closedPanel = window.activePanel || "";
  const closedPanelClass = window.activePanelClass || "";
  const mod = await import("/ToolbarCallbacks/view/closePanel.mjs");
  mod.closeActivePanel?.();
  emitNodevisionEvent("panel.closed", { panelId: closedPanel, panelClass: closedPanelClass });
  return { ok: true, panelId: closedPanel, panelClass: closedPanelClass };
}

function escapeCssIdentifier(value) {
  return globalThis.CSS?.escape ? CSS.escape(value) : String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

export function focusPanelCommand([panelId]) {
  const cell = document.querySelector(`[data-id="${escapeCssIdentifier(panelId)}"]`);
  if (!cell) return { ok: false, panelId, reason: "not-found" };
  cell.style.display = "flex";
  window.activeCell = cell;
  window.activePanel = panelId;
  window.activePanelClass = cell.dataset.panelClass || "InfoPanel";
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.activePanelType = window.activePanelClass;
  emitNodevisionEvent("panel.focused", panelDetail(panelId, window.activePanelClass));
  window.dispatchEvent(new CustomEvent("activePanelChanged", { detail: { panel: panelId, cell, panelClass: window.activePanelClass } }));
  return { ok: true, ...panelDetail(panelId, window.activePanelClass) };
}
