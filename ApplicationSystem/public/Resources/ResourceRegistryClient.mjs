// Nodevision/ApplicationSystem/public/Resources/ResourceRegistryClient.mjs
// Browser helpers for typed Nodevision Resource Registry endpoints.

import { readJson } from "/ResourcePaths/ResourcePathsClient.mjs";

const API = "/api/resource-paths/resources";

export async function loadResourceRegistry() {
  return readJson(await fetch(API, { cache: "no-store" }));
}

export async function loadResourceType(typeId) {
  return readJson(await fetch(`${API}/${encodeURIComponent(typeId)}`, { cache: "no-store" }));
}

export async function loadResourceItems(typeId, options = {}) {
  const suffix = options.raw ? "?raw=1" : "";
  const data = await readJson(await fetch(`${API}/${encodeURIComponent(typeId)}${suffix}`, { cache: "no-store" }));
  return data.resources || [];
}

export async function loadCircuitComponentLibraries(options = {}) {
  return loadResourceItems("electronics.component", options);
}

export async function saveResourceSources(typeId, sources) {
  return readJson(await fetch(`${API}/${encodeURIComponent(typeId)}/sources`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sources }),
  }));
}

export function resourceFileUrl({ typeId, sourceId, path }) {
  return `/api/resource-paths/resource-file?type=${encodeURIComponent(typeId)}&source=${encodeURIComponent(sourceId)}&path=${encodeURIComponent(path)}`;
}

export function resourceFontReference(resource) {
  const family = String(resource?.family || resource?.displayName || resource?.id || "NodevisionFont").trim();
  return {
    kind: "resource-font-file",
    src: resource?.url || "",
    fontFamily: family,
    sourceName: resource?.displayName || family,
    format: resource?.format || "",
    fallback: "sans-serif",
    resourceId: resource?.id || "",
    sourceId: resource?.sourceId || "",
    sourceType: resource?.sourceType || "",
    notebookPath: resource?.notebookPath || "",
  };
}
