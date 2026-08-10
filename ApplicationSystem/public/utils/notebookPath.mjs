// Nodevision/ApplicationSystem/public/utils/notebookPath.mjs
// Small helpers for normalizing Notebook-relative paths and building Nodevision-served URLs.

function trimTrailingSlashes(value) {
  let text = String(value || "");
  while (text.length > 1 && text.endsWith("/")) {
    text = text.slice(0, -1);
  }
  return text;
}

function cleanRouteName(value) {
  const parts = String(value || "Notebook").split("/").filter(Boolean);
  return parts.join("/") || "Notebook";
}

export function normalizeNotebookRelativePath(inputPath) {
  let cleaned = String(inputPath || "").split(String.fromCharCode(92)).join("/").trim();
  cleaned = cleaned.replace(/[?#].*$/, "");
  cleaned = cleaned.split("/").filter(Boolean).join("/");
  if (cleaned.toLowerCase().startsWith("notebook/")) {
    cleaned = cleaned.slice("Notebook/".length);
  }
  return cleaned.split("/").filter(Boolean).join("/");
}

export function toNotebookAssetUrl(relativePath, { base = "/Notebook" } = {}) {
  const baseUrl = trimTrailingSlashes(base || "/Notebook");
  const parts = String(relativePath || "")
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent);
  return `${baseUrl}/${parts.join("/")}`;
}

export function normalizeServedNotebookPath(inputPath) {
  let cleaned = normalizeNotebookRelativePath(inputPath);
  if (cleaned.toLowerCase().startsWith("php/")) {
    cleaned = cleaned.slice("php/".length);
  }
  return cleaned;
}

export function getNodevisionRouteBase({ route = "Notebook", origin } = {}) {
  const cleanRoute = cleanRouteName(route);
  const currentOrigin = trimTrailingSlashes(origin ?? globalThis.location?.origin ?? "");
  return currentOrigin ? `${currentOrigin}/${cleanRoute}` : `/${cleanRoute}`;
}

export function toNodevisionDeploymentUrl(pathValue, { route = "Notebook", origin } = {}) {
  const base = getNodevisionRouteBase({ route, origin });
  return toNotebookAssetUrl(normalizeServedNotebookPath(pathValue), { base });
}

export function toNotebookDeploymentUrl(pathValue, options = {}) {
  return toNodevisionDeploymentUrl(pathValue, { ...options, route: "Notebook" });
}

export function toPhpDeploymentUrl(pathValue, options = {}) {
  return toNodevisionDeploymentUrl(pathValue, { ...options, route: "php" });
}
