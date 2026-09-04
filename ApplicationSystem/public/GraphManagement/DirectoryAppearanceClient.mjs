// Nodevision/ApplicationSystem/public/GraphManagement/DirectoryAppearanceClient.mjs
// This module provides browser-side loading, saving, caching, and event publication for directory appearance metadata.

export {
  DIRECTORY_APPEARANCE_CHANGED_EVENT,
  normalizeDirectoryMetadataPath,
  normalizeHexColor,
  normalizeAlpha,
  resolveDirectoryAppearanceFileManagerPalette,
  resolveDirectoryAppearanceGraphColors,
  sanitizeDirectoryAppearance,
} from "./DirectoryAppearanceMetadata.mjs";

import {
  DIRECTORY_APPEARANCE_CHANGED_EVENT,
  normalizeDirectoryMetadataPath,
  sanitizeDirectoryAppearance,
  sanitizeDirectoryAppearanceManifest,
  isDirectoryAppearanceEmpty,
} from "./DirectoryAppearanceMetadata.mjs";

let appearanceCache = new Map();
let appearanceLoaded = false;
let appearanceLoadPromise = null;

function cacheFromManifest(manifest) {
  const clean = sanitizeDirectoryAppearanceManifest(manifest);
  const next = new Map();

  for (const [pathValue, record] of Object.entries(clean.directories || {})) {
    const appearance = sanitizeDirectoryAppearance(record?.appearance);
    if (!isDirectoryAppearanceEmpty(appearance)) {
      next.set(normalizeDirectoryMetadataPath(pathValue), appearance);
    }
  }

  appearanceCache = next;
  appearanceLoaded = true;
  return appearanceCache;
}

export async function loadDirectoryAppearanceMap(options = {}) {
  if (appearanceLoaded && options.force !== true) return appearanceCache;
  if (appearanceLoadPromise && options.force !== true) return appearanceLoadPromise;

  appearanceLoadPromise = fetch("/api/graph/directory-appearance", { cache: "no-store" })
    .then(async (res) => {
      if (!res.ok) throw new Error("Failed to load directory appearance metadata.");
      return cacheFromManifest(await res.json());
    })
    .catch((err) => {
      console.warn("[DirectoryAppearance] Falling back to default colors:", err);
      appearanceLoaded = true;
      return appearanceCache;
    })
    .finally(() => {
      appearanceLoadPromise = null;
    });

  return appearanceLoadPromise;
}

export function getCachedDirectoryAppearance(pathValue = "") {
  const cleanPath = normalizeDirectoryMetadataPath(pathValue);
  return appearanceCache.get(cleanPath) || {};
}

export async function readDirectoryAppearance(pathValue = "") {
  await loadDirectoryAppearanceMap();
  return getCachedDirectoryAppearance(pathValue);
}

export function publishDirectoryAppearanceChanged(pathValue = "", appearanceValue = {}) {
  if (typeof window === "undefined") return;
  const path = normalizeDirectoryMetadataPath(pathValue);
  const appearance = sanitizeDirectoryAppearance(appearanceValue);
  window.dispatchEvent(new CustomEvent(DIRECTORY_APPEARANCE_CHANGED_EVENT, {
    detail: { path, appearance },
  }));
}

async function confirmExistingDirectoryCssUpdate(pathValue = "") {
  if (typeof document === "undefined") return false;
  try {
    const { openNodevisionOverlayPanel } = await import("/TemplateSystem/NodevisionOverlayPanel.mjs");
    const displayPath = pathValue ? pathValue + "/directory.css" : "directory.css";
    const result = await openNodevisionOverlayPanel("SessionOverlayPanel", {
      title: "Update directory.css?",
      heading: "Update directory.css?",
      message: "This directory already contains a directory.css stylesheet.\n\nNodevision needs to add its directory appearance variables to this existing stylesheet in order to save the selected directory colors.\n\nExisting CSS rules will be preserved.\n\n" + displayPath,
      returnPayload: true,
      emitOverlayEvents: true,
      choices: [
        { label: "Cancel", value: "cancel" },
        { label: "Update directory.css", value: "update-directory-css", primary: true },
      ],
    });
    return result?.value === "update-directory-css" || result?.choice === "update-directory-css";
  } catch (err) {
    console.error("[DirectoryAppearance] Failed to open directory.css confirmation overlay:", err);
    return false;
  }
}

async function postDirectoryAppearance(path, appearance, options = {}) {
  const body = { path, appearance };
  if (options.confirmDirectoryStylesheetUpdate === true) body.confirmDirectoryStylesheetUpdate = true;
  const res = await fetch("/api/graph/directory-appearance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  return { res, payload };
}

export async function saveDirectoryAppearance(pathValue = "", appearanceValue = {}) {
  const path = normalizeDirectoryMetadataPath(pathValue);
  const appearance = sanitizeDirectoryAppearance(appearanceValue);
  let { res, payload } = await postDirectoryAppearance(path, appearance);

  if (!res.ok && payload?.requiresConfirmation === true) {
    const approved = await confirmExistingDirectoryCssUpdate(path);
    if (!approved) {
      const err = new Error("Directory.css update cancelled.");
      err.code = "DIRECTORY_STYLESHEET_UPDATE_CANCELLED";
      throw err;
    }
    ({ res, payload } = await postDirectoryAppearance(path, appearance, { confirmDirectoryStylesheetUpdate: true }));
  }

  if (!res.ok || payload?.success === false) {
    throw new Error(payload?.error || "Failed to save directory appearance.");
  }

  const savedAppearance = sanitizeDirectoryAppearance(payload?.appearance || appearance);
  if (isDirectoryAppearanceEmpty(savedAppearance)) {
    appearanceCache.delete(path);
  } else {
    appearanceCache.set(path, savedAppearance);
  }
  appearanceLoaded = true;
  publishDirectoryAppearanceChanged(path, savedAppearance);
  return savedAppearance;
}
