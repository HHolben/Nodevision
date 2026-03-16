// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/FileManagerDependencies.mjs/FileManagerController.mjs
// This file defines browser-side File Manager Controller logic for the Nodevision UI. It renders interface components and handles user interactions.
import { fetchDirectoryContents } from "./FileManagerAPI.mjs";
import { renderFiles } from "./FileManagerRenderer.mjs";
import { renderBreadcrumbs } from "./FileManagerBreadcrumbs.mjs";

export function createFileManager(panelElem, initialPath = "") {
  const state = {
    panelElem,
    currentPath: initialPath,
    selectedPath: null,
  };

  async function refresh(path = state.currentPath) {
    state.currentPath = path;

    const loading = panelElem.querySelector("#loading");
    const error = panelElem.querySelector("#error");

    try {
      loading.style.display = "block";
      const files = await fetchDirectoryContents(path);
      renderFiles(state, files);
      renderBreadcrumbs(state);
    } catch (err) {
      error.textContent = err.message;
    } finally {
      loading.style.display = "none";
    }
  }

  refresh(initialPath);

  return { refresh, state };
}
