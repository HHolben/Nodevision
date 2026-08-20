// Nodevision/ApplicationSystem/public/ResourcePaths/ResourcePathsClient.mjs
// This module provides browser-side helpers for the authenticated Resource Paths API.

const API = "/api/resource-paths";

export async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || `Request failed with ${response.status}`);
  return data;
}

export async function loadResourcePaths() {
  const data = await readJson(await fetch(API, { cache: "no-store" }));
  return data.resourcePaths || [];
}

export async function saveResourcePaths(resourcePaths) {
  const data = await readJson(await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resourcePaths }),
  }));
  return data.resourcePaths || [];
}

export async function browseResourceDirectories(path = "") {
  const data = await readJson(await fetch(`${API}/browse?path=${encodeURIComponent(path)}`, { cache: "no-store" }));
  return data;
}
