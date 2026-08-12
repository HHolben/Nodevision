// Nodevision/ApplicationSystem/public/RecentFilesManifestClient.mjs
// This file synchronizes the toolbar recent-files list with the Nodevision UserData-backed manifest while preserving browser-local fallback behavior.

export const RECENT_FILES_MANIFEST_API = "/api/recent-files/manifest";

const LEGACY_RECENT_EDITED_FILES_KEY = "nodevision.recentEditedFiles.v1";

let cachedEntries = null;
let loadPromise = null;

function canFetch() {
  return typeof fetch === "function";
}

function cloneEntries(entries) {
  return Array.isArray(entries) ? entries.map((entry) => ({ ...entry })) : [];
}

function entriesFromPayload(payload) {
  const entries = Array.isArray(payload?.files) ? payload.files : payload?.entries;
  return cloneEntries(Array.isArray(entries) ? entries : []);
}

function readLegacyLocalEntries() {
  try {
    const storage = globalThis.localStorage || null;
    const parsed = JSON.parse(storage?.getItem(LEGACY_RECENT_EDITED_FILES_KEY) || "[]");
    return cloneEntries(Array.isArray(parsed) ? parsed : []);
  } catch {
    return [];
  }
}

function entriesFromServerPayload(payload) {
  const remoteEntries = entriesFromPayload(payload);
  if (remoteEntries.length) return remoteEntries;
  const localEntries = readLegacyLocalEntries();
  if (localEntries.length) saveRecentManifestEntries(localEntries);
  return localEntries;
}

export function getCachedRecentManifestEntries() {
  return Array.isArray(cachedEntries) ? cloneEntries(cachedEntries) : null;
}

export function setCachedRecentManifestEntries(entries) {
  cachedEntries = cloneEntries(entries);
  return getCachedRecentManifestEntries();
}

export async function loadRecentManifestEntries() {
  if (Array.isArray(cachedEntries)) return getCachedRecentManifestEntries();
  if (loadPromise) return loadPromise;
  if (!canFetch()) return null;

  loadPromise = fetch(RECENT_FILES_MANIFEST_API, {
    credentials: "same-origin",
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Recent files manifest request failed with ${response.status}`);
      cachedEntries = entriesFromServerPayload(await response.json());
      return getCachedRecentManifestEntries();
    })
    .catch((err) => {
      console.warn("[RecentFiles] UserData manifest unavailable; using browser-local recents.", err);
      return null;
    })
    .finally(() => {
      loadPromise = null;
    });

  return loadPromise;
}

export function saveRecentManifestEntries(entries) {
  cachedEntries = cloneEntries(entries);
  if (!canFetch()) return Promise.resolve(false);
  return fetch(RECENT_FILES_MANIFEST_API, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files: cachedEntries }),
  })
    .then((response) => response.ok)
    .catch((err) => {
      console.warn("[RecentFiles] Failed to save UserData manifest:", err);
      return false;
    });
}
