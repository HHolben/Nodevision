// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/FileManagerDependencies.mjs/FileManagerAPI.mjs
// This file defines browser-side File Manager API logic for the Nodevision UI. It renders interface components and handles user interactions.
export async function fetchDirectoryContents(path = "") {
  const cleanPath = path.replace(/^\/+/, "");
  const res = await fetch(`/api/files?path=${encodeURIComponent(cleanPath)}`);
  if (!res.ok) throw new Error(`Failed to fetch ${path}`);
  return res.json();
}

function normalizePath(value = "") {
  return String(value || "").replace(/^\/+/, "").replace(/\\/g, "/").replace(/\/+/g, "/").trim();
}

function basename(pathValue = "") {
  const parts = normalizePath(pathValue).split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

/**
 * Moves a file or directory into a destination directory path.
 * Uses the same backend move semantics as toolbar Cut+Paste (/api/cut).
 */
export async function moveFileOrDirectory(src, destDir) {
  const source = normalizePath(src);
  const destinationDir = normalizePath(destDir);
  const fileName = basename(source);
  const destination = destinationDir ? `${destinationDir}/${fileName}` : fileName;

  const res = await fetch("/api/cut", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source, destination }),
  });
  if (!res.ok) throw new Error("Move failed");
  return { source, destination };
}
