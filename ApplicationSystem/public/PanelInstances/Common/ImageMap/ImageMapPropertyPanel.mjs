// Nodevision/ApplicationSystem/public/PanelInstances/Common/ImageMap/ImageMapPropertyPanel.mjs
// This module renders editable image-map and area attributes without owning geometry interaction.

import { escapeHtmlAttribute } from "./ImageMapAttributes.mjs";
import { coordsFromString, coordsToString, IMAGE_MAP_SHAPES, IMAGE_MAP_TARGETS, normalizeArea } from "./ImageMapModel.mjs";
import { findImageMapArea, updateImageMapArea } from "./ImageMapEditorState.mjs";

// ------------------------------
// Markup helpers
// ------------------------------
function valueAttr(value = "") {
  return escapeHtmlAttribute(value);
}

function options(values = [], selected = "") {
  return values
    .map((value) => `<option value="${valueAttr(value)}"${value === selected ? " selected" : ""}>${valueAttr(value || "same window")}</option>`)
    .join("");
}

function areaFields(area) {
  if (!area) return "<div class=\"nv-image-map-status\">Select or draw an area to edit its properties.</div>";
  return `<div class="nv-image-map-fields" data-area-fields="${valueAttr(area.id)}">
    <label>Shape<select data-field="shape">${options(IMAGE_MAP_SHAPES, area.shape)}</select></label>
    <label>Coordinates<input data-field="coords" value="${valueAttr(coordsToString(area.coords))}"></label>
    <div class="nv-image-map-inline">
      <label>Href<input data-field="href" value="${valueAttr(area.href)}"></label>
      <button type="button" class="nv-image-map-button" data-action="pick-href">Pick</button>
    </div>
    <label>Alt<input data-field="alt" value="${valueAttr(area.alt)}"></label>
    <label>Title<input data-field="title" value="${valueAttr(area.title)}"></label>
    <label>Target<select data-field="target">${options(IMAGE_MAP_TARGETS, area.target)}</select></label>
  </div>`;
}

// ------------------------------
// Event binding
// ------------------------------
function bindMapField(host, selector, handler) {
  const field = host.querySelector(selector);
  if (!field) return;
  field.addEventListener("input", () => handler(field.value));
  field.addEventListener("change", () => handler(field.value));
}

function patchSelectedArea(model, area, patch) {
  const nextArea = normalizeArea({ ...area, ...patch });
  return updateImageMapArea(model, nextArea);
}

function bindAreaFields(host, model, area, actions) {
  if (!area) return;
  const update = (patch) => actions.onModelChange?.(patchSelectedArea(model, area, patch));
  bindMapField(host, '[data-field="shape"]', (shape) => update({ shape, coords: area.coords }));
  bindMapField(host, '[data-field="coords"]', (coords) => update({ coords: coordsFromString(coords) }));
  bindMapField(host, '[data-field="href"]', (href) => update({ href }));
  bindMapField(host, '[data-field="alt"]', (alt) => update({ alt }));
  bindMapField(host, '[data-field="title"]', (title) => update({ title }));
  bindMapField(host, '[data-field="target"]', (target) => update({ target }));
  host.querySelector('[data-action="pick-href"]')?.addEventListener("click", () => actions.onPickHref?.(area.id));
}

// ------------------------------
// Public rendering
// ------------------------------
export function renderImageMapPropertyPanel(host, state = {}, actions = {}) {
  const model = state.model || {};
  const area = findImageMapArea(model, state.selectedAreaId || "");
  host.innerHTML = `<div class="nv-image-map-fields">
    <label>Map Name<input data-field="map-name" value="${valueAttr(model.map?.name || "")}"></label>
    <label>Image Source<input data-field="image-src" value="${valueAttr(model.image?.src || "")}"></label>
    <label>Image Alt<input data-field="image-alt" value="${valueAttr(model.image?.alt || "")}"></label>
    <label>Image Title<input data-field="image-title" value="${valueAttr(model.image?.title || "")}"></label>
  </div>
  <hr>
  ${areaFields(area)}
  <div class="nv-image-map-status">${valueAttr((state.errors || [])[0] || state.status || "")}</div>`;

  bindMapField(host, '[data-field="map-name"]', (name) => actions.onModelChange?.({ ...model, map: { ...(model.map || {}), name } }));
  bindMapField(host, '[data-field="image-src"]', (src) => actions.onModelChange?.({ ...model, image: { ...(model.image || {}), src, previewSrc: "" } }));
  bindMapField(host, '[data-field="image-alt"]', (alt) => actions.onModelChange?.({ ...model, image: { ...(model.image || {}), alt } }));
  bindMapField(host, '[data-field="image-title"]', (title) => actions.onModelChange?.({ ...model, image: { ...(model.image || {}), title } }));
  bindAreaFields(host, model, area, actions);
}
