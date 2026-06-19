import { updateToolbarState } from "/panels/createToolbar.mjs";
import { ensureKMLEditorModeLayout, ensureKMLViewerModeLayout } from "/panels/workspace.mjs";
import { parseKML, refreshKMLRecords } from "./KMLParser.mjs";
import { createKMLLayerTree } from "./KMLLayerTree.mjs";
import { createKMLMapRenderer, normalizeKMLViewType, KML_VIEW_TYPES } from "./KMLMapRenderer.mjs";
import { createKMLPropertyPanel } from "./KMLPropertyPanel.mjs";
import { DEFAULT_CELESTIAL_OPTIONS } from "./CelestialBackdrop.mjs";
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

const USER_LOCATION_MAP_ZOOM = 16;
const USER_LOCATION_GLOBE_DISTANCE = 1.45;
const CELESTIAL_OPTIONS_STORAGE_KEY = "nodevision.kml.celestialOptions";

function normalizeCelestialOptions(options = {}) {
  const merged = { ...DEFAULT_CELESTIAL_OPTIONS, ...options };
  return {
    ...merged,
    showStars: merged.showStars !== false,
    showSun: merged.showSun !== false,
    showMoon: merged.showMoon !== false,
    showLabels: merged.showLabels === true,
    useCurrentTime: merged.useCurrentTime !== false,
    useSunLight: merged.useSunLight !== false,
    observationTime: merged.observationTime || null,
  };
}

function loadCelestialOptions(overrides = {}) {
  let stored = {};
  try {
    stored = JSON.parse(window.localStorage?.getItem(CELESTIAL_OPTIONS_STORAGE_KEY) || "{}");
  } catch {}
  return normalizeCelestialOptions({ ...stored, ...overrides });
}

function celestialTimeLabel(options = {}) {
  const date = options.observationTime ? new Date(options.observationTime) : new Date();
  return Number.isNaN(date.getTime()) ? "current time" : date.toLocaleString();
}

