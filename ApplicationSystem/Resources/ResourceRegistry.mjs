// Nodevision/ApplicationSystem/Resources/ResourceRegistry.mjs
// Discovers and resolves typed resources from Application, UserData, and Notebook sources.

import fs from "node:fs/promises";
import path from "node:path";
import { isWithin } from "../routes/api/fileSaveRoutes/paths.js";
import { resolveDictionaryLayers, parseDictionaryText } from "./DictionaryResourceResolver.mjs";
import { collectElectronicsComponentReferencePaths, componentDocumentFromAsset, resolveElectronicsComponentLayers } from "./ElectronicsComponentResourceResolver.mjs";
import { RESOURCE_RESOLUTION_STRATEGIES, RESOURCE_SOURCE_TYPES, getResourceTypeDefinition } from "./ResourceTypeDefinitions.mjs";
import { getResourceTypeSettings, listResourceTypes } from "./ResourceSettingsStore.mjs";
import { normalizePortableRelativePath, resolveResourceFilePath, resolveResourceSourceDirectory, resourceUrlForFile, sourceDisplayPath } from "./ResourcePathSafety.mjs";
import { toNotebookRelativeResourcePath } from "../ResourcePaths/ResourcePathValidation.mjs";

const FONT_FORMATS = new Map([
  [".ttf", "truetype"],
  [".otf", "opentype"],
  [".woff", "woff"],
  [".woff2", "woff2"],
]);

const EXTERNAL_RESOURCE_REFERENCE = /^[a-z][a-z0-9+.-]*:\/\//i;

function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function normalizeExtension(filePath) {
  return path.extname(filePath).toLowerCase();
}

function basenameWithoutExtension(value) {
  return path.basename(value, path.extname(value)).replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeIdPart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "resource";
}

function resourceSourceMetadata(source) {
  return {
    sourceId: source.id,
    sourceName: source.name,
    sourceType: source.sourceType,
    sourcePath: source.path,
    sourceDisplayPath: sourceDisplayPath(source),
    priority: source.priority,
  };
}

function supportedExtensionSet(type) {
  const exact = new Set();
  const suffixes = [];
  for (const ext of type.supportedExtensions || []) {
    const normalized = String(ext || "").toLowerCase();
    if (!normalized) continue;
    if (normalized.includes(".", 1)) suffixes.push(normalized);
    else exact.add(normalized);
  }
  return { exact, suffixes };
}

function isSupportedFile(relativeFile, type) {
  const lower = relativeFile.toLowerCase();
  const { exact, suffixes } = supportedExtensionSet(type);
  return exact.has(normalizeExtension(lower)) || suffixes.some((suffix) => lower.endsWith(suffix));
}

async function walkFiles(root, type, prefix = "") {
  const entries = await fs.readdir(path.join(root, prefix), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(root, type, relative));
    else if (entry.isFile() && isSupportedFile(relative, type)) files.push(relative);
  }
  return files.sort((a, b) => a.localeCompare(b));
}

async function readJsonFile(absolutePath) {
  return JSON.parse(await fs.readFile(absolutePath, "utf8"));
}

function fontFamilyFromFile(relativeFile) {
  return basenameWithoutExtension(relativeFile).replace(/\b\w/g, (letter) => letter.toUpperCase()).replace(/\s+/g, "");
}

function buildFontResource(ctx, type, source, file) {
  const extension = normalizeExtension(file.relativeFile);
  const family = fontFamilyFromFile(file.relativeFile);
  const id = `font.${normalizeIdPart(family)}`;
  return {
    typeId: type.id,
    kind: "font",
    id,
    logicalId: id,
    displayName: family,
    family,
    format: FONT_FORMATS.get(extension) || extension.replace(/^\./, ""),
    extension,
    path: file.relativeFile,
    url: resourceUrlForFile(source, file.relativeFile),
    notebookPath: source.sourceType === RESOURCE_SOURCE_TYPES.NOTEBOOK ? path.posix.join(source.path, file.relativeFile) : undefined,
    managedPath: source.sourceType === RESOURCE_SOURCE_TYPES.MANAGED ? path.posix.join(source.path, file.relativeFile) : undefined,
    applicationPath: source.sourceType === RESOURCE_SOURCE_TYPES.APPLICATION ? path.posix.join(source.path, file.relativeFile) : undefined,
    ...resourceSourceMetadata(source),
    modifiedAt: file.modifiedAt,
    size: file.size,
  };
}

