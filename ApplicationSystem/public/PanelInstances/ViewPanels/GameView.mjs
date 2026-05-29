// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameView.mjs
// This file defines browser-side Game View logic for the Nodevision UI. It hosts either the legacy GameView engine or the reusable MetaWorld runtime.

import * as THREE from "/lib/three/three.module.js";
import { PointerLockControls } from "/lib/three/PointerLockControls.js";
import { defaultBindings, normalizeKeyName, loadControlScheme } from "./GameViewDependencies/controlBindings.mjs";
import { detectWorldKind, disposeMetaWorldRuntime, loadWorldFromFile } from "./GameViewDependencies/worldLoading.mjs";
import { initScene } from "./GameViewDependencies/initScene.mjs";
import { ensureSvgEditingSplit, loadPanelIntoCell } from "/panels/workspace.mjs";
import { clearActiveMetaWorldLayerBridge } from "/MetaWorld/MetaWorldLayerState.mjs";

const META_WORLD_LAYERS_PANEL_ID = "MetaWorldLayersPanel";

async function ensureMetaWorldLayersPanelVisible(panel) {
  const editorCell = panel?.closest?.(".panel-cell");
  if (!editorCell) return;
  const { layersCell } = ensureSvgEditingSplit({
    editorCell,
    layersPanelId: META_WORLD_LAYERS_PANEL_ID,
    layersPanelClass: "InfoPanel",
    editorFlex: "0 0 74%",
    layersFlex: "0 0 26%",
  }) || {};
  if (!layersCell) return;

  window.activeCell = layersCell;
  layersCell.dataset.id = META_WORLD_LAYERS_PANEL_ID;
  layersCell.dataset.panelClass = "InfoPanel";
  await loadPanelIntoCell(META_WORLD_LAYERS_PANEL_ID, {
    id: META_WORLD_LAYERS_PANEL_ID,
    displayName: "MetaWorld Layers",
  });

  window.activeCell = editorCell;
  window.highlightActiveCell?.(editorCell);
}

function cleanupLegacyGameView(panel, state = {}) {
  if (typeof panel._vrDisposeInputHandlers === "function") {
    panel._vrDisposeInputHandlers();
    panel._vrDisposeInputHandlers = null;
  }
  if (typeof panel._vrStopRenderLoop === "function") {
    panel._vrStopRenderLoop();
    panel._vrStopRenderLoop = null;
    console.log("Legacy render loop stopped");
  }
  if (panel._vrResizeObserver) {
    panel._vrResizeObserver.disconnect();
    panel._vrResizeObserver = null;
  }
  if (panel._vrControls?.unlock) panel._vrControls.unlock();
  if (panel._vrControls?.disconnect) panel._vrControls.disconnect();
  if (panel._vrControls?.dispose) panel._vrControls.dispose();
  panel._vrControls = null;
  if (panel._vrCanvas && panel._vrCanvasClickHandler) {
    panel._vrCanvas.removeEventListener("click", panel._vrCanvasClickHandler);
    panel._vrCanvasClickHandler = null;
  }
  if (panel._vrCanvas && panel._vrCanvasContextMenuHandler) {
    panel._vrCanvas.removeEventListener("contextmenu", panel._vrCanvasContextMenuHandler);
    panel._vrCanvasContextMenuHandler = null;
  }
  panel._vrCanvas = null;
  if (panel._vrRenderer?.setAnimationLoop) panel._vrRenderer.setAnimationLoop(null);
  if (panel._vrRenderer?.forceContextLoss) panel._vrRenderer.forceContextLoss();
  if (panel._vrRenderer?.domElement?.parentNode) {
    panel._vrRenderer.domElement.parentNode.removeChild(panel._vrRenderer.domElement);
  }
  if (panel._vrRenderer?.dispose) panel._vrRenderer.dispose();
  panel._vrRenderer = null;
  if (panel._vrViewController?.followCamera?.parent) {
    panel._vrViewController.followCamera.parent.remove(panel._vrViewController.followCamera);
  }
  if (panel._vrViewController?.dispose) panel._vrViewController.dispose();
  panel._vrViewController = null;
  if (panel._vrInventory?.dispose) panel._vrInventory.dispose();
  panel._vrInventory = null;
  if (panel._vrObjectInspector?.dispose) panel._vrObjectInspector.dispose();
  panel._vrObjectInspector = null;
  if (panel._vrWorldPropertiesPanel?.dispose) panel._vrWorldPropertiesPanel.dispose();
  panel._vrWorldPropertiesPanel = null;
  if (panel._vrFunctionPlotterPanel?.dispose) panel._vrFunctionPlotterPanel.dispose();
  panel._vrFunctionPlotterPanel = null;
  if (panel._vrTerrainToolController?.dispose) panel._vrTerrainToolController.dispose();
  panel._vrTerrainToolController = null;
  if (panel._vrEquationObjectsPanel?.dispose) panel._vrEquationObjectsPanel.dispose();
  panel._vrEquationObjectsPanel = null;
  if (panel._vrEquationColliderController?.dispose) panel._vrEquationColliderController.dispose();
  panel._vrEquationColliderController = null;
  if (panel._vrConsolePanels?.dispose) panel._vrConsolePanels.dispose();
  panel._vrConsolePanels = null;
  if (panel._vrSaveVirtualWorldFile && window.saveVirtualWorldFile === panel._vrSaveVirtualWorldFile) {
    window.saveVirtualWorldFile = null;
  }
  panel._vrSaveVirtualWorldFile = null;
  if (window.VRWorldContext?.panel === panel) {
    window.VRWorldContext = null;
  }
  clearActiveMetaWorldLayerBridge();
  state.legacyInitialized = false;
}

