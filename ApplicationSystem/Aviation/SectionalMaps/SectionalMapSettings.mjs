// Nodevision/ApplicationSystem/Aviation/SectionalMaps/SectionalMapSettings.mjs
// This module stores and validates FAA sectional-map directory settings through the shared Resource Paths registry.

import path from "node:path";
import {
  getResourcePath,
  resolveResourcePath,
  setResourcePath,
} from "../../ResourcePaths/ResourcePathStore.mjs";
import {
  normalizeResourceRelativePath,
  resolveNotebookResourceDirectory,
  toNotebookRelativeResourcePath,
} from "../../ResourcePaths/ResourcePathValidation.mjs";

export const SECTIONAL_SETTINGS_FILENAME = "SectionalMapSettings.json";
export const DEFAULT_SECTIONAL_MAPS_DIRECTORY = "Resources/Aviation/Sectionals";
export const SECTIONAL_RESOURCE_PATH_KEY = "aviation.sectionalMaps";

export function normalizeSectionalMapsDirectory(value, options = {}) {
  if ((value === undefined || value === null || String(value).trim() === "") && options.allowDefault) {
    return DEFAULT_SECTIONAL_MAPS_DIRECTORY;
  }
  return normalizeResourceRelativePath(value);
}

export function toNotebookRelativeSectionalDirectory(ctx, value) {
  return toNotebookRelativeResourcePath(ctx, value);
}

export function sanitizeSectionalMapSettings(raw = {}, options = {}) {
  return {
    sectionalMapsDirectory: normalizeSectionalMapsDirectory(
      raw.sectionalMapsDirectory ?? DEFAULT_SECTIONAL_MAPS_DIRECTORY,
      { allowDefault: options.allowDefault !== false },
    ),
  };
}

export function getSectionalSettingsPath(ctx) {
  return path.join(ctx.userSettingsDir, SECTIONAL_SETTINGS_FILENAME);
}

export async function loadSectionalMapSettings(ctx) {
  const entry = await getResourcePath(ctx, SECTIONAL_RESOURCE_PATH_KEY);
  return { sectionalMapsDirectory: entry.path };
}

export async function getSectionalMapsDirectory(ctx) {
  const resolved = await resolveResourcePath(ctx, SECTIONAL_RESOURCE_PATH_KEY);
  return { relativeDirectory: resolved.relativeDirectory, absoluteDirectory: resolved.absoluteDirectory };
}

export async function saveSectionalMapSettings(ctx, input) {
  const entry = await setResourcePath(ctx, {
    key: SECTIONAL_RESOURCE_PATH_KEY,
    path: input.sectionalMapsDirectory,
  });
  return { sectionalMapsDirectory: entry.path };
}

export async function resolveSectionalMapsDirectory(ctx, relativeDirectory) {
  if (relativeDirectory === undefined || relativeDirectory === null) {
    return getSectionalMapsDirectory(ctx);
  }
  const resolved = await resolveNotebookResourceDirectory(ctx, relativeDirectory);
  return { relativeDirectory: resolved.relativeDirectory, absoluteDirectory: resolved.absoluteDirectory };
}
