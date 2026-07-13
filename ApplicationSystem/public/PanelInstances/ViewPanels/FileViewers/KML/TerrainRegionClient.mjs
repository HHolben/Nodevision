// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/KML/TerrainRegionClient.mjs
// Browser API helpers for terrain estimate, preview, export, and job polling.

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `${response.status} ${response.statusText}`);
  return payload;
}

export function estimateTerrainRegion(payload) {
  return postJson("/api/terrain/estimate", payload);
}

export function previewTerrainRegion(payload) {
  return postJson("/api/terrain/preview", payload);
}

export function exportTerrainRegion(payload) {
  return postJson("/api/terrain/export", payload);
}

export async function getTerrainJob(jobId) {
  const response = await fetch(`/api/terrain/jobs/${encodeURIComponent(jobId)}`, { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `${response.status} ${response.statusText}`);
  return payload;
}

export function cancelTerrainJob(jobId) {
  return postJson(`/api/terrain/jobs/${encodeURIComponent(jobId)}/cancel`, {});
}

export function retryTerrainJob(jobId) {
  return postJson(`/api/terrain/jobs/${encodeURIComponent(jobId)}/retry`, {});
}
