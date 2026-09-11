// Nodevision/ApplicationSystem/public/NodevisionSelection.mjs
// This module owns the current workspace selection as a canonical Notebook reference while providing a temporary selectedFilePath compatibility facade for legacy Nodevision modules.

import {
  createNotebookReference,
  serializeNodevisionReference,
  referenceToApiPath,
} from "./NodevisionReference.mjs";

let currentSelection = null;
let facadeInstalled = false;
let selectedFilePathsFacadeInstalled = false;
let selectedFilePaths = [];

function selectionEventDetail() {
  return {
    reference: serializeNodevisionReference(currentSelection),
    path: referenceToApiPath(currentSelection),
    isDirectory: currentSelection?.kind === "directory",
  };
}

function updateLegacyState(reference = null) {
  const path = referenceToApiPath(reference);
  const isDirectory = reference?.kind === "directory";
  const state = globalThis.window ? (window.NodevisionState = window.NodevisionState || {}) : null;
  if (state) {
    state.selectedReference = serializeNodevisionReference(reference);
    state.selectedFile = path || null;
    state.selectedFileIsDirectory = Boolean(isDirectory);
  }
  return path;
}

export function getNodevisionSelection() {
  return currentSelection;
}

export function getNodevisionSelectedPath() {
  return referenceToApiPath(currentSelection);
}

export function setNodevisionSelection(referenceInput = null, options = {}) {
  currentSelection = referenceInput ? createNotebookReference(referenceInput) : null;
  const path = updateLegacyState(currentSelection);
  if (options.updateSelectedPaths !== false) {
    selectedFilePaths = path ? [path] : [];
    if (globalThis.window) window.NodevisionState.selectedFiles = currentSelection ? [selectionEventDetail()] : [];
  }
  if (globalThis.window && options.silent !== true) {
    window.dispatchEvent(new CustomEvent("nodevision-selection-changed", { detail: selectionEventDetail() }));
  }
  return currentSelection;
}

export function setNodevisionSelectedPath(pathValue = "", options = {}) {
  return setNodevisionSelection({ kind: options.isDirectory ? "directory" : "file", path: pathValue, rootId: options.rootId }, options);
}

export function setNodevisionSelectionEntries(entries = [], options = {}) {
  const cleanEntries = Array.isArray(entries)
    ? entries.map((entry) => createNotebookReference({ kind: entry?.isDirectory ? "directory" : "file", path: entry?.path || entry?.filePath || "" })).filter((ref) => ref.path)
    : [];
  selectedFilePaths = cleanEntries.map((ref) => ref.path);
  if (globalThis.window) {
    window.NodevisionState = window.NodevisionState || {};
    window.NodevisionState.selectedReferences = cleanEntries.map(serializeNodevisionReference);
    window.NodevisionState.selectedFiles = cleanEntries.map((ref) => ({ path: ref.path, isDirectory: ref.kind === "directory", reference: serializeNodevisionReference(ref) }));
    window.NodevisionState.selectedFileCount = cleanEntries.length;
  }
  const primary = cleanEntries[cleanEntries.length - 1] || null;
  if (primary) setNodevisionSelection(primary, { ...options, updateSelectedPaths: false });
  else setNodevisionSelection(null, { ...options, updateSelectedPaths: false });
  return cleanEntries;
}

export function getNodevisionSelectionEntries() {
  if (currentSelection && selectedFilePaths.length <= 1) return [currentSelection];
  return selectedFilePaths.map((path) => createNotebookReference({ path }));
}

export function installNodevisionSelectedFilePathFacade() {
  if (!globalThis.window || facadeInstalled || window.__nvSelectionFacadeInstalled) return;
  try {
    const existing = window.selectedFilePath;
    Object.defineProperty(window, "selectedFilePath", {
      get() {
        return getNodevisionSelectedPath();
      },
      set(value) {
        const pending = window.__nvPendingSelectedFileMetadata;
        const isDirectory = Boolean(pending && pending.path === value && pending.isDirectory);
        setNodevisionSelectedPath(value, { isDirectory });
      },
      configurable: true,
    });
    facadeInstalled = true;
    window.__nvSelectionFacadeInstalled = true;
    window._selectedFileProxyInstalled = true;
    if (existing && !currentSelection) setNodevisionSelectedPath(existing, { silent: true });
  } catch (err) {
    console.warn("[NodevisionSelection] Failed to install selectedFilePath facade:", err);
  }
}

export function installNodevisionSelectedFilePathsFacade() {
  if (!globalThis.window || selectedFilePathsFacadeInstalled || window.__nvSelectionPathsFacadeInstalled) return;
  try {
    const existing = Array.isArray(window.selectedFilePaths) ? window.selectedFilePaths : [];
    Object.defineProperty(window, "selectedFilePaths", {
      get() {
        return [...selectedFilePaths];
      },
      set(values) {
        selectedFilePaths = Array.isArray(values) ? values.map((value) => referenceToApiPath(createNotebookReference({ path: value }))).filter(Boolean) : [];
      },
      configurable: true,
    });
    selectedFilePathsFacadeInstalled = true;
    window.__nvSelectionPathsFacadeInstalled = true;
    if (existing.length) window.selectedFilePaths = existing;
  } catch (err) {
    console.warn("[NodevisionSelection] Failed to install selectedFilePaths facade:", err);
  }
}

export function installNodevisionSelectionCompatibility() {
  installNodevisionSelectedFilePathFacade();
  installNodevisionSelectedFilePathsFacade();
  if (globalThis.window) {
    window.NodevisionSelection = {
      get: getNodevisionSelection,
      set: setNodevisionSelection,
      setPath: setNodevisionSelectedPath,
      entries: getNodevisionSelectionEntries,
    };
  }
}

if (typeof window !== "undefined") {
  installNodevisionSelectionCompatibility();
}
