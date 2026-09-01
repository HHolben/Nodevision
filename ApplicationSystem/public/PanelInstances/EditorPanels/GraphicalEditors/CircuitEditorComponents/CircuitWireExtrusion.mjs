// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CircuitEditorComponents/CircuitWireExtrusion.mjs
// This module finds circuit nodes and nearest directional wire targets for keyboard wire extrusion.

import { distancePointToSegment, rotatePoint, translatePoint } from "./CircuitGeometry.mjs";
import { getSymbol } from "./SymbolLibrary.mjs";

const EPSILON = 0.001;

export function directionFromArrowKey(key = "") {
  return {
    ArrowRight: { name: "right", x: 1, y: 0 },
    ArrowLeft: { name: "left", x: -1, y: 0 },
    ArrowDown: { name: "down", x: 0, y: 1 },
    ArrowUp: { name: "up", x: 0, y: -1 },
  }[key] || null;
}

function pinWorldById(document, pinId) {
  const [cmpId, , pinName] = String(pinId || "").split(":");
  const cmp = (document.components || []).find((c) => c.id === cmpId);
  if (!cmp) return null;
  const pin = getSymbol(cmp.type)?.pins?.find((p) => p.name === pinName);
  if (!pin) return null;
  return translatePoint(rotatePoint({ x: pin.x, y: pin.y }, cmp.rotation || 0), cmp.x, cmp.y);
}

function selectedWirePoint(document, id) {
  const match = String(id || "").match(/^(.+):pt:(\d+)$/);
  if (!match) return null;
  const wire = (document.wires || []).find((w) => w.id === match[1]);
  const index = Number.parseInt(match[2], 10);
  const point = wire?.points?.[index] || null;
  if (!point) return null;
  return { point: { x: point.x, y: point.y }, hit: { type: "wire-point", id, wireId: wire.id }, sourceWireId: wire.id };
}

function selectedJunction(document, id) {
  const junction = (document.junctions || []).find((j) => j.id === id);
  if (!junction) return null;
  return { point: { x: junction.x, y: junction.y }, hit: { type: "junction", id } };
}

export function selectedExtrusionNode(state) {
  const document = state?.document || {};
  for (const id of state?.selection || []) {
    if (String(id).includes(":pin:")) {
      const point = pinWorldById(document, id);
      if (point) return { point, hit: { type: "pin", id, componentId: id.split(":")[0] } };
    }
    const wirePoint = selectedWirePoint(document, id);
    if (wirePoint) return wirePoint;
    const junction = selectedJunction(document, id);
    if (junction) return junction;
  }
  return null;
}

function cross(a, b) {
  return a.x * b.y - a.y * b.x;
}

function pointOnRayDistance(origin, direction, point) {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const along = dx * direction.x + dy * direction.y;
  const off = Math.abs(dx * direction.y - dy * direction.x);
  return off <= EPSILON && along > EPSILON ? along : null;
}

function collinearRaySegmentIntersection(origin, direction, a, b) {
  const candidates = [];
  const da = pointOnRayDistance(origin, direction, a);
  const db = pointOnRayDistance(origin, direction, b);
  if (da != null) candidates.push({ distance: da, point: { x: a.x, y: a.y } });
  if (db != null) candidates.push({ distance: db, point: { x: b.x, y: b.y } });
  if (!candidates.length) return null;
  return candidates.sort((left, right) => left.distance - right.distance)[0];
}

export function raySegmentIntersection(origin, direction, a, b) {
  const segment = { x: b.x - a.x, y: b.y - a.y };
  const delta = { x: a.x - origin.x, y: a.y - origin.y };
  const denom = cross(direction, segment);
  if (Math.abs(denom) < EPSILON) {
    if (Math.abs(cross(delta, direction)) > EPSILON) return null;
    return collinearRaySegmentIntersection(origin, direction, a, b);
  }

  const distance = cross(delta, segment) / denom;
  const segmentT = cross(delta, direction) / denom;
  if (distance <= EPSILON || segmentT < -EPSILON || segmentT > 1 + EPSILON) return null;
  return {
    distance,
    point: { x: origin.x + direction.x * distance, y: origin.y + direction.y * distance },
  };
}

function wireContainsOrigin(wire, origin) {
  for (let i = 0; i < (wire.points || []).length - 1; i += 1) {
    if (distancePointToSegment(origin, wire.points[i], wire.points[i + 1]) <= EPSILON) return true;
  }
  return false;
}

export function nearestWireInDirection(document, origin, direction, { excludeWireIds = [] } = {}) {
  const excluded = new Set(excludeWireIds);
  let best = null;
  for (const wire of document?.wires || []) {
    if (excluded.has(wire.id) || wireContainsOrigin(wire, origin)) continue;
    for (let segmentIndex = 0; segmentIndex < (wire.points || []).length - 1; segmentIndex += 1) {
      const hit = raySegmentIntersection(origin, direction, wire.points[segmentIndex], wire.points[segmentIndex + 1]);
      if (!hit) continue;
      if (!best || hit.distance < best.distance) {
        best = { ...hit, wireId: wire.id, segmentIndex, hit: { type: "wire", id: wire.id } };
      }
    }
  }
  return best;
}

export function buildExtrusionDraftPoints(node, target) {
  if (!node?.point || !target?.point) return [];
  return [
    { ...node.point, __attach: node.hit?.id || null },
    { ...target.point, __attach: target.hit?.id || null },
  ];
}