async function buildMaterialResource(ctx, type, source, file) {
  let data = null;
  const diagnostics = [];
  try {
    data = await readJsonFile(file.absolutePath);
  } catch (err) {
    diagnostics.push({ level: "warning", code: "material-json-invalid", message: err.message, path: file.relativeFile, sourceId: source.id });
  }
  const idValue = data?.id || data?.materialId || basenameWithoutExtension(file.relativeFile);
  const id = String(idValue || "").trim();
  return {
    typeId: type.id,
    kind: "material",
    id,
    logicalId: `material.${normalizeIdPart(id)}`,
    displayName: data?.displayName || data?.name || basenameWithoutExtension(file.relativeFile) || id,
    materialId: id,
    extension: normalizeExtension(file.relativeFile),
    path: file.relativeFile,
    url: resourceUrlForFile(source, file.relativeFile),
    data: data || undefined,
    diagnostics,
    ...resourceSourceMetadata(source),
    modifiedAt: file.modifiedAt,
    size: file.size,
  };
}

async function buildDictionaryResource(ctx, type, source, file) {
  let document = null;
  const diagnostics = [];
  try {
    const text = await fs.readFile(file.absolutePath, "utf8");
    if (/\.json$/i.test(file.relativeFile)) document = JSON.parse(text);
    else document = { entries: parseDictionaryText(text) };
  } catch (err) {
    diagnostics.push({ level: "warning", code: "dictionary-invalid", message: err.message, path: file.relativeFile, sourceId: source.id });
  }
  const name = document?.name || basenameWithoutExtension(file.relativeFile);
  return {
    typeId: type.id,
    kind: "dictionary-document",
    id: `dictionary.${normalizeIdPart(name || file.relativeFile)}`,
    displayName: name,
    path: file.relativeFile,
    url: resourceUrlForFile(source, file.relativeFile),
    data: document || undefined,
    diagnostics,
    ...resourceSourceMetadata(source),
    modifiedAt: file.modifiedAt,
    size: file.size,
  };
}

async function referenceExists(absolutePath) {
  try {
    const stat = await fs.stat(absolutePath);
    return stat.isFile();
  } catch (err) {
    if (err?.code === "ENOENT") return false;
    throw err;
  }
}

async function validateElectronicsComponentReferences(ctx, source, file, document) {
  const diagnostics = [];
  const references = collectElectronicsComponentReferencePaths(document);
  for (const reference of references) {
    const refPath = String(reference.path || "").trim();
    if (!refPath || EXTERNAL_RESOURCE_REFERENCE.test(refPath) || refPath.startsWith("/api/")) continue;
    try {
      let absolutePath = "";
      if (source.sourceType === RESOURCE_SOURCE_TYPES.NOTEBOOK) {
        const notebookRelative = toNotebookRelativeResourcePath(ctx, refPath, { allowEmpty: false });
        absolutePath = path.resolve(ctx.notebookDir, notebookRelative);
      } else {
        const sourceDirectory = file.sourceDirectory || path.dirname(file.absolutePath);
        const relative = normalizePortableRelativePath(refPath, "Component reference path");
        absolutePath = path.resolve(sourceDirectory, relative);
        if (!isWithin(sourceDirectory, absolutePath)) throw new Error("Component reference path must remain inside its source directory.");
      }
      if (!await referenceExists(absolutePath)) {
        diagnostics.push({
          level: "warning",
          code: "component-reference-missing",
          message: `Referenced ${reference.field} file is missing: ${refPath}`,
          sourceId: source.id,
          componentId: reference.componentId,
          field: reference.field,
          resourceId: reference.resourceId,
          path: file.relativeFile,
          referencePath: refPath,
        });
      }
    } catch (err) {
      diagnostics.push({
        level: "warning",
        code: "component-reference-invalid",
        message: err.message,
        sourceId: source.id,
        componentId: reference.componentId,
        field: reference.field,
        resourceId: reference.resourceId,
        path: file.relativeFile,
        referencePath: refPath,
      });
    }
  }
  return diagnostics;
}

