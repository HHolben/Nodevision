// Nodevision/ApplicationSystem/public/Sessions/SandboxWorkspace.mjs
// This module mounts a temporary ordinary Game View tab and restores the prior workspace tab and any session-created Layers split on exit.

import { loadPanelIntoCell, rebuildLayoutDividersForContainer } from "../panels/workspace.mjs";
import { getActivePanelTab, activatePanelTab, closePanelTab, closePanelTabsInCell } from "../panels/panelTabs.mjs";
import { updateToolbarState } from "../panels/createToolbar.mjs";
export function createSandboxWorkspace(cell, mode) {
  if (!cell?.classList?.contains("panel-cell")) throw new Error("Select a workspace panel before starting Sandbox.");
  const previousTab = getActivePanelTab(cell), parent = cell.parentElement, style = cell.getAttribute("style");
  const previousState = { currentMode: window.NodevisionState?.currentMode || "Default",
    virtualWorldMode: window.NodevisionState?.virtualWorldMode || "survival" };
  let tab = null, disposed = false;
  const restore = () => {
    if (tab) closePanelTab(cell, tab.tabId, { force: true });
    const split = cell.parentElement;
    if (split !== parent && split?.dataset.nvSvgEditingSplit === "1" && split.parentElement === parent) {
      const neighbors = [...split.children].filter(node => node.classList.contains("panel-cell") && node !== cell);
      if (neighbors.length === 1 && neighbors[0].dataset.id === "MetaWorldLayersPanel") {
        closePanelTabsInCell(neighbors[0], { force: true });
        parent.replaceChild(cell, split);
        if (style === null) cell.removeAttribute("style"); else cell.setAttribute("style", style);
        rebuildLayoutDividersForContainer(parent);
      }
    }
    if (previousTab) activatePanelTab(cell, previousTab.tabId);
    Object.assign(window.NodevisionState, previousState); updateToolbarState(previousState);
    window.activeCell = cell;
  };
  return {
    async open(filePath, options) {
      const patch = { currentMode: mode === "build" ? "Virtual World Editing" : "Virtual World Viewing",
        virtualWorldMode: mode === "build" ? "creative" : "survival" };
      window.NodevisionState ||= {}; Object.assign(window.NodevisionState, patch); updateToolbarState(patch);
      window.activeCell = cell;
      tab = await loadPanelIntoCell("GameView", { filePath, panelClass: "ViewPanel", displayName: "Sandbox — " + (mode === "build" ? "Build" : "Play"),
        allowDuplicateTab: true, ...options });
      if (disposed) { restore(); return null; }
      if (!tab?.contentElement) throw new Error("Game View could not open in the selected panel.");
      await tab.contentElement.worldReady;
      if (disposed) { restore(); return null; }
      return tab.contentElement;
    },
    dispose() { if (disposed) return; disposed = true; restore(); }
  };
}
