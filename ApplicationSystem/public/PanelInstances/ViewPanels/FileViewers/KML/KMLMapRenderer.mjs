import { createKMLGlobeRenderer, coordinatesFromGlobeLayer } from "./KMLGlobeRenderer.mjs";
import { createKMLFlatMapRenderer, coordinatesFromLeafletLayer, ensureLeaflet, ensureLeafletLoaded } from "./KMLFlatMapRenderer.mjs";

export { ensureLeaflet, ensureLeafletLoaded };

export const KML_VIEW_TYPES = Object.freeze({
  GLOBE: "globe",
  MAP: "map",
  AVIATION: "aviation",
  TERRAIN: "terrain",
});

export function normalizeKMLViewType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["terrain", "topo", "topographic", "contour", "contours"].includes(normalized)) return KML_VIEW_TYPES.TERRAIN;
  if (["aviation", "aviation-map", "aviationmap", "chart", "charts", "sectional"].includes(normalized)) return KML_VIEW_TYPES.AVIATION;
  if (["map", "street", "street-map", "flat", "projection", "flat-map", "flatmap"].includes(normalized)) return KML_VIEW_TYPES.MAP;
  return KML_VIEW_TYPES.GLOBE;
}

export async function createKMLMapRenderer(container, options = {}) {
  const viewType = normalizeKMLViewType(options.viewType);
  const renderer = viewType === KML_VIEW_TYPES.GLOBE
    ? await createKMLGlobeRenderer(container, options)
    : await createKMLFlatMapRenderer(container, {
      ...options,
      basemapType: viewType === KML_VIEW_TYPES.AVIATION ? "aviation" : viewType === KML_VIEW_TYPES.TERRAIN ? "terrain" : "street",
    });
  renderer.viewType = viewType;
  return renderer;
}

export function coordinatesFromLayer(layer) {
  if (!layer) return "";
  if (layer.getLatLng || layer.getLatLngs) return coordinatesFromLeafletLayer(layer);
  return coordinatesFromGlobeLayer(layer);
}
