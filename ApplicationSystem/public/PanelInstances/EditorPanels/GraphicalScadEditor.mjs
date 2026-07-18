// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalScadEditor.mjs
// Graphical parametric OpenSCAD editor for .scad files.

import { updateToolbarState } from "/panels/createToolbar.mjs";
import { ensureScadEditorModeLayout } from "/panels/workspace.mjs";
import { fetchText, resetEditorHooks, saveText } from "./GraphicalEditors/FamilyEditorCommon.mjs";
import { parseScadText } from "/ScadEditor/ScadParser.mjs";
import { serializeScadModel } from "/ScadEditor/ScadSerializer.mjs";
import { addObject, addTimelineStep, removeObject, renameTimelineStep, setTimelineStepDisabled, deleteTimelineStep, isObjectEditable, scadObjectTypeLabel } from "/ScadEditor/ScadModel.mjs";
import { shapeFromTool, polygonFromPoints } from "/ScadEditor/ScadShapeTools.mjs";
import { addBooleanOperation, deleteObjects, duplicateObjects, extrudeObjects, renameObject, rotateObjects, scaleObjects, translateObjects } from "/ScadEditor/ScadOperations.mjs";
import { createScadSceneRenderer } from "/ScadEditor/ScadSceneRenderer.mjs";
import { exportScadCodeToSTL } from "/ModelExport/STLExport.mjs";
import { clearScadLayersContext, ensureScadLayersContext, notifyScadLayersChanged, notifyScadSelectionChanged } from "/ScadEditor/ScadLayerPanelContext.mjs";

const SCAD_MODE = "SCADediting";
const SCAD_ACTION_AXIS_TYPES = new Set(["x", "y", "z"]);
const SCAD_FACE_OBJECT_TYPES = new Set(["circle", "rectangle", "square", "triangle", "polygon", "text"]);
const SCAD_SCALE_DRAG_UNITS = 60;
const SCAD_MIN_SCALE_FACTOR = 0.05;

function normalizePath(path = "") {
  return String(path || "").trim().replace(/\\/g, "/").replace(/[?#].*$/, "").replace(/^\/+/, "").replace(/^Notebook\//i, "");
}

function selectedObjects(model, ids) {
  const set = new Set(ids || []);
  return model.objects.filter((obj) => set.has(obj.id));
}

function clientToModelPoint(event, element) {
  const rect = element.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 100;
  const y = (0.5 - (event.clientY - rect.top) / Math.max(1, rect.height)) * 100;
  return [Number(x.toFixed(2)), Number(y.toFixed(2))];
}

function isTypingTarget(target) {
  const tag = target?.tagName?.toLowerCase?.() || "";
  return ["input", "textarea", "select"].includes(tag) || Boolean(target?.isContentEditable);
}

function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function scadVertexWorldPoint(obj) {
  if (obj?.type !== "vertexPath" && obj?.type !== "line") return null;
  const points = Array.isArray(obj.params?.points) ? obj.params.points : [];
  if (points.length !== 1 || !Array.isArray(points[0])) return null;
  const point = points[0];
  const translate = Array.isArray(obj.transform?.translate) ? obj.transform.translate : [0, 0, 0];
  const scale = Array.isArray(obj.transform?.scale) ? obj.transform.scale : [1, 1, 1];
  return {
    id: obj.id,
    x: numberOrZero(translate[0]) + numberOrZero(point[0]) * (Number(scale[0]) || 1),
    y: numberOrZero(translate[1]) + numberOrZero(point[1]) * (Number(scale[1]) || 1),
    z: numberOrZero(translate[2]) + numberOrZero(point[2]) * (Number(scale[2]) || 1),
  };
}

function scadVertexPathWorldPoints(obj) {
  if (obj?.type !== "vertexPath" && obj?.type !== "line") return [];
  const points = Array.isArray(obj.params?.points) ? obj.params.points : [];
  const translate = Array.isArray(obj.transform?.translate) ? obj.transform.translate : [0, 0, 0];
  const scale = Array.isArray(obj.transform?.scale) ? obj.transform.scale : [1, 1, 1];
  return points
    .filter((point) => Array.isArray(point))
    .map((point) => ({
      id: obj.id,
      x: numberOrZero(translate[0]) + numberOrZero(point[0]) * (Number(scale[0]) || 1),
      y: numberOrZero(translate[1]) + numberOrZero(point[1]) * (Number(scale[1]) || 1),
      z: numberOrZero(translate[2]) + numberOrZero(point[2]) * (Number(scale[2]) || 1),
    }));
}

function scadShapeWorldPoints(obj) {
  if (!obj) return [];
  if (obj.type === "vertexPath" || obj.type === "line") return scadVertexPathWorldPoints(obj);
  let points = null;
  if (obj.type === "circle") {
    const radius = Math.max(0.1, numberOrZero(obj.params?.radius || obj.params?.r || 5));
    points = Array.from({ length: 32 }, (_, index) => {
      const angle = (Math.PI * 2 * index) / 32;
      return [Math.cos(angle) * radius, Math.sin(angle) * radius];
    });
  } else if (obj.type === "rectangle") {
    const width = Math.max(0.1, numberOrZero(obj.params?.width || 20));
    const height = Math.max(0.1, numberOrZero(obj.params?.height || 10));
    points = [[0, 0], [width, 0], [width, height], [0, height]];
  } else if (obj.type === "square") {
    const size = Math.max(0.1, numberOrZero(obj.params?.size || 12));
    points = [[0, 0], [size, 0], [size, size], [0, size]];
  } else if (obj.type === "text") {
    const size = Math.max(1, numberOrZero(obj.params?.size || 10));
    const text = String(obj.params?.text || "Text");
    const width = Math.max(size, text.length * size * 0.62);
    const height = size;
    points = [[-width / 2, -height / 2], [width / 2, -height / 2], [width / 2, height / 2], [-width / 2, height / 2]];
  } else if (obj.type === "polygon" || obj.type === "triangle") {
    points = Array.isArray(obj.params?.points) ? obj.params.points : [];
  } else {
    return [];
  }
  const translate = Array.isArray(obj.transform?.translate) ? obj.transform.translate : [0, 0, 0];
  const scale = Array.isArray(obj.transform?.scale) ? obj.transform.scale : [1, 1, 1];
  return points
    .filter((point) => Array.isArray(point))
    .map((point) => ({
      id: obj.id,
      x: numberOrZero(translate[0]) + numberOrZero(point[0]) * (Number(scale[0]) || 1),
      y: numberOrZero(translate[1]) + numberOrZero(point[1]) * (Number(scale[1]) || 1),
      z: numberOrZero(translate[2]) + numberOrZero(point[2]) * (Number(scale[2]) || 1),
    }));
}

function scadVerticesAreCoplanar(vertices, epsilon = 1e-5) {
  if (!Array.isArray(vertices) || vertices.length < 3) return false;
  const z = vertices[0]?.z ?? 0;
  return vertices.every((vertex) => Math.abs((vertex?.z ?? 0) - z) <= epsilon);
}

function polygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += (a.x * b.y) - (b.x * a.y);
  }
  return Math.abs(area) / 2;
}

