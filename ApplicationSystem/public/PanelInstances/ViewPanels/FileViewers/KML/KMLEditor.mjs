import { updateToolbarState } from "/panels/createToolbar.mjs";
import { ensureKMLEditorModeLayout, ensureKMLViewerModeLayout } from "/panels/workspace.mjs";
import { parseKML, refreshKMLRecords } from "./KMLParser.mjs";
import { createKMLLayerTree } from "./KMLLayerTree.mjs";
import { createKMLMapRenderer } from "./KMLMapRenderer.mjs";
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
  if (!node) return;
  node.textContent = message;
  node.dataset.tone = tone;
}

function injectKMLStyles() {
  if (document.getElementById("nv-kml-editor-styles")) return;
  const style = document.createElement("style");
  style.id = "nv-kml-editor-styles";
  style.textContent = `
    .nv-kml-map-shell{position:relative;width:100%;height:100%;min-height:320px;background:#d9e2ec;overflow:hidden}
    .nv-kml-map-inner{position:absolute;inset:0;background:#d9e2ec}
    .nv-kml-status{position:absolute;left:8px;right:8px;bottom:8px;z-index:500;padding:5px 8px;background:rgba(248,250,252,.92);border:1px solid #c8d0da;border-radius:4px;color:#475569;font:12px ui-monospace,SFMono-Regular,Consolas,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
    .nv-kml-status[data-tone="error"]{color:#b42318;background:rgba(255,241,240,.96)}
    .nv-kml-tree{padding:6px;font:13px/1.4 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1f2933}
    .nv-kml-tree-row{display:grid;grid-template-columns:18px 42px minmax(0,1fr);align-items:center;gap:6px;width:100%;border:0;background:transparent;border-radius:4px;padding-top:5px;padding-bottom:5px;text-align:left;color:#1f2933;cursor:pointer}
    .nv-kml-tree-row:hover{background:#e6eef8}
    .nv-kml-tree-row.is-selected{background:#cfe3ff;box-shadow:inset 3px 0 0 #1d67d8}
    .nv-kml-type{font:700 10px/1 ui-monospace,SFMono-Regular,Consolas,monospace;color:#4b5563}
    .nv-kml-tree-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .nv-kml-properties{padding:10px;display:flex;flex-direction:column;gap:8px;font:13px/1.4 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1f2933;overflow:auto}
    .nv-kml-panel-title{font-weight:700;color:#111827;margin-top:3px}
    .nv-kml-field{display:flex;flex-direction:column;gap:3px}
    .nv-kml-field span{font-size:11px;text-transform:uppercase;color:#64748b;letter-spacing:.04em}
    .nv-kml-field input,.nv-kml-field textarea,.nv-kml-properties textarea{width:100%;box-sizing:border-box;border:1px solid #b8c2cf;border-radius:4px;background:#fff;color:#111827;padding:6px;font:12px/1.35 ui-monospace,SFMono-Regular,Consolas,monospace}
    .nv-kml-field textarea,.nv-kml-properties textarea{resize:vertical;min-height:42px}
    .nv-kml-empty{padding:10px;color:#64748b}
    .nv-kml-todo{font-size:11px;color:#64748b;background:#eef2f7;border-radius:4px;padding:6px}
    .nv-kml-marker-icon span{display:block;border:2px solid #242424;border-radius:50%;box-shadow:0 1px 5px rgba(0,0,0,.45)}
  `;
  document.head.appendChild(style);
}

