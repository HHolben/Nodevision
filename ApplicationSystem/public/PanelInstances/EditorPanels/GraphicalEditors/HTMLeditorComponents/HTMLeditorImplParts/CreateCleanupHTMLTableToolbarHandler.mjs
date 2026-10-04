// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/CreateCleanupHTMLTableToolbarHandler.mjs
// This module implements create Cleanup HTMLTable Toolbar Handler behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { handleTableArrowKeyNavigation, clearTableCellSelection } from "/ToolbarCallbacks/insert/tableTools.mjs";
import { updateToolbarState } from "../../../../../panels/createToolbar.mjs";
import { createPanelDOM } from "../../../../../panels/panelFactory.mjs";

// Create Cleanup HTMLTable Toolbar Handler operations.
export function createCleanupHTMLTableToolbarHandler(owner) {
  return () => {
    owner.htmlSession.wysiwyg.removeEventListener("pointerdown", owner.htmlSession.updateTableSelectionFromEvent);
    owner.htmlSession.wysiwyg.removeEventListener("click", owner.htmlSession.updateTableSelectionFromEvent);
    owner.htmlSession.wysiwyg.removeEventListener("keyup", owner.htmlSession.updateTableSelectionFromSelection);
    owner.htmlSession.wysiwyg.removeEventListener("focusin", owner.htmlSession.updateTableSelectionFromSelection);
    owner.htmlSession.wysiwyg.removeEventListener("keydown", handleTableArrowKeyNavigation);
    document.removeEventListener("selectionchange", owner.htmlSession.updateTableSelectionFromSelection);
    document.removeEventListener("copy", owner.htmlSession.handleHtmlTableCopy);
    const ownsTableContext = window.__nvTableEditorRoot === owner.htmlSession.wysiwyg;
    if (ownsTableContext) clearTableCellSelection({
      keepActive: false
    });
    if (window.__nvTableEditorRoot === owner.htmlSession.wysiwyg) window.__nvTableEditorRoot = null;
    if (window.__nvHtmlTableActiveCell && owner.htmlSession.wysiwyg.contains(window.__nvHtmlTableActiveCell)) {
      window.__nvHtmlTableActiveCell = null;
      window.__nvHtmlTableActiveTable = null;
    }
    if (owner.htmlSession.pendingTableToolbarFrame) {
      cancelAnimationFrame(owner.htmlSession.pendingTableToolbarFrame);
      owner.htmlSession.pendingTableToolbarFrame = 0;
    }
    owner.htmlSession.lastPublishedTableToolbarState = false;
    owner.htmlSession.pendingTableToolbarState = false;
    if (ownsTableContext) updateToolbarState({
      htmlTableSelected: false
    });
  };
}

export function createHtmlNativeInputHandler(owner) {
  return async () => {
    const context = window.NodevisionState?.activeHtmlCircuitContext;
    if (!context?.element) {
      alert("Select a circuit first.");
      return;
    }
    if (!context.valid || !context.linkedNotebookPath) {
      alert("Only referenced Notebook .cir files can be edited. Insert a referenced circuit and select it.");
      return;
    }
    const notebookPath = context.linkedNotebookPath;
    const safeId = btoa(notebookPath).replace(/[^a-z0-9]/gi, "-");
    const instanceId = `nv-circuit-editor-${safeId}`;
    const existing = document.querySelector(`.panel[data-instance-id="${instanceId}"]`);
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    const panelInst = await createPanelDOM("GraphicalEditor", instanceId, "EditorPanel", {
      filePath: notebookPath,
      displayName: `Edit Circuit: ${notebookPath}`
    });
    document.body.appendChild(panelInst.panel);
    panelInst.panel.classList.remove("docked");
    panelInst.panel.classList.add("undocked");
    panelInst.panel.__nvDefaultDockCell = window.activeCell && window.activeCell.classList?.contains("panel-cell") ? window.activeCell : null;
    if (panelInst.dockBtn && typeof panelInst.dockBtn.click === "function") {
      try {
        panelInst.dockBtn.dispatchEvent(new MouseEvent("click", {
          bubbles: false,
          cancelable: true,
          view: window
        }));
      } catch {
        panelInst.dockBtn.click();
      }
    }
    panelInst.panel.style.width = "min(860px, 96vw)";
    panelInst.panel.style.height = "min(640px, 92vh)";
    panelInst.panel.style.left = `${Math.max(20, Math.round(window.innerWidth * 0.16))}px`;
    panelInst.panel.style.top = `${Math.max(20, Math.round(window.innerHeight * 0.1))}px`;
    panelInst.panel.style.zIndex = "23020";
    panelInst.panel.style.pointerEvents = "auto";
  };
}

export function createHtmlSaveSerialization(owner) {
  return async () => {
    const context = window.NodevisionState?.activeHtmlAudioContext;
    if (!context?.element) {
      alert("Select a recording first.");
      return;
    }
    if (context.isInline || !context.linkedNotebookPath) {
      alert("Only linked Notebook recordings can be edited. Insert as a referenced sound and select it.");
      return;
    }
    const notebookPath = context.linkedNotebookPath;
    const safeId = btoa(notebookPath).replace(/[^a-z0-9]/gi, "-");
    const instanceId = `nv-sound-editor-${safeId}`;
    const existing = document.querySelector(`.panel[data-instance-id="${instanceId}"]`);
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    const panelInst = await createPanelDOM("GraphicalEditor", instanceId, "EditorPanel", {
      filePath: notebookPath,
      displayName: `Edit Recording: ${notebookPath}`
    });
    document.body.appendChild(panelInst.panel);
    panelInst.panel.classList.remove("docked");
    panelInst.panel.classList.add("undocked");
    panelInst.panel.__nvDefaultDockCell = window.activeCell && window.activeCell.classList?.contains("panel-cell") ? window.activeCell : null;
    if (panelInst.dockBtn && typeof panelInst.dockBtn.click === "function") {
      try {
        panelInst.dockBtn.dispatchEvent(new MouseEvent("click", {
          bubbles: false,
          cancelable: true,
          view: window
        }));
      } catch {
        panelInst.dockBtn.click();
      }
    }
    panelInst.panel.style.width = "min(760px, 94vw)";
    panelInst.panel.style.height = "min(560px, 90vh)";
    panelInst.panel.style.left = `${Math.max(20, Math.round(window.innerWidth * 0.18))}px`;
    panelInst.panel.style.top = `${Math.max(20, Math.round(window.innerHeight * 0.12))}px`;
    panelInst.panel.style.zIndex = "23010";
    panelInst.panel.style.pointerEvents = "auto";
  };
}
