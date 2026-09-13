// Nodevision/ApplicationSystem/public/panels/workspaceParts/workspacePaths.mjs
// This module normalizes Notebook paths and performs local Notebook file creation checks for workspace panel workflows.

export function normalizeNotebookPath(value) {
  let cleaned = String(value || "").trim();
  if (!cleaned) return "";
  try {
    const parsed = new URL(cleaned, window.location.origin);
    cleaned = parsed.pathname || cleaned;
  } catch {}
  cleaned = cleaned.replace(/\\/g, "/").replace(/[?#].*$/, "").replace(/^https?:\/\/[^/]+/i, "").replace(/^\/+/, "");
  if (cleaned.toLowerCase().startsWith("notebook/")) cleaned = cleaned.slice("Notebook/".length);
  return cleaned.trim();
}

export function sameNotebookPath(a, b) {
  const left = normalizeNotebookPath(a).toLowerCase();
  const right = normalizeNotebookPath(b).toLowerCase();
  return Boolean(left && right && left === right);
}

export function joinNotebookPath(directoryPath, filename) {
  const cleanDirectory = normalizeNotebookPath(directoryPath).replace(/\/+$/, "");
  const cleanFilename = String(filename || "").replace(/^\/+/, "").replace(/\\/g, "/");
  return cleanDirectory ? `${cleanDirectory}/${cleanFilename}` : cleanFilename;
}

export function notebookAssetUrl(pathValue = "") {
  const cleanPath = normalizeNotebookPath(pathValue);
  const parts = cleanPath.split("/").filter(Boolean).map(encodeURIComponent);
  return `/Notebook/${parts.join("/")}`;
}

export async function notebookFileExists(pathValue = "") {
  const cleanPath = normalizeNotebookPath(pathValue);
  if (!cleanPath) return false;
  const url = notebookAssetUrl(cleanPath);
  try {
    const head = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (head.ok) return true;
    if (head.status !== 405) return false;
  } catch {}
  try {
    const res = await fetch(url, { cache: "no-store", headers: { Range: "bytes=0-0" } });
    return res.ok;
  } catch {
    return false;
  }
}

export async function createNotebookFile(relativePath = "") {
  const cleanPath = normalizeNotebookPath(relativePath);
  if (!cleanPath) throw new Error("File path is required.");
  const response = await fetch("/api/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: cleanPath }),
  });
  if (response.ok || response.status === 409) return { path: cleanPath, existed: response.status === 409 };
  const message = await response.text().catch(() => "");
  throw new Error(message || "Failed to create " + cleanPath + ".");
}

export async function refreshNavigatorsForDirectory(directoryPath = "") {
  const cleanDirectory = normalizeNotebookPath(directoryPath);
  const tasks = [];
  if (typeof window.refreshFileManager === "function") tasks.push(window.refreshFileManager(cleanDirectory));
  if (typeof window.refreshGraphManager === "function") tasks.push(window.refreshGraphManager({ fit: false, reason: "directory-editing-file-created" }));
  await Promise.allSettled(tasks);
}
