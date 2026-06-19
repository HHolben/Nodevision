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


let requestedUserLocationEnabled = null;

function currentUserLocationEnabled() {
  const fromContext = window.KMLEditorContext?.getUserLocationEnabled?.();
  if (typeof fromContext === "boolean") return fromContext;
  if (typeof requestedUserLocationEnabled === "boolean") return requestedUserLocationEnabled;
  return window.NodevisionState?.kmlUserLocationEnabled === true;
}

const DEFAULT_CELESTIAL_OPTIONS = Object.freeze({
  showStars: true,
  showSun: true,
  showMoon: true,
  showLabels: false,
  useCurrentTime: true,
  useSunLight: true,
});

function currentCelestialOptions() {
  const fromContext = window.KMLEditorContext?.getCelestialOptions?.();
  return {
    ...DEFAULT_CELESTIAL_OPTIONS,
    ...(window.NodevisionState?.kmlCelestialOptions || {}),
    ...(fromContext || {}),
  };
}

function dispatchAction(action) {
  const contextHandler = window.KMLEditorContext?.handleToolbarAction;
  if (typeof contextHandler === "function") {
    const result = contextHandler(action);
    if (typeof result !== "undefined") return result;
  }

  const handler = window.NodevisionState?.activeActionHandler;
  if (typeof handler === "function") {
    const result = handler(action);
    if (typeof result !== "undefined" && result !== null && result !== false) return result;
  }

  if (action === "enableUserLocation" || action === "disableUserLocation" || action === "centerUserLocation") {
    window.NodevisionState = window.NodevisionState || {};
    window.NodevisionState.kmlUserLocationEnabled = action !== "disableUserLocation";
    return true;
  }
  if (String(action || "").startsWith("setCelestialOption:")) {
    const [, key, rawValue] = String(action).split(":");
    window.NodevisionState = window.NodevisionState || {};
    window.NodevisionState.kmlCelestialOptions = {
      ...DEFAULT_CELESTIAL_OPTIONS,
      ...(window.NodevisionState.kmlCelestialOptions || {}),
      [key]: rawValue === "true" || rawValue === "1" || rawValue === "yes",
    };
    return true;
  }
  return undefined;
}

function setViewType(viewType) {
  const normalized = normalizeViewType(viewType);
  if (normalized === "aviation") return dispatchAction("viewTypeAviation");
  if (normalized === "map") return dispatchAction("viewTypeMap");
  return dispatchAction("viewTypeGlobe");
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
      "<span style=\"display:flex;align-items:center;gap:4px;\">" +
        "<input data-nv-kml-user-location type=\"checkbox\" aria-label=\"Enable My Location\" />" +
        "<button type=\"button\" data-nv-kml-user-location-center title=\"Zoom to my location\" style=\"height:24px;padding:0 8px;border:1px solid #aeb9c8;border-radius:4px;background:#fff;color:#1f2933;font:12px system-ui,-apple-system,Segoe UI,sans-serif;cursor:pointer;\">My Location</button>" +
      "</span>" +
      "<span aria-hidden=\"true\" style=\"width:1px;height:20px;background:#c8d0da;\"></span>" +
      "<label style=\"display:flex;align-items:center;gap:6px;min-width:min(330px,100%);\">Search" +
        "<input data-nv-kml-location-search type=\"search\" placeholder=\"Airport, city, address\" style=\"height:24px;min-width:220px;width:28vw;max-width:380px;box-sizing:border-box;border:1px solid #aeb9c8;border-radius:4px;padding:2px 6px;font:12px system-ui,-apple-system,Segoe UI,sans-serif;\" />" +
      "</label>" +
      "<button type=\"button\" data-nv-kml-location-search-run style=\"height:24px;padding:0 8px;\">Go</button>" +
      "<button type=\"button\" data-nv-kml-sectional-download title=\"Download FAA sectional for selected pin\" style=\"height:24px;padding:0 8px;\">Get Sectional</button>" +
      "<span aria-hidden=\"true\" style=\"width:1px;height:20px;background:#c8d0da;\"></span>" +
      "<fieldset style=\"display:flex;align-items:center;gap:8px;border:0;margin:0;padding:0;\">" +
        "<legend style=\"position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip-path:inset(50%);\">Celestial sky</legend>" +
        "<label style=\"display:flex;align-items:center;gap:4px;\"><input data-nv-kml-celestial=\"showStars\" type=\"checkbox\" /> Stars</label>" +
        "<label style=\"display:flex;align-items:center;gap:4px;\"><input data-nv-kml-celestial=\"showSun\" type=\"checkbox\" /> Sun</label>" +
        "<label style=\"display:flex;align-items:center;gap:4px;\"><input data-nv-kml-celestial=\"showMoon\" type=\"checkbox\" /> Moon</label>" +
        "<label style=\"display:flex;align-items:center;gap:4px;\"><input data-nv-kml-celestial=\"showLabels\" type=\"checkbox\" /> Labels</label>" +
        "<label style=\"display:flex;align-items:center;gap:4px;\"><input data-nv-kml-celestial=\"useCurrentTime\" type=\"checkbox\" /> Current time</label>" +
        "<label style=\"display:flex;align-items:center;gap:4px;\"><input data-nv-kml-celestial=\"useSunLight\" type=\"checkbox\" /> Light</label>" +
      "</fieldset>" +
      "<button type=\"button\" data-nv-kml-celestial-refresh title=\"Refresh celestial positions using the current system time\" style=\"height:24px;padding:0 8px;\">Refresh Sky</button>" +
    "</div>";
}

