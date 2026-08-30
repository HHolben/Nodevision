// Nodevision/ApplicationSystem/Resources/ResourceSettingsStore.mjs
// Loads and saves typed resource sources while preserving the legacy ResourcePaths.json format.

import fs from "node:fs/promises";
import path from "node:path";
import { RESOURCE_PATHS_FILENAME } from "../ResourcePaths/ResourcePathDefinitions.mjs";
import { toNotebookRelativeResourcePath } from "../ResourcePaths/ResourcePathValidation.mjs";
import {
  RESOURCE_CONFIG_VERSION,
  RESOURCE_SOURCE_TYPES,
  getLegacyPathTypeId,
  getResourceTypeDefinition,
  getResourceTypeDefinitions,
  normalizeResolutionStrategy,
  normalizeResourceSourceType,
  normalizeResourceTypeId,
} from "./ResourceTypeDefinitions.mjs";
import { normalizePortableRelativePath, resolveResourceSourceDirectory } from "./ResourcePathSafety.mjs";

const LEGACY_SECTIONAL_SETTINGS_FILENAME = "SectionalMapSettings.json";
const SOURCE_ID_PATTERN = /^[a-z][a-z0-9]*(\.[a-z0-9][a-z0-9-]*)*$/;

export function getResourceSettingsPath(ctx) {
  return path.join(ctx.userSettingsDir, RESOURCE_PATHS_FILENAME);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

async function readRawSettings(ctx) {
  try {
    return JSON.parse(await fs.readFile(getResourceSettingsPath(ctx), "utf8"));
  } catch (err) {
    if (err?.code === "ENOENT" || err instanceof SyntaxError) return {};
    throw err;
  }
}

async function readLegacySectionalPath(ctx) {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(ctx.userSettingsDir, LEGACY_SECTIONAL_SETTINGS_FILENAME), "utf8"));
    return toNotebookRelativeResourcePath(ctx, raw.sectionalMapsDirectory);
  } catch (err) {
    if (err?.code === "ENOENT" || err instanceof SyntaxError) return "";
    throw err;
  }
}

function legacyRecordsFromRaw(raw) {
  const records = raw?.resourcePaths && typeof raw.resourcePaths === "object" ? raw.resourcePaths : raw?.paths;
  return records && typeof records === "object" && !Array.isArray(records) ? records : {};
}

function normalizeSourceId(value, typeId) {
  const id = String(value || "").trim().toLowerCase();
  if (!SOURCE_ID_PATTERN.test(id)) throw new Error(`Resource source ID for ${typeId} is invalid.`);
  return id;
}

function normalizeSourceName(value, fallback = "Resource Source") {
  const name = String(value || fallback || "").replace(/\s+/g, " ").trim();
  if (!name) throw new Error("Resource source name is required.");
  if (name.length > 90) throw new Error("Resource source name is too long.");
  return name;
}

function normalizePriority(value, fallback = 0) {
  const number = Number(value ?? fallback ?? 0);
  if (!Number.isFinite(number)) throw new Error("Resource source priority must be a number.");
  return Math.round(number);
}

function normalizeSourcePath(ctx, sourceType, rawPath) {
  if (sourceType === RESOURCE_SOURCE_TYPES.NOTEBOOK) return toNotebookRelativeResourcePath(ctx, rawPath);
  const label = sourceType === RESOURCE_SOURCE_TYPES.MANAGED ? "Managed Resource source path" : "Application Resource source path";
  return normalizePortableRelativePath(rawPath, label);
}

function defaultSourcesForType(ctx, typeDef, legacyRecords, legacySectionalPath) {
  return typeDef.defaultSources.map((source) => {
    const next = { ...source, typeId: typeDef.id };
    const legacy = legacyRecords[typeDef.legacyPathKey];
    const legacyPath = typeof legacy === "string" ? legacy : legacy?.path;
    if (source.legacyPath && legacyPath) next.path = legacyPath;
    else if (source.legacyPath && typeDef.legacyPathKey === "aviation.sectionalMaps" && legacySectionalPath) next.path = legacySectionalPath;
    next.path = normalizeSourcePath(ctx, next.sourceType, next.path);
    return next;
  });
}

