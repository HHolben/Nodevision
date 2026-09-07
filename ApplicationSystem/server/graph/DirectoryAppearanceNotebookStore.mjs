// Nodevision/ApplicationSystem/server/graph/DirectoryAppearanceNotebookStore.mjs
// This module derives directory appearance from Notebook-resident directory.css files and uses legacy graph metadata only as migration input.

import fs from "node:fs/promises";
import path from "node:path";
import { isWithin } from "../../routes/api/fileSaveRoutes/paths.js";
import { writePayloadToFile } from "../../routes/api/fileSaveRoutes/writePayload.js";
import {
  directoryMetadataPathIsSafe,
  isDirectoryAppearanceEmpty,
  normalizeDirectoryMetadataPath,
  sanitizeDirectoryAppearance,
  sanitizeDirectoryAppearanceManifest,
} from "../../public/GraphManagement/DirectoryAppearanceMetadata.mjs";
import {
  DIRECTORY_APPEARANCE_FILL_PROPERTY,
  DIRECTORY_APPEARANCE_OUTLINE_PROPERTY,
  DIRECTORY_APPEARANCE_STYLESHEET,
  addMissingDirectoryAppearanceCss,
  parseDirectoryAppearanceCss,
  removeEmptyNodevisionDirectoryAppearanceBlock,
  updateDirectoryAppearanceCss,
} from "../../public/GraphManagement/DirectoryAppearanceCss.mjs";
import {
  readDirectoryAppearanceManifest as readLegacyDirectoryAppearanceManifest,
  saveDirectoryAppearance as saveLegacyDirectoryAppearance,
} from "./DirectoryAppearanceStore.mjs";

export class DirectoryStylesheetConfirmationRequiredError extends Error {
  constructor(directoryPath) {
    super("Nodevision needs permission to update this directory.css before saving directory colors.");
    this.code = "DIRECTORY_STYLESHEET_CONFIRMATION_REQUIRED";
    this.statusCode = 409;
    this.directoryPath = directoryPath;
  }
}

