// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/FileManagerDependencies.mjs/FileManagerController.mjs
// This file defines browser-side File Manager Controller logic for the Nodevision UI. It renders interface components and handles user interactions.
import { fetchDirectoryContents } from "./FileManagerAPI.mjs";
import { renderFiles } from "./FileManagerRenderer.mjs";
import { renderBreadcrumbs } from "./FileManagerBreadcrumbs.mjs";

function normalizePath(value = "") {
  return String(value || "").replace(/^\/+/, "").replace(/\\/g, "/").replace(/\/+/g, "/").trim();
}

export function createFileManager(panelElem, initialPath = "", options = {}) {
  const state = {
    panelElem,
    currentPath: normalizePath(initialPath),
    selectedPath: null,
    selectedIsDirectory: false,
    onSelectionChange: typeof options.onSelectionChange === "function" ? options.onSelectionChange : null,
    onDirectoryChange: typeof options.onDirectoryChange === "function" ? options.onDirectoryChange : null,
    onEntryActivate: typeof options.onEntryActivate === "function" ? options.onEntryActivate : null,
    enableDragDrop: options.enableDragDrop !== false,
  };

  async function refresh(path = state.currentPath) {
    state.currentPath = normalizePath(path);

    const loading = panelElem.querySelector("#loading");
    const error = panelElem.querySelector("#error");

    try {
      if (loading) loading.style.display = "block";
      if (error) error.textContent = "";
      const files = await fetchDirectoryContents(state.currentPath);
      renderFiles(state, files);
      renderBreadcrumbs(state);
      state.onDirectoryChange?.({ path: state.currentPath });
    } catch (err) {
      if (error) error.textContent = err.message || String(err);
    } finally {
      if (loading) loading.style.display = "none";
    }
  }

  state.refresh = refresh;
  refresh(state.currentPath);

  return { refresh, state };
}
