// Nodevision/public/PanelInstances/ViewPanels/GameView.mjs
// ViewPanel that displays a JSON-defined 3D world embedded in an HTML file.

import * as THREE from '/lib/three/three.module.js';
import { PointerLockControls } from '/lib/three/PointerLockControls.js';
import { defaultBindings, normalizeKeyName, loadControlScheme } from "./GameViewDependencies/controlBindings.mjs";
import { loadWorldFromFile } from "./GameViewDependencies/worldLoading.mjs";
import { initScene } from "./GameViewDependencies/initScene.mjs";

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

  const canvas = document.createElement("canvas");
  canvas.id = "three-canvas";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  panel.appendChild(canvas);

  const state = {
    pendingWorldPath: null,
    controlBindings: null,
    currentWorldPath: null
  };

  const getBindings = () => state.controlBindings || defaultBindings;

  initScene({
    THREE,
    PointerLockControls,
    panel,
    canvas,
    state,
    loadWorldFromFile,
    getBindings,
    normalizeKeyName
  });

  loadControlScheme(state);

  const initialPath = instanceVars.filePath || window.selectedFilePath;
  if (initialPath) {
    state.currentWorldPath = initialPath;
    loadWorldFromFile(initialPath, state, THREE);
  } else {
    console.warn("GameView: no file selected. Select a world HTML under /Notebook.");
  }

  const listener = (e) => {
    const filePath = e.detail.filePath;
    loadWorldFromFile(filePath, state, THREE);
  };

  document.addEventListener("fileSelected", listener);

  panel.cleanup = () => {
    document.removeEventListener("fileSelected", listener);
    if (typeof panel._vrDisposeInputHandlers === "function") {
      panel._vrDisposeInputHandlers();
      panel._vrDisposeInputHandlers = null;
    }
    if (typeof panel._vrStopRenderLoop === "function") {
      panel._vrStopRenderLoop();
      panel._vrStopRenderLoop = null;
    }
    if (panel._vrResizeObserver) {
      panel._vrResizeObserver.disconnect();
      panel._vrResizeObserver = null;
    }
    if (panel._vrControls?.unlock) {
      panel._vrControls.unlock();
    }
    if (panel._vrControls?.disconnect) {
      panel._vrControls.disconnect();
    }
    if (panel._vrControls?.dispose) {
      panel._vrControls.dispose();
    }
    panel._vrControls = null;
    if (panel._vrCanvas && panel._vrCanvasClickHandler) {
      panel._vrCanvas.removeEventListener("click", panel._vrCanvasClickHandler);
      panel._vrCanvasClickHandler = null;
    }
    if (panel._vrCanvas && panel._vrCanvasContextMenuHandler) {
      panel._vrCanvas.removeEventListener("contextmenu", panel._vrCanvasContextMenuHandler);
      panel._vrCanvasContextMenuHandler = null;
    }
    if (panel._vrCanvas) {
      panel._vrCanvas = null;
    }
    if (panel._vrRenderer?.setAnimationLoop) {
      panel._vrRenderer.setAnimationLoop(null);
    }
    if (panel._vrRenderer?.forceContextLoss) {
      panel._vrRenderer.forceContextLoss();
    }
    if (panel._vrRenderer?.domElement?.parentNode) {
      panel._vrRenderer.domElement.parentNode.removeChild(panel._vrRenderer.domElement);
    }
    if (panel._vrRenderer?.dispose) {
      panel._vrRenderer.dispose();
    }
    panel._vrRenderer = null;
    if (panel._vrViewController?.followCamera?.parent) {
      panel._vrViewController.followCamera.parent.remove(panel._vrViewController.followCamera);
    }
    if (panel._vrViewController?.dispose) {
      panel._vrViewController.dispose();
      panel._vrViewController = null;
    }
    if (panel._vrInventory?.dispose) {
      panel._vrInventory.dispose();
      panel._vrInventory = null;
    }
    if (panel._vrObjectInspector?.dispose) {
      panel._vrObjectInspector.dispose();
      panel._vrObjectInspector = null;
    }
    if (panel._vrTerrainToolController?.dispose) {
      panel._vrTerrainToolController.dispose();
      panel._vrTerrainToolController = null;
    }
    if (panel._vrSaveVirtualWorldFile && window.saveVirtualWorldFile === panel._vrSaveVirtualWorldFile) {
      window.saveVirtualWorldFile = null;
    }
    panel._vrSaveVirtualWorldFile = null;
    if (window.__nodevisionGameViewCleanup === panel.cleanup) {
      window.__nodevisionGameViewCleanup = null;
    }
  };

  window.__nodevisionGameViewCleanup = panel.cleanup;
}
