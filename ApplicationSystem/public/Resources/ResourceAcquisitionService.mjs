// Nodevision/ApplicationSystem/public/Resources/ResourceAcquisitionService.mjs
// Shared browser-side Resource Acquisition service for Insert Media and standalone install/reference workflows.

import { loadResourceItems } from "/Resources/ResourceRegistryClient.mjs";
import {
  createInlineResourceReference,
  createNotebookResourceReference,
  createResourceReference,
  createUrlResourceReference,
  notebookReferenceForSource,
  RESOURCE_SOURCE_KINDS,
} from "/Resources/ResourceReference.mjs";
import { RESOURCE_PROVIDER_IDS, getResourceProvider, listResourceProviders } from "/Resources/ResourceProviderRegistry.mjs";
import { normalizeNotebookFilePath, toNotebookAssetUrl } from "/utils/notebookPath.mjs";

export { RESOURCE_PROVIDER_IDS, getResourceProvider, listResourceProviders };

export function normalizeNotebookPath(path) {
  const raw = String(path || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
  const relative = normalizeNotebookFilePath(path);
  if (relative) return `Notebook/${relative}`;
  return raw.toLowerCase() === "notebook" ? "Notebook" : "";
}

export function notebookHrefFromPath(notebookPath) {
  const relative = normalizeNotebookFilePath(notebookPath);
  return relative ? toNotebookAssetUrl(relative) : "";
}

export function dirname(notebookPath) {
  const p = normalizeNotebookPath(notebookPath);
  if (!p) return "Notebook";
  const idx = p.lastIndexOf("/");
  if (idx <= "Notebook".length) return "Notebook";
  return p.slice(0, idx);
}

export function joinNotebookPath(dirPath, fileName) {
  const dir = normalizeNotebookPath(dirPath || "Notebook");
  const name = String(fileName || "").trim().replace(/^\/+/, "");
  if (!name) return dir;
  return `${dir}/${name}`.replace(/\/+/g, "/");
}

export function notebookPathFromPickedFile(file) {
  const candidates = [file?.path, file?.webkitRelativePath].filter(Boolean);
  for (const candidate of candidates) {
    const raw = String(candidate || "").trim().split(String.fromCharCode(92)).join("/");
    if (!raw) continue;
    const match = raw.match(/(?:^|\/)Notebook\/(.+)$/i);
    if (match?.[1]) return normalizeNotebookPath(match[1]);
    if (/^Notebook(?:\/|$)/i.test(raw)) return normalizeNotebookPath(raw);
  }
  return "";
}

export function getActiveEditorNotebookPath() {
  const candidates = [window.currentActiveFilePath, window.selectedFilePath, window.filePath, window.NodevisionState?.selectedFile].filter(Boolean);
  for (const c of candidates) {
    const p = normalizeNotebookPath(c);
    if (p) return p;
  }
  return "";
}

export function looksLikeUrlOrAbsPath(value) {
  const s = String(value || "").trim();
  return /^(https?:)?\/\//i.test(s) || s.startsWith("/") || s.startsWith("data:");
}

export function notebookSourceFromPath(notebookPath, editorNotebookPath = "") {
  return notebookReferenceForSource({ sourcePath: editorNotebookPath || getActiveEditorNotebookPath(), notebookPath: normalizeNotebookPath(notebookPath) });
}

export async function readFileAsDataUrl(file) {
  const f = file;
  if (!f) throw new Error("No file selected");
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("Unable to read selected file."));
    r.readAsDataURL(f);
  });
}

export async function readFileAsText(file) {
  const f = file;
  if (!f) throw new Error("No file selected");
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("Unable to read selected file as text."));
    r.readAsText(f);
  });
}

export async function fetchUrlAsDataUrl(url) {
  const target = String(url || "").trim();
  if (!target) throw new Error("Missing URL");
  const res = await fetch(target);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("Unable to read fetched data."));
    r.readAsDataURL(blob);
  });
}

export async function fetchUrlAsText(url) {
  const target = String(url || "").trim();
  if (!target) throw new Error("Missing URL");
  const res = await fetch(target);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return await res.text();
}

export function dataUrlFromText(text, mimeType = "text/plain") {
  const t = String(text ?? "");
  const mime = String(mimeType || "text/plain").trim() || "text/plain";
  return `data:${mime};charset=utf-8,${encodeURIComponent(t)}`;
}

export async function saveNotebookText(notebookPath, content, mimeType = "text/plain") {
  const path = normalizeNotebookPath(notebookPath);
  if (!path) throw new Error("Missing notebook path");
  const res = await fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content: String(content ?? ""), encoding: "utf8", mimeType }),
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.success) throw new Error(payload?.error || `${res.status} ${res.statusText}`);
  return path;
}

export async function saveNotebookBinaryFromDataUrl(notebookPath, dataUrl, fallbackMime = "application/octet-stream") {
  const path = normalizeNotebookPath(notebookPath);
  if (!path) throw new Error("Missing notebook path");
  const raw = String(dataUrl || "").trim();
  const match = raw.match(/^data:([^;]+);base64,(.*)$/i);
  if (!match) throw new Error("Expected a base64 data URL");
  const mimeType = (match[1] || "").trim() || fallbackMime;
  const base64 = match[2] || "";
  const res = await fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content: base64, encoding: "base64", mimeType }),
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.success) throw new Error(payload?.error || `${res.status} ${res.statusText}`);
  return path;
}

