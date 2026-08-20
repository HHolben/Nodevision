// Nodevision/ApplicationSystem/ResourcePaths/ResourcePathStore.mjs
// This module loads, saves, lists, and resolves Notebook-relative Resource Path settings.

import fs from "node:fs/promises";
import path from "node:path";
import {
  BUILT_IN_RESOURCE_PATHS,
  RESOURCE_PATH_CONFIG_VERSION,
  RESOURCE_PATHS_FILENAME,
  getBuiltInResourcePathDefinition,
  getBuiltInResourcePathDefinitions,
  isBuiltInResourcePathKey,
} from "./ResourcePathDefinitions.mjs";
import {
  normalizeResourceKey,
  normalizeResourceName,
  resolveNotebookResourceDirectory,
  toNotebookRelativeResourcePath,
} from "./ResourcePathValidation.mjs";

const LEGACY_SECTIONAL_SETTINGS_FILENAME = "SectionalMapSettings.json";

export function getResourcePathsSettingsPath(ctx) {
  return path.join(ctx.userSettingsDir, RESOURCE_PATHS_FILENAME);
}

function normalizeStoredEntry(ctx, key, value, builtIn = null) {
  const record = typeof value === "string" ? { path: value } : { ...(value || {}) };
  return {
    key,
    name: builtIn?.name || normalizeResourceName(record.name || key),
    path: toNotebookRelativeResourcePath(ctx, record.path ?? builtIn?.defaultPath),
    description: builtIn?.description || String(record.description || "").trim(),
    builtIn: Boolean(builtIn),
    protected: Boolean(builtIn),
  };
}

async function loadLegacySectionalPath(ctx) {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(ctx.userSettingsDir, LEGACY_SECTIONAL_SETTINGS_FILENAME), "utf8"));
    return toNotebookRelativeResourcePath(ctx, raw.sectionalMapsDirectory);
  } catch (err) {
    if (err?.code === "ENOENT" || err instanceof SyntaxError) return null;
    throw err;
  }
}

async function readResourcePathRecords(ctx) {
  try {
    const raw = JSON.parse(await fs.readFile(getResourcePathsSettingsPath(ctx), "utf8"));
    const records = raw?.resourcePaths && typeof raw.resourcePaths === "object" ? raw.resourcePaths : raw?.paths;
    return records && typeof records === "object" && !Array.isArray(records) ? records : {};
  } catch (err) {
    if (err?.code === "ENOENT" || err instanceof SyntaxError) return {};
    throw err;
  }
}

async function mergedEntries(ctx) {
  const records = await readResourcePathRecords(ctx);
  const entries = new Map();
  for (const builtIn of BUILT_IN_RESOURCE_PATHS) {
    const legacyPath = builtIn.key === "aviation.sectionalMaps" ? await loadLegacySectionalPath(ctx) : null;
    const stored = records[builtIn.key] || (legacyPath ? { path: legacyPath } : {});
    entries.set(builtIn.key, normalizeStoredEntry(ctx, builtIn.key, stored, builtIn));
  }
  for (const [rawKey, value] of Object.entries(records)) {
    const key = normalizeResourceKey(rawKey);
    if (entries.has(key)) continue;
    entries.set(key, normalizeStoredEntry(ctx, key, value, null));
  }
  return entries;
}

async function publicEntry(ctx, entry) {
  const resolved = await resolveNotebookResourceDirectory(ctx, entry.path);
  return {
    key: entry.key,
    name: entry.name,
    path: resolved.relativeDirectory,
    description: entry.description,
    builtIn: entry.builtIn,
    protected: entry.protected,
    configured: Boolean(entry.path),
    exists: resolved.exists,
    isDirectory: resolved.isDirectory,
  };
}

