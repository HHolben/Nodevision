import { parseKML, refreshKMLRecords } from "./KMLParser.mjs";
import { createKMLLayerTree } from "./KMLLayerTree.mjs";
import { createKMLMapRenderer } from "./KMLMapRenderer.mjs";
import { createKMLEditorTools } from "./KMLEditorTools.mjs";
import { createKMLPropertyPanel } from "./KMLPropertyPanel.mjs";
import {
  createPlacemark,
  deleteFeature,
  saveKMLFile,
  serializeKML,
  updateFeatureCoordinates,
  updateFeatureOption,
  updateFeatureStyleColor,
  updateFeatureText,
} from "./KMLSave.mjs";

function normalizeNotebookPath(path = "") {
  return String(path || "")
    .trim()
    .replace(/[?#].*$/, "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^Notebook\/+/i, "");
}

function notebookUrl(filePath) {
  return `/Notebook/${normalizeNotebookPath(filePath).split("/").map(encodeURIComponent).join("/")}`;
}

function showStatus(node, message, tone = "") {
  node.textContent = message;
  node.dataset.tone = tone;
}

function injectKMLStyles() {
  if (document.getElementById("nv-kml-editor-styles")) return;
  const style = document.createElement("style");
  style.id = "nv-kml-editor-styles";
  style.textContent = `
    .nv-kml-shell{display:grid;grid-template-columns:260px minmax(320px,1fr) 310px;grid-template-rows:auto 1fr auto;width:100%;height:100%;min-height:420px;background:#eef1f4;color:#1f2933;font:13px/1.4 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:hidden}
    .nv-kml-toolbar{grid-column:1/4;display:flex;gap:6px;align-items:center;padding:7px 8px;background:#202833;color:#fff;border-bottom:1px solid #111827;overflow:auto}
    .nv-kml-toolbar button{border:1px solid #526070;background:#334155;color:#fff;border-radius:4px;padding:5px 8px;font:12px system-ui;white-space:nowrap;cursor:pointer}
    .nv-kml-toolbar button:hover{background:#40516a}
    .nv-kml-toolbar button:disabled{opacity:.55;cursor:wait}
    .nv-kml-sidebar,.nv-kml-inspector{min-width:0;overflow:auto;background:#f8fafc;border-right:1px solid #c8d0da}
    .nv-kml-inspector{border-right:0;border-left:1px solid #c8d0da}
    .nv-kml-heading{padding:8px 10px;font-weight:700;border-bottom:1px solid #d6dde6;background:#edf2f7}
    .nv-kml-tree{padding:6px}
    .nv-kml-tree-row{display:grid;grid-template-columns:18px 42px minmax(0,1fr);align-items:center;gap:6px;width:100%;border:0;background:transparent;border-radius:4px;padding-top:5px;padding-bottom:5px;text-align:left;color:#1f2933;cursor:pointer}
    .nv-kml-tree-row:hover{background:#e6eef8}
    .nv-kml-tree-row.is-selected{background:#cfe3ff;box-shadow:inset 3px 0 0 #1d67d8}
    .nv-kml-type{font:700 10px/1 ui-monospace,SFMono-Regular,Consolas,monospace;color:#4b5563}
    .nv-kml-tree-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .nv-kml-map{min-width:0;min-height:0;position:relative}
    .nv-kml-map-inner{width:100%;height:100%;background:#d9e2ec}
    .nv-kml-properties{padding:10px;display:flex;flex-direction:column;gap:8px}
    .nv-kml-panel-title{font-weight:700;color:#111827;margin-top:3px}
    .nv-kml-field{display:flex;flex-direction:column;gap:3px}
    .nv-kml-field span{font-size:11px;text-transform:uppercase;color:#64748b;letter-spacing:.04em}
    .nv-kml-field input,.nv-kml-field textarea,.nv-kml-properties textarea{width:100%;box-sizing:border-box;border:1px solid #b8c2cf;border-radius:4px;background:#fff;color:#111827;padding:6px;font:12px/1.35 ui-monospace,SFMono-Regular,Consolas,monospace}
    .nv-kml-field textarea,.nv-kml-properties textarea{resize:vertical;min-height:42px}
    .nv-kml-status{grid-column:1/4;padding:5px 8px;background:#f8fafc;border-top:1px solid #c8d0da;color:#475569;font:12px ui-monospace,SFMono-Regular,Consolas,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .nv-kml-status[data-tone="error"]{color:#b42318;background:#fff1f0}
    .nv-kml-empty{padding:10px;color:#64748b}
    .nv-kml-todo{font-size:11px;color:#64748b;background:#eef2f7;border-radius:4px;padding:6px}
    .nv-kml-marker-icon span{display:block;border:2px solid #242424;border-radius:50%;box-shadow:0 1px 5px rgba(0,0,0,.45)}
    @media (max-width:900px){.nv-kml-shell{grid-template-columns:200px minmax(240px,1fr);grid-template-rows:auto minmax(260px,1fr) minmax(220px,38%) auto}.nv-kml-inspector{grid-column:1/3;border-left:0;border-top:1px solid #c8d0da}.nv-kml-toolbar,.nv-kml-status{grid-column:1/3}}
  `;
  document.head.appendChild(style);
}

export async function renderKMLEditor(filePath, container) {
  injectKMLStyles();
  const cleanPath = normalizeNotebookPath(filePath);
  container.innerHTML = "";

  const shell = document.createElement("div");
  shell.className = "nv-kml-shell";
  const toolbarNode = document.createElement("div");
  const sidebar = document.createElement("aside");
  sidebar.className = "nv-kml-sidebar";
  const mapWrap = document.createElement("main");
  mapWrap.className = "nv-kml-map";
  const inspector = document.createElement("aside");
  inspector.className = "nv-kml-inspector";
  const status = document.createElement("div");
  status.className = "nv-kml-status";

  const treeHeading = document.createElement("div");
  treeHeading.className = "nv-kml-heading";
  treeHeading.textContent = "KML Layers";
  const treeNode = document.createElement("div");
  sidebar.append(treeHeading, treeNode);

  const mapNode = document.createElement("div");
  mapNode.className = "nv-kml-map-inner";
  mapWrap.appendChild(mapNode);

  const inspectorHeading = document.createElement("div");
  inspectorHeading.className = "nv-kml-heading";
  inspectorHeading.textContent = "Properties";
  const propertiesNode = document.createElement("div");
  inspector.append(inspectorHeading, propertiesNode);

  shell.append(toolbarNode, sidebar, mapWrap, inspector, status);
  container.appendChild(shell);
  showStatus(status, `Loading ${cleanPath}...`);

  let state = null;
  let selectedId = null;
  let tree = null;
  let renderer = null;
  let properties = null;
  let tools = null;

  function selectedRecord() {
    return selectedId ? state?.recordsById.get(selectedId) : null;
  }

  function isDescendantOf(record, parentId) {
    let cursor = record;
    while (cursor?.parentId) {
      if (cursor.parentId === parentId) return true;
      cursor = state?.recordsById.get(cursor.parentId);
    }
    return false;
  }

  function selectRecord(record, fly = false) {
    if (!record) return;
    selectedId = record.id;
    tree?.setSelected(selectedId);
    renderer?.setSelected(selectedId);
    properties?.render(record);
    if (fly && record.geometry) renderer?.flyToRecord(record);
    showStatus(status, `Selected ${record.name || record.type}`);
  }

  function rerenderFromState({ preserveSelection = true, fit = false } = {}) {
    const previousId = preserveSelection ? selectedId : null;
    const visibilityById = new Map(state.treeRecords.map((record) => [record.id, record.visible]));
    state = refreshKMLRecords(state);
    state.treeRecords.forEach((record) => {
      if (visibilityById.has(record.id)) record.visible = visibilityById.get(record.id);
    });
    renderer?.render(state.features);
    tree?.render(state.treeRecords, previousId);
    const nextSelection = previousId ? state.recordsById.get(previousId) : null;
    selectedId = nextSelection?.id || null;
    properties?.render(nextSelection || null);
    renderer?.setSelected(selectedId);
    if (fit) renderer?.fitAll();
  }

  function handleCoordinates(record, coordinatesText) {
    try {
      updateFeatureCoordinates(state, record, coordinatesText);
      rerenderFromState();
      selectRecord(state.recordsById.get(record.id) || selectedRecord());
      showStatus(status, "Coordinates updated.");
    } catch (err) {
      showStatus(status, err.message, "error");
    }
  }

  async function save() {
    try {
      tools?.setBusy(true);
      await saveKMLFile(cleanPath, state);
      showStatus(status, `Saved ${cleanPath}`);
    } catch (err) {
      showStatus(status, `Save failed: ${err.message}`, "error");
    } finally {
      tools?.setBusy(false);
    }
  }

  const response = await fetch(notebookUrl(cleanPath), { cache: "no-store" });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  state = parseKML(await response.text());

  tree = createKMLLayerTree(treeNode, {
    onSelect: (record) => selectRecord(record, true),
    onToggle: (record, visible) => {
      const affected = state.treeRecords.filter((item) => item.id === record.id || isDescendantOf(item, record.id));
      affected.forEach((item) => {
        item.visible = visible;
        if (item.geometry) renderer?.setRecordVisible(item, visible);
      });
      tree?.render(state.treeRecords, selectedId);
      showStatus(status, (visible ? "Showing " : "Hiding ") + record.name);
    },
  });

  properties = createKMLPropertyPanel(propertiesNode, {
    onTextChange: (record, patch) => {
      updateFeatureText(state, record, patch);
      rerenderFromState();
      selectRecord(state.recordsById.get(record.id) || selectedRecord());
      showStatus(status, "Feature text updated.");
    },
    onCoordinatesChange: handleCoordinates,
    onOptionChange: (record, key, value) => {
      updateFeatureOption(state, record, key, value);
      rerenderFromState();
      showStatus(status, `${key} updated.`);
    },
    onStyleChange: (record, value) => {
      updateFeatureStyleColor(state, record, value);
      rerenderFromState();
      showStatus(status, "Style color updated.");
    },
  });

  renderer = await createKMLMapRenderer(mapNode, {
    onSelect: (record) => selectRecord(record, false),
    onGeometryChange: (record, coords) => {
      handleCoordinates(record, coords.map((coord) => `${coord.lon},${coord.lat}${coord.alt !== null ? `,${coord.alt}` : ""}`).join(" "));
    },
  });

  tools = createKMLEditorTools(toolbarNode, {
    addPlacemark: () => {
      showStatus(status, "Click the map to place a placemark.");
      renderer.startAddPlacemark((coordinates) => {
        createPlacemark(state, { geometryType: "Point", coordinates, name: "New Placemark" });
        rerenderFromState({ preserveSelection: false });
        const added = state.features[state.features.length - 1];
        if (added) selectRecord(added, true);
      });
    },
    drawPath: () => {
      showStatus(status, "Click the map to draw a path. Double-click to finish.");
      renderer.startDrawPath((coordinates) => {
        if (coordinates.length < 2) {
          showStatus(status, "A path needs at least two points.", "error");
          return;
        }
        createPlacemark(state, { geometryType: "LineString", coordinates, name: "New Path" });
        rerenderFromState({ preserveSelection: false });
        const added = state.features[state.features.length - 1];
        if (added) selectRecord(added, true);
      });
    },
    drawPolygon: () => {
      showStatus(status, "Click the map to draw a polygon. Double-click to finish.");
      renderer.startDrawPolygon((coordinates) => {
        if (coordinates.length < 3) {
          showStatus(status, "A polygon needs at least three points.", "error");
          return;
        }
        createPlacemark(state, { geometryType: "Polygon", coordinates, name: "New Polygon" });
        rerenderFromState({ preserveSelection: false });
        const added = state.features[state.features.length - 1];
        if (added) selectRecord(added, true);
      });
    },
    editSelected: () => {
      const record = selectedRecord();
      if (!record) {
        showStatus(status, "Select a feature first.", "error");
        return;
      }
      const editable = renderer.editRecord(record);
      showStatus(status, editable ? "Editing selected feature vertices." : "Selected feature is not graphically editable.", editable ? "" : "error");
    },
    deleteSelected: () => {
      const record = selectedRecord();
      if (!record?.geometry) {
        showStatus(status, "Select a feature to delete.", "error");
        return;
      }
      deleteFeature(record);
      selectedId = null;
      rerenderFromState({ preserveSelection: false });
      showStatus(status, "Feature deleted. Save KML to persist.");
    },
    fit: () => renderer.fitAll(),
    save,
    viewXml: () => {
      const record = selectedRecord();
      if (!record) {
        showStatus(status, "Select a feature to view XML.", "error");
        return;
      }
      properties.render(record);
      showStatus(status, "Selected feature XML is visible in the properties panel.");
    },
  });

  renderer.render(state.features);
  tree.render(state.treeRecords, selectedId);
  properties.render(null);
  renderer.fitAll();
  showStatus(status, `Loaded ${state.features.length} editable KML feature${state.features.length === 1 ? "" : "s"}.`);

  window.saveCurrentFile = save;
  window.currentSaveKML = save;
  window.getCurrentKMLXML = () => serializeKML(state);

  return {
    state,
    save,
    destroy: () => renderer?.destroy(),
  };
}