export async function renderEditor(filePath, container) {
  resetEditorHooks();
  const scadPath = normalizePath(filePath);
  let disposed = false;
  let renderer = null;
  let activeTool = "select";
  let polygonPoints = [];
  let dragStart = null;
  let activeLayerId = null;
  let selectedIds = [];
  let selectedVertexRefs = [];
  let selectedFaceRefs = [];
  let lastModelPoint = [0, 0];
  let grabState = null;

  container.innerHTML = "";
  container.style.width = "100%";
  container.style.height = "100%";
  container.style.minHeight = "640px";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.overflow = "hidden";

  let sourceText = "";
  try {
    sourceText = await fetchText(scadPath);
  } catch {
    sourceText = "";
  }
  const parseResult = parseScadText(sourceText);
  if (parseResult.source === "unsupported" && String(sourceText || "").trim() && typeof window.openCodeEditor === "function") {
    container.innerHTML = "";
    const fallback = document.createElement("div");
    fallback.textContent = "This SCAD file uses structures outside the graphical editor subset. Opening it in code mode.";
    Object.assign(fallback.style, { padding: "14px", font: "12px/1.4 system-ui,sans-serif", color: "#7c4a03", background: "#fff7e6" });
    container.appendChild(fallback);
    window.setTimeout(() => window.openCodeEditor?.(scadPath), 0);
    return { destroy() { container.innerHTML = ""; } };
  }
  const model = parseResult.model;
  activeLayerId = model.layers[0]?.id || null;

  const shell = document.createElement("div");
  Object.assign(shell.style, { display: "flex", flexDirection: "column", width: "100%", height: "100%", minHeight: "0", background: "#f5f7fb" });
  container.appendChild(shell);

  const notice = document.createElement("div");
  Object.assign(notice.style, { display: parseResult.warnings?.length ? "block" : "none", padding: "8px 10px", borderBottom: "1px solid #f2d39b", background: "#fff7e6", color: "#7c4a03", font: "12px/1.35 system-ui,sans-serif" });
  notice.textContent = parseResult.warnings?.[0] || "";
  shell.appendChild(notice);

  const main = document.createElement("div");
  Object.assign(main.style, { display: "flex", flex: "1", minHeight: "0" });
  shell.appendChild(main);

  const center = document.createElement("div");
  Object.assign(center.style, { display: "flex", flexDirection: "column", flex: "1", minWidth: "0", minHeight: "0" });
  const previewMount = document.createElement("div");
  previewMount.tabIndex = 0;
  Object.assign(previewMount.style, { flex: "1", minHeight: "0", position: "relative", overflow: "hidden", background: "#f7f8fb" });
  const status = document.createElement("div");
  Object.assign(status.style, { padding: "6px 10px", font: "12px/1.3 system-ui,sans-serif", color: "#4b5563", borderTop: "1px solid #d6dce5", background: "#fff" });
  status.textContent = "Select or insert a SCAD primitive.";
  center.append(previewMount, status);

  main.append(center);

  function setStatus(text) {
    status.textContent = text;
  }

  function setTool(tool) {
    activeTool = tool;
    polygonPoints = [];
    setStatus(tool === "polygon" ? "Click points to build a polygon. Double-click to close it." : `Tool: ${tool}`);
  }

  function setActiveLayer(id) {
    if (id && model.layers.some((layer) => layer.id === id)) activeLayerId = id;
  }

  function makeScadVertexRef(objectId, pointIndex = 0) {
    const obj = objectById(objectId);
    if (obj?.type !== "vertexPath" && obj?.type !== "line") return null;
    const index = Number.isInteger(pointIndex) ? pointIndex : 0;
    const point = scadVertexPathWorldPoints(obj)[index];
    return point ? { ...point, id: obj.id, pointIndex: index } : null;
  }

  function vertexRefKey(ref) {
    return String(ref?.id || "") + ":" + String(Number.isInteger(ref?.pointIndex) ? ref.pointIndex : 0);
  }

  function vertexRefPositionKey(ref) {
    return [ref?.x, ref?.y, ref?.z].map((value) => Number(numberOrZero(value).toFixed(6))).join(",");
  }

  function dedupeScadVertexRefs(refs = []) {
    const seen = new Set();
    const seenPositions = new Set();
    const hydrated = [];
    refs.forEach((ref) => {
      const next = makeScadVertexRef(ref?.id || ref?.objectId, Number.isInteger(ref?.pointIndex) ? ref.pointIndex : 0);
      if (!next) return;
      const key = vertexRefKey(next);
      const positionKey = vertexRefPositionKey(next);
      if (seen.has(key) || seenPositions.has(positionKey)) return;
      seen.add(key);
      seenPositions.add(positionKey);
      hydrated.push(next);
    });
    return hydrated;
  }

  function pickedVertexRefFromMeta(objectId, meta = null) {
    if (!meta || typeof meta !== "object") return null;
    const raw = meta.vertexRef && typeof meta.vertexRef === "object" ? meta.vertexRef : meta;
    const pointIndex = Number.isInteger(raw.pointIndex) ? raw.pointIndex : null;
    return pointIndex === null ? null : makeScadVertexRef(raw.objectId || raw.id || objectId, pointIndex);
  }

  function hydrateScadFacePoint(point) {
    if (Array.isArray(point)) return { x: numberOrZero(point[0]), y: numberOrZero(point[1]), z: numberOrZero(point[2]) };
    if (point && typeof point === "object") return { x: numberOrZero(point.x), y: numberOrZero(point.y), z: numberOrZero(point.z) };
    return null;
  }

  function makeScadFaceRef(raw = {}) {
    const objectId = raw?.objectId || raw?.id;
    const obj = objectById(objectId);
    if (!obj || !isObjectEditable(model, obj)) return null;
    const points = (Array.isArray(raw?.points) ? raw.points : []).map(hydrateScadFacePoint).filter(Boolean);
    if (points.length < 3) return null;
    return {
      id: obj.id,
      objectId: obj.id,
      faceIndex: Number.isInteger(raw?.faceIndex) ? raw.faceIndex : null,
      points,
      normal: Array.isArray(raw?.normal) ? raw.normal.map(numberOrZero) : null,
    };
  }

  function faceRefKey(ref) {
    const pointKey = (ref?.points || []).map((point) => [point.x, point.y, point.z].map((value) => Number(numberOrZero(value).toFixed(5))).join(",")).join(";");
    return String(ref?.id || ref?.objectId || "") + ":" + String(ref?.faceIndex ?? pointKey);
  }

  function dedupeScadFaceRefs(refs = []) {
    const seen = new Set();
    const hydrated = [];
    refs.forEach((ref) => {
      const next = makeScadFaceRef(ref);
      if (!next) return;
      const key = faceRefKey(next);
      if (seen.has(key)) return;
      seen.add(key);
      hydrated.push(next);
    });
    return hydrated;
  }

  function pickedFaceRefFromMeta(objectId, meta = null) {
    if (!meta || typeof meta !== "object" || !meta.faceRef) return null;
    return makeScadFaceRef({ ...meta.faceRef, objectId: meta.faceRef.objectId || objectId });
  }

  function currentSelectedFaceRefs() {
    const selectedSet = new Set(selectedIds);
    return dedupeScadFaceRefs(selectedFaceRefs).filter((ref) => selectedSet.has(ref.id));
  }

  function singlePointVertexRefsForIds(ids = selectedIds) {
    return (ids || [])
      .map((id) => {
        const obj = objectById(id);
        return (obj?.type === "vertexPath" || obj?.type === "line") && scadVertexPathWorldPoints(obj).length === 1
          ? makeScadVertexRef(id, 0)
          : null;
      })
      .filter(Boolean);
  }

  function currentSelectedVertexRefs() {
    const selectedSet = new Set(selectedIds);
    const explicit = dedupeScadVertexRefs(selectedVertexRefs).filter((ref) => selectedSet.has(ref.id));
    if (explicit.length) return explicit;
    return singlePointVertexRefsForIds();
  }

  function setSelection(ids = [], refs = [], faces = []) {
    selectedIds = Array.isArray(ids) ? ids.filter(Boolean) : [];
    selectedVertexRefs = dedupeScadVertexRefs(refs).filter((ref) => selectedIds.includes(ref.id));
    selectedFaceRefs = dedupeScadFaceRefs(faces).filter((ref) => selectedIds.includes(ref.id));
  }

  function selectObject(id, event = null, meta = null) {
    const obj = model.objects.find((item) => item.id === id);
    if (!obj || !isObjectEditable(model, obj)) return;
    const vertexRef = pickedVertexRefFromMeta(id, meta) || ((obj.type === "vertexPath" || obj.type === "line") && scadVertexPathWorldPoints(obj).length === 1 ? makeScadVertexRef(id, 0) : null);
    const objectFaceRef = !vertexRef && SCAD_FACE_OBJECT_TYPES.has(obj.type) ? makeScadFaceRef({ objectId: id, points: scadShapeWorldPoints(obj) }) : null;
    const faceRef = vertexRef ? null : (objectFaceRef || pickedFaceRefFromMeta(id, meta));
    if (event?.shiftKey || event?.ctrlKey || event?.metaKey) {
      if (vertexRef) {
        const nextRefs = currentSelectedVertexRefs();
        const key = vertexRefKey(vertexRef);
        const exists = nextRefs.some((ref) => vertexRefKey(ref) === key);
        selectedVertexRefs = exists ? nextRefs.filter((ref) => vertexRefKey(ref) !== key) : [...nextRefs, vertexRef];
        selectedFaceRefs = [];
        const nextIds = new Set(selectedIds);
        if (selectedVertexRefs.some((ref) => ref.id === id)) nextIds.add(id);
        else nextIds.delete(id);
        selectedIds = [...nextIds];
      } else if (faceRef) {
        const nextFaces = currentSelectedFaceRefs();
        const key = faceRefKey(faceRef);
        const exists = nextFaces.some((ref) => faceRefKey(ref) === key);
        selectedFaceRefs = exists ? nextFaces.filter((ref) => faceRefKey(ref) !== key) : [...nextFaces, faceRef];
        selectedVertexRefs = [];
        const nextIds = new Set(selectedIds);
        if (selectedFaceRefs.some((ref) => ref.id === id)) nextIds.add(id);
        else nextIds.delete(id);
        selectedIds = [...nextIds];
      } else {
        selectedIds = selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id];
        selectedVertexRefs = currentSelectedVertexRefs().filter((ref) => selectedIds.includes(ref.id));
        selectedFaceRefs = currentSelectedFaceRefs().filter((ref) => selectedIds.includes(ref.id));
      }
    } else {
      setSelection([id], vertexRef ? [vertexRef] : [], faceRef ? [faceRef] : []);
    }
    if (typeof renderer?.setSelectedIds === "function") renderer.setSelectedIds(selectedIds);
    else renderer?.setSelectedId(selectedIds[0] || null);
    renderer?.setSelectedFaceRefs?.(selectedFaceRefs);
    if (faceRef) setStatus("Selected face on " + (obj.name || obj.type || "mesh") + ".");
    refresh();
  }

  function selectObjects(ids = [], event = null, meta = null) {
    const editable = ids.filter((id) => {
      const obj = model.objects.find((item) => item.id === id);
      return obj && isObjectEditable(model, obj);
    });
    const refs = dedupeScadVertexRefs(Array.isArray(meta?.vertexRefs) ? meta.vertexRefs : []);
    if (event?.shiftKey || event?.ctrlKey || event?.metaKey) {
      const next = new Set(selectedIds);
      editable.forEach((id) => next.add(id));
      selectedIds = [...next];
      selectedVertexRefs = dedupeScadVertexRefs([...currentSelectedVertexRefs(), ...refs]).filter((ref) => selectedIds.includes(ref.id));
      selectedFaceRefs = [];
    } else {
      setSelection(editable, refs);
    }
    refresh();
  }

  function selectAllObjects() {
    const ids = model.objects
      .filter((obj) => isObjectEditable(model, obj))
      .map((obj) => obj.id);
    setSelection(ids, []);
    renderer?.setSelectedIds?.(selectedIds);
    setStatus(ids.length ? "Selected " + ids.length + " object(s)." : "No editable objects to select.");
    refresh();
  }

  function selectedScadVertices() {
    return currentSelectedVertexRefs();
  }

  function selectedScadEdge() {
    const vertexRefs = selectedScadVertices();
    if (vertexRefs.length === 2) return { a: vertexRefs[0], b: vertexRefs[1] };

    const selected = selectedObjects(model, selectedIds);
    if (selected.length === 1 && (selected[0]?.type === "vertexPath" || selected[0]?.type === "line")) {
      const points = scadVertexPathWorldPoints(selected[0]);
      if (points.length === 2) return { a: points[0], b: points[1] };
    }

    const vertices = selected.map(scadVertexWorldPoint).filter(Boolean);
    if (vertices.length === 2 && vertices.length === selected.length) {
      return { a: vertices[0], b: vertices[1] };
    }
    return null;
  }

  function pointWithDelta(point, delta) {
    return {
      x: numberOrZero(point?.x) + numberOrZero(delta?.x),
      y: numberOrZero(point?.y) + numberOrZero(delta?.y),
      z: numberOrZero(point?.z) + numberOrZero(delta?.z),
    };
  }

  function edgeExtrusionOffset(a, b) {
    const dx = numberOrZero(b?.x) - numberOrZero(a?.x);
    const dy = numberOrZero(b?.y) - numberOrZero(a?.y);
    const len = Math.hypot(dx, dy);
    if (len <= 1e-6) return { x: 8, y: 8, z: 0 };
    const distance = Math.max(4, Math.min(24, len * 0.35));
    return { x: (-dy / len) * distance, y: (dx / len) * distance, z: 0 };
  }

  function setVertexPathWorldPoints(obj, points = [], closed = false) {
    if (!obj) return;
    const z = numberOrZero(points[0]?.z);
    obj.params = {
      ...(obj.params || {}),
      points: points.map((point) => {
        const localZ = numberOrZero(point.z) - z;
        const next = [numberOrZero(point.x), numberOrZero(point.y)];
        if (Math.abs(localZ) > 1e-8) next.push(localZ);
        return next;
      }),
      closed: Boolean(closed),
    };
    obj.transform = { ...(obj.transform || {}), translate: [0, 0, z] };
  }

  function setPolygonWorldPoints(obj, points = []) {
    if (!obj) return;
    const z = numberOrZero(points[0]?.z);
    obj.params = {
      ...(obj.params || {}),
      points: points.map((point) => [numberOrZero(point.x), numberOrZero(point.y)]),
      closed: true,
    };
    obj.transform = { ...(obj.transform || {}), translate: [0, 0, z] };
  }

  function objectById(id) {
    return model.objects.find((obj) => obj.id === id) || null;
  }

  function updateScadEdgeExtrusion(extrusion, delta = { x: 0, y: 0, z: 0 }) {
    if (!extrusion) return;
    const a = extrusion.sourceA;
    const b = extrusion.sourceB;
    const a2 = pointWithDelta(a, delta);
    const b2 = pointWithDelta(b, delta);
    setVertexPathWorldPoints(objectById(extrusion.newEdgeId), [a2, b2], false);
    setVertexPathWorldPoints(objectById(extrusion.sideAId), [a, a2], false);
    setVertexPathWorldPoints(objectById(extrusion.sideBId), [b, b2], false);
    setPolygonWorldPoints(objectById(extrusion.faceId), [a, b, b2, a2]);
  }

  function createScadEdgeExtrusion(edge) {
    if (!edge?.a || !edge?.b) return null;
    const offset = edgeExtrusionOffset(edge.a, edge.b);
    const a2 = pointWithDelta(edge.a, offset);
    const b2 = pointWithDelta(edge.b, offset);
    const z = numberOrZero(edge.a.z);
    const face = addObject(model, {
      type: "polygon",
      name: "Extruded Edge Face",
      params: { points: [[edge.a.x, edge.a.y], [edge.b.x, edge.b.y], [b2.x, b2.y], [a2.x, a2.y]], closed: true },
      transform: { translate: [0, 0, z] },
    }, { activeLayerId, timeline: false });
    const sideA = addObject(model, {
      type: "vertexPath",
      name: "Extruded Side",
      params: { points: [[edge.a.x, edge.a.y], [a2.x, a2.y]], closed: false },
      transform: { translate: [0, 0, z] },
    }, { activeLayerId, timeline: false });
    const sideB = addObject(model, {
      type: "vertexPath",
      name: "Extruded Side",
      params: { points: [[edge.b.x, edge.b.y], [b2.x, b2.y]], closed: false },
      transform: { translate: [0, 0, z] },
    }, { activeLayerId, timeline: false });
    const newEdge = addObject(model, {
      type: "vertexPath",
      name: "Extruded Edge",
      params: { points: [[a2.x, a2.y], [b2.x, b2.y]], closed: false },
      transform: { translate: [0, 0, z] },
    }, { activeLayerId, timeline: false });

    setSelection([newEdge.id], [
      { id: newEdge.id, pointIndex: 0 },
      { id: newEdge.id, pointIndex: 1 },
    ]);
    markDirty();
    refresh();
    return {
      sourceA: { ...edge.a },
      sourceB: { ...edge.b },
      initialOffset: { ...offset },
      faceId: face.id,
      sideAId: sideA.id,
      sideBId: sideB.id,
      newEdgeId: newEdge.id,
      createdIds: [face.id, sideA.id, sideB.id, newEdge.id],
    };
  }

  function selectedScadFaceObjectIds() {
    return selectedObjects(model, selectedIds)
      .filter((obj) => SCAD_FACE_OBJECT_TYPES.has(obj.type) && isObjectEditable(model, obj))
      .map((obj) => obj.id);
  }

  function selectedScadFace() {
    const faceRefs = currentSelectedFaceRefs();
    if (faceRefs.length === 1) {
      const points = faceRefs[0].points || [];
      if (points.length >= 3 && scadVerticesAreCoplanar(points) && polygonArea(points) > 1e-6) return { points, source: faceRefs[0] };
    }

    const selected = selectedObjects(model, selectedIds);
    if (selected.length === 1 && (selected[0].type === "polygon" || selected[0].type === "triangle")) {
      const points = scadShapeWorldPoints(selected[0]);
      if (points.length >= 3 && scadVerticesAreCoplanar(points) && polygonArea(points) > 1e-6) return { points };
    }

    const vertices = selectedScadVertices();
    if (vertices.length >= 3 && scadVerticesAreCoplanar(vertices) && polygonArea(vertices) > 1e-6) {
      return { points: vertices };
    }
    return null;
  }

  function faceExtrusionOffset(points = []) {
    if (!points.length) return { x: 8, y: 8, z: 0 };
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    points.forEach((point) => {
      minX = Math.min(minX, numberOrZero(point.x));
      maxX = Math.max(maxX, numberOrZero(point.x));
      minY = Math.min(minY, numberOrZero(point.y));
      maxY = Math.max(maxY, numberOrZero(point.y));
    });
    const size = Math.max(maxX - minX, maxY - minY, 1);
    const distance = Math.max(4, Math.min(24, size * 0.2));
    return { x: distance, y: distance, z: 0 };
  }

  function updateScadFaceExtrusion(extrusion, delta = { x: 0, y: 0, z: 0 }) {
    if (!extrusion) return;
    const copies = extrusion.sourcePoints.map((point) => pointWithDelta(point, delta));
    setPolygonWorldPoints(objectById(extrusion.copyFaceId), copies);
    extrusion.sideFaceIds.forEach((id, index) => {
      const next = (index + 1) % extrusion.sourcePoints.length;
      setPolygonWorldPoints(objectById(id), [extrusion.sourcePoints[index], extrusion.sourcePoints[next], copies[next], copies[index]]);
    });
    extrusion.sideEdgeIds.forEach((id, index) => {
      setVertexPathWorldPoints(objectById(id), [extrusion.sourcePoints[index], copies[index]], false);
    });
  }

  function createScadFaceExtrusion(face) {
    const points = Array.isArray(face?.points) ? face.points : [];
    if (points.length < 3) return null;
    const offset = faceExtrusionOffset(points);
    const copies = points.map((point) => pointWithDelta(point, offset));
    const z = numberOrZero(points[0]?.z);
    const copyFace = addObject(model, {
      type: "polygon",
      name: "Extruded Face",
      params: { points: copies.map((point) => [point.x, point.y]), closed: true },
      transform: { translate: [0, 0, z] },
    }, { activeLayerId, timeline: false });

    const sideFaceIds = [];
    const sideEdgeIds = [];
    for (let i = 0; i < points.length; i += 1) {
      const next = (i + 1) % points.length;
      const sideFace = addObject(model, {
        type: "polygon",
        name: "Extruded Side Face",
        params: { points: [[points[i].x, points[i].y], [points[next].x, points[next].y], [copies[next].x, copies[next].y], [copies[i].x, copies[i].y]], closed: true },
        transform: { translate: [0, 0, z] },
      }, { activeLayerId, timeline: false });
      sideFaceIds.push(sideFace.id);

      const sideEdge = addObject(model, {
        type: "vertexPath",
        name: "Extruded Side Edge",
        params: { points: [[points[i].x, points[i].y], [copies[i].x, copies[i].y]], closed: false },
        transform: { translate: [0, 0, z] },
      }, { activeLayerId, timeline: false });
      sideEdgeIds.push(sideEdge.id);
    }

    setSelection([copyFace.id], []);
    markDirty();
    refresh();
    return {
      sourcePoints: points.map((point) => ({ ...point })),
      initialOffset: { ...offset },
      copyFaceId: copyFace.id,
      sideFaceIds,
      sideEdgeIds,
      createdIds: [copyFace.id, ...sideFaceIds, ...sideEdgeIds],
    };
  }

  function modelPointFromEventOrLast(event = null) {
    if (Number.isFinite(event?.clientX) && Number.isFinite(event?.clientY)) {
      return clientToModelPoint(event, previewMount);
    }
    return [...lastModelPoint];
  }

  function grabTypeLabel(type) {
    if (type === "scale") return "Scale";
    if (type === "vertexExtrusion") return "Vertex extrude";
    if (type === "edgeExtrusion") return "Edge extrude";
    if (type === "faceExtrusion") return "Face extrude";
    return "Grab";
  }

  function getGrabDirectionSign(state = grabState) {
    return state?.axisDirectionSign === -1 ? -1 : 1;
  }

  function grabAxisLabel(state = grabState) {
    if (!SCAD_ACTION_AXIS_TYPES.has(state?.axisLock)) return "free";
    return String(state.axisLock).toUpperCase() + " " + (getGrabDirectionSign(state) < 0 ? "-" : "+");
  }

  function setGrabInstructionStatus(state = grabState) {
    if (!state) return;
    const axisText = SCAD_ACTION_AXIS_TYPES.has(state.axisLock) ? ", " + grabAxisLabel(state) + " locked" : "";
    setStatus(grabTypeLabel(state.type) + ": move mouse" + axisText + ", X/Y/Z lock axis, - flips direction, click/Enter confirm, Esc cancel.");
  }

  function grabDeltaMagnitude(delta) {
    return Math.hypot(numberOrZero(delta?.x), numberOrZero(delta?.y), numberOrZero(delta?.z));
  }

  function rawGrabDelta(state, event = null) {
    const point = modelPointFromEventOrLast(event);
    const delta = { x: point[0] - state.start[0], y: point[1] - state.start[1], z: 0 };
    const initial = state?.extrusion?.initialOffset;
    if (initial && grabDeltaMagnitude(delta) <= 1e-6) return { ...initial };
    return delta;
  }

  function constrainedGrabDelta(state, event = null) {
    const delta = rawGrabDelta(state, event);
    const sign = getGrabDirectionSign(state);
    if (state.axisLock === "x") return { x: delta.x * sign, y: 0, z: 0 };
    if (state.axisLock === "y") return { x: 0, y: delta.y * sign, z: 0 };
    if (state.axisLock === "z") return { x: 0, y: 0, z: delta.y * sign };
    return { x: delta.x * sign, y: delta.y * sign, z: numberOrZero(delta.z) * sign };
  }

  function objectScaleVector(obj) {
    const scale = Array.isArray(obj?.transform?.scale) ? obj.transform.scale : [1, 1, 1];
    return [0, 1, 2].map((index) => {
      const value = Number(scale[index]);
      return Number.isFinite(value) && value !== 0 ? value : 1;
    });
  }

  function transformTimelineSelectionLabel(objectIds = []) {
    const objects = selectedObjects(model, objectIds);
    if (objects.length === 1) return scadObjectTypeLabel(objects[0].type);
    return String(objects.length) + " Objects";
  }

  function scaleFactorForGrab(state, event = null) {
    const delta = rawGrabDelta(state, event);
    const axis = state?.axisLock;
    const driver = axis === "x"
      ? delta.x
      : axis === "y" || axis === "z"
        ? delta.y
        : Math.abs(delta.x) >= Math.abs(delta.y)
          ? delta.x
          : delta.y;
    return Math.max(SCAD_MIN_SCALE_FACTOR, 1 + (numberOrZero(driver) * getGrabDirectionSign(state)) / SCAD_SCALE_DRAG_UNITS);
  }

  function scaleFactorsForGrab(state, event = null) {
    const factor = scaleFactorForGrab(state, event);
    if (state?.axisLock === "x") return [factor, 1, 1];
    if (state?.axisLock === "y") return [1, factor, 1];
    if (state?.axisLock === "z") return [1, 1, factor];
    return [factor, factor, factor];
  }

  function startGrabSelectedObjects(event = null) {
    const selected = selectedObjects(model, selectedIds).filter((obj) => isObjectEditable(model, obj));
    if (!selected.length) return false;
    grabState = {
      type: "objects",
      start: modelPointFromEventOrLast(event),
      axisLock: null,
      axisDirectionSign: 1,
      originals: selected.map((obj) => ({
        id: obj.id,
        translate: Array.isArray(obj.transform?.translate) ? [...obj.transform.translate] : [0, 0, 0],
      })),
    };
    setGrabInstructionStatus(grabState);
    return true;
  }

  function startScaleSelectedObjects(event = null, axisLock = null) {
    const selected = selectedObjects(model, selectedIds).filter((obj) => isObjectEditable(model, obj));
    if (!selected.length) {
      setStatus("Select one or more objects to scale.");
      return false;
    }
    grabState = {
      type: "scale",
      start: modelPointFromEventOrLast(event),
      axisLock: SCAD_ACTION_AXIS_TYPES.has(axisLock) ? axisLock : null,
      axisDirectionSign: 1,
      lastFactors: [1, 1, 1],
      originals: selected.map((obj) => ({
        id: obj.id,
        scale: objectScaleVector(obj),
      })),
    };
    setGrabInstructionStatus(grabState);
    return true;
  }

  function startGrabScadExtrusion(extrusion, event = null, type = "edgeExtrusion") {
    if (!extrusion) return false;
    grabState = { type, start: modelPointFromEventOrLast(event), axisLock: null, axisDirectionSign: 1, extrusion };
    setGrabInstructionStatus(grabState);
    return true;
  }

  function vertexExtrusionTarget(state, event = null) {
    const delta = constrainedGrabDelta(state, event);
    const source = state.source;
    return { x: source.x + delta.x, y: source.y + delta.y, z: source.z + delta.z };
  }

  function setGrabAxisLock(axis, event = null) {
    if (!grabState || !SCAD_ACTION_AXIS_TYPES.has(axis)) return false;
    if (grabState.axisLock === axis) {
      grabState.axisLock = null;
      grabState.axisDirectionSign = 1;
    } else {
      grabState.axisLock = axis;
      grabState.axisDirectionSign = 1;
    }
    updateGrab(event);
    setGrabInstructionStatus(grabState);
    return true;
  }

  function toggleGrabDirection(event = null) {
    if (!grabState) return false;
    grabState.axisDirectionSign = getGrabDirectionSign(grabState) < 0 ? 1 : -1;
    updateGrab(event);
    setGrabInstructionStatus(grabState);
    return true;
  }

  function createScadVertexExtrusion(source) {
    if (!source) return null;
    const z = numberOrZero(source.z);
    const newVertex = addObject(model, {
      type: "vertexPath",
      name: "Extruded Vertex",
      params: { points: [[source.x, source.y]], closed: false },
      transform: { translate: [0, 0, z] },
    }, { activeLayerId, timeline: false });
    const edge = addObject(model, {
      type: "vertexPath",
      name: "Extruded Edge",
      params: { points: [[source.x, source.y], [source.x, source.y]], closed: false },
      transform: { translate: [0, 0, z] },
    }, { activeLayerId, timeline: false });
    setSelection([newVertex.id, edge.id], [{ id: newVertex.id, pointIndex: 0 }]);
    return {
      source: { ...source },
      sourceId: source.id,
      newVertexId: newVertex.id,
      edgeId: edge.id,
      createdIds: [newVertex.id, edge.id],
      target: { ...source },
    };
  }

  function updateScadVertexExtrusion(state, event = null) {
    if (!state) return false;
    const target = vertexExtrusionTarget(state, event);
    state.target = { ...target };
    setVertexPathWorldPoints(objectById(state.newVertexId), [target], false);
    setVertexPathWorldPoints(objectById(state.edgeId), [state.source, target], false);
    return true;
  }

  function startGrabScadVertexExtrusion(event = null) {
    const vertices = selectedScadVertices();
    if (vertices.length !== 1) {
      setStatus("Select exactly one vertex to extrude.");
      return false;
    }
    const source = vertices[0];
    const extrusion = createScadVertexExtrusion(source);
    if (!extrusion) return false;
    grabState = {
      type: "vertexExtrusion",
      ...extrusion,
      start: modelPointFromEventOrLast(event),
      axisLock: null,
      axisDirectionSign: 1,
    };
    updateScadVertexExtrusion(grabState, event);
    setGrabInstructionStatus(grabState);
    refresh();
    return true;
  }

  function updateGrab(event) {
    if (!grabState) return false;
    const delta = constrainedGrabDelta(grabState, event);
    if (grabState.type === "vertexExtrusion") {
      updateScadVertexExtrusion(grabState, event);
    } else if (grabState.type === "edgeExtrusion") {
      updateScadEdgeExtrusion(grabState.extrusion, delta);
    } else if (grabState.type === "faceExtrusion") {
      updateScadFaceExtrusion(grabState.extrusion, delta);
    } else if (grabState.type === "scale") {
      const factors = scaleFactorsForGrab(grabState, event);
      grabState.lastFactors = [...factors];
      grabState.originals.forEach((entry) => {
        const obj = objectById(entry.id);
        if (!obj) return;
        obj.transform = {
          ...(obj.transform || {}),
          scale: [
            numberOrZero(entry.scale[0]) * factors[0],
            numberOrZero(entry.scale[1]) * factors[1],
            numberOrZero(entry.scale[2]) * factors[2],
          ],
        };
      });
    } else {
      grabState.originals.forEach((entry) => {
        const obj = objectById(entry.id);
        if (!obj) return;
        obj.transform = {
          ...(obj.transform || {}),
          translate: [
            numberOrZero(entry.translate[0]) + delta.x,
            numberOrZero(entry.translate[1]) + delta.y,
            numberOrZero(entry.translate[2]) + delta.z,
          ],
        };
      });
    }
    refresh();
    return true;
  }

  function finishGrab({ cancel = false } = {}) {
    if (!grabState) return false;
    const finished = grabState;
    grabState = null;
    if (cancel && finished.type === "objects") {
      finished.originals.forEach((entry) => {
        const obj = objectById(entry.id);
        if (!obj) return;
        obj.transform = { ...(obj.transform || {}), translate: [...entry.translate] };
      });
    } else if (cancel && finished.type === "scale") {
      finished.originals.forEach((entry) => {
        const obj = objectById(entry.id);
        if (!obj) return;
        obj.transform = { ...(obj.transform || {}), scale: [...entry.scale] };
      });
    } else if (cancel && finished.type === "vertexExtrusion") {
      (finished.createdIds || []).forEach((id) => removeObject(model, id, { timeline: false }));
      setSelection(finished.sourceId ? [finished.sourceId] : [], finished.source ? [finished.source] : []);
    } else if (cancel && (finished.type === "edgeExtrusion" || finished.type === "faceExtrusion")) {
      const createdIds = Array.isArray(finished.extrusion?.createdIds)
        ? finished.extrusion.createdIds
        : [finished.extrusion?.faceId, finished.extrusion?.sideAId, finished.extrusion?.sideBId, finished.extrusion?.newEdgeId].filter(Boolean);
      createdIds.forEach((id) => removeObject(model, id, { timeline: false }));
      setSelection([], []);
    } else if (finished.type === "vertexExtrusion") {
      setSelection(finished.newVertexId ? [finished.newVertexId] : [], finished.newVertexId ? [{ id: finished.newVertexId, pointIndex: 0 }] : []);
      addTimelineStep(model, {
        type: "extrude",
        objectIds: [finished.sourceId, finished.newVertexId, finished.edgeId].filter(Boolean),
        label: "Extrude Vertex",
        params: { operation: "extrude", axisLock: finished.axisLock || null, source: finished.source || null, target: finished.target || null },
      });
      markDirty();
    } else if (finished.type === "edgeExtrusion" || finished.type === "faceExtrusion") {
      const createdIds = Array.isArray(finished.extrusion?.createdIds) ? finished.extrusion.createdIds : [];
      addTimelineStep(model, {
        type: "extrude",
        objectIds: createdIds,
        label: finished.type === "faceExtrusion" ? "Extrude Face" : "Extrude Edge",
        params: { operation: "extrude", target: finished.type === "faceExtrusion" ? "face" : "edge" },
      });
      markDirty();
    } else if (finished.type === "scale") {
      const objectIds = finished.originals.map((entry) => entry.id).filter((id) => Boolean(objectById(id)));
      if (objectIds.length) {
        addTimelineStep(model, {
          type: "transform",
          objectIds,
          label: "Scale " + transformTimelineSelectionLabel(objectIds),
          params: { operation: "scale", factors: finished.lastFactors || [1, 1, 1], axisLock: finished.axisLock || null },
        });
      }
      markDirty();
    } else {
      markDirty();
    }
    setStatus(cancel ? "Grab canceled." : "Grab confirmed.");
    refresh();
    return true;
  }

  function extrudeSelectedScadEdge(event = null) {
    const faceObjectIds = selectedScadFaceObjectIds();
    if (faceObjectIds.length) {
      const h = Number(prompt("Extrusion height", "10"));
      if (!Number.isFinite(h) || h <= 0) return false;
      const changed = extrudeObjects(model, faceObjectIds, h);
      if (!changed.length) return alert("Select a 2D face object to extrude.");
      markDirty();
      setStatus("Extruded " + faceObjectIds.length + " face object(s).");
      refresh();
      return true;
    }

    const vertices = selectedScadVertices();
    if (vertices.length === 1) return startGrabScadVertexExtrusion(event);

    const edge = selectedScadEdge();
    if (edge) {
      const extrusion = createScadEdgeExtrusion(edge);
      return startGrabScadExtrusion(extrusion, event);
    }

    const face = selectedScadFace();
    if (face) {
      const extrusion = createScadFaceExtrusion(face);
      return startGrabScadExtrusion(extrusion, event, "faceExtrusion");
    }

    setStatus("Select one edge, two joined vertices, or a face first.");
    return false;
  }

  function fillOrConnectSelectedVertices() {
    const vertices = selectedScadVertices();
    if (vertices.length < 2) {
      setStatus("Select two or more vertices first.");
      return;
    }

    if (vertices.length === 2) {
      const [a, b] = vertices;
      const edge = addObject(model, {
        type: "vertexPath",
        name: "Edge",
        params: { points: [[a.x, a.y], [b.x, b.y]], closed: false },
        transform: { translate: [0, 0, a.z] },
      }, { activeLayerId });
      setSelection([edge.id], [{ id: edge.id, pointIndex: 0 }, { id: edge.id, pointIndex: 1 }]);
      markDirty();
      setStatus("Edge created.");
      refresh();
      return;
    }

    if (!scadVerticesAreCoplanar(vertices)) {
      setStatus("Selected vertices must be in the same plane.");
      return;
    }
    if (polygonArea(vertices) <= 1e-6) {
      setStatus("Selected vertices do not define a face.");
      return;
    }

    const z = vertices[0].z || 0;
    const face = addObject(model, {
      type: "polygon",
      name: "Face",
      params: { points: vertices.map((point) => [point.x, point.y]), closed: true },
      transform: { translate: [0, 0, z] },
    }, { activeLayerId });
    setSelection([face.id], []);
    markDirty();
    setStatus("Face created.");
    refresh();
  }

  function addShapeAt(tool, start, end = null) {
    const obj = addObject(model, shapeFromTool(tool, start, end), { activeLayerId });
    setSelection([obj.id], []);
    activeTool = "select";
    markDirty();
    refresh();
  }

  function markDirty() {
    window.NodevisionState = window.NodevisionState || {};
    window.NodevisionState.fileIsDirty = true;
    updateToolbarState({ fileIsDirty: true, currentMode: SCAD_MODE });
  }

  function refresh() {
    if (disposed) return;
    renderer?.renderModel(model);
    if (typeof renderer?.setSelectedIds === "function") renderer.setSelectedIds(selectedIds);
    else renderer?.setSelectedId(selectedIds[0] || null);
    renderer?.setSelectedFaceRefs?.(selectedFaceRefs);
    notifyScadLayersChanged();
    notifyScadSelectionChanged();
    window.NodevisionState.scadShapeSelected = selectedIds.length > 0;
    updateToolbarState({ currentMode: SCAD_MODE, scadShapeSelected: selectedIds.length > 0 });
    window.dispatchEvent(new CustomEvent("nv-scad-model-changed", { detail: { model, selectedIds, selectedFaceRefs } }));
  }

  function runExtrude() {
    if (!selectedIds.length) return alert("Select a shape to extrude.");
    const h = Number(prompt("Extrusion height", "10"));
    if (!Number.isFinite(h) || h <= 0) return;
    const changed = extrudeObjects(model, selectedIds, h);
    if (!changed.length) return alert("Select a 2D face object to extrude.");
    markDirty();
    refresh();
  }

  function runBoolean(type) {
    if (selectedIds.length < 2) return alert("Select at least two shapes for this operation.");
    const step = addBooleanOperation(model, type, selectedIds);
    if (!step) return alert("Choose union, difference, intersection, or cut out with at least two selected shapes.");
    setSelection(step.objectIds || selectedIds, []);
    const booleanHint = step.params?.operation === "difference" ? " First selected object is the base." : "";
    setStatus((step.label || "Boolean operation") + " added to CADtimeline." + booleanHint);
    markDirty();
    refresh();
  }

  function promptVector(label, defaults = [0, 0, 0]) {
    const raw = prompt(label, defaults.join(", "));
    if (raw === null) return null;
    const parts = String(raw).split(/[ ,]+/).filter(Boolean).map(Number);
    return [0, 1, 2].map((index) => Number.isFinite(parts[index]) ? parts[index] : defaults[index]);
  }

  function runTransform(type) {
    if (!selectedIds.length) return alert("Select a shape to transform.");
    if (type === "translate") {
      const delta = promptVector("Translate by X, Y, Z", [5, 0, 0]);
      if (!delta) return;
      translateObjects(model, selectedIds, delta);
    } else if (type === "rotate") {
      const delta = promptVector("Rotate by X, Y, Z degrees", [0, 0, 15]);
      if (!delta) return;
      rotateObjects(model, selectedIds, delta);
    } else if (type === "scale") {
      const factors = promptVector("Scale by X, Y, Z", [1.25, 1.25, 1.25]);
      if (!factors) return;
      scaleObjects(model, selectedIds, factors);
    }
    markDirty();
    refresh();
  }

  function runDuplicate() {
    const clones = duplicateObjects(model, selectedIds);
    if (clones.length) setSelection(clones, []);
    markDirty();
    refresh();
  }

  function runDelete() {
    if (!selectedIds.length) return;
    deleteObjects(model, selectedIds);
    setSelection([], []);
    markDirty();
    refresh();
  }

  const timelineActions = {
    selectStep(step) { setSelection((step.objectIds || []).filter((id) => model.objects.some((obj) => obj.id === id)), []); refresh(); },
    toggleStep(id, disabled) { setTimelineStepDisabled(model, id, disabled); markDirty(); refresh(); },
    renameStep(id, label) { renameTimelineStep(model, id, label); markDirty(); refresh(); },
    deleteStep(id) { deleteTimelineStep(model, id); markDirty(); refresh(); },
  };

  async function saveCurrent(path = scadPath) {
    if (model.unsupportedSource && !model.objects.length) {
      const ok = confirm("This SCAD file was not graphically importable. Saving graphical mode will replace it with generated Nodevision SCAD metadata. Continue?");
      if (!ok) return;
    }
    const content = serializeScadModel(model, { preserveUnsupportedSource: true });
    await saveText(path, content);
    window.NodevisionState.fileIsDirty = false;
    updateToolbarState({ fileIsDirty: false, currentMode: SCAD_MODE });
    setStatus(`Saved ${path}`);
  }

  async function exportSTL() {
    await exportScadCodeToSTL(serializeScadModel(model, { preserveUnsupportedSource: true }), scadPath);
  }

  function showCodeNotice() {
    if (typeof window.openCodeEditor === "function") {
      window.openCodeEditor(scadPath);
      return;
    }
    alert("Use View > Code Editing to edit this .scad file as text. Graphical mode saves valid SCAD with embedded Nodevision metadata.");
  }

  function handleToolbarAction(callbackKey) {
    const key = String(callbackKey || "");
    const insertMap = {
      scadInsertVertex: "vertex",
      scadInsertPolygon: "polygon",
      scadInsertCircle: "circle",
      scadInsertRectangle: "rectangle",
      scadInsertSquare: "square",
      scadInsertLine: "line",
      scadInsertText: "text",
      scadInsertSphere: "sphere",
      scadInsertCube: "cube",
      scadInsertCylinder: "cylinder",
      scadInsertPolyhedron: "polyhedron",
      scadInsertTriangle: "triangle",
    };
    if (insertMap[key]) return setTool(insertMap[key]);
    if (key === "scadSelectTool") return setTool("select");
    if (key === "scadExtrude") return runExtrude();
    if (key === "scadCutout") return runBoolean("cutout");
    if (key === "scadUnion") return runBoolean("union");
    if (key === "scadDifference") return runBoolean("difference");
    if (key === "scadIntersection") return runBoolean("intersection");
    if (key === "scadTranslate") return runTransform("translate");
    if (key === "scadRotate") return runTransform("rotate");
    if (key === "scadScale") return runTransform("scale");
    if (key === "scadRename") {
      const obj = selectedObjects(model, selectedIds)[0];
      if (!obj) return alert("Select a shape to rename.");
      const next = prompt("Shape name", obj.name || obj.type);
      if (next !== null) { renameObject(model, obj.id, next); markDirty(); refresh(); }
      return;
    }
    if (key === "scadDuplicate") return runDuplicate();
    if (key === "scadDelete") return runDelete();
    if (key === "scadSave") return saveCurrent();
    if (key === "ExportSelectedModelAsSTL" || key === "exportModelAsSTL") return exportSTL();
    if (key === "scadOpenCode") return showCodeNotice();
  }

  function handleEditorKeyDown(event) {
    if (disposed || window.GraphicalScadEditorContext?.handleToolbarAction !== handleToolbarAction) return;
    if (event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;
    const rawKey = String(event.key || "");
    const key = rawKey.toLowerCase();
    if (grabState && SCAD_ACTION_AXIS_TYPES.has(key)) {
      event.preventDefault();
      setGrabAxisLock(key, event);
      return;
    }
    if (grabState && (rawKey === "-" || rawKey === "=")) {
      event.preventDefault();
      toggleGrabDirection(event);
      return;
    }
    if (key === "escape" && grabState) {
      event.preventDefault();
      finishGrab({ cancel: true });
      return;
    }
    if (key === "enter" && grabState) {
      event.preventDefault();
      finishGrab();
      return;
    }
    if (grabState) {
      event.preventDefault();
      return;
    }
    if (key === "e") {
      event.preventDefault();
      extrudeSelectedScadEdge(event);
      return;
    }
    if (key === "g") {
      event.preventDefault();
      if (!grabState) startGrabSelectedObjects(event);
      return;
    }
    if (key === "s") {
      event.preventDefault();
      startScaleSelectedObjects(event);
      return;
    }
    if (key === "a") {
      event.preventDefault();
      selectAllObjects();
      return;
    }
    if (key === "f") {
      event.preventDefault();
      fillOrConnectSelectedVertices();
    }
  }

  previewMount.addEventListener("pointermove", (event) => {
    lastModelPoint = clientToModelPoint(event, previewMount);
    if (grabState) {
      event.preventDefault();
      updateGrab(event);
    }
  });

  previewMount.addEventListener("pointerdown", (event) => {
    previewMount.focus?.();
    lastModelPoint = clientToModelPoint(event, previewMount);
    if (grabState) {
      event.preventDefault();
      finishGrab();
      return;
    }
    if (activeTool === "select") return;
    dragStart = clientToModelPoint(event, previewMount);
  });

  previewMount.addEventListener("pointerup", (event) => {
    lastModelPoint = clientToModelPoint(event, previewMount);
    if (grabState) {
      event.preventDefault();
      finishGrab();
      return;
    }
    if (activeTool === "select" || !dragStart) return;
    const end = clientToModelPoint(event, previewMount);
    if (activeTool === "polygon") {
      polygonPoints.push(end);
      setStatus(`${polygonPoints.length} polygon point(s). Double-click to close.`);
      dragStart = null;
      return;
    }
    addShapeAt(activeTool, dragStart, end);
    dragStart = null;
  });

  previewMount.addEventListener("dblclick", () => {
    if (activeTool !== "polygon" || polygonPoints.length < 3) return;
    const obj = addObject(model, polygonFromPoints(polygonPoints), { activeLayerId });
    setSelection([obj.id], []);
    polygonPoints = [];
    activeTool = "select";
    markDirty();
    refresh();
  });

  renderer = await createScadSceneRenderer(previewMount);
  renderer.setPickHandler(selectObject);
  renderer.setBoxSelectHandler?.(selectObjects);

  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.currentMode = SCAD_MODE;
  window.NodevisionState.activePanelType = "GraphicalEditor";
  window.NodevisionState.selectedFile = scadPath;
  window.NodevisionState.activeEditorFilePath = scadPath;
  window.NodevisionState.activeActionHandler = handleToolbarAction;
  window.NodevisionState.scadShapeSelected = selectedIds.length > 0;
  const exportToken = Symbol("nv-scad-export-context");
  window.NodevisionModelExportContext = {
    token: exportToken,
    kind: "scad-editor",
    filePath: scadPath,
    exportSTL,
  };
  updateToolbarState({ currentMode: SCAD_MODE, selectedFile: scadPath, activeEditorFilePath: scadPath, activeActionHandler: handleToolbarAction, scadShapeSelected: false, modelCanExportSTL: true });
  window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
    detail: { heading: "SCAD Primitive", force: true, toggle: false },
  }));

  const scadController = {
    getModel: () => model,
    getSelectedIds: () => [...selectedIds],
    getActiveLayerId: () => activeLayerId,
    setActiveLayer,
    setTool,
    selectObject,
    selectAll: selectAllObjects,
    fillSelection: fillOrConnectSelectedVertices,
    markDirty,
    refresh,
    save: saveCurrent,
    exportSTL,
    serialize: () => serializeScadModel(model),
    handleToolbarAction,
    selectTimelineStep: timelineActions.selectStep,
    toggleTimelineStep: timelineActions.toggleStep,
    renameTimelineStep: timelineActions.renameStep,
    deleteTimelineStep: timelineActions.deleteStep,
  };

  window.GraphicalScadEditorContext = scadController;
  ensureScadLayersContext(scadController);
  window.addEventListener("keydown", handleEditorKeyDown, true);

  try {
    const editorCell = container?.closest?.(".panel-cell");
    if (editorCell) {
      await ensureScadEditorModeLayout({ editorCell });
    }
  } catch (err) {
    console.warn("SCAD editor: failed to apply SCAD editor mode layout:", err);
  }

  window.getEditorMarkdown = () => serializeScadModel(model);
  window.getEditorHTML = () => serializeScadModel(model);
  window.saveMDFile = async (path = scadPath) => saveCurrent(path);
  window.saveWYSIWYGFile = async (path = scadPath) => saveCurrent(path);

  refresh();

  return {
    destroy() {
      disposed = true;
      window.removeEventListener("keydown", handleEditorKeyDown, true);
      renderer?.dispose?.();
      clearScadLayersContext(scadController);
      if (window.NodevisionState?.activeActionHandler === handleToolbarAction) {
        window.NodevisionState.activeActionHandler = null;
        updateToolbarState({ activeActionHandler: null, scadShapeSelected: false });
      }
      if (window.NodevisionModelExportContext?.token === exportToken) {
        window.NodevisionModelExportContext = null;
        updateToolbarState({ modelCanExportSTL: false });
      }
      if (window.GraphicalScadEditorContext?.handleToolbarAction === handleToolbarAction) {
        window.GraphicalScadEditorContext = null;
      }
      container.innerHTML = "";
    },
  };
}