export async function renderKMLEditor(filePath, container, options = {}) {
  if (typeof container?.__nvKMLDestroy === "function") container.__nvKMLDestroy();
  injectKMLStyles();
  const mode = options.mode === "viewer" ? "viewer" : "editor";
  const nodevisionMode = mode === "viewer" ? "KMLviewerMode" : "KMLeditorMode";
  const cleanPath = normalizeNotebookPath(filePath);
  container.innerHTML = "";

  const shell = document.createElement("div");
  shell.className = "nv-kml-map-shell";
  const mapNode = document.createElement("div");
  mapNode.className = "nv-kml-map-inner";
  const status = document.createElement("div");
  status.className = "nv-kml-status";
  shell.append(mapNode, status);
  container.appendChild(shell);
  showStatus(status, `Loading ${cleanPath}...`);

  let state = null;
  let selectedId = null;
  let renderer = null;
  let layersContext = null;
  let propertiesContext = null;
  const layerHosts = new Set();
  const propertyHosts = new Set();

  function selectedRecord() {
    return selectedId ? state?.recordsById.get(selectedId) : null;
  }

  function dispatchKMLChange(reason, extra = {}) {
    window.dispatchEvent(new CustomEvent("nv-kml-context-changed", {
      detail: { reason, filePath: cleanPath, selectedId, ...extra },
    }));
  }

  function isDescendantOf(record, parentId) {
    let cursor = record;
    while (cursor?.parentId) {
      if (cursor.parentId === parentId) return true;
      cursor = state?.recordsById.get(cursor.parentId);
    }
    return false;
  }

  function createLayerTree(host) {
    const tree = createKMLLayerTree(host, {
      onSelect: (record) => selectRecord(record, true),
      onToggle: (record, visible) => {
        const affected = state.treeRecords.filter((item) => item.id === record.id || isDescendantOf(item, record.id));
        affected.forEach((item) => {
          item.visible = visible;
          if (item.geometry) renderer?.setRecordVisible(item, visible);
        });
        refreshLayerHosts();
        showStatus(status, (visible ? "Showing " : "Hiding ") + record.name);
      },
    });
    tree.render(state?.treeRecords || [], selectedId);
    return tree;
  }

  function createProperties(host) {
    const panel = createKMLPropertyPanel(host, {
      onTextChange: (record, patch) => {
        updateFeatureText(state, record, patch);
        rerenderFromState();
        selectRecord(state.recordsById.get(record.id) || selectedRecord());
        markDirty("Feature text updated. Save KML to persist.");
      },
      onCoordinatesChange: handleCoordinates,
      onOptionChange: (record, key, value) => {
        updateFeatureOption(state, record, key, value);
        rerenderFromState();
        markDirty(` updated. Save KML to persist.`);
      },
      onStyleChange: (record, value) => {
        updateFeatureStyleColor(state, record, value);
        rerenderFromState();
        markDirty("Style color updated. Save KML to persist.");
      },
    });
    panel.render(selectedRecord());
    return panel;
  }

  function refreshLayerHosts() {
    for (const host of Array.from(layerHosts)) {
      if (!host.isConnected) {
        layerHosts.delete(host);
        continue;
      }
      const tree = host.__nvKMLLayerTree || createLayerTree(host);
      host.__nvKMLLayerTree = tree;
      tree.render(state?.treeRecords || [], selectedId);
    }
  }

  function refreshPropertyHosts() {
    for (const host of Array.from(propertyHosts)) {
      if (!host.isConnected) {
        propertyHosts.delete(host);
        continue;
      }
      const panel = host.__nvKMLPropertyPanel || createProperties(host);
      host.__nvKMLPropertyPanel = panel;
      panel.render(selectedRecord());
    }
  }

  function selectRecord(record, fly = false) {
    if (!record) return;
    selectedId = record.id;
    renderer?.setSelected(selectedId);
    refreshLayerHosts();
    refreshPropertyHosts();
    if (fly && record.geometry) renderer?.flyToRecord(record);
    dispatchKMLChange("selection", { record });
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
    const nextSelection = previousId ? state.recordsById.get(previousId) : null;
    selectedId = nextSelection?.id || null;
    renderer?.setSelected(selectedId);
    refreshLayerHosts();
    refreshPropertyHosts();
    dispatchKMLChange("records", { selectedId });
    if (fit) renderer?.fitAll();
  }

  function handleCoordinates(record, coordinatesText) {
    try {
      updateFeatureCoordinates(state, record, coordinatesText);
      rerenderFromState();
      selectRecord(state.recordsById.get(record.id) || selectedRecord());
      markDirty("Coordinates updated. Save KML to persist.");
    } catch (err) {
      showStatus(status, err.message, "error");
    }
  }

  async function save(targetPath = cleanPath) {
    try {
      await saveKMLFile(normalizeNotebookPath(targetPath) || cleanPath, state);
      updateToolbarState({ fileIsDirty: false });
      showStatus(status, `Saved ${cleanPath}`);
      return true;
    } catch (err) {
      showStatus(status, `Save failed: ${err.message}`, "error");
      return false;
    }
  }

  function markDirty(message = "KML changed. Save to persist.") {
    updateToolbarState({ fileIsDirty: true });
    showStatus(status, message);
  }

  function addPlacemark() {
    if (mode === "viewer") return;
    showStatus(status, "Click the map to place a placemark.");
    renderer.startAddPlacemark((coordinates) => {
      createPlacemark(state, { geometryType: "Point", coordinates, name: "New Placemark" });
      rerenderFromState({ preserveSelection: false });
      const added = state.features[state.features.length - 1];
      if (added) selectRecord(added, true);
      markDirty("Placemark added. Save KML to persist.");
    });
  }

  function drawPath() {
    if (mode === "viewer") return;
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
      markDirty("Path added. Save KML to persist.");
    });
  }

  function drawPolygon() {
    if (mode === "viewer") return;
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
      markDirty("Polygon added. Save KML to persist.");
    });
  }

  function editSelected() {
    if (mode === "viewer") return;
    const record = selectedRecord();
    if (!record) {
      showStatus(status, "Select a feature first.", "error");
      return;
    }
    const editable = renderer.editRecord(record);
    showStatus(status, editable ? "Editing selected feature vertices." : "Selected feature is not graphically editable.", editable ? "" : "error");
  }

  function deleteSelected() {
    if (mode === "viewer") return;
    const record = selectedRecord();
    if (!record?.geometry) {
      showStatus(status, "Select a feature to delete.", "error");
      return;
    }
    deleteFeature(record);
    selectedId = null;
    rerenderFromState({ preserveSelection: false });
    markDirty("Feature deleted. Save KML to persist.");
  }

  function viewXml() {
    const record = selectedRecord();
    if (!record) {
      showStatus(status, "Select a feature to view XML.", "error");
      return;
    }
    refreshPropertyHosts();
    showStatus(status, "Selected feature XML is visible in the properties panel.");
  }

  function handleToolbarAction(action) {
    const actions = {
      addPlacemark,
      drawPath,
      drawPolygon,
      editSelected,
      deleteSelected,
      fitKML: () => renderer?.fitAll(),
      fit: () => renderer?.fitAll(),
      saveKML: save,
      save,
      viewXml,
    };
    if (typeof actions[action] === "function") return actions[action]();
    return undefined;
  }

  const response = await fetch(notebookUrl(cleanPath), { cache: "no-store" });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  state = parseKML(await response.text());

  renderer = await createKMLMapRenderer(mapNode, {
    onSelect: (record) => selectRecord(record, false),
    onGeometryChange: (record, coords) => {
      handleCoordinates(record, coords.map((coord) => `${coord.lon},${coord.lat}${coord.alt !== null ? `,${coord.alt}` : ""}`).join(" "));
      markDirty("Geometry updated. Save KML to persist.");
    },
  });

  layersContext = {
    id: "kml",
    title: "KML Layers",
    attachHost(host) {
      if (!host) return null;
      layerHosts.add(host);
      const tree = createLayerTree(host);
      host.__nvKMLLayerTree = tree;
      return () => {
        layerHosts.delete(host);
        if (host.__nvKMLLayerTree === tree) delete host.__nvKMLLayerTree;
      };
    },
  };

  propertiesContext = {
    id: "kml",
    title: "KML Feature Properties",
    attachHost(host) {
      if (!host) return null;
      propertyHosts.add(host);
      const panel = createProperties(host);
      host.__nvKMLPropertyPanel = panel;
      return () => {
        propertyHosts.delete(host);
        if (host.__nvKMLPropertyPanel === panel) delete host.__nvKMLPropertyPanel;
      };
    },
  };

  window.KMLLayersContext = layersContext;
  window.KMLPropertiesContext = propertiesContext;
  window.KMLEditorContext = {
    mode,
    filePath: cleanPath,
    getState: () => state,
    getSelectedRecord: selectedRecord,
    selectRecord,
    refreshLayerHosts,
    refreshPropertyHosts,
    handleToolbarAction,
    save,
  };
  window.currentSaveKML = save;
  window.getCurrentKMLXML = () => serializeKML(state);
  window.saveCurrentFile = save;

  updateToolbarState({
    currentMode: nodevisionMode,
    selectedFile: cleanPath,
    activeActionHandler: handleToolbarAction,
    fileIsDirty: false,
  });

  renderer.render(state.features);
  renderer.fitAll();
  refreshLayerHosts();
  refreshPropertyHosts();
  dispatchKMLChange("ready");
  window.dispatchEvent(new CustomEvent("nv-kml-context-ready", { detail: { filePath: cleanPath, mode } }));
  showStatus(status, `Loaded ${state.features.length} editable KML feature${state.features.length === 1 ? "" : "s"}.`);

  try {
    const panelCell = container?.closest?.(".panel-cell");
    if (panelCell) {
      if (mode === "viewer") await ensureKMLViewerModeLayout({ viewerCell: panelCell });
      else await ensureKMLEditorModeLayout({ editorCell: panelCell });
    }
  } catch (err) {
    console.warn("KML editor: failed to apply KML mode layout:", err);
  }

  const destroy = () => {
    renderer?.destroy();
    layerHosts.clear();
    propertyHosts.clear();
    if (window.KMLEditorContext?.filePath === cleanPath) {
      delete window.KMLEditorContext;
      delete window.KMLLayersContext;
      delete window.KMLPropertiesContext;
      if (window.NodevisionState?.activeActionHandler === handleToolbarAction) {
        updateToolbarState({ activeActionHandler: null });
      }
    }
  };
  container.__nvKMLDestroy = destroy;

  return {
    state,
    save,
    destroy,
  };
}
