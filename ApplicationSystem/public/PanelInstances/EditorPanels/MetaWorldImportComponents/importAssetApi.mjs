// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/MetaWorldImportComponents/importAssetApi.mjs
// This file wraps Meta World asset discovery and import API calls for the browser panel.

export async function listNotebookAssets() {
  const res = await fetch("/api/meta-world/assets", { cache: "no-store" });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload?.error || "Failed to list Notebook assets.");
  return Array.isArray(payload.assets) ? payload.assets : [];
}

export async function importNotebookAsset({ worldPath, assetPath, placement }) {
  const res = await fetch("/api/meta-world/import-asset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ worldPath, assetPath, placement }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload?.success) {
    throw new Error(payload?.error || "Failed to import asset.");
  }
  return payload;
}
