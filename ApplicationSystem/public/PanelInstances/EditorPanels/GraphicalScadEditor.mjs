// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalScadEditor.mjs
// Graphical parametric OpenSCAD editor for .scad files.

import { updateToolbarState } from "/panels/createToolbar.mjs";
import { ensureScadEditorModeLayout } from "/panels/workspace.mjs";
import { fetchText, resetEditorHooks, saveText } from "./GraphicalEditors/FamilyEditorCommon.mjs";
import { parseScadText } from "/ScadEditor/ScadParser.mjs";
import { serializeScadModel } from "/ScadEditor/ScadSerializer.mjs";
import { addObject, renameTimelineStep, setTimelineStepDisabled, deleteTimelineStep, isObjectEditable } from "/ScadEditor/ScadModel.mjs";
import { shapeFromTool, polygonFromPoints } from "/ScadEditor/ScadShapeTools.mjs";
import { addBooleanOperation, deleteObjects, duplicateObjects, extrudeObjects, renameObject } from "/ScadEditor/ScadOperations.mjs";
import { createScadSceneRenderer } from "/ScadEditor/ScadSceneRenderer.mjs";
import { exportScadCodeToSTL } from "/ModelExport/STLExport.mjs";
import { clearScadLayersContext, ensureScadLayersContext, notifyScadLayersChanged, notifyScadSelectionChanged } from "/ScadEditor/ScadLayerPanelContext.mjs";

