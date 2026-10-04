// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditorParts/GetGraphicalEditorHost.mjs
// This module implements get Graphical Editor Host behavior for the GraphicalEditor feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { claimGraphicalEditorHost, activeGraphicalEditorHost, cleanupEditorHost, registerGraphicalEditorLiveProvider } from "./ReadGraphicalLiveContent.mjs";
import { GraphicalEditorModuleState } from "./LoadModuleMap.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";
import { updateGraphicalEditor } from "./UpdateGraphicalEditor.mjs";
import { cleanupGraphicalEditorAttention } from "./CleanupGraphicalEditorAttention.mjs";

// Get Graphical Editor Host operations.
export function getGraphicalEditorHost(host = null) {
  const explicit = host?.matches?.("[data-nv-graphical-editor-root=\"true\"], #graphical-editor") ? host : host?.querySelector?.("[data-nv-graphical-editor-root=\"true\"], #graphical-editor");
  if (explicit) return claimGraphicalEditorHost(explicit);
  const activeHost = activeGraphicalEditorHost();
  if (activeHost) return claimGraphicalEditorHost(activeHost);
  if (GraphicalEditorModuleState.graphicalEditorHostRef && document.body.contains(GraphicalEditorModuleState.graphicalEditorHostRef) && (!window.__nvPanelTabContentIsActive || window.__nvPanelTabContentIsActive(GraphicalEditorModuleState.graphicalEditorHostRef))) {
    return claimGraphicalEditorHost(GraphicalEditorModuleState.graphicalEditorHostRef);
  }
  const byId = document.getElementById("graphical-editor");
  if (byId && (!window.__nvPanelTabContentIsActive || window.__nvPanelTabContentIsActive(byId))) return claimGraphicalEditorHost(byId);
  return null;
}

export function activateGraphicalEditorHost(host) {
  const editorDiv = getGraphicalEditorHost(host);
  if (!editorDiv) return false;
  const filePath = editorDiv.dataset.nvGraphicalEditorPath || editorDiv.dataset.currentFilePath || editorDiv.closest(".nv-panel-tab-content")?.dataset?.currentFilePath || GraphicalEditorModuleState.lastEditedPath || "";
  const owningCell = editorDiv.closest?.(".panel-cell") || null;
  if (editorDiv.__nvHtmlEditorContext && editorDiv.__nvHtmlEditorContext === window.__nvActiveHtmlEditorContext && window.activeCell === owningCell && window.activePanel === 'GraphicalEditor') return true;
  if (owningCell) {
    window.activeCell = owningCell;
    window.activePanel = "GraphicalEditor";
    window.activePanelClass = "EditorPanel";
    owningCell.dataset.id = "GraphicalEditor";
    owningCell.dataset.panelId = "GraphicalEditor";
    owningCell.dataset.panelClass = "EditorPanel";
  }
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.activePanelType = "GraphicalEditor";
  window.NodevisionState.currentMode = "GraphicalEditing";
  window.NodevisionState.activeActionHandler = null;
  if (filePath) {
    if (owningCell) owningCell.dataset.currentFilePath = filePath;
    window.currentActiveFilePath = filePath;
    window.filePath = filePath;
    window.NodevisionState.selectedFile = filePath;
    window.NodevisionState.selectedFileIsDirectory = false;
    window.NodevisionState.activeEditorFilePath = filePath;
  }
  updateToolbarState({
    currentMode: "GraphicalEditing",
    selectedFile: filePath || null,
    activeEditorFilePath: filePath || null,
    activeActionHandler: null
  });
  const svgContext = editorDiv.__nvSvgEditorContext || owningCell?.__nvSvgEditorContext || null;
  if (svgContext?.kind === "svg" && typeof svgContext.activate === "function" && svgContext.activate()) {
    // SVG files need their precise toolbar mode; the generic GraphicalEditing mode hides SVG Draw/Insert items.
  } else {
    const htmlContext = editorDiv.__nvHtmlEditorContext || owningCell?.__nvHtmlEditorContext || null;
    if (htmlContext?.kind === "html" && typeof htmlContext.activate === "function") {
      htmlContext.activate();
    }
  }
  window.highlightActiveCell?.(owningCell);
  if (owningCell) {
    window.dispatchEvent(new CustomEvent("activePanelChanged", {
      detail: {
        panel: "GraphicalEditor",
        cell: owningCell,
        panelClass: "EditorPanel"
      }
    }));
  }
  return true;
}

export function enableGraphicalEditorActivation(editorDiv) {
  if (!editorDiv || editorDiv.dataset.nvGraphicalEditorActivationBound === "true") return;
  editorDiv.dataset.nvGraphicalEditorActivationBound = "true";
  const activate = () => {
    if (window.__nvPanelTabContentIsActive && !window.__nvPanelTabContentIsActive(editorDiv)) return;
    activateGraphicalEditorHost(editorDiv);
  };
  editorDiv.addEventListener("pointerdown", activate, {
    capture: true
  });
  editorDiv.addEventListener("mousedown", activate, {
    capture: true
  });
  editorDiv.addEventListener("click", activate, {
    capture: true
  });
  editorDiv.addEventListener("focusin", activate, {
    capture: true
  });
}

/* ---------------------------------------------------------
 * Panel setup
 * --------------------------------------------------------- */

export async function setupPanel(cell, instanceVars = {}) {
  const container = document.createElement("div");
  container.className = "nv-graphical-editor-host";
  container.dataset.nvGraphicalEditorRoot = "true";
  container.style.width = "100%";
  container.style.height = "100%";
  container.style.display = "flex";
  container.style.alignItems = "center";
  container.style.justifyContent = "center";
  cell.appendChild(container);
  claimGraphicalEditorHost(container);
  enableGraphicalEditorActivation(container);

  // Initial render
  const initialPath = instanceVars.filePath || window.selectedFilePath;
  await updateGraphicalEditor(initialPath, {
    force: true,
    host: container
  });
  activateGraphicalEditorHost(container);
  const destroy = () => {
    cleanupEditorHost(container);
    cleanupGraphicalEditorAttention(container.dataset.currentFilePath || GraphicalEditorModuleState.lastEditedPath || window.currentActiveFilePath || null);
  };
  return {
    activate: () => {
      activateGraphicalEditorHost(container);
      if (!container.__nvGraphicalLiveCleanup && container.dataset.currentFilePath) {
        registerGraphicalEditorLiveProvider(container.dataset.currentFilePath, container);
      }
    },
    deactivate: () => {
      // A retained HTML tab still owns an unsaved buffer that neighboring viewers may read.
      if (container.__nvHtmlEditorContext) return;
      const cleanup = container.__nvGraphicalLiveCleanup;
      if (typeof cleanup === "function") cleanup();
    },
    destroy
  };
}