function sortedObjectFromEntries(entries) {
  return Object.fromEntries([...entries].sort(([a], [b]) => a.localeCompare(b)));
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function cleanDirectoryPath(pathValue) {
  if (!directoryMetadataPathIsSafe(pathValue)) throw new Error("Invalid directory path.");
  return normalizeDirectoryMetadataPath(pathValue);
}

async function resolveDirectory(ctx, pathValue) {
  const cleanPath = cleanDirectoryPath(pathValue);
  const notebookDir = path.resolve(ctx.notebookDir);
  const absoluteDirectory = path.resolve(notebookDir, cleanPath || ".");
  if (!isWithin(notebookDir, absoluteDirectory)) throw new Error("Directory path must remain inside the Notebook.");
  const stat = await fs.stat(absoluteDirectory);
  if (!stat.isDirectory()) throw new Error("Directory appearance can only be saved for directories.");
  return { cleanPath, absoluteDirectory, cssPath: path.join(absoluteDirectory, DIRECTORY_APPEARANCE_STYLESHEET) };
}

async function directoryExists(ctx, pathValue) {
  try {
    await resolveDirectory(ctx, pathValue);
    return true;
  } catch {
    return false;
  }
}

async function readCssFile(cssPath) {
  try {
    return { exists: true, content: await fs.readFile(cssPath, "utf8") };
  } catch (err) {
    if (err?.code === "ENOENT") return { exists: false, content: "" };
    throw err;
  }
}

async function readDirectoryCss(ctx, pathValue) {
  const resolved = await resolveDirectory(ctx, pathValue);
  const file = await readCssFile(resolved.cssPath);
  return { ...resolved, ...file, parsed: parseDirectoryAppearanceCss(file.content) };
}

async function removeLegacyEntry(ctx, pathValue) {
  try {
    await saveLegacyDirectoryAppearance(ctx, pathValue, {});
  } catch (err) {
    console.warn("[DirectoryAppearance] Failed to clear legacy appearance metadata:", err);
  }
}

function propertyPresence(parsed) {
  const props = new Set((parsed?.declarations || []).map((declaration) => declaration.prop));
  return {
    fill: props.has(DIRECTORY_APPEARANCE_FILL_PROPERTY),
    outline: props.has(DIRECTORY_APPEARANCE_OUTLINE_PROPERTY),
  };
}

function mergeLegacyMissingProperties(cssRecord, legacyAppearance) {
  const cssAppearance = sanitizeDirectoryAppearance(cssRecord?.parsed?.appearance || {});
  const legacy = sanitizeDirectoryAppearance(legacyAppearance);
  const present = propertyPresence(cssRecord?.parsed);
  const merged = { ...cssAppearance };
  if (!present.fill && legacy.fillColor) {
    merged.fillColor = legacy.fillColor;
    if (hasOwn(legacy, "fillAlpha")) merged.fillAlpha = legacy.fillAlpha;
  }
  if (!present.outline && legacy.outlineColor) {
    merged.outlineColor = legacy.outlineColor;
    if (hasOwn(legacy, "outlineAlpha")) merged.outlineAlpha = legacy.outlineAlpha;
  }
  return sanitizeDirectoryAppearance(merged);
}

function migrationWouldAddProperties(cssRecord, legacyAppearance) {
  const present = propertyPresence(cssRecord?.parsed);
  const legacy = sanitizeDirectoryAppearance(legacyAppearance);
  return Boolean((!present.fill && legacy.fillColor) || (!present.outline && legacy.outlineColor));
}

function manifestFromMap(directoryMap) {
  return sanitizeDirectoryAppearanceManifest({ directories: sortedObjectFromEntries(directoryMap) });
}

async function writeDirectoryCss(ctx, pathValue, appearance) {
  const record = await readDirectoryCss(ctx, pathValue);
  const update = updateDirectoryAppearanceCss(record.content, appearance);
  const content = removeEmptyNodevisionDirectoryAppearanceBlock(update.content);
  if (isDirectoryAppearanceEmpty(appearance) && content.trim() === "") {
    if (record.exists) await fs.unlink(record.cssPath);
    return { path: record.cleanPath, appearance: {}, deleted: record.exists };
  }
  if (!record.exists || content !== record.content) {
    await writePayloadToFile({
      filePath: record.cssPath,
      content,
      encoding: "utf8",
      mimeType: "text/css",
      logPath: path.join(record.cleanPath, DIRECTORY_APPEARANCE_STYLESHEET),
    });
  }
  const next = parseDirectoryAppearanceCss(content);
  return { path: record.cleanPath, appearance: next.appearance, deleted: false };
}

async function writeMissingDirectoryCss(ctx, cssRecord, appearance) {
  const update = addMissingDirectoryAppearanceCss(cssRecord.content, appearance);
  if (!update.changed) return { path: cssRecord.cleanPath, appearance: cssRecord.parsed.appearance };
  await writePayloadToFile({
    filePath: cssRecord.cssPath,
    content: update.content,
    encoding: "utf8",
    mimeType: "text/css",
    logPath: path.join(cssRecord.cleanPath, DIRECTORY_APPEARANCE_STYLESHEET),
  });
  return { path: cssRecord.cleanPath, appearance: update.parsedAfter.appearance };
}

async function walkNotebookDirectories(ctx) {
  const notebookDir = path.resolve(ctx.notebookDir);
  const directories = [{ cleanPath: "", absoluteDirectory: notebookDir }];
  for (let index = 0; index < directories.length; index++) {
    let entries = [];
    try {
      entries = await fs.readdir(directories[index].absoluteDirectory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const cleanPath = [directories[index].cleanPath, entry.name].filter(Boolean).join("/");
      directories.push({ cleanPath, absoluteDirectory: path.join(directories[index].absoluteDirectory, entry.name) });
    }
  }
  return directories;
}

async function readAllDirectoryCss(ctx) {
  const records = new Map();
  for (const directory of await walkNotebookDirectories(ctx)) {
    const cssPath = path.join(directory.absoluteDirectory, DIRECTORY_APPEARANCE_STYLESHEET);
    const file = await readCssFile(cssPath);
    if (!file.exists) continue;
    records.set(directory.cleanPath, { ...directory, cssPath, ...file, parsed: parseDirectoryAppearanceCss(file.content) });
  }
  return records;
}

async function migrateLegacyEntry(ctx, cssRecords, directoryMap, pathValue, legacyAppearance, options) {
  const cssRecord = cssRecords.get(pathValue);
  if (cssRecord?.parsed?.hasNodevisionProperties) {
    const merged = mergeLegacyMissingProperties(cssRecord, legacyAppearance);
    if (migrationWouldAddProperties(cssRecord, legacyAppearance) && options.migrate !== false) {
      const written = await writeMissingDirectoryCss(ctx, cssRecord, merged);
      directoryMap.set(pathValue, { appearance: written.appearance });
      await removeLegacyEntry(ctx, pathValue);
    } else if (!isDirectoryAppearanceEmpty(cssRecord.parsed.appearance)) {
      directoryMap.set(pathValue, { appearance: cssRecord.parsed.appearance });
    }
    return;
  }
  if (cssRecord?.exists) {
    directoryMap.set(pathValue, { appearance: sanitizeDirectoryAppearance(legacyAppearance) });
    return;
  }
  if (options.migrate !== false && await directoryExists(ctx, pathValue)) {
    const written = await writeDirectoryCss(ctx, pathValue, legacyAppearance);
    directoryMap.set(pathValue, { appearance: written.appearance });
    await removeLegacyEntry(ctx, pathValue);
    return;
  }
  directoryMap.set(pathValue, { appearance: sanitizeDirectoryAppearance(legacyAppearance) });
}

async function readDirectoryAppearanceRecord(ctx, pathValue, legacyManifest = null) {
  const cleanPath = cleanDirectoryPath(pathValue);
  const cssRecord = await readDirectoryCss(ctx, cleanPath);
  const legacy = legacyManifest || await readLegacyDirectoryAppearanceManifest(ctx);
  const legacyAppearance = legacy.directories?.[cleanPath]?.appearance || {};
  if (cssRecord.parsed?.hasNodevisionProperties) {
    return { path: cleanPath, appearance: mergeLegacyMissingProperties(cssRecord, legacyAppearance) };
  }
  return { path: cleanPath, appearance: sanitizeDirectoryAppearance(legacyAppearance) };
}

export async function readDirectoryAppearanceRecords(ctx, pathValues = []) {
  const directories = {};
  const paths = [];
  const requestedPathValues = Array.isArray(pathValues) ? pathValues : [pathValues];
  if (!requestedPathValues.length) return { paths, directories };
  const legacy = await readLegacyDirectoryAppearanceManifest(ctx);
  for (const pathValue of requestedPathValues) {
    const record = await readDirectoryAppearanceRecord(ctx, pathValue, legacy);
    paths.push(record.path);
    directories[record.path] = { appearance: sanitizeDirectoryAppearance(record.appearance) };
  }
  return { paths, directories: sortedObjectFromEntries(Object.entries(directories)) };
}

export async function readDirectoryAppearanceManifest(ctx, options = {}) {
  const cssRecords = await readAllDirectoryCss(ctx);
  const directoryMap = new Map();
  for (const [pathValue, record] of cssRecords.entries()) {
    if (!isDirectoryAppearanceEmpty(record.parsed.appearance)) directoryMap.set(pathValue, { appearance: record.parsed.appearance });
  }
  const legacy = await readLegacyDirectoryAppearanceManifest(ctx);
  for (const [pathValue, record] of Object.entries(legacy.directories || {})) {
    if (directoryMap.has(pathValue) && !migrationWouldAddProperties(cssRecords.get(pathValue), record.appearance)) continue;
    await migrateLegacyEntry(ctx, cssRecords, directoryMap, pathValue, record.appearance, options);
  }
  return manifestFromMap(directoryMap);
}

export async function saveDirectoryAppearance(ctx, pathValue, appearanceValue, options = {}) {
  const record = await readDirectoryCss(ctx, pathValue);
  const appearance = sanitizeDirectoryAppearance(appearanceValue);
  if (record.exists && !record.parsed.hasNodevisionProperties && !isDirectoryAppearanceEmpty(appearance) && options.confirmDirectoryStylesheetUpdate !== true) {
    throw new DirectoryStylesheetConfirmationRequiredError(record.cleanPath);
  }
  const written = await writeDirectoryCss(ctx, record.cleanPath, appearance);
  await removeLegacyEntry(ctx, record.cleanPath);
  return { path: written.path, appearance: written.appearance };
}
