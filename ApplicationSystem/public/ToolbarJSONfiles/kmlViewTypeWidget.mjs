// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/kmlViewTypeWidget.mjs
// Sub-toolbar widget for View -> View Type in KML modes.

function normalizeViewType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["aviation", "aviation-map", "aviationmap", "chart", "charts", "sectional"].includes(normalized)) return "aviation";
  if (["map", "street", "street-map", "flat", "projection", "flat-map", "flatmap"].includes(normalized)) return "map";
  return "globe";
}

function currentViewType() {
  const fromContext = window.KMLEditorContext?.getViewType?.();
  const fromState = window.NodevisionState?.kmlViewType;
  return normalizeViewType(fromContext || fromState || "globe");
}

function currentChartPackPath() {
  return String(window.KMLEditorContext?.getAviationChartPackPath?.() || window.NodevisionState?.kmlAviationChartPackPath || "");
}

function dispatchAction(action) {
  const handler = window.NodevisionState?.activeActionHandler;
  if (typeof handler === "function") return handler(action);
  return window.KMLEditorContext?.handleToolbarAction?.(action);
}

function setViewType(viewType) {
  const normalized = normalizeViewType(viewType);
  if (normalized === "aviation") return dispatchAction("viewTypeAviation");
  if (normalized === "map") return dispatchAction("viewTypeMap");
  return dispatchAction("viewTypeGlobe");
}

function applyChartPackPath(hostElement) {
  const input = hostElement.querySelector("[data-nv-kml-chart-path]");
  const path = String(input?.value || "").trim();
  return dispatchAction("setAviationChartPack:" + path);
}

function render(hostElement) {
  hostElement.innerHTML = "" +
    "<div class=\"nv-kml-view-type-widget\" style=\"display:flex;align-items:center;gap:12px;flex-wrap:wrap;font:12px system-ui,-apple-system,Segoe UI,sans-serif;white-space:nowrap;\">" +
      "<fieldset style=\"display:flex;align-items:center;gap:10px;border:0;margin:0;padding:0;\">" +
        "<legend style=\"position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip-path:inset(50%);\">KML view type</legend>" +
        "<label style=\"display:flex;align-items:center;gap:5px;\"><input type=\"radio\" name=\"nv-kml-view-type\" value=\"map\" /> Street</label>" +
        "<label style=\"display:flex;align-items:center;gap:5px;\"><input type=\"radio\" name=\"nv-kml-view-type\" value=\"globe\" /> Globe</label>" +
        "<label style=\"display:flex;align-items:center;gap:5px;\"><input type=\"radio\" name=\"nv-kml-view-type\" value=\"aviation\" /> Aviation</label>" +
      "</fieldset>" +
      "<span aria-hidden=\"true\" style=\"width:1px;height:20px;background:#c8d0da;\"></span>" +
      "<label style=\"display:flex;align-items:center;gap:6px;min-width:min(380px,100%);\">Chart Pack" +
        "<input data-nv-kml-chart-path type=\"text\" placeholder=\"Aviation/Charts/FAA_Sectional_Example/chart-pack.json\" style=\"height:24px;min-width:260px;width:32vw;max-width:420px;box-sizing:border-box;border:1px solid #aeb9c8;border-radius:4px;padding:2px 6px;font:12px ui-monospace,SFMono-Regular,Consolas,monospace;\" />" +
      "</label>" +
      "<button type=\"button\" data-nv-kml-chart-apply style=\"height:24px;padding:0 8px;\">Apply</button>" +
      "<button type=\"button\" data-nv-kml-chart-select style=\"height:24px;padding:0 8px;\">Select</button>" +
      "<button type=\"button\" data-nv-kml-chart-clear style=\"height:24px;padding:0 8px;\">Clear</button>" +
    "</div>";
}

function sync(hostElement) {
  const value = currentViewType();
  hostElement.querySelectorAll('input[name="nv-kml-view-type"]').forEach((input) => {
    input.checked = input.value === value;
  });
  const input = hostElement.querySelector("[data-nv-kml-chart-path]");
  if (input && document.activeElement !== input) input.value = currentChartPackPath();
}

export function initToolbarWidget(hostElement) {
  if (!hostElement) return;
  render(hostElement);
  hostElement.querySelectorAll('input[name="nv-kml-view-type"]').forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) setViewType(input.value);
    });
  });
  hostElement.querySelector("[data-nv-kml-chart-apply]")?.addEventListener("click", () => applyChartPackPath(hostElement));
  hostElement.querySelector("[data-nv-kml-chart-select]")?.addEventListener("click", () => dispatchAction("selectAviationChartPack"));
  hostElement.querySelector("[data-nv-kml-chart-clear]")?.addEventListener("click", () => dispatchAction("clearAviationChartPack"));
  hostElement.querySelector("[data-nv-kml-chart-path]")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") applyChartPackPath(hostElement);
  });
  const onContextChanged = () => sync(hostElement);
  window.addEventListener("nv-kml-context-changed", onContextChanged);
  window.addEventListener("nv-kml-context-ready", onContextChanged);
  sync(hostElement);
}
