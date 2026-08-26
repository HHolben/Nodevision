// Nodevision/ApplicationSystem/public/PanelInstances/Common/ImageMap/ImageMapEditorState.mjs
// This module provides small immutable update helpers for image-map editor state.

import { normalizeArea } from "./ImageMapModel.mjs";

// ------------------------------
// Area access
// ------------------------------
export function findImageMapArea(model = {}, areaId = "") {
  return (model.areas || []).find((area) => area.id === areaId) || null;
}

export function updateImageMapArea(model = {}, area = {}) {
  const nextArea = normalizeArea(area);
  return {
    ...model,
    areas: (model.areas || []).map((entry) => entry.id === nextArea.id ? nextArea : entry),
  };
}

export function appendImageMapArea(model = {}, area = {}) {
  const nextArea = normalizeArea(area, (model.areas || []).length);
  return { ...model, areas: [...(model.areas || []), nextArea] };
}

export function removeImageMapArea(model = {}, areaId = "") {
  return {
    ...model,
    areas: (model.areas || []).filter((area) => area.id !== areaId),
  };
}

export function firstImageMapAreaId(model = {}) {
  return (model.areas || [])[0]?.id || "";
}
