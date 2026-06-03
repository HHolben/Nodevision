// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/flashBoard.mjs
// Opens the Arduino Flash Panel through the shared Nodevision layout and panel loaders.

import {
  loadPanelIntoCell,
  rebuildLayoutDividersForContainer,
  renderLayout,
} from "/panels/workspace.mjs";

function normalizeNotebookPath(value) {
  let cleaned = String(value || "").trim();
  if (!cleaned) return "";
  try {
    const parsed = new URL(cleaned, window.location.origin);
    cleaned = parsed.pathname || cleaned;
  } catch {}
  cleaned = cleaned.replace(/\\/g, "/").replace(/[?#].*$/, "").replace(/^\/+/, "");
  if (cleaned.toLowerCase().startsWith("notebook/")) cleaned = cleaned.slice("Notebook/".length);
  return cleaned;
}

function resolveActiveInoPath() {
  const candidates = [
    window.currentActiveFilePath,
    window.NodevisionState?.activeEditorFilePath,
    window.selectedFilePath,
    window.NodevisionState?.selectedFile,
    window.ActiveNode,
    window.filePath,
  ];
  for (const candidate of candidates) {
    const path = normalizeNotebookPath(candidate);
    if (path && path.toLowerCase().endsWith(".ino")) return path;
  }
  return "";
}

function findFlashPanelCell() {
  return document.querySelector(
    ".panel-cell[data-id=\"FlashPanel\"], .panel-cell[data-panel-id=\"FlashPanel\"]"
  );
}

function isColumnLayoutContainer(container) {
  const direction = container?.dataset?.direction;
  if (direction) return direction === "column";
  const isVertical = container?.dataset?.isVertical;
  if (isVertical !== undefined) return isVertical === "1" || isVertical === "true";
  return true;
}

function ensureFlashPanelCell(workspace, filePath) {
  const existing = findFlashPanelCell();
  if (existing) return existing;

  renderLayout({
    type: "cell",
    id: "FlashPanel",
    panelType: "FlashPanel",
    panelClass: "ControlPanel",
    displayName: "Flash Board",
    flex: "0 0 38%",
    panelVars: { filePath },
    deferLoad: true,
  }, workspace);

  rebuildLayoutDividersForContainer(workspace, isColumnLayoutContainer(workspace));
  return findFlashPanelCell();
}

async function loadFlashPanel(cell, filePath) {
  const previousActiveCell = window.activeCell;
  window.activeCell = cell;
  try {
    await loadPanelIntoCell("FlashPanel", {
      id: "FlashPanel",
      displayName: "Flash Board",
      filePath,
    });
  } finally {
    window.activeCell = previousActiveCell;
  }
}

export default async function flashBoard() {
  const filePath = resolveActiveInoPath();
  if (!filePath) {
    alert("Open or select a .ino file before using Flash Board.");
    return;
  }

  const workspace = document.getElementById("workspace");
  if (!workspace) {
    alert("Workspace is not ready yet.");
    return;
  }

  const cell = ensureFlashPanelCell(workspace, filePath);
  if (!cell) {
    alert("Could not create the Flash Board panel.");
    return;
  }

  cell.style.display = "flex";
  cell.dataset.currentFilePath = filePath;
  window.activeCell = cell;
  window.activePanel = "FlashPanel";
  window.activePanelClass = "ControlPanel";
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.activePanelType = "ControlPanel";
  window.highlightActiveCell?.(cell);

  await loadFlashPanel(cell, filePath);
}
