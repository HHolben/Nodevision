// Nodevision/ApplicationSystem/public/utils/notebookPath.mjs
// Small helpers for normalizing Notebook-relative paths and building Nodevision-served URLs.
// Notebook-local references stored inside HTML/PHP documents are relative to the
// directory containing the source document; Graph resolution performs the inverse.

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

export function normalizeNotebookRelativePath(inputPath, { stripSuffix = true } = {}) {
  const pathText = stripSuffix ? splitNotebookReferenceSuffix(inputPath).pathPart : String(inputPath ?? "");
  let cleaned = decodeNotebookPathSegments(pathText).split(String.fromCharCode(92)).join("/").trim();
  cleaned = cleaned.replace(/^\/+/, "");
  if (cleaned.toLowerCase() === "notebook") return "";
  if (cleaned.toLowerCase().startsWith("notebook/")) {
    cleaned = cleaned.slice("Notebook/".length);
  }
  return normalizeNotebookRelativeParts(cleaned) || "";
}

export function normalizeNotebookFilePath(inputPath) {
  return normalizeNotebookRelativePath(inputPath, { stripSuffix: false });
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

export function splitNotebookReferenceSuffix(rawReference = "") {
  const value = String(rawReference ?? "");
  const hashIndex = value.indexOf("#");
  const queryIndex = value.indexOf("?");
  const indices = [hashIndex, queryIndex].filter((idx) => idx >= 0);
  if (indices.length === 0) return { pathPart: value, suffix: "" };
  const cut = Math.min(...indices);
  return { pathPart: value.slice(0, cut), suffix: value.slice(cut) };
}

export function isExternalNotebookReference(rawReference = "") {
  const value = String(rawReference || "").trim();
  if (!value) return false;
  if (value.startsWith("#") || value.startsWith("//")) return true;
  return /^[a-z][a-z0-9+.-]*:/i.test(value);
}

export function getRelativeNotebookReference({ sourcePath = "", targetPath = "", suffix = "" } = {}) {
  const source = normalizeNotebookRelativePath(sourcePath);
  const target = normalizeNotebookFilePath(targetPath);
  if (!target) return "";

  const sourceDir = dirnameNotebookPath(source);
  const relative = relativeNotebookPath(sourceDir, target) || basenameNotebookPath(target);
  return `${encodeNotebookReferencePath(relative)}${suffix}`;
}

export function resolveNotebookReference({ sourcePath = "", reference = "" } = {}) {
  const raw = String(reference || "").trim();
  if (!raw || isExternalNotebookReference(raw)) return null;

  const { pathPart } = splitNotebookReferenceSuffix(raw);
  if (!String(pathPart || "").trim()) return null;

  const decoded = decodeNotebookPathSegments(pathPart).split(String.fromCharCode(92)).join("/");
  const rootish = decoded.startsWith("/") || decoded.toLowerCase().startsWith("notebook/");
  let candidate = decoded.replace(/^\/+/, "");

  if (candidate.toLowerCase() === "notebook") return "";
  if (candidate.toLowerCase().startsWith("notebook/")) {
    candidate = candidate.slice("Notebook/".length);
  } else if (!rootish) {
    const sourceDir = dirnameNotebookPath(normalizeNotebookRelativePath(sourcePath));
    candidate = [sourceDir, candidate].filter(Boolean).join("/");
  }

  return normalizeNotebookRelativeParts(candidate);
}

function normalizeNotebookRelativeParts(pathValue = "") {
  const parts = [];
  for (const part of String(pathValue || "").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (parts.length === 0) return null;
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join("/");
}

function dirnameNotebookPath(pathValue = "") {
  const clean = normalizeNotebookRelativeParts(pathValue) || "";
  const idx = clean.lastIndexOf("/");
  return idx < 0 ? "" : clean.slice(0, idx);
}

function basenameNotebookPath(pathValue = "") {
  const clean = normalizeNotebookRelativeParts(pathValue) || "";
  return clean.split("/").filter(Boolean).pop() || "";
}

function relativeNotebookPath(fromDir = "", targetPath = "") {
  const from = (normalizeNotebookRelativeParts(fromDir) || "").split("/").filter(Boolean);
  const to = (normalizeNotebookRelativeParts(targetPath) || "").split("/").filter(Boolean);
  let i = 0;
  while (i < from.length && i < to.length && from[i] === to[i]) i += 1;
  return [
    ...new Array(Math.max(0, from.length - i)).fill(".."),
    ...to.slice(i),
  ].join("/");
}

function encodeNotebookReferencePath(pathValue = "") {
  return String(pathValue || "")
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => segment === ".." ? ".." : encodeURIComponent(segment))
    .join("/");
}

function decodeNotebookPathSegments(pathValue = "") {
  return String(pathValue || "")
    .split("/")
    .map((segment) => {
      try {
        const decoded = decodeURIComponent(segment);
        return /[\\/]/.test(decoded) ? segment : decoded;
      } catch {
        return segment;
      }
    })
    .join("/");
}