function defaultResourceFolder(resourceType = "file") {
  const type = String(resourceType || "file").toLowerCase();
  if (type === "image") return "Resources/Media/Images";
  if (type === "audio") return "Resources/Media/Audio";
  if (type === "video") return "Resources/Media/Video";
  if (type === "model") return "Resources/Models";
  return "Resources";
}

function sanitizeFileName(name = "") {
  return String(name || "").trim().replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || `resource-${Date.now()}`;
}

function destinationPath({ resourceType = "file", destinationPath = "", sourceName = "" } = {}) {
  const explicit = normalizeNotebookPath(destinationPath);
  if (explicit && explicit !== "Notebook") return explicit;
  const folder = normalizeNotebookPath(joinNotebookPath("Notebook", defaultResourceFolder(resourceType)));
  return normalizeNotebookPath(joinNotebookPath(folder, sanitizeFileName(sourceName)));
}

export async function acquireRegistryResource({ resourceType = "file", resourceId = "", sourcePath = "" } = {}) {
  const resources = await loadResourceItems(resourceType, { raw: true });
  const wanted = String(resourceId || "").trim();
  const resource = resources.find((item) => String(item.id || item.logicalId || item.path || "") === wanted || String(item.path || "") === wanted) || resources[0];
  if (!resource) throw new Error(`No installed ${resourceType} resources were found.`);
  const notebookPath = resource.notebookPath ? normalizeNotebookPath(resource.notebookPath) : "";
  return createResourceReference({
    resourceType,
    sourceKind: RESOURCE_SOURCE_KINDS.REGISTRY,
    sourcePath,
    sourceName: resource.displayName || resource.path || resource.id || "",
    src: notebookPath ? notebookSourceFromPath(notebookPath, sourcePath) : (resource.url || ""),
    notebookPath,
    providerId: RESOURCE_PROVIDER_IDS.REGISTRY,
    resourceId: resource.id || resource.logicalId || "",
    metadata: { title: resource.displayName || resource.path || "", license: "unknown" },
  });
}

export async function acquireResource(options = {}) {
  const providerId = String(options.providerId || RESOURCE_PROVIDER_IDS.NOTEBOOK).trim();
  const mode = String(options.mode || "reference").trim().toLowerCase();
  const resourceType = String(options.resourceType || "file").trim().toLowerCase() || "file";
  const sourcePath = String(options.sourcePath || getActiveEditorNotebookPath() || "").trim();
  const sourceName = String(options.sourceName || options.file?.name || options.url?.split("/").pop() || options.notebookPath?.split("/").pop() || "").trim();

  if (providerId === RESOURCE_PROVIDER_IDS.REGISTRY) return acquireRegistryResource({ resourceType, resourceId: options.resourceId, sourcePath });

  if (providerId === RESOURCE_PROVIDER_IDS.NOTEBOOK) {
    const notebookPath = normalizeNotebookPath(options.notebookPath || options.source || "");
    if (!notebookPath) throw new Error("Choose a Notebook resource path.");
    return createNotebookResourceReference({ resourceType, notebookPath, sourcePath, sourceName, fallbacks: options.fallbacks || [], metadata: options.metadata || {} });
  }

  if (providerId === RESOURCE_PROVIDER_IDS.DIRECT_URL) {
    const url = String(options.url || options.source || "").trim();
    if (!url) throw new Error("Enter a URL.");
    if (mode === "reference") return createUrlResourceReference({ resourceType, url, sourcePath, sourceName, fallbacks: options.fallbacks || [], metadata: options.metadata || {} });
    const dataUrl = await fetchUrlAsDataUrl(url);
    if (mode === "inline") return createInlineResourceReference({ resourceType, dataUrl, sourcePath, sourceName, metadata: options.metadata || {}, providerId });
    const path = destinationPath({ resourceType, destinationPath: options.destinationPath, sourceName: sourceName || url.split("/").pop() });
    await saveNotebookBinaryFromDataUrl(path, dataUrl, options.mimeType || "application/octet-stream");
    return createNotebookResourceReference({ resourceType, notebookPath: path, sourcePath, sourceName, fallbacks: options.fallbacks || [], metadata: options.metadata || {}, providerId: RESOURCE_PROVIDER_IDS.DIRECT_URL });
  }

  if (providerId === RESOURCE_PROVIDER_IDS.LOCAL_FILE) {
    const file = options.file;
    if (!file) throw new Error("Choose a local file.");
    const notebookPath = normalizeNotebookPath(options.notebookPath || notebookPathFromPickedFile(file));
    if (mode === "reference" && notebookPath) return createNotebookResourceReference({ resourceType, notebookPath, sourcePath, sourceName: sourceName || file.name, fallbacks: options.fallbacks || [], metadata: options.metadata || {}, providerId });
    const dataUrl = await readFileAsDataUrl(file);
    if (mode === "inline") return createInlineResourceReference({ resourceType, dataUrl, sourcePath, sourceName: sourceName || file.name, metadata: options.metadata || {}, providerId });
    const path = destinationPath({ resourceType, destinationPath: options.destinationPath || notebookPath, sourceName: sourceName || file.name });
    await saveNotebookBinaryFromDataUrl(path, dataUrl, options.mimeType || file.type || "application/octet-stream");
    return createNotebookResourceReference({ resourceType, notebookPath: path, sourcePath, sourceName: sourceName || file.name, fallbacks: options.fallbacks || [], metadata: options.metadata || {}, providerId });
  }

  throw new Error(`Unsupported resource provider: ${providerId}`);
}
