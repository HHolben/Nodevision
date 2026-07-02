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
    if (key === "scadOpenCode") return showCodeNotice();
  }

  function handleEditorKeyDown(event) {
    if (disposed || window.GraphicalScadEditorContext?.handleToolbarAction !== handleToolbarAction) return;
    if (event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;
    const key = String(event.key || "").toLowerCase();
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

  previewMount.addEventListener("pointerdown", (event) => {
    previewMount.focus?.();
    if (activeTool === "select") return;
    dragStart = clientToModelPoint(event, previewMount);
  });

  previewMount.addEventListener("pointerup", (event) => {
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
  updateToolbarState({ currentMode: SCAD_MODE, selectedFile: scadPath, activeEditorFilePath: scadPath, activeActionHandler: handleToolbarAction, scadShapeSelected: false });
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
      if (window.GraphicalScadEditorContext?.handleToolbarAction === handleToolbarAction) {
        window.GraphicalScadEditorContext = null;
      }
      container.innerHTML = "";
    },
  };
}
