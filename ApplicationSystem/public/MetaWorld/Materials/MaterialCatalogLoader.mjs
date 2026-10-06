// Nodevision/ApplicationSystem/public/MetaWorld/Materials/MaterialCatalogLoader.mjs
// This module provides material catalog loader behavior shared by Nodevision world objects, equations, and voxels.

import { WORLD_OBJECT_MATERIAL_CATALOG_PATH, DEFAULT_WORLD_OBJECT_MATERIAL_ROWS } from './MaterialCatalogRows.mjs';
import { normalizeWorldObjectMaterialId, rememberMaterialCatalogFiles, readWorldObjectMatterState } from './MaterialIdentity.mjs';
import { normalizeCatalogEntry, parseWorldObjectMaterialCsv } from './MaterialCatalogCsv.mjs';

export function fallbackWorldObjectMaterialCatalog() {
  return DEFAULT_WORLD_OBJECT_MATERIAL_ROWS.map(normalizeCatalogEntry);
}

export let materialCatalogPromise = null;

export async function loadCatalogMaterialDefinition(entry, fetcher, cacheMode) {
  if (!entry?.materialFile || typeof fetcher !== "function") return null;
  try {
    const response = await fetcher(entry.materialFile, { cache: cacheMode });
    if (!response?.ok) throw new Error("HTTP " + (response?.status || "error"));
    return await response.json();
  } catch (err) {
    console.warn("World object material JSON failed to load:", entry.materialFile, err);
    return null;
  }
}

export function readWorldObjectMaterialColor(def = {}) {
  const candidates = [
    def?.defaultColor,
    def?.rendering?.color,
    def?.color,
    def?.material?.color,
    def?.terrain?.color
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return "";
}

export function enrichMaterialCatalogEntry(entry, materialDefinition = null) {
  const matterState = readWorldObjectMatterState(materialDefinition || {}, entry.matterState);
  const color = readWorldObjectMaterialColor(materialDefinition || {});
  return {
    ...entry,
    displayName: materialDefinition?.displayName || entry.materialName,
    matterState,
    MatterState: matterState || undefined,
    color: color || undefined,
    materialDefinition: materialDefinition || undefined,
  };
}

export async function enrichMaterialCatalog(entries, fetcher, cacheMode) {
  if (typeof fetcher !== "function") return entries.map((entry) => enrichMaterialCatalogEntry(entry));
  return Promise.all(entries.map(async (entry) => {
    const materialDefinition = await loadCatalogMaterialDefinition(entry, fetcher, cacheMode);
    return enrichMaterialCatalogEntry(entry, materialDefinition);
  }));
}

export async function loadRegistryMaterialCatalog(fetcher, cacheMode) {
  if (typeof fetcher !== "function") return [];
  try {
    const response = await fetcher("/api/resource-paths/resources/material", { cache: cacheMode });
    if (!response?.ok) throw new Error("HTTP " + (response?.status || "error"));
    const payload = await response.json();
    return (payload.resources || []).map(normalizeRegistryMaterialEntry).filter((entry) => entry.materialName && entry.materialFile);
  } catch (err) {
    console.warn("World object material registry failed to load:", err);
    return [];
  }
}

export function normalizeRegistryMaterialEntry(resource = {}) {
  const materialDefinition = resource.data || resource.materialDefinition || {};
  const materialId = normalizeWorldObjectMaterialId(materialDefinition.id || resource.materialId || resource.id, resource.displayName);
  const materialName = materialDefinition.displayName || resource.displayName || materialId;
  const materialFile = resource.url || materialDefinition.materialFile || "";
  return enrichMaterialCatalogEntry({
    materialName,
    materialJSONfile: resource.path || materialFile,
    materialFile,
    materialId,
    matterState: readWorldObjectMatterState(materialDefinition),
  }, materialDefinition);
}

export async function loadWorldObjectMaterialCatalog(options = {}) {
  const force = options.force === true;
  if (!force && materialCatalogPromise) return materialCatalogPromise;

  materialCatalogPromise = (async () => {
    const fetcher = options.fetch || globalThis.fetch;
    const cacheMode = force ? "reload" : "no-cache";
    const registryEntries = await loadRegistryMaterialCatalog(fetcher, cacheMode);
    if (registryEntries.length > 0) {
      rememberMaterialCatalogFiles(registryEntries);
      return registryEntries;
    }
    let entries = fallbackWorldObjectMaterialCatalog();
    if (typeof fetcher === "function") {
      try {
        const response = await fetcher(WORLD_OBJECT_MATERIAL_CATALOG_PATH, { cache: cacheMode });
        if (!response?.ok) throw new Error("HTTP " + (response?.status || "error"));
        const parsed = parseWorldObjectMaterialCsv(await response.text());
        if (parsed.length > 0) entries = parsed;
      } catch (err) {
        console.warn("World object material catalog failed to load:", err);
      }
    }
    const enriched = await enrichMaterialCatalog(entries, fetcher, cacheMode);
    rememberMaterialCatalogFiles(enriched);
    return enriched;
  })();

  return materialCatalogPromise;
}
