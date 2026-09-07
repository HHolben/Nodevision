// Nodevision/ApplicationSystem/public/Resources/ResourceReference.mjs
// Normalized runtime reference/result shape returned by shared resource acquisition.

import {
  getRelativeNotebookReference,
  isExternalNotebookReference,
  normalizeNotebookFilePath,
} from "/utils/notebookPath.mjs";
import { normalizeFallbackReferencesForSource } from "/utils/referenceFallbacks.mjs";

export const RESOURCE_REFERENCE_VERSION = 1;

export const RESOURCE_SOURCE_KINDS = Object.freeze({
  NOTEBOOK: "notebook",
  LOCAL_FILE: "local-file",
  URL: "url",
  INLINE: "inline",
  DOWNLOADED: "downloaded",
  REGISTRY: "registry",
  UNKNOWN: "unknown",
});

const RESOURCE_SOURCE_KIND_SET = new Set(Object.values(RESOURCE_SOURCE_KINDS));

export function normalizeResourceSourceKind(value) {
  const kind = String(value || "").trim().toLowerCase();
  return RESOURCE_SOURCE_KIND_SET.has(kind) ? kind : RESOURCE_SOURCE_KINDS.UNKNOWN;
}

export function normalizeNotebookResourcePath(value) {
  const relative = normalizeNotebookFilePath(value);
  return relative ? `Notebook/${relative}` : "";
}

export function notebookReferenceForSource({ notebookPath = "", sourcePath = "" } = {}) {
  const path = normalizeNotebookResourcePath(notebookPath);
  if (!path) return "";
  const mode = globalThis.window?.NodevisionState?.currentMode || "";
  if (mode === "EPUBediting") return `/Notebook/${normalizeNotebookFilePath(path)}`;
  return getRelativeNotebookReference({ sourcePath, targetPath: path });
}

export function inferResourceSourceKind({ source = "", notebookPath = "", inlineDataUrl = "", inlineText = "" } = {}) {
  const raw = String(source || "").trim();
  if (inlineDataUrl || inlineText || raw.startsWith("data:")) return RESOURCE_SOURCE_KINDS.INLINE;
  if (normalizeNotebookResourcePath(notebookPath || raw)) return RESOURCE_SOURCE_KINDS.NOTEBOOK;
  if (isExternalNotebookReference(raw) || raw.startsWith("/") || /^(https?:)?\/\//i.test(raw)) return RESOURCE_SOURCE_KINDS.URL;
  return RESOURCE_SOURCE_KINDS.UNKNOWN;
}

export function createResourceReference(input = {}) {
  const sourceInput = input.source && typeof input.source === "object" ? input.source : {};
  const notebookPath = normalizeNotebookResourcePath(input.notebookPath || sourceInput.notebookPath || "");
  const inlineDataUrl = String(input.inlineDataUrl || sourceInput.inlineDataUrl || "");
  const inlineText = typeof input.inlineText === "string" ? input.inlineText : (typeof sourceInput.inlineText === "string" ? sourceInput.inlineText : "");
  const sourceValue = String(sourceInput.value || input.src || notebookPath || inlineDataUrl || inlineText || "").trim();
  const suppliedKind = normalizeResourceSourceKind(input.sourceKind || sourceInput.kind);
  const sourceKind = suppliedKind === RESOURCE_SOURCE_KINDS.UNKNOWN
    ? inferResourceSourceKind({ source: sourceValue, notebookPath, inlineDataUrl, inlineText })
    : suppliedKind;
  const sourcePath = String(input.sourcePath || "").trim();
  const sourceName = String(input.sourceName || sourceInput.name || "").trim();
  const src = String(input.src || (notebookPath ? notebookReferenceForSource({ notebookPath, sourcePath }) : sourceValue) || inlineDataUrl || "").trim();
  const fallbacks = normalizeFallbackReferencesForSource(input.fallbacks || [], {
    sourcePath,
    primary: src || sourceValue,
  });

  return {
    version: RESOURCE_REFERENCE_VERSION,
    resourceType: String(input.resourceType || input.typeId || "file").trim().toLowerCase() || "file",
    src,
    href: String(input.href || src || "").trim(),
    notebookPath,
    inlineDataUrl,
    inlineText,
    source: {
      kind: sourceKind,
      value: sourceValue,
      name: sourceName,
      providerId: String(input.providerId || sourceInput.providerId || "").trim(),
      resourceId: String(input.resourceId || sourceInput.resourceId || "").trim(),
    },
    fallbacks,
    metadata: {
      title: String(input.metadata?.title || sourceName || "").trim(),
      license: String(input.metadata?.license || "unknown").trim() || "unknown",
      attribution: String(input.metadata?.attribution || "").trim(),
      ...Object.fromEntries(Object.entries(input.metadata || {}).filter(([, value]) => value !== undefined)),
    },
  };
}

export function createNotebookResourceReference({ resourceType = "file", notebookPath = "", sourcePath = "", sourceName = "", fallbacks = [], metadata = {}, providerId = "notebook" } = {}) {
  const normalized = normalizeNotebookResourcePath(notebookPath);
  return createResourceReference({
    resourceType,
    sourceKind: RESOURCE_SOURCE_KINDS.NOTEBOOK,
    sourcePath,
    sourceName,
    src: notebookReferenceForSource({ notebookPath: normalized, sourcePath }),
    notebookPath: normalized,
    fallbacks,
    metadata,
    providerId,
  });
}

export function createUrlResourceReference({ resourceType = "file", url = "", sourcePath = "", sourceName = "", fallbacks = [], metadata = {}, providerId = "direct-url" } = {}) {
  const target = String(url || "").trim();
  return createResourceReference({
    resourceType,
    sourceKind: RESOURCE_SOURCE_KINDS.URL,
    sourcePath,
    sourceName,
    src: target,
    source: { kind: RESOURCE_SOURCE_KINDS.URL, value: target, name: sourceName, providerId },
    fallbacks,
    metadata,
    providerId,
  });
}

export function createInlineResourceReference({ resourceType = "file", dataUrl = "", text = "", sourceName = "", sourcePath = "", metadata = {}, providerId = "inline" } = {}) {
  return createResourceReference({
    resourceType,
    sourceKind: RESOURCE_SOURCE_KINDS.INLINE,
    sourcePath,
    sourceName,
    src: dataUrl,
    inlineDataUrl: dataUrl,
    inlineText: text,
    source: { kind: RESOURCE_SOURCE_KINDS.INLINE, value: dataUrl || text, name: sourceName, providerId },
    metadata,
    providerId,
  });
}

export function isNotebookResourceReference(resource) {
  return normalizeResourceSourceKind(resource?.source?.kind) === RESOURCE_SOURCE_KINDS.NOTEBOOK || Boolean(normalizeNotebookResourcePath(resource?.notebookPath));
}

export function isInlineResourceReference(resource) {
  return normalizeResourceSourceKind(resource?.source?.kind) === RESOURCE_SOURCE_KINDS.INLINE || Boolean(resource?.inlineDataUrl || resource?.inlineText);
}
