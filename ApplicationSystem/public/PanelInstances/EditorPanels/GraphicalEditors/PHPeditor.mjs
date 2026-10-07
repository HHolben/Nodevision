// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/PHPeditor.mjs
// This module exposes the PHP editor entry points and coordinates initial state, toolbar integration and disposal.
import { updateToolbarState } from '/panels/createToolbar.mjs';
import { createEditorState, ensureDefaultBlocks, ensureDefaultWidgets } from './PhpEditorState.mjs';
import { fetchTextFile, bindSaveHooks, cleanupSaveHooks } from './PhpEditorFiles.mjs';
import { createDeviceNode } from './PhpEditorDevices.mjs';
import { setupEditorUI } from './PhpEditorUI.mjs';

export function setupEditorGlobals(state) {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.currentMode = "PHPediting";
  window.NodevisionState.activePanelType = "GraphicalEditor";
  window.NodevisionState.selectedFile = state.filePath;
  window.NodevisionState.activeEditorFilePath = state.filePath;
  updateToolbarState({
    currentMode: "PHPediting",
    activePanelType: "GraphicalEditor",
    selectedFile: state.filePath
  });

  bindSaveHooks(state);
}

export async function renderInternal(filePath, container, options = {}) {
  if (!container) throw new Error("Container required");
  const state = createEditorState(filePath, options.serverBase || "");
  state.code = await fetchTextFile(filePath);
  setupEditorGlobals(state);
  ensureDefaultBlocks(state);
  ensureDefaultWidgets(state);
  createDeviceNode(state, "gamepad", "gamepad-api", "controller-1").values = {
    axes: [0, 0, 0, 0], buttons: [false, false, false, false], triggerL: 0, triggerR: 0
  };
  const instance = setupEditorUI(state, container, options);

  return {
    state,
    dispose() {
      instance?.dispose?.();
      cleanupSaveHooks();
    }
  };
}

export async function renderEditor(filePath, container) {
  return renderInternal(filePath, container, {});
}

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  const host = viewPanel || iframe?.parentElement;
  if (!host) throw new Error("viewPanel required");
  return renderInternal(filename, host, { serverBase: serverBase || "" });
}
