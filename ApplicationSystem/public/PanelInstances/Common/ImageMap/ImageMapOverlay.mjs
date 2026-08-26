// Nodevision/ApplicationSystem/public/PanelInstances/Common/ImageMap/ImageMapOverlay.mjs
// This module coordinates source selection, image-map editing, and Notebook href picking inside Nodevision overlay panels.

import { openNodevisionOverlayPanel } from "/TemplateSystem/NodevisionOverlayPanel.mjs";
import { mountImageMapEditor } from "./ImageMapEditorView.mjs";
import { mountImageMapSourceChooser } from "./ImageMapSourceChooser.mjs";
import { createBlankImageMapModel, normalizeImageMapModel, uniqueImageMapName } from "./ImageMapModel.mjs";
import { imageMapHrefFromNotebookPath } from "./ImageMapSources.mjs";

// ------------------------------
// Model preparation
// ------------------------------
function modelFromSource(source = {}, vars = {}) {
  const name = uniqueImageMapName(vars.existingMapNames || [], vars.preferredMapName || "image-map");
  return createBlankImageMapModel({
    name,
    src: source.savedSrc || source.src || "",
    alt: vars.defaultImageAlt || "",
  });
}

function withSourcePreview(model, source = {}) {
  return normalizeImageMapModel({
    ...model,
    image: {
      ...(model.image || {}),
      src: source.savedSrc || source.src || model.image?.src || "",
      previewSrc: source.previewSrc || "",
      linkedNotebookPath: source.linkedNotebookPath || "",
    },
  });
}

// ------------------------------
// Overlay lifecycle
// ------------------------------
export function mountImageMapOverlay(root, vars = {}) {
  let child = null;
  const editorPath = vars.editorPath || "";

  function clearChild() {
    child?.destroy?.();
    child = null;
  }

  function finish(model) {
    clearChild();
    vars.onDone?.(normalizeImageMapModel(model));
  }

  function cancel() {
    clearChild();
    vars.onCancel?.();
  }

  async function pickHref() {
    const picked = await openNodevisionOverlayPanel("ImageMapNotebookPicker", {
      displayName: "Select Image Map Link",
    }, { panelClass: "InfoPanel" });
    if (!picked?.path) return "";
    return imageMapHrefFromNotebookPath(picked.path, editorPath, { isDirectory: picked.isDirectory });
  }

  function renderEditor(model) {
    clearChild();
    child = mountImageMapEditor(root, normalizeImageMapModel(model), {
      onApply: finish,
      onCancel: cancel,
      onPickHref: pickHref,
    });
  }

  function renderChooser() {
    clearChild();
    child = mountImageMapSourceChooser(root, {
      editorPath,
      onCancel: cancel,
      onSource: (source) => renderEditor(withSourcePreview(modelFromSource(source, vars), source)),
    });
  }

  const initial = normalizeImageMapModel(vars.initialModel || {});
  if (initial.image.src || initial.image.previewSrc) renderEditor(initial);
  else renderChooser();

  return { destroy: clearChild };
}
