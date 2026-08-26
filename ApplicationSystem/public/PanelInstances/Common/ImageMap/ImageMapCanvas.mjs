// Nodevision/ApplicationSystem/public/PanelInstances/Common/ImageMap/ImageMapCanvas.mjs
// This module owns pointer interaction for drawing, selecting, moving, and reshaping image-map regions.

import {
  circleCoordsFromPoints,
  moveAreaBy,
  pointFromDisplay,
  polygonCoordsFromPoints,
  rectCoordsFromPoints,
  replacePolygonVertex,
  reshapeAreaWithPoint,
} from "./ImageMapGeometry.mjs";
import { createImageMapArea, validateAreaGeometry } from "./ImageMapModel.mjs";
import { appendImageMapArea, findImageMapArea, updateImageMapArea } from "./ImageMapEditorState.mjs";
import { renderImageMapSvg } from "./ImageMapSvgRenderer.mjs";

// ------------------------------
// DOM setup
// ------------------------------
function fallbackImageSize(img) {
  return {
    width: img?.naturalWidth || img?.width || 640,
    height: img?.naturalHeight || img?.height || 480,
  };
}

function eventPoint(event, svg, imageSize) {
  return pointFromDisplay(event.clientX, event.clientY, svg.getBoundingClientRect(), imageSize);
}

function areaIdFromTarget(target) {
  const element = target?.closest?.("[data-area-id]");
  const id = element?.dataset?.areaId || "";
  return id === "draft-area" ? "" : id;
}

function handleFromTarget(target) {
  const handle = target?.closest?.("[data-handle]");
  if (!handle) return null;
  return {
    areaId: handle.dataset.areaId || "",
    handle: handle.dataset.handle || "",
    vertexIndex: Number.parseInt(handle.dataset.vertexIndex || "0", 10) || 0,
  };
}

// ------------------------------
// Canvas lifecycle
// ------------------------------
export function mountImageMapCanvas(host, initialState = {}, actions = {}) {
  host.innerHTML = `<div class="nv-image-map-stage"><img alt=""><svg class="nv-image-map-svg"></svg></div>`;
  const image = host.querySelector("img");
  const svg = host.querySelector("svg");
  let state = initialState;
  let imageSize = initialState.imageSize || fallbackImageSize(image);
  let draftStart = null;
  let draftArea = null;
  let draftPoints = [];
  let drag = null;

  function refresh(nextState = state) {
    state = nextState;
    const nextSrc = state.model?.image?.previewSrc || state.model?.image?.src || "";
    if (image.getAttribute("src") !== nextSrc) image.setAttribute("src", nextSrc);
    image.alt = state.model?.image?.alt || "Image map source";
    renderImageMapSvg(svg, state.model, state.selectedAreaId, draftArea, imageSize);
  }

  function changeModel(model, selectedId = state.selectedAreaId) {
    state = { ...state, model, selectedAreaId: selectedId };
    actions.onModelChange?.(model, selectedId);
    refresh(state);
  }

  function selectedArea() {
    return findImageMapArea(state.model, state.selectedAreaId);
  }

  function updateDraggedArea(event) {
    if (!drag) return;
    const point = eventPoint(event, svg, imageSize);
    const base = drag.baseArea;
    let nextArea = base;
    if (drag.type === "move") {
      nextArea = moveAreaBy(base, point.x - drag.start.x, point.y - drag.start.y, imageSize);
    } else if (drag.type === "handle" && base.shape === "poly") {
      nextArea = replacePolygonVertex(base, drag.vertexIndex, point);
    } else if (drag.type === "handle") {
      nextArea = reshapeAreaWithPoint(base, drag.handle, point);
    }
    changeModel(updateImageMapArea(state.model, nextArea), nextArea.id);
  }

  function pointerDown(event) {
    if (event.button !== 0) return;
    const point = eventPoint(event, svg, imageSize);
    const handle = handleFromTarget(event.target);
    if (handle?.areaId) {
      const baseArea = findImageMapArea(state.model, handle.areaId);
      if (baseArea) drag = { type: "handle", baseArea, ...handle };
      svg.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      return;
    }

    if (state.tool === "rect" || state.tool === "circle") {
      draftStart = point;
      draftArea = createImageMapArea(state.tool, state.tool === "rect" ? rectCoordsFromPoints(point, point) : circleCoordsFromPoints(point, point));
      refresh();
      svg.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      return;
    }

    if (state.tool === "poly") {
      draftPoints.push(point);
      draftArea = createImageMapArea("poly", polygonCoordsFromPoints(draftPoints));
      refresh();
      event.preventDefault();
      return;
    }

    const areaId = areaIdFromTarget(event.target);
    actions.onSelectArea?.(areaId);
    if (areaId) {
      const baseArea = findImageMapArea(state.model, areaId);
      if (baseArea) drag = { type: "move", areaId, baseArea, start: point };
      svg.setPointerCapture?.(event.pointerId);
    }
    event.preventDefault();
  }

  function pointerMove(event) {
    if (drag) {
      updateDraggedArea(event);
      event.preventDefault();
      return;
    }
    if (!draftStart || !draftArea) return;
    const point = eventPoint(event, svg, imageSize);
    const coords = draftArea.shape === "rect" ? rectCoordsFromPoints(draftStart, point) : circleCoordsFromPoints(draftStart, point);
    draftArea = createImageMapArea(draftArea.shape, coords);
    refresh();
    event.preventDefault();
  }

  function pointerUp(event) {
    if (drag) {
      drag = null;
      event.preventDefault();
      return;
    }
    if (!draftStart || !draftArea) return;
    const area = draftArea;
    draftStart = null;
    draftArea = null;
    if (validateAreaGeometry(area)) changeModel(appendImageMapArea(state.model, area), area.id);
    else refresh();
    event.preventDefault();
  }

  function finishPolygon() {
    if (draftPoints.length >= 3 && draftArea && validateAreaGeometry(draftArea)) {
      const area = draftArea;
      draftPoints = [];
      draftArea = null;
      changeModel(appendImageMapArea(state.model, area), area.id);
      return true;
    }
    return false;
  }

  function cancelDraft() {
    draftStart = null;
    draftArea = null;
    draftPoints = [];
    refresh();
  }

  function imageLoaded() {
    imageSize = fallbackImageSize(image);
    actions.onImageSizeChange?.(imageSize);
    refresh();
  }

  function imageErrored() {
    actions.onImageError?.("The selected image could not be loaded.");
  }

  image.addEventListener("load", imageLoaded);
  image.addEventListener("error", imageErrored);
  svg.addEventListener("pointerdown", pointerDown);
  svg.addEventListener("pointermove", pointerMove);
  svg.addEventListener("pointerup", pointerUp);
  refresh();

  function destroy() {
    image.removeEventListener("load", imageLoaded);
    image.removeEventListener("error", imageErrored);
    svg.removeEventListener("pointerdown", pointerDown);
    svg.removeEventListener("pointermove", pointerMove);
    svg.removeEventListener("pointerup", pointerUp);
    host.innerHTML = "";
  }

  return { refresh, finishPolygon, cancelDraft, destroy, getImageSize: () => ({ ...imageSize }), selectedArea };
}
