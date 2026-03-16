// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/FileManagerDependencies.mjs/FileManagerAPI.mjs
// This file defines browser-side File Manager API logic for the Nodevision UI. It renders interface components and handles user interactions.
export async function fetchDirectoryContents(path = "") {
  const cleanPath = path.replace(/^\/+/, "");
  const res = await fetch(`/api/files?path=${encodeURIComponent(cleanPath)}`);
  if (!res.ok) throw new Error(`Failed to fetch ${path}`);
  return res.json();
}

export async function moveFileOrDirectory(src, dest) {
  const res = await fetch("/api/files/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ src, dest }),
  });
  if (!res.ok) throw new Error("Move failed");
}
