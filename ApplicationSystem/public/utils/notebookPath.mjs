// Nodevision/ApplicationSystem/public/utils/notebookPath.mjs
// Small helpers for normalizing Notebook-relative paths and building `/Notebook/...` URLs.

export function normalizeNotebookRelativePath(inputPath) {
  let cleaned = String(inputPath || "").replace(/\\/g, "/").trim();
  cleaned = cleaned.replace(/[?#].*$/, "");
  cleaned = cleaned.replace(/\/+/g, "/");
  cleaned = cleaned.replace(/^\/+/, "");
  if (cleaned.toLowerCase().startsWith("notebook/")) {
    cleaned = cleaned.slice("Notebook/".length);
  }
  cleaned = cleaned.replace(/^\/+/, "");
  cleaned = cleaned.replace(/\/+/g, "/");
  return cleaned;
}

export function toNotebookAssetUrl(relativePath, { base = "/Notebook" } = {}) {
  const baseUrl = String(base || "/Notebook").replace(/\/+$/, "");
  const parts = String(relativePath || "")
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent);
  return `${baseUrl}/${parts.join("/")}`;
}
