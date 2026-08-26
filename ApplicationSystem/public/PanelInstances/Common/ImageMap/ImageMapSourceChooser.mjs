// Nodevision/ApplicationSystem/public/PanelInstances/Common/ImageMap/ImageMapSourceChooser.mjs
// This module renders the initial image-map source chooser and reuses the Notebook File Manager picker for image selection.

import { createFileManager } from "/PanelInstances/InfoPanels/FileManagerDependencies.mjs/FileManagerController.mjs";
import { getNodevisionNavigationState } from "/NodevisionNavigationState.mjs";
import { createBlankNotebookImage, imageMapSourceFromNotebookPath, isSupportedImageMapImage } from "./ImageMapSources.mjs";
import { ensureImageMapEditorStyles, imageMapButton } from "./ImageMapStyles.mjs";

const navigationState = getNodevisionNavigationState();

// ------------------------------
// Shared helpers
// ------------------------------
function setStatus(root, message = "") {
  const status = root.querySelector("[data-status]");
  if (status) status.textContent = message;
}

function appendButtons(row, buttons = []) {
  buttons.forEach((button) => row.appendChild(button));
}

function fileStatus(path = "", isDirectory = false) {
  if (!path) return "Select a Notebook image.";
  if (isDirectory) return "Open a file, not a folder.";
  return isSupportedImageMapImage(path) ? `Selected: ${path}` : "Choose a supported image file.";
}

// ------------------------------
// Initial chooser
// ------------------------------
export function mountImageMapSourceChooser(root, options = {}) {
  ensureImageMapEditorStyles();
  root.innerHTML = `<div class="nv-image-map-picker">
    <div class="nv-image-map-picker-row" data-start></div>
    <div data-work style="min-height:0;flex:1 1 auto;"></div>
    <div class="nv-image-map-status" data-status></div>
  </div>`;
  const row = root.querySelector("[data-start]");
  const select = imageMapButton("Select Notebook Image");
  const create = imageMapButton("Create New Image");
  const cancel = imageMapButton("Cancel");
  appendButtons(row, [select, create, cancel]);
  select.addEventListener("click", () => renderNotebookPicker(root, options));
  create.addEventListener("click", () => renderNewImageForm(root, options));
  cancel.addEventListener("click", () => options.onCancel?.());
  return { destroy: () => { root.innerHTML = ""; } };
}

// ------------------------------
// Notebook picker
// ------------------------------
function renderNotebookPicker(root, options = {}) {
  const work = root.querySelector("[data-work]");
  work.innerHTML = `<div class="nv-image-map-manager">
    <div class="file-manager"><h3>File Manager</h3><div id="loading" style="display:none;">Loading...</div><div id="error"></div><ul id="file-list" class="file-list"></ul><div id="fm-path"></div></div>
  </div>
  <div class="nv-image-map-picker-row" data-picker-actions></div>`;
  const row = work.querySelector("[data-picker-actions]");
  const back = imageMapButton("Back");
  const choose = imageMapButton("Select", { disabled: true });
  appendButtons(row, [choose, back]);

  let selectedPath = "";
  let selectedIsDirectory = false;
  const initialDir = navigationState.getSearchRoot?.() || window.currentDirectoryPath || "";

  function update() {
    const ok = Boolean(selectedPath && !selectedIsDirectory && isSupportedImageMapImage(selectedPath));
    choose.disabled = !ok;
    setStatus(root, fileStatus(selectedPath, selectedIsDirectory));
  }

  function finish(path) {
    const source = imageMapSourceFromNotebookPath(path, options.editorPath);
    if (!source) {
      setStatus(root, "Unable to resolve the selected image path.");
      return;
    }
    options.onSource?.(source);
  }

  createFileManager(work.querySelector(".file-manager"), initialDir, {
    enableDragDrop: false,
    onSelectionChange: ({ path, isDirectory }) => {
      selectedPath = path || "";
      selectedIsDirectory = Boolean(isDirectory);
      update();
    },
    onEntryActivate: ({ path, isDirectory }) => {
      if (path && !isDirectory && isSupportedImageMapImage(path)) finish(path);
    },
  });
  choose.addEventListener("click", () => selectedPath && finish(selectedPath));
  back.addEventListener("click", () => mountImageMapSourceChooser(root, options));
  update();
}

// ------------------------------
// New image form
// ------------------------------
function renderNewImageForm(root, options = {}) {
  const work = root.querySelector("[data-work]");
  work.innerHTML = `<form class="nv-image-map-fields" data-new-image>
    <label>File Name<input data-field="fileName" value="image-map-source.svg"></label>
    <label>Format<select data-field="format"><option value="svg">SVG</option><option value="png">PNG</option></select></label>
    <label>Width<input data-field="width" type="number" min="1" max="4096" value="512"></label>
    <label>Height<input data-field="height" type="number" min="1" max="4096" value="512"></label>
    <div class="nv-image-map-picker-row"><button class="nv-image-map-button" type="submit">Create</button><button class="nv-image-map-button" type="button" data-action="back">Back</button></div>
  </form>`;
  const form = work.querySelector("form");
  form.querySelector('[data-action="back"]').addEventListener("click", () => mountImageMapSourceChooser(root, options));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(root, "");
    try {
      const source = await createBlankNotebookImage({
        editorPath: options.editorPath,
        fileName: form.querySelector('[data-field="fileName"]').value,
        format: form.querySelector('[data-field="format"]').value,
        width: form.querySelector('[data-field="width"]').value,
        height: form.querySelector('[data-field="height"]').value,
      });
      options.onSource?.(source);
    } catch (err) {
      setStatus(root, err?.message || String(err));
    }
  });
}