const SCAD_MODE = "SCADediting";

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
  if (obj?.type !== "vertexPath") return null;
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
  if (obj?.type !== "vertexPath") return [];
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
  if (obj.type === "vertexPath") return scadVertexPathWorldPoints(obj);
  if (obj.type !== "polygon" && obj.type !== "triangle") return [];
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

  function selectObject(id, event = null) {
    const obj = model.objects.find((item) => item.id === id);
    if (!obj || !isObjectEditable(model, obj)) return;
    if (event?.shiftKey || event?.ctrlKey || event?.metaKey) {
      selectedIds = selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id];
    } else {
      selectedIds = [id];
    }
    renderer?.setSelectedId(selectedIds[0] || null);
    refresh();
  }

  function selectObjects(ids = [], event = null) {
    const editable = ids.filter((id) => {
      const obj = model.objects.find((item) => item.id === id);
      return obj && isObjectEditable(model, obj);
    });
    if (event?.shiftKey || event?.ctrlKey || event?.metaKey) {
      const next = new Set(selectedIds);
      editable.forEach((id) => next.add(id));
      selectedIds = [...next];
    } else {
      selectedIds = editable;
    }
    refresh();
  }

  function selectAllObjects() {
    const ids = model.objects
      .filter((obj) => isObjectEditable(model, obj))
      .map((obj) => obj.id);
    selectedIds = ids;
    renderer?.setSelectedIds?.(selectedIds);
    setStatus(ids.length ? "Selected " + ids.length + " object(s)." : "No editable objects to select.");
    refresh();
  }

  function selectedScadVertices() {
    const selected = selectedObjects(model, selectedIds);
    return selected.map(scadVertexWorldPoint).filter(Boolean);
  }

  function selectedScadEdge() {
    const selected = selectedObjects(model, selectedIds);
    if (selected.length === 1 && selected[0]?.type === "vertexPath") {
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
      points: points.map((point) => [numberOrZero(point.x), numberOrZero(point.y)]),
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
    const a2 = pointWithDelta(extrusion.startA2, delta);
    const b2 = pointWithDelta(extrusion.startB2, delta);
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
    }, { activeLayerId });
    const sideA = addObject(model, {
      type: "vertexPath",
      name: "Extruded Side",
      params: { points: [[edge.a.x, edge.a.y], [a2.x, a2.y]], closed: false },
      transform: { translate: [0, 0, z] },
    }, { activeLayerId });
    const sideB = addObject(model, {
      type: "vertexPath",
      name: "Extruded Side",
      params: { points: [[edge.b.x, edge.b.y], [b2.x, b2.y]], closed: false },
      transform: { translate: [0, 0, z] },
    }, { activeLayerId });
    const newEdge = addObject(model, {
      type: "vertexPath",
      name: "Extruded Edge",
      params: { points: [[a2.x, a2.y], [b2.x, b2.y]], closed: false },
      transform: { translate: [0, 0, z] },
    }, { activeLayerId });

    selectedIds = [newEdge.id];
    markDirty();
    refresh();
    return {
      sourceA: { ...edge.a },
      sourceB: { ...edge.b },
      startA2: { ...a2 },
      startB2: { ...b2 },
      faceId: face.id,
      sideAId: sideA.id,
      sideBId: sideB.id,
      newEdgeId: newEdge.id,
      createdIds: [face.id, sideA.id, sideB.id, newEdge.id],
    };
  }

  function selectedScadFace() {
    const selected = selectedObjects(model, selectedIds);
    if (selected.length === 1 && (selected[0].type === "polygon" || selected[0].type === "triangle")) {
      const points = scadShapeWorldPoints(selected[0]);
      if (points.length >= 3 && scadVerticesAreCoplanar(points) && polygonArea(points) > 1e-6) return { points };
    }

    const vertices = selected.map(scadVertexWorldPoint).filter(Boolean);
    if (vertices.length >= 3 && vertices.length === selected.length && scadVerticesAreCoplanar(vertices) && polygonArea(vertices) > 1e-6) {
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
    const copies = extrusion.startCopies.map((point) => pointWithDelta(point, delta));
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
    }, { activeLayerId });

    const sideFaceIds = [];
    const sideEdgeIds = [];
    for (let i = 0; i < points.length; i += 1) {
      const next = (i + 1) % points.length;
      const sideFace = addObject(model, {
        type: "polygon",
        name: "Extruded Side Face",
        params: { points: [[points[i].x, points[i].y], [points[next].x, points[next].y], [copies[next].x, copies[next].y], [copies[i].x, copies[i].y]], closed: true },
        transform: { translate: [0, 0, z] },
      }, { activeLayerId });
      sideFaceIds.push(sideFace.id);

      const sideEdge = addObject(model, {
        type: "vertexPath",
        name: "Extruded Side Edge",
        params: { points: [[points[i].x, points[i].y], [copies[i].x, copies[i].y]], closed: false },
        transform: { translate: [0, 0, z] },
      }, { activeLayerId });
      sideEdgeIds.push(sideEdge.id);
    }

    selectedIds = [copyFace.id];
    markDirty();
    refresh();
    return {
      sourcePoints: points.map((point) => ({ ...point })),
      startCopies: copies.map((point) => ({ ...point })),
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

  function startGrabSelectedObjects(event = null) {
    const selected = selectedObjects(model, selectedIds).filter((obj) => isObjectEditable(model, obj));
    if (!selected.length) return false;
    grabState = {
      type: "objects",
      start: modelPointFromEventOrLast(event),
      originals: selected.map((obj) => ({
        id: obj.id,
        translate: Array.isArray(obj.transform?.translate) ? [...obj.transform.translate] : [0, 0, 0],
      })),
    };
    setStatus("Grab: move mouse, click/Enter to confirm, Esc to cancel.");
    return true;
  }

  function startGrabScadExtrusion(extrusion, event = null, type = "edgeExtrusion") {
    if (!extrusion) return false;
    grabState = { type, start: modelPointFromEventOrLast(event), extrusion };
    setStatus((type === "faceExtrusion" ? "Face" : "Edge") + " extruded. Move mouse, click/Enter to confirm, Esc to cancel.");
    return true;
  }

  function updateGrab(event) {
    if (!grabState) return false;
    const point = modelPointFromEventOrLast(event);
    const delta = { x: point[0] - grabState.start[0], y: point[1] - grabState.start[1], z: 0 };
    if (grabState.type === "edgeExtrusion") {
      updateScadEdgeExtrusion(grabState.extrusion, delta);
    } else if (grabState.type === "faceExtrusion") {
      updateScadFaceExtrusion(grabState.extrusion, delta);
    } else {
      grabState.originals.forEach((entry) => {
        const obj = objectById(entry.id);
        if (!obj) return;
        obj.transform = {
          ...(obj.transform || {}),
          translate: [numberOrZero(entry.translate[0]) + delta.x, numberOrZero(entry.translate[1]) + delta.y, numberOrZero(entry.translate[2])],
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
    } else if (cancel && (finished.type === "edgeExtrusion" || finished.type === "faceExtrusion")) {
      const createdIds = Array.isArray(finished.extrusion?.createdIds)
        ? finished.extrusion.createdIds
        : [finished.extrusion?.faceId, finished.extrusion?.sideAId, finished.extrusion?.sideBId, finished.extrusion?.newEdgeId].filter(Boolean);
      deleteObjects(model, createdIds);
      selectedIds = [];
    } else {
      markDirty();
    }
    setStatus(cancel ? "Grab canceled." : "Grab confirmed.");
    refresh();
    return true;
  }

  function extrudeSelectedScadEdge(event = null) {
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
    if (selectedIds.length < 2) {
      setStatus("Select two or more vertices first.");
      return;
    }
    const vertices = selectedScadVertices();
    if (vertices.length !== selectedIds.length) {
      setStatus("F works on selected vertex objects only.");
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
      selectedIds = [edge.id];
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
    selectedIds = [face.id];
    markDirty();
    setStatus("Face created.");
    refresh();
  }

  function addShapeAt(tool, start, end = null) {
    const obj = addObject(model, shapeFromTool(tool, start, end), { activeLayerId });
    selectedIds = [obj.id];
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
    notifyScadLayersChanged();
    notifyScadSelectionChanged();
    window.NodevisionState.scadShapeSelected = selectedIds.length > 0;
    updateToolbarState({ currentMode: SCAD_MODE, scadShapeSelected: selectedIds.length > 0 });
    window.dispatchEvent(new CustomEvent("nv-scad-model-changed", { detail: { model, selectedIds } }));
  }

  function runExtrude() {
    if (!selectedIds.length) return alert("Select a shape to extrude.");
    const h = Number(prompt("Extrusion height", "10"));
    if (!Number.isFinite(h) || h <= 0) return;
    extrudeObjects(model, selectedIds, h);
    markDirty();
    refresh();
  }

  function runBoolean(type) {
    if (selectedIds.length < 2) return alert("Select at least two shapes for this operation.");
    addBooleanOperation(model, type, selectedIds);
    markDirty();
    refresh();
  }

  function runDuplicate() {
    const clones = duplicateObjects(model, selectedIds);
    if (clones.length) selectedIds = clones;
    markDirty();
    refresh();
  }

  function runDelete() {
    if (!selectedIds.length) return;
    deleteObjects(model, selectedIds);
    selectedIds = [];
    markDirty();
    refresh();
  }

  const timelineActions = {
    selectStep(step) { selectedIds = (step.objectIds || []).filter((id) => model.objects.some((obj) => obj.id === id)); refresh(); },
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
      scadInsertTriangle: "triangle",
    };
    if (insertMap[key]) return setTool(insertMap[key]);
    if (key === "scadSelectTool") return setTool("select");
    if (key === "scadExtrude") return runExtrude();
    if (key === "scadCutout") return runBoolean("cutout");
    if (key === "scadUnion") return runBoolean("union");
    if (key === "scadDifference") return runBoolean("difference");
    if (key === "scadIntersection") return runBoolean("intersection");
    if (key === "scadTranslate") return setStatus("Select a shape, then edit translation from the SCAD properties controls.");
    if (key === "scadRotate") return setStatus("Select a shape, then edit rotation from the SCAD properties controls.");
    if (key === "scadScale") return setStatus("Select a shape, then edit scale from the SCAD properties controls.");
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
    const key = String(event.key || "").toLowerCase();
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
    selectedIds = [obj.id];
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