function cleanupMetaWorld(panel, state = {}) {
  const runtime = state.metaWorldRuntime || panel._metaWorldRuntime || null;
  if (runtime) disposeMetaWorldRuntime(runtime);
  state.metaWorldRuntime = null;
  panel._metaWorldRuntime = null;
  panel.classList.remove("gameview-metaworld-active");
}

function createLegacyCanvas(panel) {
  const canvas = document.createElement("canvas");
  canvas.id = "three-canvas";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  panel.appendChild(canvas);
  return canvas;
}

export async function setupPanel(panel, instanceVars = {}) {
  console.log("GameView.mjs loaded");

  if (typeof window.__nodevisionGameViewCleanup === "function") {
    try {
      window.__nodevisionGameViewCleanup();
    } catch (err) {
      console.warn("Previous GameView global cleanup failed:", err);
    }
  }

  if (typeof panel.cleanup === "function") {
    try {
      panel.cleanup();
    } catch (err) {
      console.warn("GameView cleanup failed before setup:", err);
    }
  }

  panel.innerHTML = "";
  panel.style.position = "relative";
  panel.style.overflow = "hidden";

  const state = {
    pendingWorldPath: null,
    controlBindings: null,
    currentWorldPath: null,
    currentWorldDefinition: null,
    legacyInitialized: false,
    metaWorldRuntime: null,
    mode: null,
    loadToken: 0,
  };

  const getBindings = () => state.controlBindings || defaultBindings;

  const ensureLegacyEngine = async () => {
    if (state.legacyInitialized && window.VRWorldContext?.panel === panel) return;
    cleanupMetaWorld(panel, state);
    cleanupLegacyGameView(panel, state);
    panel.innerHTML = "";
    const canvas = createLegacyCanvas(panel);
    initScene({
      THREE,
      PointerLockControls,
      panel,
      canvas,
      state,
      loadWorldFromFile,
      getBindings,
      normalizeKeyName,
    });
    state.legacyInitialized = true;
    void loadControlScheme(state);
  };

  const loadSelectedWorld = async (filePath) => {
    if (!filePath) {
      console.warn("GameView: no file selected. Select a world HTML under /Notebook.");
      return;
    }
    const token = ++state.loadToken;
    state.currentWorldPath = filePath;
    const detected = await detectWorldKind(filePath);
    if (token !== state.loadToken) return;

    if (detected.kind === "metaworld") {
      console.log("GameView mode: MetaWorld via legacy 3D world loader");
      await ensureLegacyEngine();
      if (token !== state.loadToken) return;
      state.mode = "metaworld";
      await loadWorldFromFile(filePath, state, THREE);
      return;
    }

    if (detected.kind === "unknown") {
      console.warn("GameView: world kind detection failed; falling back to legacy world loading.", detected.reason || detected.error || "unknown error");
    }
    console.log("GameView mode: Legacy World");
    await ensureLegacyEngine();
    if (token !== state.loadToken) return;
    state.mode = "legacy";
    await loadWorldFromFile(filePath, state, THREE);
  };

  const showLayersIfEditing = async () => {
    if (window.NodevisionState?.currentMode !== "Virtual World Editing") return;
    await ensureMetaWorldLayersPanelVisible(panel);
  };

  const listener = (e) => {
    const filePath = e.detail.filePath;
    void loadSelectedWorld(filePath).then(() => showLayersIfEditing());
  };

  const editingModeListener = () => {
    void showLayersIfEditing();
  };

  document.addEventListener("fileSelected", listener);
  window.addEventListener("nodevision:metaworld-editing-enabled", editingModeListener);

  panel.cleanup = () => {
    document.removeEventListener("fileSelected", listener);
    window.removeEventListener("nodevision:metaworld-editing-enabled", editingModeListener);
    state.loadToken += 1;
    cleanupMetaWorld(panel, state);
    cleanupLegacyGameView(panel, state);
    if (window.__nodevisionGameViewCleanup === panel.cleanup) {
      window.__nodevisionGameViewCleanup = null;
    }
  };

  window.__nodevisionGameViewCleanup = panel.cleanup;

  const initialPath = instanceVars.filePath || window.selectedFilePath;
  void loadSelectedWorld(initialPath).then(() => showLayersIfEditing());
}
