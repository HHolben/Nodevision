// Nodevision/public/PanelInstances/ViewPanels/GameView.mjs
// ViewPanel that displays a JSON-defined 3D world embedded in an HTML file.

import * as THREE from '/lib/three/three.module.js';
import { PointerLockControls } from '/lib/three/PointerLockControls.js';
import { defaultBindings, normalizeKeyName, loadControlScheme } from "./GameViewDependencies/controlBindings.mjs";
import { loadWorldFromFile } from "./GameViewDependencies/worldLoading.mjs";
import { initScene } from "./GameViewDependencies/initScene.mjs";

export async function setupPanel(panel, instanceVars = {}) {
  console.log("GameView.mjs loaded");

  panel.innerHTML = "";
  panel.style.position = "relative";

  const canvas = document.createElement("canvas");
  canvas.id = "three-canvas";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  panel.appendChild(canvas);

  const state = {
    pendingWorldPath: null,
    controlBindings: null
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
    if (panel._vrResizeObserver) {
      panel._vrResizeObserver.disconnect();
      panel._vrResizeObserver = null;
    }
  };
}
