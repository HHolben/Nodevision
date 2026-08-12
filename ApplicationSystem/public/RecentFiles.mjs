// Nodevision/ApplicationSystem/public/RecentFiles.mjs
// This file normalizes, caches, and exposes the recently edited Notebook files used by the Nodevision toolbar and editor integrations.

import { dispatchRecentSelection, revealRecentFileInNavigator } from "./RecentFileNavigation.mjs";
import { getCachedRecentManifestEntries, saveRecentManifestEntries, setCachedRecentManifestEntries } from "./RecentFilesManifestClient.mjs";

export const RECENT_EDITED_FILES_KEY = "nodevision.recentEditedFiles.v1";
export const MAX_RECENT_EDITED_FILES = 20;

const PROTECTED_APP_PREFIXES = [
  "ApplicationSystem/",
  "NativeComponents/",
  "ServerData/",
  "ServerSettings/",
  "UserData/",
  "UserSettings/",
];

function getGlobal() {
  if (typeof window !== "undefined") return window;
  if (typeof globalThis !== "undefined") return globalThis;
  return {};
}

function safeStorage(storage) {
  if (storage) return storage;
  try {
    return getGlobal().localStorage || null;
  } catch {
    return null;
  }
}

function readRawEntries(storage) {
  if (!storage) {
    const cached = getCachedRecentManifestEntries();
    if (Array.isArray(cached)) return cached;
  }
  const target = safeStorage(storage);
  if (!target) return [];
  try {
    const parsed = JSON.parse(target.getItem(RECENT_EDITED_FILES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeEntries(entries, storage) {
  if (!storage) {
    setCachedRecentManifestEntries(entries);
    saveRecentManifestEntries(entries);
  }
  const target = safeStorage(storage);
  if (!target) return !storage;
  try {
    target.setItem(RECENT_EDITED_FILES_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return !storage;
  }
}

function normalizePathParts(value) {
  const parts = [];
  for (const part of String(value || "").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") return [];
    parts.push(part);
  }
  return parts;
}

export function normalizeRecentFilePath(pathValue) {
  let value = String(pathValue || "").replace(/\u0000/g, "").trim();
  if (!value) return "";
  value = value.replace(/\\/g, "/").replace(/[?#].*$/, "").replace(/\/+/g, "/");

  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
      value = new URL(value, getGlobal().location?.href || "http://nodevision.local/").pathname;
    }
  } catch {
    return "";
  }

  const notebookMarker = "/notebook/";
  const notebookIndex = value.toLowerCase().indexOf(notebookMarker);
  if (notebookIndex >= 0) value = value.slice(notebookIndex + notebookMarker.length);
  value = value.replace(/^\/+/, "");
  if (value.toLowerCase().startsWith("notebook/")) value = value.slice("Notebook/".length);

  const parts = normalizePathParts(value);
  const normalized = parts.join("/");
  if (!normalized || !normalized.includes(".")) return "";
  const normalizedLower = normalized.toLowerCase();
  if (PROTECTED_APP_PREFIXES.some((prefix) => normalizedLower.startsWith(prefix.toLowerCase()))) return "";
  return normalized;
}

function entryFromStoredValue(value) {
  const source = typeof value === "string" ? { path: value } : value;
  const path = normalizeRecentFilePath(source?.path);
  if (!path) return null;
  const editedAt = Number.isFinite(source?.editedAt) ? source.editedAt : 0;
  return { path, editedAt };
}

export function getRecentEditedFileEntries(storage) {
  const seen = new Set();
  const entries = [];
  for (const value of readRawEntries(storage)) {
    const entry = entryFromStoredValue(value);
    if (!entry || seen.has(entry.path)) continue;
    seen.add(entry.path);
    entries.push(entry);
  }
  return entries.slice(0, MAX_RECENT_EDITED_FILES);
}

export function getRecentEditedFiles(storage) {
  return getRecentEditedFileEntries(storage).map((entry) => entry.path);
}

export function filePathToNotebookHref(pathValue) {
  const path = normalizeRecentFilePath(pathValue);
  if (!path) return "";
  const encoded = path.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  return `/Notebook/${encoded}`;
}

export function recordEditedFile(pathValue, options = {}) {
  const path = normalizeRecentFilePath(pathValue);
  if (!path) return getRecentEditedFileEntries(options.storage);

  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const entries = [
    { path, editedAt: now },
    ...getRecentEditedFileEntries(options.storage).filter((entry) => entry.path !== path),
  ].slice(0, MAX_RECENT_EDITED_FILES);

  writeEntries(entries, options.storage);
  const target = options.eventTarget || getGlobal();
  if (typeof target.dispatchEvent === "function" && typeof CustomEvent !== "undefined") {
    target.dispatchEvent(new CustomEvent("nodevision-recents-changed", {
      detail: { filePath: path, files: entries },
    }));
  }
  return entries;
}

export function clearRecentEditedFiles(storage) {
  writeEntries([], storage);
}

export function openRecentFile(pathValue) {
  const path = normalizeRecentFilePath(pathValue);
  if (!path) return false;
  const global = getGlobal();
  const afterSelected = (selectedPath) => {
    dispatchRecentSelection(global, selectedPath);
    revealRecentFileInNavigator(global, selectedPath).catch((err) => {
      console.warn("[RecentFiles] Failed to reveal recent file:", err);
    });
  };

  if (typeof global.requestNodevisionFileSelection === "function") {
    global.requestNodevisionFileSelection(path, { isDirectory: false, onSelected: afterSelected });
    return true;
  }

  global.NodevisionState = global.NodevisionState || {};
  global.NodevisionState.selectedFile = path;
  global.NodevisionState.selectedFileIsDirectory = false;
  global.NodevisionState.activeEditorFilePath = path;
  global.currentActiveFilePath = path;
  global.selectedFilePath = path;
  afterSelected(path);
  return true;
}
