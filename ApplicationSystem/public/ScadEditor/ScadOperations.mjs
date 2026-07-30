// Nodevision/ApplicationSystem/public/ScadEditor/ScadOperations.mjs
// Parametric operations for graphical SCAD models.

import { addTimelineStep, addObject, removeObject, scadObjectTypeLabel, updateObject } from "./ScadModel.mjs";

const EXTRUDABLE_TYPES = new Set(["circle", "rectangle", "square", "triangle", "polygon", "text"]);
const BOOLEAN_OPERATION_TYPES = new Set(["cutout", "difference", "union", "intersection"]);
const BOOLEAN_SOLID_TYPES = new Set(["sphere", "cube", "cylinder", "polyhedron"]);

function hasActiveExtrude(obj) {
  return (obj?.operations || []).some((op) => op?.type === "extrude" && !op.disabled);
}

function hasBooleanSolidBody(obj) {
  return BOOLEAN_SOLID_TYPES.has(obj?.type) || hasActiveExtrude(obj);
}

function orderBooleanObjectIds(model, type, ids = []) {
  if (type !== "cutout" && type !== "difference") return ids;
  const byId = new Map(model.objects.map((obj) => [obj.id, obj]));
  const solidIds = ids.filter((id) => hasBooleanSolidBody(byId.get(id)));
  if (solidIds.length !== 1 || ids[0] === solidIds[0]) return ids;
  return [solidIds[0], ...ids.filter((id) => id !== solidIds[0])];
}

function selected(model, ids = []) {
  const set = new Set(ids);
  return model.objects.filter((obj) => set.has(obj.id));
}

function selectionLabel(model, ids = []) {
  const objects = selected(model, ids);
  if (objects.length === 1) return scadObjectTypeLabel(objects[0].type);
  return String(objects.length || ids.length) + " Objects";
}

function changedSelectionLabel(objects = [], fallbackIds = []) {
  if (objects.length === 1) return scadObjectTypeLabel(objects[0].type);
  return String(objects.length || fallbackIds.length) + " Objects";
}

function titleCaseOperation(value = "") {
  return String(value || "Operation").replace(/^./, (ch) => ch.toUpperCase());
}

function scaleFactorVector(values = []) {
  const arr = Array.isArray(values) ? values : [];
  return [0, 1, 2].map((index) => {
    const num = Number(arr[index]);
    return Number.isFinite(num) && num !== 0 ? num : 1;
  });
}

function sameObjectIdSet(a = [], b = []) {
  const left = (Array.isArray(a) ? a : []).filter(Boolean);
  const right = (Array.isArray(b) ? b : []).filter(Boolean);
  if (left.length !== right.length) return false;
  const leftSet = new Set(left);
  if (leftSet.size !== left.length) return false;
  return right.every((id) => leftSet.has(id));
}

function lastMergeableScaleStep(model, objectIds = []) {
  const timeline = Array.isArray(model?.timeline) ? model.timeline : [];
  const last = timeline[timeline.length - 1] || null;
  if (!last || last.disabled) return null;
  if (last.type !== "transform" || last.params?.operation !== "scale") return null;
  return sameObjectIdSet(last.objectIds, objectIds) ? last : null;
}

export function recordScaleTimelineStep(model, objectIds = [], factors = [1, 1, 1], options = {}) {
  const ids = (Array.isArray(objectIds) ? objectIds : []).filter(Boolean);
  if (!ids.length) return null;
  const nextFactors = scaleFactorVector(factors);
  const previous = lastMergeableScaleStep(model, ids);
  if (previous) {
    const previousFactors = scaleFactorVector(previous.params?.factors);
    previous.params = {
      ...(previous.params || {}),
      operation: "scale",
      factors: previousFactors.map((factor, index) => factor * nextFactors[index]),
    };
    if (options.axisLock !== undefined) previous.params.axisLock = options.axisLock;
    previous.timestamp = new Date().toISOString();
    return previous;
  }
  const params = { operation: "scale", factors: nextFactors };
  if (options.axisLock !== undefined) params.axisLock = options.axisLock;
  return addTimelineStep(model, {
    type: "transform",
    objectIds: ids,
    label: options.label || "Scale " + selectionLabel(model, ids),
    params,
  });
}

