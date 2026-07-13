export const KML_BASEMAP_TYPES = Object.freeze({
  STREET: "street",
  AVIATION: "aviation",
  TERRAIN: "terrain",
});

const AVIATION_CHART_PACK_TYPE = "nodevision-aviation-chart-pack";
const AVIATION_EMPTY_MESSAGE = "No aviation chart layer loaded. Import or select an aviation chart pack.";
const TILE_PLACEHOLDERS = new Set(["{z}", "{x}", "{y}", "{-y}"]);

function encodeNotebookPath(filePath) {
  return normalizeNotebookPath(filePath)
    .split("/")
    .filter(Boolean)
    .map((segment) => (TILE_PLACEHOLDERS.has(segment) ? segment : encodeURIComponent(segment)))
    .join("/");
}

export function normalizeNotebookPath(filePath = "") {
  return String(filePath || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^Notebook\//i, "")
    .replace(/\/+/g, "/");
}

export function getNotebookFileUrl(filePath = "") {
  const normalized = normalizeNotebookPath(filePath);
  if (!normalized) return "";
  return `/Notebook/${encodeNotebookPath(normalized)}`;
}

function getDirectory(filePath = "") {
  const normalized = normalizeNotebookPath(filePath);
  const slash = normalized.lastIndexOf("/");
  return slash >= 0 ? normalized.slice(0, slash) : "";
}

function joinNotebookPath(baseDir, relativePath) {
  const relative = String(relativePath || "").trim().replace(/\\/g, "/");
  if (!relative) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(relative)) {
    throw new Error("Aviation chart tile URLs must be local Notebook-relative paths.");
  }

  const path = relative.replace(/^\.\//, "");
  if (path.startsWith("/Notebook/")) return normalizeNotebookPath(path.slice("/Notebook/".length));
  if (path.startsWith("Notebook/")) return normalizeNotebookPath(path.slice("Notebook/".length));
  if (path.startsWith("/")) return normalizeNotebookPath(path);

  const pieces = `${baseDir ? `${baseDir}/` : ""}${path}`.split("/");
  const normalized = [];
  for (const piece of pieces) {
    if (!piece || piece === ".") continue;
    if (piece === "..") {
      normalized.pop();
      continue;
    }
    normalized.push(piece);
  }
  return normalized.join("/");
}

function normalizeBounds(bounds) {
  if (!Array.isArray(bounds) || bounds.length !== 2) return null;
  const [southWest, northEast] = bounds;
  if (!Array.isArray(southWest) || !Array.isArray(northEast)) return null;
  const swLat = Number(southWest[0]);
  const swLng = Number(southWest[1]);
  const neLat = Number(northEast[0]);
  const neLng = Number(northEast[1]);
  if (![swLat, swLng, neLat, neLng].every(Number.isFinite)) return null;
  return [[swLat, swLng], [neLat, neLng]];
}

function normalizeLayer(layer, baseDir, index) {
  const format = String(layer?.format || "").trim().toLowerCase();
  if (format !== "xyz") return null;
  if (!layer.tileUrl) {
    throw new Error(`Aviation chart layer ${index + 1} is missing tileUrl.`);
  }

  const tilePath = joinNotebookPath(baseDir, layer.tileUrl);
  if (!tilePath.includes("{z}") || !tilePath.includes("{x}") || !tilePath.includes("{y}")) {
    throw new Error(`Aviation chart layer ${index + 1} tileUrl must include {z}, {x}, and {y}.`);
  }

  return {
    name: String(layer.name || `Layer ${index + 1}`),
    format,
    tileUrl: getNotebookFileUrl(tilePath),
    minZoom: Number.isFinite(Number(layer.minZoom)) ? Number(layer.minZoom) : undefined,
    maxZoom: Number.isFinite(Number(layer.maxZoom)) ? Number(layer.maxZoom) : undefined,
    bounds: normalizeBounds(layer.bounds),
    attribution: layer.attribution ? String(layer.attribution) : "",
  };
}

function getExpirationState(expirationDate) {
  if (!expirationDate) return "unknown";
  const expires = new Date(`${expirationDate}T23:59:59`);
  if (Number.isNaN(expires.getTime())) return "unknown";
  return expires.getTime() < Date.now() ? "expired" : "current";
}

export function getAviationCurrencyMessage(chartPack) {
  if (!chartPack) return AVIATION_EMPTY_MESSAGE;
  const expirationState = getExpirationState(chartPack.expirationDate);
  if (expirationState === "expired") return "Chart may be expired. Verify current chart before flight.";
  if (expirationState === "unknown") return "Chart expiration unknown. Verify chart currency before flight.";
  return "Verify chart currency before flight.";
}

export function getAviationCurrencyTone(chartPack) {
  const expirationState = getExpirationState(chartPack?.expirationDate);
  return expirationState === "current" ? "info" : "warning";
}

export async function loadAviationChartPack(chartPackPath) {
  const normalizedPath = normalizeNotebookPath(chartPackPath);
  if (!normalizedPath) throw new Error(AVIATION_EMPTY_MESSAGE);

  let response;
  try {
    response = await fetch(getNotebookFileUrl(normalizedPath), { cache: "no-store" });
  } catch (error) {
    throw new Error(`Failed to load aviation chart pack: ${error?.message || error}`);
  }

  if (!response?.ok) {
    throw new Error(`Missing chart-pack.json (${response?.status || "network error"}).`);
  }

  let manifest;
  try {
    manifest = await response.json();
  } catch (error) {
    throw new Error(`Invalid chart-pack.json: ${error?.message || error}`);
  }

  if (manifest?.type !== AVIATION_CHART_PACK_TYPE) {
    throw new Error("Invalid aviation chart pack: manifest type is not nodevision-aviation-chart-pack.");
  }

  if (!Array.isArray(manifest.layers) || !manifest.layers.length) {
    throw new Error("Invalid aviation chart pack: no layers are defined.");
  }

  const baseDir = getDirectory(normalizedPath);
  const layers = manifest.layers
    .map((layer, index) => normalizeLayer(layer, baseDir, index))
    .filter(Boolean);

  if (!layers.length) {
    throw new Error("No supported aviation chart layers found. This viewer currently supports local XYZ tile layers.");
  }

  return {
    path: normalizedPath,
    baseDir,
    type: manifest.type,
    version: manifest.version || 1,
    name: String(manifest.name || "Aviation Chart Pack"),
    chartType: manifest.chartType ? String(manifest.chartType) : "unknown",
    effectiveDate: manifest.effectiveDate ? String(manifest.effectiveDate) : "",
    expirationDate: manifest.expirationDate ? String(manifest.expirationDate) : "",
    source: manifest.source ? String(manifest.source) : "",
    layers,
  };
}

export function createStreetBaseLayer(L) {
  return L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  });
}

