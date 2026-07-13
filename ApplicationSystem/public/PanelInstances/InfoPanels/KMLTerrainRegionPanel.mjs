// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/KMLTerrainRegionPanel.mjs
// Terrain Region panel for KML closed-region export and offline package workflows.

function ctx() {
  return window.KMLTerrainContext || null;
}

function clear(node) {
  while (node?.firstChild) node.removeChild(node.firstChild);
}

function section(title) {
  const el = document.createElement("section");
  Object.assign(el.style, { borderTop: "1px solid #d7d7d7", paddingTop: "8px", display: "grid", gap: "7px" });
  const heading = document.createElement("div");
  heading.textContent = title;
  Object.assign(heading.style, { fontWeight: "700", fontSize: "13px" });
  el.appendChild(heading);
  return el;
}

function row(label, value) {
  const div = document.createElement("div");
  Object.assign(div.style, { display: "grid", gridTemplateColumns: "120px minmax(0,1fr)", gap: "8px", fontSize: "12px" });
  const l = document.createElement("span");
  l.textContent = label;
  l.style.color = "#52606d";
  const v = document.createElement("span");
  v.textContent = value;
  div.append(l, v);
  return div;
}

function controlRow(labelText, control) {
  const label = document.createElement("label");
  Object.assign(label.style, { display: "grid", gridTemplateColumns: "120px minmax(0,1fr)", alignItems: "center", gap: "8px", fontSize: "12px" });
  const span = document.createElement("span");
  span.textContent = labelText;
  label.append(span, control);
  return label;
}

function select(value, options, onChange) {
  const input = document.createElement("select");
  Object.assign(input.style, { minHeight: "28px", border: "1px solid #b8c2cf", borderRadius: "4px", background: "#fff" });
  options.forEach(([optValue, label]) => {
    const option = document.createElement("option");
    option.value = optValue;
    option.textContent = label;
    input.appendChild(option);
  });
  input.value = value;
  input.addEventListener("change", () => onChange(input.value));
  return input;
}

function checkbox(value, onChange) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = Boolean(value);
  input.style.width = "18px";
  input.style.height = "18px";
  input.addEventListener("change", () => onChange(input.checked));
  return input;
}

function button(label, action, title = label, disabled = false) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  btn.title = title;
  btn.disabled = Boolean(disabled);
  Object.assign(btn.style, { minHeight: "30px" });
  btn.addEventListener("click", () => action?.());
  return btn;
}