async function buildElectronicsComponentResource(ctx, type, source, file) {
  const extension = normalizeExtension(file.relativeFile);
  const diagnostics = [];
  let document = null;
  if (extension === ".json") {
    try {
      document = await readJsonFile(file.absolutePath);
    } catch (err) {
      diagnostics.push({ level: "warning", code: "electronics-component-json-invalid", message: err.message, path: file.relativeFile, sourceId: source.id });
    }
  } else {
    const assetPath = source.sourceType === RESOURCE_SOURCE_TYPES.NOTEBOOK ? path.posix.join(source.path, file.relativeFile) : file.relativeFile;
    document = componentDocumentFromAsset({
      extension,
      path: assetPath,
      relativeFile: file.relativeFile,
      url: resourceUrlForFile(source, file.relativeFile),
      displayName: basenameWithoutExtension(file.relativeFile),
    });
  }
  if (document) diagnostics.push(...await validateElectronicsComponentReferences(ctx, source, file, document));
  const name = document?.name || document?.displayName || basenameWithoutExtension(file.relativeFile);
  return {
    typeId: type.id,
    kind: "electronics-component-document",
    id: `electronics.component.document.${normalizeIdPart(source.id)}.${normalizeIdPart(file.relativeFile)}`,
    displayName: name,
    extension,
    path: file.relativeFile,
    url: resourceUrlForFile(source, file.relativeFile),
    data: document || undefined,
    diagnostics,
    ...resourceSourceMetadata(source),
    modifiedAt: file.modifiedAt,
    size: file.size,
  };
}

function buildGenericResource(ctx, type, source, file) {
  const name = basenameWithoutExtension(file.relativeFile);
  return {
    typeId: type.id,
    kind: type.id,
    id: `${normalizeIdPart(type.id)}.${normalizeIdPart(name)}`,
    displayName: name,
    extension: normalizeExtension(file.relativeFile),
    path: file.relativeFile,
    url: resourceUrlForFile(source, file.relativeFile),
    ...resourceSourceMetadata(source),
    modifiedAt: file.modifiedAt,
    size: file.size,
  };
}

async function buildResource(ctx, type, source, file) {
  if (type.id === "electronics.component") return buildElectronicsComponentResource(ctx, type, source, file);
  if (type.id === "font") return buildFontResource(ctx, type, source, file);
  if (type.id === "material") return buildMaterialResource(ctx, type, source, file);
  if (type.id === "dictionary") return buildDictionaryResource(ctx, type, source, file);
  return buildGenericResource(ctx, type, source, file);
}

async function statFile(absolutePath) {
  const stat = await fs.stat(absolutePath);
  return { size: stat.size, modifiedAt: stat.mtime.toISOString() };
}

