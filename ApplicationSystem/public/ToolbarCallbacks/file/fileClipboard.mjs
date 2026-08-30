// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/fileClipboard.mjs
// This file defines browser-side file Clipboard logic for the Nodevision UI. It renders interface components and handles user interactions.
// Shared client-side clipboard for File Manager toolbar actions.

const KEY = "__nodevisionFileClipboard";

function normalizePath(value = "") {
  return String(value || "").replace(/^\/+/, "").replace(/\\/g, "/").replace(/\/+/g, "/").trim();
}

function normalizeSelectionEntry(entry = {}) {
  const path = normalizePath(typeof entry === "string" ? entry : entry.path);
  if (!path) return null;
  return { path, isDirectory: Boolean(entry.isDirectory) };
}

function uniqueSelectionEntries(entries = []) {
  const byPath = new Map();
  for (const entry of entries) {
    const clean = normalizeSelectionEntry(entry);
    if (clean) byPath.set(clean.path, clean);
  }
  return [...byPath.values()];
}

function selectedFileEntriesFromPaths(paths = []) {
  return uniqueSelectionEntries(paths.map((path) => ({ path })));
}

export function getSelectedFileEntries({ fallbackToSingle = true } = {}) {
  const state = window.NodevisionState || {};
  const managerActive = state.activePanelType === "FileManager" || state.activePanelType === "GraphManager";
  const owner = state.selectedFilesOwner || "";
  const managerSelectionMatches = managerActive && (!owner || owner === state.activePanelType);

  if (managerSelectionMatches && Array.isArray(state.selectedFiles)) {
    return uniqueSelectionEntries(state.selectedFiles);
  }

  if (managerSelectionMatches && Array.isArray(window.selectedFilePaths)) {
    return selectedFileEntriesFromPaths(window.selectedFilePaths);
  }

  if (managerActive && owner && owner !== state.activePanelType) {
    if (!fallbackToSingle) return [];
    const selectedPath = normalizePath(window.selectedFilePath || state.selectedFile || "");
    return selectedPath ? [{ path: selectedPath, isDirectory: Boolean(state.selectedFileIsDirectory) }] : [];
  }

  const selectedFiles = uniqueSelectionEntries(state.selectedFiles || []);
  if (selectedFiles.length) return selectedFiles;

  if (Array.isArray(window.selectedFilePaths) && window.selectedFilePaths.length) {
    return selectedFileEntriesFromPaths(window.selectedFilePaths);
  }

  if (!fallbackToSingle) return [];

  const selectedPath = normalizePath(window.selectedFilePath || state.selectedFile || "");
  if (!selectedPath) return [];
  return [{ path: selectedPath, isDirectory: Boolean(state.selectedFileIsDirectory) }];
}

export function getSelectedFilePaths(options = {}) {
  return getSelectedFileEntries(options).map((entry) => entry.path);
}

export function getClipboardEntries(entry = getClipboard()) {
  if (!entry || typeof entry !== "object") return [];
  if (Array.isArray(entry.entries)) return uniqueSelectionEntries(entry.entries);
  if (Array.isArray(entry.sourcePaths)) return selectedFileEntriesFromPaths(entry.sourcePaths);
  if (entry.sourcePath) return uniqueSelectionEntries([{ path: entry.sourcePath, isDirectory: Boolean(entry.isDirectory) }]);
  return [];
}

export function setClipboard(entry) {
  if (!entry || typeof entry !== "object") return;
  window[KEY] = { ...entry };
}

export function getClipboard() {
  const value = window[KEY];
  if (!value || typeof value !== "object") return null;
  return value;
}

export function clearClipboard() {
  delete window[KEY];
}
