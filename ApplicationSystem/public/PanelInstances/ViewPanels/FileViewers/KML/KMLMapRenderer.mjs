import { createKMLGlobeRenderer, coordinatesFromGlobeLayer } from "./KMLGlobeRenderer.mjs";
import { createKMLFlatMapRenderer, coordinatesFromLeafletLayer, ensureLeaflet, ensureLeafletLoaded } from "./KMLFlatMapRenderer.mjs";

export { ensureLeaflet, ensureLeafletLoaded };

export const KML_VIEW_TYPES = Object.freeze({
  GLOBE: "globe",
  MAP: "map",
});

export function normalizeKMLViewType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["map", "flat", "projection", "flat-map", "flatMap"].includes(normalized)) return KML_VIEW_TYPES.MAP;
  return KML_VIEW_TYPES.GLOBE;
}

export async function createKMLMapRenderer(container, options = {}) {
  const viewType = normalizeKMLViewType(options.viewType);
  const renderer = viewType === KML_VIEW_TYPES.MAP
    ? await createKMLFlatMapRenderer(container, options)
    : await createKMLGlobeRenderer(container, options);
  renderer.viewType = viewType;
  return renderer;
}

export function coordinatesFromLayer(layer) {
  if (!layer) return "";
  if (layer.getLatLng || layer.getLatLngs) return coordinatesFromLeafletLayer(layer);
  return coordinatesFromGlobeLayer(layer);
}
