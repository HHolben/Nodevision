// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalScadEditor.mjs
// Graphical parametric OpenSCAD editor for .scad files.

import { updateToolbarState } from "/panels/createToolbar.mjs";
import { fetchText, resetEditorHooks, saveText } from "./GraphicalEditors/FamilyEditorCommon.mjs";
import { parseScadText } from "/ScadEditor/ScadParser.mjs";
import { serializeScadModel } from "/ScadEditor/ScadSerializer.mjs";
import { addObject, addLayer as modelAddLayer, deleteLayer as modelDeleteLayer, moveObjectToLayer, reorderLayer as modelReorderLayer, setLayerLocked, setLayerVisibility, renameTimelineStep, setTimelineStepDisabled, deleteTimelineStep, updateObject, isObjectEditable } from "/ScadEditor/ScadModel.mjs";
import { shapeFromTool, polygonFromPoints } from "/ScadEditor/ScadShapeTools.mjs";
import { addBooleanOperation, deleteObjects, duplicateObjects, extrudeObjects, renameObject } from "/ScadEditor/ScadOperations.mjs";
import { createScadSceneRenderer } from "/ScadEditor/ScadSceneRenderer.mjs";
import { renderScadTimelinePanel } from "./ScadTimelinePanel.mjs";
import { renderScadLayersPanel } from "./ScadLayersPanel.mjs";

const SCAD_MODE = "SCADediting";

