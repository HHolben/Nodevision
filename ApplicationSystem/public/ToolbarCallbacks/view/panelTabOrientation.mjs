// Nodevision/ApplicationSystem/public/ToolbarCallbacks/view/panelTabOrientation.mjs
// This module applies panel tab-bar orientation changes to the active workspace panel cell.

import { setPanelTabOrientation } from "/panels/panelTabs.mjs";

function activePanelCell() {
  const candidate = window.activeCell?.closest?.(".panel-cell") || window.activeCell;
  if (candidate?.classList?.contains("panel-cell")) return candidate;
  return document.querySelector(".panel-cell.active-panel");
}

export function setActivePanelTabOrientation(orientation) {
  const cell = activePanelCell();
  if (!cell) {
    console.warn("No active panel cell available for tab orientation.");
    return null;
  }
  return setPanelTabOrientation(cell, orientation);
}