function normalizeResourceSource(ctx, typeDef, source, fallback = {}) {
  const sourceType = normalizeResourceSourceType(source?.sourceType ?? fallback.sourceType);
  const protectedSource = Boolean(fallback.protected || source?.protected);
  const editable = source?.editable ?? fallback.editable ?? sourceType === RESOURCE_SOURCE_TYPES.NOTEBOOK;
  const removable = protectedSource ? false : Boolean(source?.removable ?? fallback.removable ?? true);
  return {
    ...cloneJson(fallback || {}),
    ...cloneJson(source || {}),
    typeId: typeDef.id,
    id: normalizeSourceId(source?.id ?? fallback.id, typeDef.id),
    name: normalizeSourceName(source?.name ?? fallback.name, fallback.name || "Resource Source"),
    sourceType,
    path: normalizeSourcePath(ctx, sourceType, source?.path ?? fallback.path),
    enabled: source?.enabled !== undefined ? Boolean(source.enabled) : fallback.enabled !== false,
    priority: normalizePriority(source?.priority, fallback.priority),
    protected: protectedSource,
    removable,
    editable: Boolean(editable),
  };
}

function normalizeTypeSettings(ctx, typeDef, rawType, legacyRecords, legacySectionalPath) {
  const defaultSources = defaultSourcesForType(ctx, typeDef, legacyRecords, legacySectionalPath);
  const rawSources = Array.isArray(rawType?.sources) ? rawType.sources : [];
  const rawById = new Map();
  for (const source of rawSources) {
    if (!source?.id) continue;
    rawById.set(String(source.id).trim().toLowerCase(), source);
  }

  const sources = [];
  const seen = new Set();
  for (const defaultSource of defaultSources) {
    const rawSource = rawById.get(defaultSource.id);
    sources.push(normalizeResourceSource(ctx, typeDef, rawSource || defaultSource, defaultSource));
    seen.add(defaultSource.id);
  }
  for (const rawSource of rawSources) {
    const rawId = String(rawSource?.id || "").trim().toLowerCase();
    if (!rawId || seen.has(rawId)) continue;
    sources.push(normalizeResourceSource(ctx, typeDef, rawSource, { enabled: true, priority: 300, removable: true, editable: true }));
    seen.add(rawId);
  }

  sources.sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return {
    id: typeDef.id,
    displayName: typeDef.displayName,
    description: typeDef.description,
    supportedExtensions: [...typeDef.supportedExtensions],
    resolutionStrategy: normalizeResolutionStrategy(rawType?.resolutionStrategy || rawType?.strategy, typeDef.resolutionStrategy),
    legacyPathKey: typeDef.legacyPathKey,
    sources,
  };
}

export async function loadResourceSettings(ctx) {
  const raw = await readRawSettings(ctx);
  const legacyRecords = legacyRecordsFromRaw(raw);
  const legacySectionalPath = await readLegacySectionalPath(ctx);
  const resources = {};
  for (const typeDef of getResourceTypeDefinitions()) {
    resources[typeDef.id] = normalizeTypeSettings(ctx, typeDef, raw?.resources?.[typeDef.id], legacyRecords, legacySectionalPath);
  }
  return { version: RESOURCE_CONFIG_VERSION, resources };
}

function legacyPathRecordFromSource(source) {
  return { path: source.path };
}

function mirrorLegacyResourcePaths(raw, settings) {
  const legacy = { ...legacyRecordsFromRaw(raw) };
  for (const type of Object.values(settings.resources || {})) {
    if (!type?.legacyPathKey) continue;
    const source = (type.sources || []).find((item) => item.legacyPath) || (type.sources || []).find((item) => item.sourceType === RESOURCE_SOURCE_TYPES.NOTEBOOK);
    if (source?.sourceType === RESOURCE_SOURCE_TYPES.NOTEBOOK) legacy[type.legacyPathKey] = legacyPathRecordFromSource(source);
  }
  return legacy;
}