function normalizePath(path = "") {
  return String(path || "").trim().replace(/\\/g, "/").replace(/[?#].*$/, "").replace(/^\/+/, "").replace(/^Notebook\//i, "");
}

function button(label, onClick, title = "") {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  btn.title = title || label;
  Object.assign(btn.style, {
    font: "12px/1 system-ui, sans-serif",
    padding: "7px 9px",
    border: "1px solid #cfd7e3",
    borderRadius: "6px",
    background: "#fff",
    color: "#172033",
    cursor: "pointer",
  });
  btn.addEventListener("click", onClick);
  return btn;
}

function labeledInput(label, value, onChange, attrs = {}) {
  const wrap = document.createElement("label");
  Object.assign(wrap.style, { display: "grid", gap: "4px", font: "11px/1.25 system-ui,sans-serif", color: "#4b5563" });
  const span = document.createElement("span");
  span.textContent = label;
  const input = document.createElement("input");
  input.value = value ?? "";
  Object.assign(input, attrs);
  Object.assign(input.style, { minWidth: "0", padding: "6px", border: "1px solid #cfd7e3", borderRadius: "5px", font: "12px/1.2 system-ui,sans-serif" });
  input.addEventListener("change", () => onChange(input.value));
  wrap.append(span, input);
  return wrap;
}

function selectedObjects(model, ids) {
  const set = new Set(ids || []);
  return model.objects.filter((obj) => set.has(obj.id));
}

function vecInput(label, values, onChange) {
  const wrap = document.createElement("div");
  Object.assign(wrap.style, { display: "grid", gap: "4px", font: "11px/1.25 system-ui,sans-serif", color: "#4b5563" });
  const span = document.createElement("span");
  span.textContent = label;
  const row = document.createElement("div");
  Object.assign(row.style, { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px" });
  [0, 1, 2].forEach((i) => {
    const input = document.createElement("input");
    input.type = "number";
    input.step = "0.1";
    input.value = Number(values?.[i] ?? (label === "Scale" ? 1 : 0));
    Object.assign(input.style, { minWidth: "0", padding: "5px", border: "1px solid #cfd7e3", borderRadius: "5px" });
    input.addEventListener("change", () => {
      const next = [0, 1, 2].map((idx) => Number(row.children[idx].value || (label === "Scale" ? 1 : 0)));
      onChange(next);
    });
    row.appendChild(input);
  });
  wrap.append(span, row);
  return wrap;
}

function clientToModelPoint(event, element) {
  const rect = element.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 100;
  const y = (0.5 - (event.clientY - rect.top) / Math.max(1, rect.height)) * 100;
  return [Number(x.toFixed(2)), Number(y.toFixed(2))];
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

  const header = document.createElement("div");
  Object.assign(header.style, { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "8px 10px", borderBottom: "1px solid #d6dce5", background: "#fff" });
  const title = document.createElement("div");
  title.textContent = `Graphical SCAD - ${scadPath || "untitled.scad"}`;
  Object.assign(title.style, { font: "600 13px/1.3 system-ui,sans-serif", color: "#111827" });
  const headerActions = document.createElement("div");
  Object.assign(headerActions.style, { display: "flex", gap: "6px", flexWrap: "wrap" });
  headerActions.append(
    button("Select", () => setTool("select")),
    button("Circle", () => setTool("circle")),
    button("Rectangle", () => setTool("rectangle")),
    button("Triangle", () => setTool("triangle")),
    button("Polygon", () => setTool("polygon")),
    button("Save SCAD", () => saveCurrent()),
    button("Code SCAD", () => showCodeNotice()),
  );
  header.append(title, headerActions);
  shell.appendChild(header);

  const notice = document.createElement("div");
  Object.assign(notice.style, { display: parseResult.warnings?.length ? "block" : "none", padding: "8px 10px", borderBottom: "1px solid #f2d39b", background: "#fff7e6", color: "#7c4a03", font: "12px/1.35 system-ui,sans-serif" });
  notice.textContent = parseResult.warnings?.[0] || "";
  shell.appendChild(notice);

  const main = document.createElement("div");
  Object.assign(main.style, { display: "grid", gridTemplateColumns: "minmax(420px,1fr) 280px 270px", flex: "1", minHeight: "0" });
  shell.appendChild(main);

  const center = document.createElement("div");
  Object.assign(center.style, { display: "flex", flexDirection: "column", minWidth: "0", minHeight: "0" });
  const previewMount = document.createElement("div");
  Object.assign(previewMount.style, { flex: "1", minHeight: "0", position: "relative", overflow: "hidden", background: "#f7f8fb" });
  const status = document.createElement("div");
  Object.assign(status.style, { padding: "6px 10px", font: "12px/1.3 system-ui,sans-serif", color: "#4b5563", borderTop: "1px solid #d6dce5", background: "#fff" });
  status.textContent = "Select or insert a SCAD primitive.";
  center.append(previewMount, status);

  const inspector = document.createElement("div");
  Object.assign(inspector.style, { borderLeft: "1px solid #d6dce5", background: "#fff", overflow: "auto", padding: "10px", display: "flex", flexDirection: "column", gap: "10px" });
  const layersMount = document.createElement("div");
  main.append(center, inspector, layersMount);

  const timelineMount = document.createElement("div");
  shell.appendChild(timelineMount);

  function setStatus(text) {
    status.textContent = text;
  }

  function setTool(tool) {
    activeTool = tool;
    polygonPoints = [];
    setStatus(tool === "polygon" ? "Click points to build a polygon. Double-click to close it." : `Tool: ${tool}`);
  }

  function selectObject(id, event = null) {
    const obj = model.objects.find((item) => item.id === id);
    if (!obj || !isObjectEditable(model, obj)) return;
    if (event?.ctrlKey || event?.metaKey) {
      selectedIds = selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id];
    } else {
      selectedIds = [id];
    }
    renderer?.setSelectedId(selectedIds[0] || null);
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
    renderer?.setSelectedId(selectedIds[0] || null);
    renderInspector();
    renderScadLayersPanel(layersMount, { model, selectedIds, activeLayerId }, layerActions);
    renderScadTimelinePanel(timelineMount, { model, selectedIds }, timelineActions);
    window.NodevisionState.scadShapeSelected = selectedIds.length > 0;
    updateToolbarState({ currentMode: SCAD_MODE, scadShapeSelected: selectedIds.length > 0 });
    window.dispatchEvent(new CustomEvent("nv-scad-model-changed", { detail: { model, selectedIds } }));
  }

  function renderInspector() {
    inspector.innerHTML = "";
    const heading = document.createElement("div");
    heading.textContent = "Shape";
    Object.assign(heading.style, { font: "600 13px/1.3 system-ui,sans-serif", color: "#111827" });
    inspector.appendChild(heading);

    const selected = selectedObjects(model, selectedIds);
    if (!selected.length) {
      const empty = document.createElement("div");
      empty.textContent = "No shape selected.";
      Object.assign(empty.style, { font: "12px/1.35 system-ui,sans-serif", color: "#6b7280" });
      inspector.appendChild(empty);
      inspector.appendChild(button("Add Layer", () => { const layer = modelAddLayer(model); activeLayerId = layer.id; markDirty(); refresh(); }));
      appendScadOutput();
      return;
    }

    if (selected.length > 1) {
      const info = document.createElement("div");
      info.textContent = `${selected.length} shapes selected`;
      Object.assign(info.style, { font: "12px/1.35 system-ui,sans-serif", color: "#374151" });
      inspector.appendChild(info);
      inspector.append(button("Union", () => runBoolean("union")), button("Difference", () => runBoolean("difference")), button("Intersection", () => runBoolean("intersection")), button("Cut out", () => runBoolean("cutout")), button("Duplicate", () => runDuplicate()), button("Delete", () => runDelete()));
      appendScadOutput();
      return;
    }

    const obj = selected[0];
    inspector.appendChild(labeledInput("Name", obj.name, (value) => { renameObject(model, obj.id, value); markDirty(); refresh(); }));
    inspector.appendChild(vecInput("Translate", obj.transform.translate, (value) => { updateObject(model, obj.id, { transform: { translate: value } }); markDirty(); refresh(); }));
    inspector.appendChild(vecInput("Rotate", obj.transform.rotate, (value) => { updateObject(model, obj.id, { transform: { rotate: value } }); markDirty(); refresh(); }));
    inspector.appendChild(vecInput("Scale", obj.transform.scale, (value) => { updateObject(model, obj.id, { transform: { scale: value } }); markDirty(); refresh(); }));

    if (obj.type === "circle") inspector.appendChild(labeledInput("Radius", obj.params.radius, (value) => { updateObject(model, obj.id, { params: { radius: Number(value) || 1 } }); markDirty(); refresh(); }, { type: "number", step: "0.1" }));
    if (obj.type === "rectangle") {
      inspector.appendChild(labeledInput("Width", obj.params.width, (value) => { updateObject(model, obj.id, { params: { width: Number(value) || 1 } }); markDirty(); refresh(); }, { type: "number", step: "0.1" }));
      inspector.appendChild(labeledInput("Height", obj.params.height, (value) => { updateObject(model, obj.id, { params: { height: Number(value) || 1 } }); markDirty(); refresh(); }, { type: "number", step: "0.1" }));
    }
    if (["triangle", "polygon", "vertexPath"].includes(obj.type)) {
      inspector.appendChild(labeledInput("Vertices JSON", JSON.stringify(obj.params.points || []), (value) => {
        try { updateObject(model, obj.id, { params: { points: JSON.parse(value) } }); markDirty(); refresh(); }
        catch (err) { alert(`Invalid vertices JSON: ${err?.message || err}`); }
      }));
    }

    const extrude = (obj.operations || []).find((op) => op.type === "extrude");
    inspector.appendChild(labeledInput("Extrusion height", extrude?.params?.height || "", (value) => { extrudeObjects(model, [obj.id], Number(value) || 1); markDirty(); refresh(); }, { type: "number", step: "0.1", placeholder: "none" }));
    inspector.append(button("Extrude", () => runExtrude()), button("Duplicate", () => runDuplicate()), button("Delete", () => runDelete()));
    appendScadOutput();
  }

  function appendScadOutput() {
    const label = document.createElement("div");
    label.textContent = "Generated SCAD";
    Object.assign(label.style, { font: "600 12px/1.3 system-ui,sans-serif", color: "#111827", marginTop: "6px" });
    const pre = document.createElement("pre");
    pre.textContent = serializeScadModel(model).split("*/").slice(1).join("*/").trim();
    Object.assign(pre.style, { margin: "0", padding: "8px", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: "6px", overflow: "auto", maxHeight: "220px", font: "11px/1.35 ui-monospace,monospace", whiteSpace: "pre-wrap" });
    inspector.append(label, pre);
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

  const layerActions = {
    addLayer() { const layer = modelAddLayer(model); activeLayerId = layer.id; markDirty(); refresh(); },
    setActiveLayer(id) { activeLayerId = id; refresh(); },
    renameLayer(id, name) { const layer = model.layers.find((item) => item.id === id); if (layer) layer.name = name || layer.name; markDirty(); refresh(); },
    deleteLayer(id) { if (modelDeleteLayer(model, id)) { activeLayerId = model.layers[0]?.id || null; markDirty(); refresh(); } },
    reorderLayer(id, direction) { if (modelReorderLayer(model, id, direction)) { markDirty(); refresh(); } },
    toggleLayerVisible(id) { const layer = model.layers.find((item) => item.id === id); if (layer && setLayerVisibility(model, id, !layer.visible)) { markDirty(); refresh(); } },
    toggleLayerLocked(id) { const layer = model.layers.find((item) => item.id === id); if (layer && setLayerLocked(model, id, !layer.locked)) { markDirty(); refresh(); } },
    selectObject,
    moveSelectionToLayer(id) { selectedIds.forEach((objId) => moveObjectToLayer(model, objId, id)); markDirty(); refresh(); },
  };

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
    if (key === "scadTranslate") return setStatus("Edit Translate values in the Shape inspector.");
    if (key === "scadRotate") return setStatus("Edit Rotate values in the Shape inspector.");
    if (key === "scadScale") return setStatus("Edit Scale values in the Shape inspector.");
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
  }

  previewMount.addEventListener("pointerdown", (event) => {
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

  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.currentMode = SCAD_MODE;
  window.NodevisionState.activePanelType = "GraphicalEditor";
  window.NodevisionState.selectedFile = scadPath;
  window.NodevisionState.activeEditorFilePath = scadPath;
  window.NodevisionState.activeActionHandler = handleToolbarAction;
  window.NodevisionState.scadShapeSelected = selectedIds.length > 0;
  updateToolbarState({ currentMode: SCAD_MODE, selectedFile: scadPath, activeEditorFilePath: scadPath, activeActionHandler: handleToolbarAction, scadShapeSelected: false });

  window.GraphicalScadEditorContext = {
    getModel: () => model,
    getSelectedIds: () => [...selectedIds],
    setTool,
    selectObject,
    save: saveCurrent,
    serialize: () => serializeScadModel(model),
    handleToolbarAction,
  };

  window.getEditorMarkdown = () => serializeScadModel(model);
  window.getEditorHTML = () => serializeScadModel(model);
  window.saveMDFile = async (path = scadPath) => saveCurrent(path);
  window.saveWYSIWYGFile = async (path = scadPath) => saveCurrent(path);

  refresh();

  return {
    destroy() {
      disposed = true;
      renderer?.dispose?.();
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
