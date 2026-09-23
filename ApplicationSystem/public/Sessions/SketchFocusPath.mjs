// Nodevision/ApplicationSystem/public/Sessions/SketchFocusPath.mjs
// This module keeps Sketch Focus Notebook-relative path normalization pure so save workflow and tests share the same filename rules.

export function normalizeNotebookPath(value = "") {
  const clean = String(value || "")
    .replace(/\\/g, "/")
    .replace(/[?#].*$/, "")
    .replace(/^\/+/, "")
    .replace(/^Notebook\//i, "");
  const parts = [];
  for (const part of clean.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") continue;
    parts.push(part);
  }
  return parts.join("/");
}

export function joinNotebookPath(directory, basename) {
  return [normalizeNotebookPath(directory), normalizeNotebookPath(basename)].filter(Boolean).join("/");
}

export function notebookAssetUrl(path) {
  const clean = normalizeNotebookPath(path);
  return "/Notebook/" + clean.split("/").filter(Boolean).map(encodeURIComponent).join("/");
}

export function dirnameNotebookPath(path) {
  const clean = normalizeNotebookPath(path);
  const index = clean.lastIndexOf("/");
  return index < 0 ? "" : clean.slice(0, index);
}
