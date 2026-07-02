// Nodevision/ApplicationSystem/public/ScadEditor/ScadOperations.mjs
// Parametric operations for graphical SCAD models.

import { addTimelineStep, addObject, removeObject, updateObject } from "./ScadModel.mjs";

function selected(model, ids = []) {
  const set = new Set(ids);
  return model.objects.filter((obj) => set.has(obj.id));
}

export function extrudeObjects(model, objectIds = [], height = 10) {
  const changed = [];
  for (const obj of selected(model, objectIds)) {
    const ops = Array.isArray(obj.operations) ? [...obj.operations] : [];
    const existing = ops.find((op) => op.type === "extrude");
    if (existing) existing.params = { ...(existing.params || {}), height: Number(height) || 10 };
    else ops.push({ type: "extrude", params: { height: Number(height) || 10 } });
    obj.operations = ops;
    changed.push(obj.id);
  }
  if (changed.length) addTimelineStep(model, { type: "extrude", objectIds: changed, label: `Extruded ${changed.length} shape(s)`, params: { height: Number(height) || 10 } });
  return changed;
}

export function addBooleanOperation(model, type, objectIds = []) {
  const ids = objectIds.filter(Boolean);
  if (ids.length < 2) return null;
  const normalized = type === "cutout" ? "cutout" : type;
  return addTimelineStep(model, {
    type: normalized,
    objectIds: ids,
    label: normalized === "cutout" ? "Cut object" : `${normalized[0].toUpperCase()}${normalized.slice(1)} objects`,
    params: { operation: normalized === "cutout" ? "difference" : normalized },
  });
}

export function translateObjects(model, objectIds = [], delta = [0, 0, 0]) {
  selected(model, objectIds).forEach((obj) => {
    const t = obj.transform?.translate || [0, 0, 0];
    obj.transform.translate = [0, 1, 2].map((i) => Number(t[i] || 0) + Number(delta[i] || 0));
  });
  if (objectIds.length) addTimelineStep(model, { type: "transform", objectIds, label: "Translated objects", params: { delta } });
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
    });
    clones.push(clone.id);
  }
  if (clones.length) addTimelineStep(model, { type: "create", objectIds: clones, label: `Duplicated ${clones.length} object(s)` });
  return clones;
}

export function deleteObjects(model, objectIds = []) {
  let count = 0;
  objectIds.forEach((id) => { if (removeObject(model, id, { timeline: false })) count += 1; });
  if (count) addTimelineStep(model, { type: "modify", label: `Deleted ${count} object(s)`, params: { count } });
  return count;
}

export function renameObject(model, objectId, name) {
  const obj = updateObject(model, objectId, { name }, { timeline: false });
  if (obj) addTimelineStep(model, { type: "modify", objectIds: [objectId], label: `Renamed ${obj.name}` });
  return obj;
}