function createInlineMessageControl(L, message, tone = "info") {
  const control = L.control({ position: "topright" });
  control.onAdd = () => {
    const node = document.createElement("div");
    node.className = `nv-kml-aviation-inline nv-kml-aviation-inline-${tone}`;
    node.textContent = message;
    return node;
  };
  return control;
}

function layerOptionsFromManifest(layer) {
  const options = {
    attribution: layer.attribution || "",
    crossOrigin: false,
    pane: "tilePane",
  };
  if (Number.isFinite(layer.minZoom)) options.minZoom = layer.minZoom;
  if (Number.isFinite(layer.maxZoom)) options.maxZoom = layer.maxZoom;
  if (layer.bounds) options.bounds = layer.bounds;
  return options;
}

export async function createAviationBaseLayerManager(L, map, { chartPackPath = "", onStatus } = {}) {
  const layers = [];
  let messageControl = null;
  let chartPack = null;
  let reportedTileError = false;

  const emit = (status) => {
    try {
      onStatus?.(status);
    } catch (error) {
      console.warn("KML aviation status listener failed", error);
    }
  };

  const showMessage = (message, tone = "info") => {
    if (messageControl) {
      map.removeControl(messageControl);
      messageControl = null;
    }
    messageControl = createInlineMessageControl(L, message, tone);
    messageControl.addTo(map);
  };

  const normalizedPath = normalizeNotebookPath(chartPackPath);
  if (!normalizedPath) {
    showMessage(AVIATION_EMPTY_MESSAGE, "warning");
    emit({ state: "empty", tone: "warning", message: AVIATION_EMPTY_MESSAGE, chartPack: null });
  } else {
    try {
      chartPack = await loadAviationChartPack(normalizedPath);
      chartPack.layers.forEach((layer) => {
        const tileLayer = L.tileLayer(layer.tileUrl, layerOptionsFromManifest(layer));
        tileLayer.on("tileerror", () => {
          if (reportedTileError) return;
          reportedTileError = true;
          emit({
            state: "tile-error",
            tone: "warning",
            message: "Aviation chart tile path not found or could not be read.",
            chartPack,
          });
        });
        tileLayer.addTo(map);
        if (typeof tileLayer.setZIndex === "function") tileLayer.setZIndex(100);
        layers.push(tileLayer);
      });
      emit({
        state: "loaded",
        tone: getAviationCurrencyTone(chartPack),
        message: getAviationCurrencyMessage(chartPack),
        chartPack,
      });
    } catch (error) {
      const message = error?.message || "Failed to load aviation chart pack.";
      showMessage(message, "error");
      emit({ state: "error", tone: "error", message, chartPack: null, error });
    }
  }

  return {
    get chartPack() {
      return chartPack;
    },
    destroy() {
      layers.forEach((layer) => {
        if (map.hasLayer(layer)) map.removeLayer(layer);
      });
      if (messageControl) {
        map.removeControl(messageControl);
        messageControl = null;
      }
    },
  };
}
