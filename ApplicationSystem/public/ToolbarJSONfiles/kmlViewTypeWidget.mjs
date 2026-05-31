// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/kmlViewTypeWidget.mjs
// Sub-toolbar widget for View -> View Type in KML modes.

function currentViewType() {
  const fromContext = window.KMLEditorContext?.getViewType?.();
  const fromState = window.NodevisionState?.kmlViewType;
  return String(fromContext || fromState || "globe").toLowerCase() === "map" ? "map" : "globe";
}

function setViewType(viewType) {
  const handler = window.NodevisionState?.activeActionHandler;
  if (typeof handler === "function") {
    handler(viewType === "map" ? "viewTypeMap" : "viewTypeGlobe");
  } else if (window.KMLEditorContext?.setViewType) {
    window.KMLEditorContext.setViewType(viewType);
  }
}

function render(hostElement) {
  hostElement.innerHTML = "" +
    "<fieldset class=\"nv-kml-view-type-widget\" style=\"display:flex;align-items:center;gap:12px;border:0;margin:0;padding:0;font:12px system-ui,-apple-system,Segoe UI,sans-serif;white-space:nowrap;\">" +
      "<legend style=\"position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip-path:inset(50%);\">KML view type</legend>" +
      "<label style=\"display:flex;align-items:center;gap:5px;\"><input type=\"radio\" name=\"nv-kml-view-type\" value=\"globe\" /> Globe</label>" +
      "<label style=\"display:flex;align-items:center;gap:5px;\"><input type=\"radio\" name=\"nv-kml-view-type\" value=\"map\" /> Map Projection</label>" +
    "</fieldset>";
}

function sync(hostElement) {
  const value = currentViewType();
  hostElement.querySelectorAll('input[name="nv-kml-view-type"]').forEach((input) => {
    input.checked = input.value === value;
  });
}

export function initToolbarWidget(hostElement) {
  if (!hostElement) return;
  render(hostElement);
  hostElement.querySelectorAll('input[name="nv-kml-view-type"]').forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) setViewType(input.value);
    });
  });
  const onContextChanged = () => sync(hostElement);
  window.addEventListener("nv-kml-context-changed", onContextChanged);
  window.addEventListener("nv-kml-context-ready", onContextChanged);
  sync(hostElement);
}
