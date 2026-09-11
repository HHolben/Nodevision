// Nodevision/ApplicationSystem/public/NodevisionReference.mjs
// This module defines small, serializable references to user-owned Notebook objects and helpers for normalizing paths, comparing references, displaying tab labels, and resolving directory-associated files without turning Notebook content into application-owned records.

import {
  normalizeNotebookRelativePath,
  toNotebookAssetUrl,
} from "./utils/notebookPath.mjs";

export const DEFAULT_NOTEBOOK_ROOT_ID = "local-notebook";

export function normalizeNodevisionReferencePath(pathValue = "") {
  return normalizeNotebookRelativePath(pathValue || "");
}

export function createNotebookReference(input = {}, defaults = {}) {
  const source = typeof input === "string" ? { path: input } : (input || {});
  const kind = source.kind === "directory" ? "directory" : "file";
  const rootId = String(source.rootId || defaults.rootId || DEFAULT_NOTEBOOK_ROOT_ID);
  const path = normalizeNodevisionReferencePath(source.path || source.filePath || source.resourcePath || "");
  return Object.freeze({ type: "notebook", rootId, kind, path });
}

export function createDirectoryReference(input = {}, defaults = {}) {
  const source = typeof input === "string" ? { path: input } : (input || {});
  return createNotebookReference({ ...source, kind: "directory" }, defaults);
}

export function createFileReference(input = {}, defaults = {}) {
  const source = typeof input === "string" ? { path: input } : (input || {});
  return createNotebookReference({ ...source, kind: "file" }, defaults);
}

export function serializeNodevisionReference(reference = null) {
  if (!reference) return null;
  const ref = createNotebookReference(reference);
  return { type: ref.type, rootId: ref.rootId, kind: ref.kind, path: ref.path };
}

export function deserializeNodevisionReference(value = null) {
  if (!value) return null;
  return createNotebookReference(value);
}

export function sameNodevisionReference(a = null, b = null) {
  if (!a || !b) return false;
  const left = createNotebookReference(a);
  const right = createNotebookReference(b);
  return left.type === right.type && left.rootId === right.rootId && left.kind === right.kind && left.path === right.path;
}

export function referenceDisplayName(reference = null, fallback = "") {
  if (!reference) return String(fallback || "");
  const ref = createNotebookReference(reference);
  if (!ref.path) return ref.kind === "directory" ? "Notebook" : String(fallback || "Notebook");
  return ref.path.split("/").filter(Boolean).pop() || ref.path;
}

export function referenceFullDisplayName(reference = null) {
  if (!reference) return "";
  const ref = createNotebookReference(reference);
  if (!ref.path) return ref.kind === "directory" ? "Notebook" : "";
  return ref.path;
}

function joinDirectoryAssociatedPath(reference = null, fileName = "") {
  const ref = createNotebookReference(reference?.kind === "directory" ? reference : { ...reference, kind: "directory" });
  const cleanName = String(fileName || "").replace(/^\/+/, "");
  return ref.path ? ref.path + "/" + cleanName : cleanName;
}

export function resolveDirectoryIndexReference(reference = null) {
  return createFileReference({ rootId: reference?.rootId, path: joinDirectoryAssociatedPath(reference, "index.html") });
}

export function resolveDirectoryStylesheetReference(reference = null) {
  return createFileReference({ rootId: reference?.rootId, path: joinDirectoryAssociatedPath(reference, "directory.css") });
}

export function resolveDirectoryImageReferences(reference = null) {
  return [".directory.svg", "directory.svg", ".directory.png", "directory.png"].map((fileName) =>
    createFileReference({ rootId: reference?.rootId, path: joinDirectoryAssociatedPath(reference, fileName) })
  );
}

export function referenceToApiPath(reference = null) {
  if (!reference) return "";
  return createNotebookReference(reference).path;
}

export function referenceToNotebookAssetUrl(reference = null) {
  if (!reference) return "";
  return toNotebookAssetUrl(createNotebookReference(reference).path);
}