function buttonGrid(buttons) {
  const grid = document.createElement("div");
  Object.assign(grid.style, { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(128px,1fr))", gap: "6px" });
  buttons.forEach((btn) => grid.appendChild(btn));
  return grid;
}

function renderPanel(panel) {
  clear(panel);
  const api = ctx();
  Object.assign(panel.style, { display: "flex", flexDirection: "column", gap: "10px", overflow: "auto", padding: "8px" });
  if (!api) {
    const empty = document.createElement("div");
    empty.textContent = "Open a KML file to prepare terrain and offline map data.";
    empty.style.color = "#b00020";
    panel.appendChild(empty);
    return;
  }

  const settings = api.getTerrainSettings?.() || {};
  const terrain = section("Terrain View");
  terrain.appendChild(controlRow("Source", select(settings.requestedSource || "automatic", [
    ["automatic", "Automatic"], ["usgs-3dep", "USGS 3DEP"], ["copernicus-dem", "Copernicus DEM"], ["mapzen", "Mapzen"],
  ], (value) => api.setTerrainSettings?.({ requestedSource: value }))));
  terrain.appendChild(controlRow("Contour interval", select(String(settings.contourInterval || "automatic"), [
    ["automatic", "Automatic"], ["5", "5 m"], ["10", "10 m"], ["20", "20 m"], ["50", "50 m"], ["custom", "Custom"],
  ], (value) => api.setTerrainSettings?.({ contourInterval: value }))));
  terrain.appendChild(controlRow("Index interval", select(String(settings.indexContourInterval || "automatic"), [["automatic", "Automatic"], ["custom", "Custom"]], (value) => api.setTerrainSettings?.({ indexContourInterval: value }))));
  terrain.appendChild(controlRow("Elevation units", select(settings.elevationUnits || "meters", [["meters", "Meters"], ["feet", "Feet"]], (value) => api.setTerrainSettings?.({ elevationUnits: value }))));
  terrain.appendChild(controlRow("Hillshade", checkbox(settings.hillshade, (value) => api.setTerrainSettings?.({ hillshade: value }))));
  terrain.appendChild(controlRow("Elevation colors", checkbox(settings.elevationColors, (value) => api.setTerrainSettings?.({ elevationColors: value }))));
  terrain.appendChild(controlRow("Slope shading", checkbox(settings.slopeShading, (value) => api.setTerrainSettings?.({ slopeShading: value }))));
  terrain.appendChild(controlRow("Attribution", checkbox(settings.showAttribution, (value) => api.setTerrainSettings?.({ showAttribution: value }))));
  terrain.appendChild(buttonGrid([button("Switch Terrain View", () => api.setViewType?.("terrain")), button("Street View", () => api.setViewType?.("map"))]));
  panel.appendChild(terrain);

  const selected = api.getSelectedRegion?.();
  const candidate = api.getSelectedRegionCandidate?.();
  const regionActionDisabled = !(selected || candidate?.valid);
  const region = section("Selected Region");
  if (selected) {
    region.append(row("Name", selected.featureName || "Selected region"));
    region.append(row("Area", api.formatArea?.(selected.areaSquareMeters) || ""));
    region.append(row("Bounds", api.formatBounds?.(selected.bounds) || ""));
    region.append(row("Vertices", String(selected.vertexCount || 0)));
    region.append(row("Source", settings.actualSource || settings.requestedSource || "automatic"));
  } else if (candidate?.valid) {
    region.appendChild(row("Status", "Closed path available"));
    region.appendChild(row("Area", api.formatArea?.(candidate.region.areaSquareMeters) || ""));
    region.appendChild(button("Select Enclosed Region", () => api.selectEnclosedRegion?.()));
  } else if (candidate?.reason) {
    region.appendChild(row("Status", candidate.reason));
  } else {
    const msg = document.createElement("div");
    msg.textContent = "Select a closed KML path or polygon to prepare terrain and offline map data.";
    msg.style.fontSize = "12px";
    region.appendChild(msg);
  }
  panel.appendChild(region);

  const estimate = api.getLastTerrainEstimate?.();
  const download = section("Download Estimate");
  download.appendChild(controlRow("Quality", select(settings.qualityPreset || "preview", [
    ["preview", "Preview"], ["offline-map", "Offline Map"], ["metaworld-low", "MetaWorld Low"], ["metaworld-medium", "MetaWorld Medium"], ["metaworld-high", "MetaWorld High"], ["custom", "Custom"],
  ], (value) => api.setTerrainSettings?.({ qualityPreset: value }))));
  download.appendChild(controlRow("Basemap", checkbox(settings.includeBasemap, (value) => api.setTerrainSettings?.({ includeBasemap: value }))));
  download.appendChild(controlRow("Aviation", checkbox(settings.includeAviation, (value) => api.setTerrainSettings?.({ includeAviation: value }))));
  if (estimate) {
    download.append(row("Requested", estimate.requestedSource || "automatic"));
    download.append(row("Actual", estimate.actualSource || "unknown"));
    download.append(row("Tiles", String(estimate.tileCount ?? 0)));
    download.append(row("Estimated", estimate.estimatedBytesLabel || "unknown"));
    if (estimate.warning) download.append(row("Warning", estimate.warning));
  }
  download.appendChild(buttonGrid([
    button("Preview Terrain", () => api.previewTerrain?.(), "Preview Terrain", regionActionDisabled),
    button("Estimate", () => api.estimateTerrain?.(), "Estimate", regionActionDisabled),
    button("Download Region Data", () => api.downloadRegionData?.(), "Download Region Data", regionActionDisabled),
  ]));
  panel.appendChild(download);

  const exportSection = section("Export");
  exportSection.appendChild(buttonGrid([
    button("Export Terrain Asset", () => api.exportTerrainAsset?.(), "Export Terrain Asset", regionActionDisabled),
    button("Offline Package", () => api.createOfflineMapPackage?.(), "Offline Package", regionActionDisabled),
    button("Insert into MetaWorld", () => api.insertTerrainIntoMetaWorld?.(), "Prepared exports can be inserted in a later phase", true),
  ]));
  const job = api.getTerrainJobStatus?.();
  if (job) {
    exportSection.append(row("Job", job.jobId || ""));
    exportSection.append(row("State", job.status || ""));
    exportSection.append(row("Phase", job.phase || ""));
    exportSection.append(row("Progress", `${Math.round((Number(job.progress) || 0) * 100)}%`));
    if (job.result?.manifestPath) exportSection.append(row("Manifest", job.result.manifestPath));
  }
  panel.appendChild(exportSection);

  const attribution = section("Attribution");
  attribution.appendChild(row("Terrain", estimate?.attribution || "Source attribution is recorded in exported packages."));
  attribution.appendChild(row("Aviation", "FAA chart data is cached with edition/effective metadata when downloaded."));
  panel.appendChild(attribution);
}

export async function setupPanel(panel) {
  if (!panel) throw new Error("Panel container required.");
  if (typeof panel.__nvCleanupKMLTerrainPanel === "function") panel.__nvCleanupKMLTerrainPanel();
  const rerender = () => renderPanel(panel);
  renderPanel(panel);
  window.addEventListener("nv-kml-context-ready", rerender);
  window.addEventListener("nv-kml-context-changed", rerender);
  window.addEventListener("nv-kml-terrain-job", rerender);
  panel.__nvCleanupKMLTerrainPanel = () => {
    window.removeEventListener("nv-kml-context-ready", rerender);
    window.removeEventListener("nv-kml-context-changed", rerender);
    window.removeEventListener("nv-kml-terrain-job", rerender);
  };
}
