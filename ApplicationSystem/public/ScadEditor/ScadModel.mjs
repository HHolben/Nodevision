// Nodevision/ApplicationSystem/public/ScadEditor/ScadModel.mjs
// Internal parametric data model helpers for the graphical SCAD editor.

export const SCAD_MODEL_VERSION = 1;
export const DEFAULT_UNITS = "mm";

const SHAPE_TYPES = new Set(["circle", "rectangle", "triangle", "polygon", "vertexPath"]);

function makeId(prefix = "id") {
  const random = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

export function createDefaultTransform(overrides = {}) {
  return {
    translate: Array.isArray(overrides.translate) ? [...overrides.translate] : [0, 0, 0],
    rotate: Array.isArray(overrides.rotate) ? [...overrides.rotate] : [0, 0, 0],
    scale: Array.isArray(overrides.scale) ? [...overrides.scale] : [1, 1, 1],
  };
}

export function createLayer({ id = makeId("layer"), name = "Layer 1", visible = true, locked = false, color = "#4f8cff", objectIds = [] } = {}) {
  return { id, name, visible: visible !== false, locked: Boolean(locked), color, objectIds: [...objectIds] };
}

export function createTimelineStep({ id = makeId("step"), type = "modify", objectIds = [], label = "Modified model", timestamp = null, params = {}, disabled = false } = {}) {
  return {
    id,
    type,
    objectIds: [...objectIds],
    label,
    timestamp: timestamp || new Date().toISOString(),
    params: { ...params },
    disabled: Boolean(disabled),
  };
}

export function defaultParamsForType(type) {
  if (type === "circle") return { radius: 5, segments: 48 };
  if (type === "rectangle") return { width: 20, height: 10, center: false };
  if (type === "triangle") return { points: [[0, 0], [10, 0], [5, 8]] };
  if (type === "polygon" || type === "vertexPath") return { points: [[0, 0], [10, 0], [5, 8]], closed: type !== "vertexPath" };
  return {};
}

export function createScadObject({ id = makeId("obj"), type = "rectangle", name = null, layerId = null, visible = true, locked = false, params = {}, transform = {}, operations = [] } = {}) {
  if (!SHAPE_TYPES.has(type)) throw new Error(`Unsupported SCAD graphical object type: ${type}`);
  return {
    id,
    type,
    name: name || type[0].toUpperCase() + type.slice(1),
    layerId,
    visible: visible !== false,
    locked: Boolean(locked),
    params: { ...defaultParamsForType(type), ...params },
    transform: createDefaultTransform(transform),
    operations: operations.map((op) => ({ ...op, params: { ...(op.params || {}) } })),
  };
}

export function createEmptyScadModel(options = {}) {
  const layer = createLayer({ name: options.layerName || "Layer 1", color: options.layerColor || "#4f8cff" });
  return {
    version: SCAD_MODEL_VERSION,
    units: options.units || DEFAULT_UNITS,
    parameters: { ...(options.parameters || {}) },
    layers: [layer],
    objects: [],
    timeline: [],
    unsupportedSource: options.unsupportedSource || "",
    warnings: Array.isArray(options.warnings) ? [...options.warnings] : [],
  };
}

export function normalizeScadModel(input = {}) {
  const model = createEmptyScadModel({
    units: input.units || DEFAULT_UNITS,
    parameters: input.parameters || {},
    unsupportedSource: input.unsupportedSource || "",
    warnings: input.warnings || [],
  });
  model.version = Number(input.version) || SCAD_MODEL_VERSION;
  model.layers = Array.isArray(input.layers) && input.layers.length
    ? input.layers.map((layer, index) => createLayer({ name: `Layer ${index + 1}`, ...layer }))
    : model.layers;
  const fallbackLayerId = model.layers[0]?.id || createLayer().id;
  model.objects = Array.isArray(input.objects)
    ? input.objects.filter((obj) => SHAPE_TYPES.has(obj?.type)).map((obj) => createScadObject({ ...obj, layerId: obj.layerId || fallbackLayerId }))
    : [];
  model.timeline = Array.isArray(input.timeline)
    ? input.timeline.map((step) => createTimelineStep(step))
    : [];
  reconcileLayerMembership(model);
  return model;
}

export function getActiveLayer(model, activeLayerId = null) {
  return model.layers.find((layer) => layer.id === activeLayerId) || model.layers[0] || null;
}

export function addLayer(model, layerInput = {}) {
  const layer = createLayer({ name: `Layer ${model.layers.length + 1}`, ...layerInput });
  model.layers.push(layer);
  addTimelineStep(model, { type: "modify", label: `Created layer ${layer.name}`, params: { layerId: layer.id } });
  return layer;
}

export function deleteLayer(model, layerId) {
  if (!model.layers.length || model.layers.length === 1) return false;
  const idx = model.layers.findIndex((layer) => layer.id === layerId);
  if (idx < 0) return false;
  const [removed] = model.layers.splice(idx, 1);
  const target = model.layers[Math.max(0, idx - 1)] || model.layers[0];
  model.objects.forEach((obj) => {
    if (obj.layerId === removed.id) obj.layerId = target.id;
  });
  reconcileLayerMembership(model);
  addTimelineStep(model, { type: "modify", label: `Deleted layer ${removed.name}`, params: { layerId: removed.id } });
  return true;
}

export function addObject(model, objectInput = {}, options = {}) {
  const activeLayer = getActiveLayer(model, options.activeLayerId || objectInput.layerId);
  const obj = createScadObject({ ...objectInput, layerId: activeLayer?.id || objectInput.layerId });
  model.objects.push(obj);
  reconcileLayerMembership(model);
  if (options.timeline !== false) {
    addTimelineStep(model, { type: "create", objectIds: [obj.id], label: `Created ${obj.type}`, params: { type: obj.type } });
  }
  return obj;
}

export function updateObject(model, objectId, patch = {}, options = {}) {
  const obj = model.objects.find((item) => item.id === objectId);
  if (!obj) return null;
  if (patch.name !== undefined) obj.name = String(patch.name || obj.name);
  if (patch.visible !== undefined) obj.visible = patch.visible !== false;
  if (patch.locked !== undefined) obj.locked = Boolean(patch.locked);
  if (patch.params) obj.params = { ...obj.params, ...patch.params };
  if (patch.transform) obj.transform = createDefaultTransform({ ...obj.transform, ...patch.transform });
  if (patch.operations) obj.operations = patch.operations.map((op) => ({ ...op, params: { ...(op.params || {}) } }));
  if (patch.layerId && patch.layerId !== obj.layerId) moveObjectToLayer(model, objectId, patch.layerId, { timeline: false });
  if (options.timeline !== false) addTimelineStep(model, { type: "modify", objectIds: [obj.id], label: `Modified ${obj.name}` });
  reconcileLayerMembership(model);
  return obj;
}

export function removeObject(model, objectId, options = {}) {
  const idx = model.objects.findIndex((obj) => obj.id === objectId);
  if (idx < 0) return false;
  const [removed] = model.objects.splice(idx, 1);
  model.timeline.forEach((step) => {
    step.objectIds = (step.objectIds || []).filter((id) => id !== objectId);
  });
  reconcileLayerMembership(model);
  if (options.timeline !== false) addTimelineStep(model, { type: "modify", label: `Deleted ${removed.name}`, params: { objectId } });
  return true;
}

export function moveObjectToLayer(model, objectId, layerId, options = {}) {
  const obj = model.objects.find((item) => item.id === objectId);
  const layer = model.layers.find((item) => item.id === layerId);
  if (!obj || !layer) return false;
  obj.layerId = layer.id;
  reconcileLayerMembership(model);
  if (options.timeline !== false) addTimelineStep(model, { type: "modify", objectIds: [obj.id], label: `Moved ${obj.name} to ${layer.name}`, params: { layerId: layer.id } });
  return true;
}

export function setLayerVisibility(model, layerId, visible) {
  const layer = model.layers.find((item) => item.id === layerId);
  if (!layer) return false;
  layer.visible = visible !== false;
  addTimelineStep(model, { type: "modify", label: `${layer.visible ? "Showed" : "Hid"} ${layer.name}`, params: { layerId } });
  return true;
}

export function setLayerLocked(model, layerId, locked) {
  const layer = model.layers.find((item) => item.id === layerId);
  if (!layer) return false;
  layer.locked = Boolean(locked);
  addTimelineStep(model, { type: "modify", label: `${layer.locked ? "Locked" : "Unlocked"} ${layer.name}`, params: { layerId } });
  return true;
}

export function reorderLayer(model, layerId, direction = -1) {
  const idx = model.layers.findIndex((layer) => layer.id === layerId);
  const next = idx + Number(direction || 0);
  if (idx < 0 || next < 0 || next >= model.layers.length) return false;
  const [layer] = model.layers.splice(idx, 1);
  model.layers.splice(next, 0, layer);
  addTimelineStep(model, { type: "modify", label: `Reordered ${layer.name}`, params: { layerId } });
  return true;
}

export function addTimelineStep(model, stepInput = {}) {
  const step = createTimelineStep(stepInput);
  model.timeline.push(step);
  return step;
}

export function setTimelineStepDisabled(model, stepId, disabled) {
  const step = model.timeline.find((item) => item.id === stepId);
  if (!step) return false;
  step.disabled = Boolean(disabled);
  return true;
}

export function renameTimelineStep(model, stepId, label) {
  const step = model.timeline.find((item) => item.id === stepId);
  if (!step) return false;
  step.label = String(label || step.label || "Timeline step");
  return true;
}

export function deleteTimelineStep(model, stepId) {
  const idx = model.timeline.findIndex((step) => step.id === stepId);
  if (idx < 0) return false;
  model.timeline.splice(idx, 1);
  return true;
}

export function reconcileLayerMembership(model) {
  const existingLayerIds = new Set(model.layers.map((layer) => layer.id));
  if (!existingLayerIds.size) model.layers.push(createLayer());
  const fallbackLayerId = model.layers[0].id;
  model.layers.forEach((layer) => { layer.objectIds = []; });
  model.objects.forEach((obj) => {
    if (!existingLayerIds.has(obj.layerId)) obj.layerId = fallbackLayerId;
    const layer = model.layers.find((item) => item.id === obj.layerId);
    if (layer && !layer.objectIds.includes(obj.id)) layer.objectIds.push(obj.id);
  });
  return model;
}

export function isObjectEditable(model, obj) {
  if (!obj || obj.locked || obj.visible === false) return false;
  const layer = model.layers.find((item) => item.id === obj.layerId);
  return !layer?.locked && layer?.visible !== false;
}

export function cloneScadModel(model) {
  return normalizeScadModel(JSON.parse(JSON.stringify(model || createEmptyScadModel())));
}