async function writeEntries(ctx, entries) {
  const resourcePaths = {};
  for (const entry of entries) {
    resourcePaths[entry.key] = entry.builtIn
      ? { path: entry.path }
      : { name: entry.name, path: entry.path };
  }
  await fs.mkdir(ctx.userSettingsDir, { recursive: true });
  const target = getResourcePathsSettingsPath(ctx);
  const temp = target + ".tmp";
  await fs.writeFile(temp, JSON.stringify({ version: RESOURCE_PATH_CONFIG_VERSION, resourcePaths }, null, 2) + "\n");
  await fs.rename(temp, target);
}

export async function listResourcePaths(ctx) {
  const entries = [...(await mergedEntries(ctx)).values()];
  return Promise.all(entries.map((entry) => publicEntry(ctx, entry)));
}

export async function getResourcePath(ctx, key) {
  const normalizedKey = normalizeResourceKey(key);
  const entry = (await mergedEntries(ctx)).get(normalizedKey);
  if (!entry) throw new Error(`Resource Path "${normalizedKey}" is not configured.`);
  return publicEntry(ctx, entry);
}

export async function hasResourcePath(ctx, key) {
  try {
    await getResourcePath(ctx, key);
    return true;
  } catch {
    return false;
  }
}

export async function resolveResourcePath(ctx, key) {
  const normalizedKey = normalizeResourceKey(key);
  const entry = (await mergedEntries(ctx)).get(normalizedKey);
  if (!entry) throw new Error(`Resource Path "${normalizedKey}" is not configured.`);
  const resolved = await resolveNotebookResourceDirectory(ctx, entry.path);
  return { ...resolved, key: normalizedKey, name: entry.name };
}

export async function setResourcePath(ctx, input = {}) {
  const key = normalizeResourceKey(input.key);
  const builtIn = getBuiltInResourcePathDefinition(key);
  const current = await mergedEntries(ctx);
  const name = builtIn?.name || normalizeResourceName(input.name || current.get(key)?.name || key);
  const entry = normalizeStoredEntry(ctx, key, { name, path: input.path }, builtIn);
  current.set(key, entry);
  await writeEntries(ctx, [...current.values()]);
  return publicEntry(ctx, entry);
}

export async function removeResourcePath(ctx, key) {
  const normalizedKey = normalizeResourceKey(key);
  if (isBuiltInResourcePathKey(normalizedKey)) throw new Error("Built-in Resource Paths cannot be removed.");
  const current = await mergedEntries(ctx);
  if (!current.delete(normalizedKey)) throw new Error(`Resource Path "${normalizedKey}" was not found.`);
  await writeEntries(ctx, [...current.values()]);
  return { ok: true, key: normalizedKey };
}

export async function saveResourcePathEntries(ctx, rawEntries = []) {
  if (!Array.isArray(rawEntries)) throw new Error("Resource Paths payload must be an array.");
  const seen = new Set();
  const current = await mergedEntries(ctx);
  const next = new Map();
  const byKey = new Map();

  for (const entry of rawEntries) {
    const key = normalizeResourceKey(entry?.key);
    if (byKey.has(key)) throw new Error(`Duplicate Resource Path key: ${key}`);
    byKey.set(key, entry);
  }

  for (const builtIn of getBuiltInResourcePathDefinitions()) {
    const incoming = byKey.get(builtIn.key);
    const currentEntry = current.get(builtIn.key);
    const pathValue = incoming?.path ?? currentEntry?.path ?? builtIn.defaultPath;
    next.set(builtIn.key, normalizeStoredEntry(ctx, builtIn.key, { path: pathValue }, builtIn));
    seen.add(builtIn.key);
  }

  for (const entry of rawEntries) {
    const key = normalizeResourceKey(entry?.key);
    if (seen.has(key)) continue;
    if (isBuiltInResourcePathKey(key)) throw new Error("Built-in Resource Path metadata cannot be overwritten.");
    seen.add(key);
    next.set(key, normalizeStoredEntry(ctx, key, entry, null));
  }

  await writeEntries(ctx, [...next.values()]);
  return listResourcePaths(ctx);
}

export {
  getResourcePath as get,
  setResourcePath as set,
  hasResourcePath as has,
  listResourcePaths as list,
  resolveResourcePath as resolve,
};
