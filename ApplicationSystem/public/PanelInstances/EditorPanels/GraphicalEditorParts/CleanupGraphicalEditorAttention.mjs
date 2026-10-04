// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditorParts/CleanupGraphicalEditorAttention.mjs
// This module implements cleanup Graphical Editor Attention behavior for the GraphicalEditor feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { GraphicalEditorModuleState } from "./LoadModuleMap.mjs";
import { clearEditorContext } from "../../../EditorAttentionState.mjs";
import { getGraphicalEditorHost, activateGraphicalEditorHost } from "./GetGraphicalEditorHost.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";
import { updateGraphicalEditor } from "./UpdateGraphicalEditor.mjs";
import { refreshPanelTabMetadata } from "/panels/panelTabMetadata.mjs";
import { renderPanelTabs } from "/panels/panelTabs.mjs";

// Cleanup Graphical Editor Attention operations.
export function cleanupGraphicalEditorAttention(filePath) {
  try {
    GraphicalEditorModuleState.currentGraphicalEditorCleanup?.();
  } catch (error) {
    console.warn("Graphical editor cleanup failed", error);
  }
  GraphicalEditorModuleState.currentGraphicalEditorCleanup = null;
  clearEditorContext(filePath || window.currentActiveFilePath || window.filePath || null);
}

export function createNvGetGraphicalEditorFileSwitchTargetHandler(owner) {
  return () => {
    const host = getGraphicalEditorHost();
    const filePath = host?.dataset.nvGraphicalEditorPath;
    if (!filePath || window.NodevisionState?.activeEditorFilePath !== filePath) return null;
    const isCurrent = () => host.isConnected && host.dataset.nvGraphicalEditorPath === filePath && (!window.__nvPanelTabContentIsActive || window.__nvPanelTabContentIsActive(host));
    return {
      filePath,
      isCurrent,
      activate() {
        if (!isCurrent()) throw new Error("The original editor is no longer available.");
        activateGraphicalEditorHost(host);
        updateToolbarState({
          currentMode: host.__nvGraphicalEditorMode || "GraphicalEditing"
        });
      },
      async switchTo(nextPath) {
        if (!isCurrent()) throw new Error("The original editor is no longer available.");
        await updateGraphicalEditor(nextPath, {
          force: true,
          host,
          selectFile: false
        });
        const cell = host.closest(".panel-cell");
        const content = host.closest(".nv-panel-tab-content");
        const tab = cell?.__nvPanelTabs?.tabs?.find(candidate => candidate.contentElement === content);
        if (tab) {
          tab.panelVars = {
            ...tab.panelVars,
            filePath: nextPath,
            isDirectory: false
          };
          refreshPanelTabMetadata(tab, cell);
          renderPanelTabs(cell);
        }
      }
    };
  };
}