async function discoverSourceResources(ctx, type, source) {
  const sourceStatus = await resolveResourceSourceDirectory(ctx, source);
  const publicSource = { ...source, displayPath: sourceDisplayPath(source), exists: sourceStatus.exists, isDirectory: sourceStatus.isDirectory };
  const diagnostics = [];
  if (!source.enabled) {
    return { source: publicSource, resources: [], diagnostics: [{ level: "info", code: "source-disabled", sourceId: source.id, message: `${source.name} is disabled.` }] };
  }
  if (!sourceStatus.exists) {
    diagnostics.push({ level: "warning", code: "source-missing", sourceId: source.id, message: `${source.name} does not exist.`, path: source.path });
    return { source: publicSource, resources: [], diagnostics };
  }
  if (!sourceStatus.isDirectory) {
    diagnostics.push({ level: "warning", code: "source-not-directory", sourceId: source.id, message: `${source.name} is not a directory.`, path: source.path });
    return { source: publicSource, resources: [], diagnostics };
  }
  const relativeFiles = await walkFiles(sourceStatus.absoluteDirectory, type);
  const resources = [];
  for (const relativeFile of relativeFiles) {
    const absolutePath = path.resolve(sourceStatus.absoluteDirectory, relativeFile);
    if (!isWithin(sourceStatus.absoluteDirectory, absolutePath)) continue;
    const stats = await statFile(absolutePath);
    const resource = await buildResource(ctx, type, source, { relativeFile, absolutePath, sourceDirectory: sourceStatus.absoluteDirectory, ...stats });
    resources.push(resource);
    if (Array.isArray(resource.diagnostics)) diagnostics.push(...resource.diagnostics);
  }
  return { source: publicSource, resources, diagnostics };
}

function sortByPriorityThenName(resources) {
  return [...resources].sort((a, b) => b.priority - a.priority || a.displayName.localeCompare(b.displayName) || a.path.localeCompare(b.path));
}

function resolveCollection(resources) {
  const sorted = [...resources].sort((a, b) => a.priority - b.priority || a.sourceId.localeCompare(b.sourceId) || a.path.localeCompare(b.path));
  const byId = new Map();
  for (const resource of sorted) {
    const duplicateKey = resource.id || resource.logicalId || resource.path;
    const existing = byId.get(duplicateKey);
    if (!existing || Number(resource.priority) >= Number(existing.priority)) byId.set(duplicateKey, resource);
  }
  return sortByPriorityThenName([...byId.values()]);
}

function mergeObjects(base = {}, overlay = {}) {
  const result = { ...base };
  for (const [key, value] of Object.entries(overlay || {})) {
    if (value === undefined) continue;
    if (value && typeof value === "object" && !Array.isArray(value) && base[key] && typeof base[key] === "object" && !Array.isArray(base[key])) result[key] = mergeObjects(base[key], value);
    else result[key] = cloneJson(value);
  }
  return result;
}

function resolveMaterialOverlay(resources) {
  const sorted = [...resources].sort((a, b) => a.priority - b.priority || a.sourceId.localeCompare(b.sourceId) || a.path.localeCompare(b.path));
  const byId = new Map();
  for (const resource of sorted) {
    if (!resource.data || !resource.id) continue;
    const key = String(resource.id).toLowerCase();
    const layer = { sourceId: resource.sourceId, sourceName: resource.sourceName, sourceType: resource.sourceType, priority: resource.priority, path: resource.path, url: resource.url };
    const existing = byId.get(key);
    if (!existing) {
      byId.set(key, { ...resource, layers: [layer] });
      continue;
    }
    const data = mergeObjects(existing.data || {}, resource.data || {});
    byId.set(key, {
      ...existing,
      ...resource,
      id: resource.id || existing.id,
      materialId: resource.materialId || existing.materialId,
      displayName: data.displayName || resource.displayName || existing.displayName,
      data,
      layers: [...(existing.layers || []), layer],
    });
  }
  return sortByPriorityThenName([...byId.values()]);
}

function resolveDictionaryOverlay(resources) {
  const layers = resources
    .filter((resource) => resource.data)
    .map((resource) => ({ source: { id: resource.sourceId, name: resource.sourceName, sourceType: resource.sourceType, priority: resource.priority }, document: resource.data }));
  return resolveDictionaryLayers(layers).map((entry) => ({
    typeId: "dictionary",
    kind: "dictionary-entry",
    id: `dictionary.entry.${normalizeIdPart(entry.term)}`,
    displayName: entry.term,
    term: entry.term,
    data: entry,
    sources: entry.sources,
  }));
}

