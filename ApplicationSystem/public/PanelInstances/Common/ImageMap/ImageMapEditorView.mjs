// Nodevision/ApplicationSystem/public/PanelInstances/Common/ImageMap/ImageMapEditorView.mjs
// This module composes the image-map canvas, toolbar, property editor, keyboard handling, and apply lifecycle.

import { ensureImageMapEditorStyles, imageMapButton } from "./ImageMapStyles.mjs";
import { mountImageMapCanvas } from "./ImageMapCanvas.mjs";
import { renderImageMapPropertyPanel } from "./ImageMapPropertyPanel.mjs";
import { normalizeImageMapModel, validateImageMapModel } from "./ImageMapModel.mjs";
import { findImageMapArea, removeImageMapArea, updateImageMapArea } from "./ImageMapEditorState.mjs";

// ------------------------------
// Focus helpers
// ------------------------------
function isTextEditingTarget(target) {
  return Boolean(target?.closest?.("input, textarea, select, [contenteditable='true']"));
}

function selectedDeletedState(state) {
  return {
    ...state,
    model: removeImageMapArea(state.model, state.selectedAreaId),
    selectedAreaId: "",
  };
}

// ------------------------------
// Editor view
// ------------------------------
export function mountImageMapEditor(root, initialModel = {}, options = {}) {
  ensureImageMapEditorStyles();
  root.innerHTML = `<div class="nv-image-map-editor">
    <div class="nv-image-map-header"><div class="nv-image-map-tools" data-toolbar></div><div class="nv-image-map-tools" data-actions></div></div>
    <div class="nv-image-map-body"><div class="nv-image-map-stage-wrap" data-stage></div><div class="nv-image-map-side" data-side></div></div>
  </div>`;

  const toolbar = root.querySelector("[data-toolbar]");
  const actions = root.querySelector("[data-actions]");
  const stage = root.querySelector("[data-stage]");
  const side = root.querySelector("[data-side]");
  let state = {
    model: normalizeImageMapModel(initialModel),
    selectedAreaId: "",
    tool: "select",
    imageSize: { width: 640, height: 480 },
    errors: [],
    status: "",
  };
  let canvas = null;

  function setState(patch = {}) {
    state = { ...state, ...patch };
    const validation = validateImageMapModel(state.model);
    state.errors = validation.errors;
    renderToolbar();
    renderProperties();
    canvas?.refresh(state);
  }

  function setModel(model, selectedAreaId = state.selectedAreaId) {
    setState({ model: normalizeImageMapModel(model), selectedAreaId });
  }

  function deleteSelected() {
    if (!state.selectedAreaId) return;
    setState(selectedDeletedState(state));
  }

  async function pickHref(areaId) {
    const area = findImageMapArea(state.model, areaId);
    if (!area || typeof options.onPickHref !== "function") return;
    const href = await options.onPickHref();
    if (!href) return;
    setModel(updateImageMapArea(state.model, { ...area, href }), areaId);
  }

  function renderToolbar() {
    toolbar.innerHTML = "";
    for (const [tool, label] of [["select", "Select"], ["rect", "Rectangle"], ["circle", "Circle"], ["poly", "Polygon"]]) {
      const button = imageMapButton(label, { active: state.tool === tool });
      button.addEventListener("click", () => setState({ tool, status: "" }));
      toolbar.appendChild(button);
    }
    const finish = imageMapButton("Finish Polygon", { disabled: state.tool !== "poly" });
    finish.addEventListener("click", () => {
      if (!canvas?.finishPolygon()) setState({ status: "Add at least three polygon points." });
    });
    const del = imageMapButton("Delete Selected", { disabled: !state.selectedAreaId });
    del.addEventListener("click", deleteSelected);
    toolbar.append(finish, del);

    actions.innerHTML = "";
    const apply = imageMapButton("Apply", { disabled: state.errors.length > 0 });
    apply.addEventListener("click", () => {
      const validation = validateImageMapModel(state.model);
      if (!validation.ok) {
        setState({ status: validation.errors[0] || "Image map is invalid." });
        return;
      }
      options.onApply?.(state.model);
    });
    const cancel = imageMapButton("Cancel");
    cancel.addEventListener("click", () => options.onCancel?.());
    actions.append(apply, cancel);
  }

  function renderProperties() {
    renderImageMapPropertyPanel(side, state, {
      onModelChange: (model) => setModel(model),
      onPickHref: pickHref,
    });
  }

  function keydown(event) {
    if (isTextEditingTarget(event.target)) return;
    if ((event.key === "Delete" || event.key === "Backspace") && state.selectedAreaId) {
      event.preventDefault();
      deleteSelected();
    } else if (event.key === "Escape") {
      event.preventDefault();
      canvas?.cancelDraft();
      setState({ status: "", tool: "select" });
    } else if (event.key === "Enter" && state.tool === "poly") {
      event.preventDefault();
      if (!canvas?.finishPolygon()) setState({ status: "Add at least three polygon points." });
    }
  }

  canvas = mountImageMapCanvas(stage, state, {
    onModelChange: (model, selectedAreaId) => setModel(model, selectedAreaId),
    onSelectArea: (selectedAreaId) => setState({ selectedAreaId, tool: "select" }),
    onImageSizeChange: (imageSize) => setState({ imageSize }),
    onImageError: (status) => setState({ status }),
  });
  root.addEventListener("keydown", keydown, true);
  root.tabIndex = 0;
  setState({});

  return {
    destroy() {
      root.removeEventListener("keydown", keydown, true);
      canvas?.destroy();
      root.innerHTML = "";
    },
  };
}
