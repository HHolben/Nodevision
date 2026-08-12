// Nodevision/ApplicationSystem/public/Commands/handlers/ViewerCommands.mjs
// This module adapts viewer commands to Nodevision's existing FileView routing and state.

import { emitNodevisionEvent } from "../NodevisionEventRegistry.mjs";

function currentViewerPath() {
  return window.NodevisionState?.activeFileViewPath || window.currentActiveFilePath || window.selectedFilePath || "";
}

function dispatchViewerOpen(path) {
  window.selectedFilePath = path;
  window.dispatchEvent(new CustomEvent("toolbarAction", { detail: { id: "FileView", type: "ViewPanel", replaceActive: false } }));
}

export async function openViewerCommand([path]) {
  dispatchViewerOpen(path);
  let rendered = null;
  if (typeof window.updateViewPanel === "function") rendered = await window.updateViewPanel(path, { force: true });
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