function sync(hostElement) {
  const value = currentViewType();
  hostElement.querySelectorAll('input[name="nv-kml-view-type"]').forEach((input) => {
    input.checked = input.value === value;
  });
  const userLocationInput = hostElement.querySelector("[data-nv-kml-user-location]");
  if (userLocationInput) {
    const fromContext = window.KMLEditorContext?.getUserLocationEnabled?.();
    if (typeof fromContext === "boolean") {
      if (typeof requestedUserLocationEnabled === "boolean" && fromContext !== requestedUserLocationEnabled) {
        window.KMLEditorContext?.setUserLocationEnabled?.(requestedUserLocationEnabled);
        userLocationInput.checked = requestedUserLocationEnabled;
      } else {
        if (typeof requestedUserLocationEnabled === "boolean") requestedUserLocationEnabled = null;
        userLocationInput.checked = fromContext;
      }
    } else {
      userLocationInput.checked = currentUserLocationEnabled();
    }
  }

  const celestialOptions = currentCelestialOptions();
  hostElement.querySelectorAll("[data-nv-kml-celestial]").forEach((input) => {
    const key = input.dataset.nvKmlCelestial;
    input.checked = celestialOptions[key] !== false;
    if (key === "showLabels") input.checked = celestialOptions.showLabels === true;
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
  const runLocationSearch = () => {
    const input = hostElement.querySelector("[data-nv-kml-location-search]");
    const query = String(input?.value || "").trim();
    if (query) dispatchAction("searchLocation:" + encodeURIComponent(query));
  };
  hostElement.querySelector("[data-nv-kml-location-search-run]")?.addEventListener("click", runLocationSearch);
  hostElement.querySelector("[data-nv-kml-sectional-download]")?.addEventListener("click", () => dispatchAction("downloadSectionalForSelectedPin"));
  hostElement.querySelectorAll("[data-nv-kml-celestial]").forEach((input) => {
    input.addEventListener("change", () => {
      dispatchAction("setCelestialOption:" + input.dataset.nvKmlCelestial + ":" + String(input.checked));
      sync(hostElement);
    });
  });
  hostElement.querySelector("[data-nv-kml-celestial-refresh]")?.addEventListener("click", () => {
    dispatchAction("refreshCelestialNow");
    sync(hostElement);
  });
  hostElement.querySelector("[data-nv-kml-user-location]")?.addEventListener("change", (event) => {
    requestedUserLocationEnabled = event.currentTarget?.checked === true;
    dispatchAction(requestedUserLocationEnabled ? "enableUserLocation" : "disableUserLocation");
  });
  hostElement.querySelector("[data-nv-kml-user-location-center]")?.addEventListener("click", () => {
    requestedUserLocationEnabled = true;
    dispatchAction("centerUserLocation");
    sync(hostElement);
  });
  hostElement.querySelector("[data-nv-kml-location-search]")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runLocationSearch();
    }
  });
  const onContextChanged = () => sync(hostElement);
  window.addEventListener("nv-kml-context-changed", onContextChanged);
  window.addEventListener("nv-kml-context-ready", onContextChanged);
  sync(hostElement);
}