async function writeResourceSettings(ctx, settings, rawBase = {}) {
  await fs.mkdir(ctx.userSettingsDir, { recursive: true });
  const target = getResourceSettingsPath(ctx);
  const temp = target + ".tmp";
  const payload = {
    ...rawBase,
    version: RESOURCE_CONFIG_VERSION,
    resources: settings.resources,
    resourcePaths: mirrorLegacyResourcePaths(rawBase, settings),
  };
  await fs.writeFile(temp, JSON.stringify(payload, null, 2) + "\n");
  await fs.rename(temp, target);
}

export async function saveResourceSettings(ctx, input = {}) {
  const raw = await readRawSettings(ctx);
  const legacyRecords = legacyRecordsFromRaw(raw);
  const legacySectionalPath = await readLegacySectionalPath(ctx);
  const resources = {};
  for (const typeDef of getResourceTypeDefinitions()) {
    const incoming = input?.resources?.[typeDef.id] || {};
    resources[typeDef.id] = normalizeTypeSettings(ctx, typeDef, incoming, legacyRecords, legacySectionalPath);
  }
  const settings = { version: RESOURCE_CONFIG_VERSION, resources };
  await writeResourceSettings(ctx, settings, raw);
  return loadResourceSettings(ctx);
}

export async function listResourceTypes(ctx) {
  return Object.values((await loadResourceSettings(ctx)).resources);
}

export async function getResourceTypeSettings(ctx, typeId) {
  const normalizedTypeId = normalizeResourceTypeId(typeId);
  const settings = await loadResourceSettings(ctx);
  const type = settings.resources[normalizedTypeId];
  if (!type) getResourceTypeDefinition(normalizedTypeId);
  return type;
}

export async function saveResourceTypeSources(ctx, typeId, sources = [], options = {}) {
  const normalizedTypeId = normalizeResourceTypeId(typeId);
  const current = await loadResourceSettings(ctx);
  const typeDef = getResourceTypeDefinition(normalizedTypeId);
  const raw = await readRawSettings(ctx);
  const incoming = {
    ...current.resources[normalizedTypeId],
    resolutionStrategy: options.resolutionStrategy || current.resources[normalizedTypeId]?.resolutionStrategy || typeDef.resolutionStrategy,
    sources,
  };
  current.resources[normalizedTypeId] = normalizeTypeSettings(ctx, typeDef, incoming, {}, "");
  await writeResourceSettings(ctx, current, raw);
  return getResourceTypeSettings(ctx, normalizedTypeId);
}

export async function setLegacyResourcePathSource(ctx, legacyPathKey, notebookRelativePath) {
  const typeId = getLegacyPathTypeId(legacyPathKey);
  if (!typeId) return null;
  const type = await getResourceTypeSettings(ctx, typeId);
  const sources = type.sources.map((source) => {
    if (source.legacyPath && source.sourceType === RESOURCE_SOURCE_TYPES.NOTEBOOK) return { ...source, path: notebookRelativePath, enabled: true };
    return source;
  });
  return saveResourceTypeSources(ctx, typeId, sources, { resolutionStrategy: type.resolutionStrategy });
}

export async function resolveFirstEnabledSourceDirectory(ctx, typeId, options = {}) {
  const type = await getResourceTypeSettings(ctx, typeId);
  const preferredTypes = Array.isArray(options.preferredSourceTypes) ? options.preferredSourceTypes : [];
  const sources = [...type.sources]
    .filter((source) => source.enabled !== false)
    .sort((a, b) => {
      const preferredA = preferredTypes.includes(a.sourceType) ? preferredTypes.indexOf(a.sourceType) : preferredTypes.length;
      const preferredB = preferredTypes.includes(b.sourceType) ? preferredTypes.indexOf(b.sourceType) : preferredTypes.length;
      if (preferredA !== preferredB) return preferredA - preferredB;
      return b.priority - a.priority || a.name.localeCompare(b.name);
    });
  const diagnostics = [];
  for (const source of sources) {
    const resolved = await resolveResourceSourceDirectory(ctx, source);
    diagnostics.push({ sourceId: source.id, exists: resolved.exists, isDirectory: resolved.isDirectory });
    if (options.mustExist && (!resolved.exists || !resolved.isDirectory)) continue;
    return { type, source, ...resolved, diagnostics };
  }
  throw new Error(`No enabled ${type.displayName} source is configured.`);
}
