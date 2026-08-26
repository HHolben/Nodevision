// Nodevision/ApplicationSystem/public/PanelInstances/Common/ImageMap/ImageMapNotebookPicker.mjs
// This module provides a reusable File Manager based Notebook picker for image-map link targets.

import { createFileManager } from "/PanelInstances/InfoPanels/FileManagerDependencies.mjs/FileManagerController.mjs";
import { getNodevisionNavigationState } from "/NodevisionNavigationState.mjs";
import { ensureImageMapEditorStyles, imageMapButton } from "./ImageMapStyles.mjs";

const navigationState = getNodevisionNavigationState();

// ------------------------------
// Picker panel
// ------------------------------
function setDisabled(button, disabled) {
  button.disabled = Boolean(disabled);
}

function normalizePickerPath(value = "") {
  return String(value || "").replace(/^\/+/, "").replace(/\\/g, "/").replace(/\/+/g, "/");
}

export function mountImageMapNotebookPicker(root, options = {}) {
  ensureImageMapEditorStyles();
  root.innerHTML = `<div class="nv-image-map-picker">
    <div class="nv-image-map-manager"><div class="file-manager"><h3>File Manager</h3><div id="loading" style="display:none;">Loading...</div><div id="error"></div><ul id="file-list" class="file-list"></ul><div id="fm-path"></div></div></div>
    <div class="nv-image-map-picker-row" data-actions></div>
    <div class="nv-image-map-status" data-status>Select a Notebook target.</div>
  </div>`;
  const actions = root.querySelector("[data-actions]");
  const status = root.querySelector("[data-status]");
  const select = imageMapButton("Select", { disabled: true });
  const current = imageMapButton("Use Current Folder");
  const cancel = imageMapButton("Cancel");
  actions.append(select, current, cancel);

  let selectedPath = "";
  let selectedIsDirectory = false;
  let currentDirectory = normalizePickerPath(navigationState.getSearchRoot?.() || window.currentDirectoryPath || "");

  function finish(path, isDirectory) {
    const clean = normalizePickerPath(path);
    if (!clean) return;
    options.onDone?.({ path: clean, isDirectory: Boolean(isDirectory) });
  }

  function updateStatus() {
    setDisabled(select, !selectedPath);
    setDisabled(current, !currentDirectory);
    status.textContent = selectedPath
      ? `${selectedIsDirectory ? "Folder" : "File"} selected: ${selectedPath}`
      : "Select a Notebook target.";
  }

  createFileManager(root.querySelector(".file-manager"), currentDirectory, {
    enableDragDrop: false,
    onDirectoryChange: ({ path }) => {
      currentDirectory = normalizePickerPath(path || "");
      selectedPath = "";
      selectedIsDirectory = false;
      updateStatus();
    },
    onSelectionChange: ({ path, isDirectory }) => {
      selectedPath = normalizePickerPath(path || "");
      selectedIsDirectory = Boolean(isDirectory);
      updateStatus();
    },
    onEntryActivate: ({ path, isDirectory }) => {
      if (path && !isDirectory) finish(path, false);
    },
  });

  select.addEventListener("click", () => finish(selectedPath, selectedIsDirectory));
  current.addEventListener("click", () => finish(currentDirectory, true));
  cancel.addEventListener("click", () => options.onCancel?.());
  updateStatus();
  return { destroy: () => { root.innerHTML = ""; } };
}