export function extrudeObjects(model, objectIds = [], height = 10) {
  const changed = [];
  const changedObjects = [];
  for (const obj of selected(model, objectIds).filter((item) => EXTRUDABLE_TYPES.has(item.type))) {
    const ops = Array.isArray(obj.operations) ? [...obj.operations] : [];
    const existing = ops.find((op) => op.type === "extrude");
    if (existing) existing.params = { ...(existing.params || {}), height: Number(height) || 10 };
    else ops.push({ type: "extrude", params: { height: Number(height) || 10 } });
    obj.operations = ops;
    changed.push(obj.id);
    changedObjects.push(obj);
  }
  if (changed.length) addTimelineStep(model, { type: "extrude", objectIds: changed, label: "Extrude " + changedSelectionLabel(changedObjects, changed), params: { operation: "extrude", height: Number(height) || 10 } });
  return changed;
}

export function addBooleanOperation(model, type, objectIds = []) {
  const seen = new Set();
  const ids = objectIds.filter((id) => {
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return model.objects.some((obj) => obj.id === id);
  });
  if (ids.length < 2) return null;
  const normalized = type === "cutout" ? "cutout" : String(type || "").toLowerCase();
  if (!BOOLEAN_OPERATION_TYPES.has(normalized)) return null;
  const operation = normalized === "cutout" ? "difference" : normalized;
  const orderedIds = orderBooleanObjectIds(model, normalized, ids);
  const label = normalized === "cutout" ? "Cut Out" : "Boolean " + titleCaseOperation(normalized);
  return addTimelineStep(model, {
    type: normalized,
    objectIds: orderedIds,
    label,
    params: {
      operation,
      operandCount: orderedIds.length,
      baseObjectId: orderedIds[0],
      operandIds: orderedIds.slice(1),
    },
  });
}

export function translateObjects(model, objectIds = [], delta = [0, 0, 0]) {
  selected(model, objectIds).forEach((obj) => {
    const t = obj.transform?.translate || [0, 0, 0];
    obj.transform.translate = [0, 1, 2].map((i) => Number(t[i] || 0) + Number(delta[i] || 0));
  });
  if (objectIds.length) addTimelineStep(model, { type: "transform", objectIds, label: "Translate " + selectionLabel(model, objectIds), params: { operation: "translate", delta } });
}

export function rotateObjects(model, objectIds = [], delta = [0, 0, 0]) {
  selected(model, objectIds).forEach((obj) => {
    const r = obj.transform?.rotate || [0, 0, 0];
    obj.transform.rotate = [0, 1, 2].map((i) => Number(r[i] || 0) + Number(delta[i] || 0));
  });
  if (objectIds.length) addTimelineStep(model, { type: "transform", objectIds, label: "Rotate " + selectionLabel(model, objectIds), params: { operation: "rotate", delta } });
}

export function scaleObjects(model, objectIds = [], factors = [1, 1, 1]) {
  const appliedFactors = scaleFactorVector(factors);
  selected(model, objectIds).forEach((obj) => {
    const s = obj.transform?.scale || [1, 1, 1];
    obj.transform.scale = [0, 1, 2].map((i) => Number(s[i] || 1) * appliedFactors[i]);
  });
  recordScaleTimelineStep(model, objectIds, appliedFactors, { label: "Scale " + selectionLabel(model, objectIds) });
}

export function duplicateObjects(model, objectIds = []) {
  const clones = [];
  for (const obj of selected(model, objectIds)) {
    const clone = addObject(model, {
      ...JSON.parse(JSON.stringify(obj)),
      id: undefined,
      name: `${obj.name || obj.type} copy`,
      transform: {
        ...(obj.transform || {}),
        translate: [(obj.transform?.translate?.[0] || 0) + 5, (obj.transform?.translate?.[1] || 0) + 5, obj.transform?.translate?.[2] || 0],
      },
    }, { timeline: false });
    clones.push(clone.id);
  }
  if (clones.length) addTimelineStep(model, { type: "duplicate", objectIds: clones, label: "Duplicate " + selectionLabel(model, clones), params: { operation: "duplicate", count: clones.length } });
  return clones;
}

export function deleteObjects(model, objectIds = []) {
  let count = 0;
  objectIds.forEach((id) => { if (removeObject(model, id, { timeline: false })) count += 1; });
  if (count) addTimelineStep(model, { type: "delete", objectIds, label: "Delete " + String(count) + " Object" + (count === 1 ? "" : "s"), params: { operation: "delete", count } });
  return count;
}

export function renameObject(model, objectId, name) {
  const obj = updateObject(model, objectId, { name }, { timeline: false });
  if (obj) addTimelineStep(model, { type: "rename", objectIds: [objectId], label: "Rename " + scadObjectTypeLabel(obj.type), params: { operation: "rename", name: obj.name } });
  return obj;
}