function resolveElectronicsComponentCollection(resources) {
  const layers = resources
    .filter((resource) => resource.data)
    .map((resource) => ({
      source: {
        id: resource.sourceId,
        name: resource.sourceName,
        sourceType: resource.sourceType,
        priority: resource.priority,
        path: resource.sourcePath,
      },
      resource: {
        id: resource.id,
        path: resource.path,
        url: resource.url,
        displayName: resource.displayName,
      },
      document: resource.data,
    }));
  return resolveElectronicsComponentLayers(layers).map((component) => ({
    typeId: "electronics.component",
    kind: "electronics-component",
    id: component.componentId,
    logicalId: component.componentId,
    displayName: component.displayName,
    componentId: component.componentId,
    componentKind: component.componentKind,
    manufacturer: component.manufacturer,
    manufacturerPartNumber: component.manufacturerPartNumber,
    category: component.category,
    data: component,
    sources: component.sources,
    provenance: component.provenance,
    diagnostics: component.diagnostics,
  }));
}

function resolveResources(type, resources) {
  if (type.id === "electronics.component") return resolveElectronicsComponentCollection(resources);
  if (type.resolutionStrategy === RESOURCE_RESOLUTION_STRATEGIES.OVERLAY && type.id === "material") return resolveMaterialOverlay(resources);
  if (type.resolutionStrategy === RESOURCE_RESOLUTION_STRATEGIES.OVERLAY && type.id === "dictionary") return resolveDictionaryOverlay(resources);
  if (type.resolutionStrategy === RESOURCE_RESOLUTION_STRATEGIES.OVERLAY) return resolveCollection(resources);
  return resolveCollection(resources);
}

export async function getResources(ctx, typeId, options = {}) {
  const type = await getResourceTypeSettings(ctx, typeId);
  getResourceTypeDefinition(type.id);
  const diagnostics = [];
  const sourcePayloads = [];
  const allResources = [];
  for (const source of type.sources) {
    const payload = await discoverSourceResources(ctx, type, source);
    sourcePayloads.push(payload.source);
    diagnostics.push(...payload.diagnostics);
    allResources.push(...payload.resources);
  }
  const resources = options.raw === true ? sortByPriorityThenName(allResources) : resolveResources(type, allResources);
  if (options.raw !== true) {
    for (const resource of resources) {
      if (Array.isArray(resource.diagnostics)) diagnostics.push(...resource.diagnostics);
    }
  }
  return { ok: true, type, sources: sourcePayloads, resources, diagnostics };
}

export async function listResourceRegistry(ctx) {
  const types = await listResourceTypes(ctx);
  const payload = [];
  for (const type of types) {
    const sourceStatuses = [];
    for (const source of type.sources) {
      const resolved = await resolveResourceSourceDirectory(ctx, source);
      sourceStatuses.push({ ...source, displayPath: sourceDisplayPath(source), exists: resolved.exists, isDirectory: resolved.isDirectory });
    }
    payload.push({ ...type, sources: sourceStatuses });
  }
  return { ok: true, version: 2, types: payload };
}

export async function resolveResourceFile(ctx, query = {}) {
  const typeId = query.type || query.typeId;
  const sourceId = query.source || query.sourceId;
  const relativePath = query.path;
  const type = await getResourceTypeSettings(ctx, typeId);
  const source = type.sources.find((item) => item.id === sourceId);
  if (!source) throw new Error("Resource source was not found.");
  if (source.enabled === false) throw new Error("Resource source is disabled.");
  const resolved = await resolveResourceFilePath(ctx, source, relativePath);
  if (!isSupportedFile(resolved.relativeFile, type)) throw new Error("Requested file does not match this resource type.");
  return { type, source, absolutePath: resolved.absolutePath, relativePath: resolved.relativeFile, size: resolved.size, modifiedAt: resolved.modifiedAt };
}
