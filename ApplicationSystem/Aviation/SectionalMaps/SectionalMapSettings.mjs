// Nodevision/ApplicationSystem/Aviation/SectionalMaps/SectionalMapSettings.mjs
// Stores and resolves FAA sectional-map directories through the typed Resource Registry.

import path from "node:path";
import {
  normalizeResourceRelativePath,
  resolveNotebookResourceDirectory,
  toNotebookRelativeResourcePath,
} from "../../ResourcePaths/ResourcePathValidation.mjs";
import { RESOURCE_SOURCE_TYPES } from "../../Resources/ResourceTypeDefinitions.mjs";
import { resolveFirstEnabledSourceDirectory, setLegacyResourcePathSource } from "../../Resources/ResourceSettingsStore.mjs";

export const SECTIONAL_SETTINGS_FILENAME = "SectionalMapSettings.json";
export const DEFAULT_SECTIONAL_MAPS_DIRECTORY = "Resources/Aviation/Sectionals";
export const SECTIONAL_RESOURCE_PATH_KEY = "aviation.sectionalMaps";
export const SECTIONAL_RESOURCE_TYPE_ID = "faa.sectional";

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

function publicSectionalSettings(resolved) {
  return {
    sectionalMapsDirectory: resolved.source.sourceType === RESOURCE_SOURCE_TYPES.NOTEBOOK ? resolved.relativeDirectory : resolved.source.path,
    resourceType: SECTIONAL_RESOURCE_TYPE_ID,
    sourceId: resolved.source.id,
    sourceType: resolved.source.sourceType,
  };
}

export async function loadSectionalMapSettings(ctx) {
  const resolved = await resolveFirstEnabledSourceDirectory(ctx, SECTIONAL_RESOURCE_TYPE_ID, {
    preferredSourceTypes: [RESOURCE_SOURCE_TYPES.NOTEBOOK, RESOURCE_SOURCE_TYPES.MANAGED],
  });
  return publicSectionalSettings(resolved);
}

export async function getSectionalMapsDirectory(ctx) {
  const resolved = await resolveFirstEnabledSourceDirectory(ctx, SECTIONAL_RESOURCE_TYPE_ID, {
    preferredSourceTypes: [RESOURCE_SOURCE_TYPES.NOTEBOOK, RESOURCE_SOURCE_TYPES.MANAGED],
  });
  return {
    relativeDirectory: resolved.relativeDirectory,
    absoluteDirectory: resolved.absoluteDirectory,
    sourceId: resolved.source.id,
    sourceType: resolved.source.sourceType,
    displayDirectory: resolved.source.sourceType === RESOURCE_SOURCE_TYPES.MANAGED ? `UserData/${resolved.relativeDirectory}` : resolved.relativeDirectory,
  };
}

export async function saveSectionalMapSettings(ctx, input) {
  const notebookPath = toNotebookRelativeSectionalDirectory(ctx, input.sectionalMapsDirectory || DEFAULT_SECTIONAL_MAPS_DIRECTORY);
  await setLegacyResourcePathSource(ctx, SECTIONAL_RESOURCE_PATH_KEY, notebookPath);
  return { sectionalMapsDirectory: notebookPath, resourceType: SECTIONAL_RESOURCE_TYPE_ID, sourceType: RESOURCE_SOURCE_TYPES.NOTEBOOK };
}

export async function resolveSectionalMapsDirectory(ctx, relativeDirectory) {
  if (relativeDirectory === undefined || relativeDirectory === null) return getSectionalMapsDirectory(ctx);
  const resolved = await resolveNotebookResourceDirectory(ctx, relativeDirectory);
  return { relativeDirectory: resolved.relativeDirectory, absoluteDirectory: resolved.absoluteDirectory, sourceType: RESOURCE_SOURCE_TYPES.NOTEBOOK };
}