function showStatus(node, message, tone = "") {
  if (!node) return;
  const text = String(message ?? "");
  node.textContent = text;
  node.dataset.tone = tone;
  node.hidden = text.length === 0;
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
    .nv-kml-aviation-status{position:absolute;left:8px;top:8px;z-index:510;max-width:min(560px,calc(100% - 16px));padding:6px 8px;background:rgba(248,250,252,.94);border:1px solid #c8d0da;border-radius:4px;color:#334155;font:12px/1.35 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 1px 6px rgba(15,23,42,.16);display:none;pointer-events:none}
    .nv-kml-aviation-status[data-visible="true"]{display:block}
    .nv-kml-aviation-status[data-tone="warning"]{background:rgba(255,251,235,.96);border-color:#f59e0b;color:#92400e}
    .nv-kml-aviation-status[data-tone="error"]{background:rgba(255,241,240,.96);border-color:#fda29b;color:#b42318}
    .nv-kml-aviation-inline{max-width:280px;padding:7px 9px;background:rgba(248,250,252,.96);border:1px solid #c8d0da;border-radius:4px;color:#334155;font:12px/1.35 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 1px 6px rgba(15,23,42,.18)}
    .nv-kml-aviation-inline-warning{background:rgba(255,251,235,.96);border-color:#f59e0b;color:#92400e}
    .nv-kml-aviation-inline-error{background:rgba(255,241,240,.96);border-color:#fda29b;color:#b42318}
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
    .nv-kml-user-location-icon{position:relative;width:34px;height:34px;pointer-events:none}
    .nv-kml-user-location-icon span{position:absolute;inset:6px;border:3px solid #fff;border-radius:50%;background:#0a84ff;box-shadow:0 2px 10px rgba(15,23,42,.38)}
    .nv-kml-user-location-icon span::before{content:"";position:absolute;inset:-9px;border:2px solid rgba(10,132,255,.5);border-radius:50%;background:rgba(10,132,255,.13)}
    .nv-kml-user-location-icon span::after{content:"";position:absolute;left:50%;top:50%;width:6px;height:6px;transform:translate(-50%,-50%);border-radius:50%;background:#fff}
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
  const aviationStatus = document.createElement("div");
  aviationStatus.className = "nv-kml-aviation-status";
  shell.append(mapNode, aviationStatus, status);
  container.appendChild(shell);
  showStatus(status, `Loading ${cleanPath}...`);

  let state = null;
  let selectedId = null;
  let renderer = null;
  let viewType = normalizeKMLViewType(options.viewType || window.localStorage?.getItem("nodevision.kml.viewType") || "globe");
  let aviationChartPackPath = normalizeNotebookPath(options.aviationChartPackPath || "");
  if (!aviationChartPackPath) {
    try {
      aviationChartPackPath = normalizeNotebookPath(window.sessionStorage?.getItem("nodevision.kml.aviationChartPackPath") || "");
    } catch {}
  }
  let aviationChartStatus = null;
  let celestialOptions = loadCelestialOptions(options.celestialOptions || {});
  let userLocationEnabled = false;
  let userLocationWatchId = null;
  let userLocationLastPosition = null;
  let userLocationHasCentered = false;
  let userLocationRequestId = 0;
  let layersContext = null;
  let propertiesContext = null;
  const layerHosts = new Set();
  const propertyHosts = new Set();

  function selectedRecord() {
    return selectedId ? state?.recordsById.get(selectedId) : null;
  }

  function coordinateForRecord(record) {
    const coordinates = Array.isArray(record?.geometry?.coordinates) ? record.geometry.coordinates : [];
    const finite = coordinates
      .map((coord) => ({ lat: Number(coord?.lat), lon: Number(coord?.lon) }))
      .filter((coord) => Number.isFinite(coord.lat) && Number.isFinite(coord.lon));
    if (!finite.length) return null;
    if (record?.geometry?.type === "Point") return finite[0];
    const totals = finite.reduce((acc, coord) => {
      acc.lat += coord.lat;
      acc.lon += coord.lon;
      return acc;
    }, { lat: 0, lon: 0 });
    return { lat: totals.lat / finite.length, lon: totals.lon / finite.length };
  }

  function viewTypeLabel(type) {
    const normalized = normalizeKMLViewType(type);
    if (normalized === KML_VIEW_TYPES.AVIATION) return "aviation map";
    if (normalized === KML_VIEW_TYPES.MAP) return "street map";
    return "globe";
  }

  function renderAviationStatus(info = aviationChartStatus) {
    if (viewType !== KML_VIEW_TYPES.AVIATION) {
      aviationStatus.dataset.visible = "false";
      aviationStatus.textContent = "";
      return;
    }

    const statusInfo = info || {
      state: aviationChartPackPath ? "loading" : "empty",
      tone: aviationChartPackPath ? "info" : "warning",
      message: aviationChartPackPath ? "Loading aviation chart layer..." : "No aviation chart layer loaded. Import or select an aviation chart pack.",
    };
    const chartPack = statusInfo.chartPack;
    if (chartPack) {
      aviationStatus.textContent = "Chart: " + chartPack.name + " | Effective: " + (chartPack.effectiveDate || "Unknown") + " | Expires: " + (chartPack.expirationDate || "Unknown") + " | " + (statusInfo.message || "Verify chart currency before flight.");
    } else {
      aviationStatus.textContent = statusInfo.message || "No aviation chart layer loaded. Import or select an aviation chart pack.";
    }
    aviationStatus.dataset.tone = statusInfo.tone || "info";
    aviationStatus.dataset.visible = "true";
  }

  function handleBasemapStatus(info = {}) {
    aviationChartStatus = info;
    renderAviationStatus(info);
    if (viewType === KML_VIEW_TYPES.AVIATION && info.message) {
      const prefix = info.state === "loaded" && info.chartPack?.name ? "Aviation chart: " + info.chartPack.name + ". " : "";
      showStatus(status, prefix + info.message, info.tone === "error" ? "error" : "");
    }
    updateToolbarState({
      kmlAviationChartPackPath: aviationChartPackPath,
      kmlAviationChartState: info.state || "",
    });
    dispatchKMLChange("aviation-chart", { aviationChartPackPath, aviationChartStatus: info });
  }

  function dispatchKMLChange(reason, extra = {}) {
    window.dispatchEvent(new CustomEvent("nv-kml-context-changed", {
      detail: { reason, filePath: cleanPath, selectedId, ...extra },
    }));
  }

  function persistCelestialOptions() {
    try {
      window.localStorage?.setItem(CELESTIAL_OPTIONS_STORAGE_KEY, JSON.stringify(celestialOptions));
    } catch {}
  }

  function publishCelestialState(reason = "celestial-options") {
    const optionsSnapshot = { ...celestialOptions };
    updateToolbarState({ kmlCelestialOptions: optionsSnapshot });
    dispatchKMLChange(reason, { celestialOptions: optionsSnapshot });
  }

  function setCelestialOptions(nextOptions = {}, { announce = true } = {}) {
    celestialOptions = normalizeCelestialOptions({ ...celestialOptions, ...nextOptions });
    if (celestialOptions.useCurrentTime === false && !celestialOptions.observationTime) {
      celestialOptions = normalizeCelestialOptions({ ...celestialOptions, observationTime: new Date().toISOString() });
    }
    const appliedOptions = renderer?.setCelestialOptions?.(celestialOptions);
    if (appliedOptions) celestialOptions = normalizeCelestialOptions(appliedOptions);
    persistCelestialOptions();
    publishCelestialState();
    if (announce) showStatus(status, "Sky updated for " + (celestialOptions.useCurrentTime ? "current time" : celestialTimeLabel(celestialOptions)) + ".");
    return true;
  }

  function setCelestialOption(key, value) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_CELESTIAL_OPTIONS, key)) return false;
    return setCelestialOptions({ [key]: Boolean(value) });
  }

  function refreshCelestialNow() {
    const refreshed = renderer?.refreshCelestialNow?.() || { ...celestialOptions, observationTime: new Date().toISOString() };
    celestialOptions = normalizeCelestialOptions(refreshed);
    persistCelestialOptions();
    publishCelestialState("celestial-refresh");
    showStatus(status, "Sky refreshed for " + celestialTimeLabel(celestialOptions) + ".");
    return true;
  }

  function stopUserLocationTelemetry() {
    const geolocation = globalThis.navigator?.geolocation;
    if (userLocationWatchId !== null && geolocation?.clearWatch) {
      geolocation.clearWatch(userLocationWatchId);
    }
    userLocationWatchId = null;
    userLocationRequestId += 1;
    userLocationLastPosition = null;
    userLocationHasCentered = false;
    renderer?.clearUserLocation?.();
  }

  function publishUserLocationState(reason = "user-location") {
    updateToolbarState({ kmlUserLocationEnabled: userLocationEnabled });
    dispatchKMLChange(reason, { userLocationEnabled });
  }

  function flyToUserLocation(location) {
    renderer?.flyToLocation?.(location, {
      zoom: USER_LOCATION_MAP_ZOOM,
      distance: USER_LOCATION_GLOBE_DISTANCE,
    });
  }

  function applyUserLocationPosition(position, { center = false } = {}) {
    if (!userLocationEnabled) return false;
    const coords = position?.coords || position || {};
    const location = {
      lat: Number(coords.latitude ?? coords.lat),
      lon: Number(coords.longitude ?? coords.lon),
      accuracy: Number(coords.accuracy),
    };
    if (!Number.isFinite(location.lat) || !Number.isFinite(location.lon)) {
      renderer?.clearUserLocation?.();
      showStatus(status, "User location did not include valid coordinates.", "error");
      return false;
    }

    userLocationLastPosition = location;
    renderer?.setUserLocation?.(location);
    if (center || !userLocationHasCentered) {
      flyToUserLocation(location);
      userLocationHasCentered = true;
    }
    const accuracyLabel = Number.isFinite(location.accuracy) && location.accuracy > 0 ? " (accuracy " + Math.round(location.accuracy) + " m)" : "";
    showStatus(status, "Showing your location on the " + viewTypeLabel(viewType) + ": " + location.lat.toFixed(5) + ", " + location.lon.toFixed(5) + accuracyLabel + ".");
    return true;
  }

  function browserLocationHelpMessage(err) {
    const message = String(err?.message || "location permission was not granted").trim();
    if (globalThis.isSecureContext === false) {
      return "Browser location requires localhost, HTTPS, or a secure context. Open Nodevision as http://localhost:3000 or allow location for this site.";
    }
    if (err?.code === 1) {
      return "Location permission is blocked for this site. Allow location in the browser site settings, then try My Location again.";
    }
    return message;
  }

  function handleUserLocationFailure(err, { fatal = false } = {}) {
    if (fatal) {
      userLocationEnabled = false;
      stopUserLocationTelemetry();
      publishUserLocationState();
    } else {
      publishUserLocationState();
    }
    showStatus(status, "User location is waiting: " + browserLocationHelpMessage(err), "error");
  }

  function startUserLocationTelemetry() {
    if (!userLocationEnabled) return;
    if (userLocationWatchId !== null) {
      if (userLocationLastPosition) applyUserLocationPosition(userLocationLastPosition, { center: true });
      return;
    }
    const geolocation = globalThis.navigator?.geolocation;
    if (!geolocation?.getCurrentPosition && !geolocation?.watchPosition) {
      handleUserLocationFailure(new Error("User location is unavailable in this browser."));
      return;
    }

    const requestId = ++userLocationRequestId;
    const quickOptions = { enableHighAccuracy: false, maximumAge: 300000, timeout: 30000 };
    const watchOptions = { enableHighAccuracy: true, maximumAge: 60000, timeout: 60000 };

    if (geolocation.getCurrentPosition) {
      geolocation.getCurrentPosition(
        (position) => {
          if (requestId === userLocationRequestId) applyUserLocationPosition(position, { center: true });
        },
        (err) => {
          if (requestId === userLocationRequestId && !geolocation.watchPosition) handleUserLocationFailure(err);
        },
        quickOptions,
      );
    }

    if (geolocation.watchPosition && userLocationWatchId === null) {
      userLocationWatchId = geolocation.watchPosition(
        (position) => {
          if (requestId === userLocationRequestId) applyUserLocationPosition(position);
        },
        (err) => {
          if (requestId === userLocationRequestId) handleUserLocationFailure(err);
        },
        watchOptions,
      );
    }
  }

  function centerUserLocation() {
    if (userLocationLastPosition) {
      return applyUserLocationPosition(userLocationLastPosition, { center: true });
    }

    if (!userLocationEnabled) {
      userLocationEnabled = true;
      userLocationHasCentered = false;
      publishUserLocationState();
    }

    const geolocation = globalThis.navigator?.geolocation;
    if (!geolocation?.getCurrentPosition) {
      startUserLocationTelemetry();
      return true;
    }

    const requestId = userLocationRequestId;
    const quickOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 };
    const watchOptions = { enableHighAccuracy: true, maximumAge: 60000, timeout: 60000 };
    showStatus(status, "Finding and zooming to your location...");

    geolocation.getCurrentPosition(
      (position) => {
        if (requestId === userLocationRequestId) applyUserLocationPosition(position, { center: true });
      },
      (err) => {
        if (requestId === userLocationRequestId) handleUserLocationFailure(err);
      },
      quickOptions,
    );

    if (geolocation.watchPosition && userLocationWatchId === null) {
      userLocationWatchId = geolocation.watchPosition(
        (position) => {
          if (requestId === userLocationRequestId) applyUserLocationPosition(position);
        },
        (err) => {
          if (requestId === userLocationRequestId) handleUserLocationFailure(err);
        },
        watchOptions,
      );
    }

    return true;
  }

  function setUserLocationEnabled(enabled) {
    const next = Boolean(enabled);
    if (!next) {
      userLocationEnabled = false;
      stopUserLocationTelemetry();
      publishUserLocationState();
      showStatus(status, "");
      return true;
    }

    userLocationEnabled = true;
    userLocationLastPosition = null;
    userLocationHasCentered = false;
    publishUserLocationState();
    showStatus(status, "Requesting your location...");
    startUserLocationTelemetry();
    return true;
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
        markDirty(String(key || "Option") + " updated. Save KML to persist.");
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

  function flyToRecord(record) {
    if (!record?.geometry || typeof renderer?.flyToRecord !== "function") return;
    const run = () => renderer?.flyToRecord?.(record);
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
    else setTimeout(run, 0);
  }

  function selectRecord(record, fly = false) {
    const currentRecord = state?.recordsById.get(record?.id) || record;
    if (!currentRecord) return;
    selectedId = currentRecord.id;
    renderer?.setSelected(selectedId);
    refreshLayerHosts();
    refreshPropertyHosts();
    if (fly) flyToRecord(currentRecord);
    dispatchKMLChange("selection", { record: currentRecord });
    showStatus(status, "Selected " + (currentRecord.name || currentRecord.type));
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

  async function initRenderer({ fit = false, flyToSelected = false } = {}) {
    renderer?.destroy?.();
    renderer = null;
    if (viewType === KML_VIEW_TYPES.AVIATION) {
      aviationChartStatus = {
        state: "loading",
        tone: aviationChartPackPath ? "info" : "warning",
        message: aviationChartPackPath ? "Loading aviation chart layer..." : "No aviation chart layer loaded. Import or select an aviation chart pack.",
        chartPack: null,
      };
      renderAviationStatus(aviationChartStatus);
    } else {
      aviationChartStatus = null;
      renderAviationStatus(null);
    }
    renderer = await createKMLMapRenderer(mapNode, {
      viewType,
      aviationChartPackPath,
      celestialOptions,
      onBasemapStatus: handleBasemapStatus,
      onSelect: (record) => selectRecord(record, false),
      onGeometryChange: (record, coords) => {
        handleCoordinates(record, coords.map((coord) => String(coord.lon) + "," + String(coord.lat) + (coord.alt !== null ? "," + String(coord.alt) : "")).join(" "));
        markDirty("Geometry updated. Save KML to persist.");
      },
    });
    renderer.render(state?.features || []);
    const appliedCelestialOptions = renderer.setCelestialOptions?.(celestialOptions);
    if (appliedCelestialOptions) celestialOptions = normalizeCelestialOptions(appliedCelestialOptions);
    renderer.setSelected(selectedId);
    if (userLocationEnabled) {
      stopUserLocationTelemetry();
      userLocationEnabled = true;
      startUserLocationTelemetry();
    }
    const selected = selectedRecord();
    if (flyToSelected && selected?.geometry) renderer.flyToRecord(selected);
    else if (fit) renderer.fitAll();
    if (window.NodevisionState) window.NodevisionState.kmlViewType = viewType;
    if (window.NodevisionState?.currentMode === nodevisionMode) updateToolbarState({ kmlViewType: viewType, kmlAviationChartPackPath: aviationChartPackPath, kmlCelestialOptions: { ...celestialOptions } });
    dispatchKMLChange("view-type", { viewType, aviationChartPackPath });
  }

  async function setViewType(nextViewType) {
    const normalized = normalizeKMLViewType(nextViewType);
    const label = viewTypeLabel(normalized);
    if (normalized === viewType) {
      renderAviationStatus();
      showStatus(status, "Already viewing KML as " + label + ".");
      return;
    }
    const hadSelection = Boolean(selectedRecord()?.geometry);
    viewType = normalized;
    try {
      window.localStorage?.setItem("nodevision.kml.viewType", viewType);
    } catch {}
    showStatus(status, "Switching to " + label + " view...");
    await initRenderer({ fit: !hadSelection, flyToSelected: hadSelection });
    refreshLayerHosts();
    refreshPropertyHosts();
    if (viewType === KML_VIEW_TYPES.AVIATION && aviationChartStatus?.message) {
      showStatus(status, aviationChartStatus.message, aviationChartStatus.tone === "error" ? "error" : "");
    } else {
      showStatus(status, "Viewing KML as " + label + ".");
    }
  }

  async function setAviationChartPackPath(nextPath = "") {
    const next = normalizeNotebookPath(nextPath);
    aviationChartPackPath = next;
    try {
      if (next) window.sessionStorage?.setItem("nodevision.kml.aviationChartPackPath", next);
      else window.sessionStorage?.removeItem("nodevision.kml.aviationChartPackPath");
    } catch {}
    updateToolbarState({ kmlAviationChartPackPath: aviationChartPackPath });
    dispatchKMLChange("aviation-chart-pack-path", { aviationChartPackPath });

    if (viewType === KML_VIEW_TYPES.AVIATION) {
      showStatus(status, next ? "Loading aviation chart pack " + next + "..." : "Cleared aviation chart pack.");
      await initRenderer({ fit: false, flyToSelected: Boolean(selectedRecord()?.geometry) });
      if (!next) showStatus(status, "No aviation chart layer loaded. Import or select an aviation chart pack.");
      return true;
    }

    showStatus(status, next ? "Aviation chart pack selected: " + next : "Aviation chart pack cleared.");
    return true;
  }

  function selectAviationChartPack() {
    if (typeof window.prompt !== "function") {
      showStatus(status, "Enter a Notebook-relative chart-pack.json path from the Aviation toolbar controls.", "error");
      return false;
    }
    const next = window.prompt("Notebook path to chart-pack.json", aviationChartPackPath || "Aviation/Charts/FAA_Sectional_Example/chart-pack.json");
    if (next === null || typeof next === "undefined") return false;
    return setAviationChartPackPath(next);
  }

  function clearAviationChartPack() {
    return setAviationChartPackPath("");
  }

  function showAviationChartImportPlaceholder() {
    showStatus(status, "Aviation chart import will convert FAA GeoTIFF, geospatial PDF, or MBTiles sources into a local Nodevision chart pack. This phase currently supports loading existing chart-pack.json tile packs.");
    return true;
  }

  async function searchLocation(query = "") {
    const cleanQuery = String(query || "").trim();
    if (!cleanQuery) {
      showStatus(status, "Enter a location to search.", "error");
      return false;
    }

    try {
      showStatus(status, "Searching for " + cleanQuery + "...");
      const response = await fetch("/api/kml/geocode?q=" + encodeURIComponent(cleanQuery), { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Location search failed (" + response.status + ").");
      const result = Array.isArray(payload?.results) ? payload.results[0] : null;
      const location = { lat: Number(result?.lat), lon: Number(result?.lon) };
      if (!Number.isFinite(location.lat) || !Number.isFinite(location.lon)) {
        throw new Error("No matching location was found.");
      }
      flyToUserLocation(location);
      showStatus(status, "Found " + (result?.displayName || cleanQuery) + ".");
      return true;
    } catch (err) {
      showStatus(status, "Location search failed: " + (err?.message || err), "error");
      return false;
    }
  }

  async function downloadSectionalForSelectedPin() {
    const record = selectedRecord();
    if (!record?.geometry) {
      showStatus(status, "Select a pin or KML feature first.", "error");
      return false;
    }
    const coordinate = coordinateForRecord(record);
    if (!coordinate) {
      showStatus(status, "Selected feature does not have usable coordinates.", "error");
      return false;
    }

    const label = record.name || record.type || "selected feature";
    try {
      showStatus(status, "Downloading FAA sectional for " + label + "...");
      const response = await fetch("/api/kml/aviation/download-sectional", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: coordinate.lat, lon: coordinate.lon, name: label }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Sectional download failed (" + response.status + ").");
      const chartName = payload?.chartName || "FAA sectional";
      const resourcePath = payload?.path || "Notebook/Resources/Aviation/Sectionals";
      showStatus(status, "Downloaded " + chartName + " sectional to " + resourcePath + ". Convert to a chart pack before display.");
      return true;
    } catch (err) {
      showStatus(status, "Sectional download failed: " + (err?.message || err), "error");
      return false;
    }
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

  function flyToSelected() {
    const record = selectedRecord();
    if (!record?.geometry) {
      showStatus(status, "Select a placemark, path, or polygon first.", "error");
      return;
    }
    flyToRecord(record);
    showStatus(status, "Flying to " + (record.name || record.type));
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
    const actionKey = String(action || "");
    if (actionKey.startsWith("setAviationChartPack:")) {
      return setAviationChartPackPath(actionKey.slice("setAviationChartPack:".length));
    }
    if (actionKey.startsWith("searchLocation:")) {
      const encodedQuery = actionKey.slice("searchLocation:".length);
      try {
        return searchLocation(decodeURIComponent(encodedQuery));
      } catch {
        return searchLocation(encodedQuery);
      }
    }
    if (actionKey.startsWith("setCelestialOption:")) {
      const [, key, rawValue] = actionKey.split(":");
      return setCelestialOption(key, rawValue === "true" || rawValue === "1" || rawValue === "yes");
    }
    const actions = {
      addPlacemark,
      drawPath,
      drawPolygon,
      editSelected,
      deleteSelected,
      fitKML: () => renderer?.fitAll(),
      fit: () => renderer?.fitAll(),
      flyToSelected,
      flySelected: flyToSelected,
      flyToPin: flyToSelected,
      flyPin: flyToSelected,
      saveKML: save,
      save,
      viewXml,
      viewTypeGlobe: () => setViewType("globe"),
      viewTypeMap: () => setViewType("map"),
      viewTypeStreet: () => setViewType("map"),
      viewTypeAviation: () => setViewType("aviation"),
      enableUserLocation: () => setUserLocationEnabled(true),
      disableUserLocation: () => setUserLocationEnabled(false),
      toggleUserLocation: () => setUserLocationEnabled(!userLocationEnabled),
      centerUserLocation,
      locateUserLocation: centerUserLocation,
      zoomToUserLocation: centerUserLocation,
      setViewTypeGlobe: () => setViewType("globe"),
      setViewTypeMap: () => setViewType("map"),
      setViewTypeStreet: () => setViewType("map"),
      setViewTypeAviation: () => setViewType("aviation"),
      selectAviationChartPack,
      clearAviationChartPack,
      showAviationChartImportPlaceholder,
      aviationChartImportPlaceholder: showAviationChartImportPlaceholder,
      searchLocation,
      downloadSectionalForSelectedPin,
      refreshCelestialNow,
    };
    if (typeof actions[actionKey] === "function") return actions[actionKey]();
    return undefined;
  }

  const response = await fetch(notebookUrl(cleanPath), { cache: "no-store" });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  state = parseKML(await response.text());

  await initRenderer({ fit: true });

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
    getViewType: () => viewType,
    setViewType,
    getAviationChartPackPath: () => aviationChartPackPath,
    setAviationChartPackPath,
    getUserLocationEnabled: () => userLocationEnabled,
    setUserLocationEnabled,
    centerUserLocation,
    selectAviationChartPack,
    clearAviationChartPack,
    searchLocation,
    downloadSectionalForSelectedPin,
    getCelestialOptions: () => ({ ...celestialOptions }),
    setCelestialOptions,
    refreshCelestialNow,
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
    kmlViewType: viewType,
    kmlAviationChartPackPath: aviationChartPackPath,
    kmlUserLocationEnabled: userLocationEnabled,
    kmlCelestialOptions: { ...celestialOptions },
  });

  refreshLayerHosts();
  refreshPropertyHosts();
  dispatchKMLChange("ready");
  window.dispatchEvent(new CustomEvent("nv-kml-context-ready", { detail: { filePath: cleanPath, mode, viewType, aviationChartPackPath, userLocationEnabled, celestialOptions: { ...celestialOptions } } }));
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
    userLocationEnabled = false;
    stopUserLocationTelemetry();
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
