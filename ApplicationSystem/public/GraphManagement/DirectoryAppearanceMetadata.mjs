// Nodevision/ApplicationSystem/public/GraphManagement/DirectoryAppearanceMetadata.mjs
// This module normalizes, validates, and remaps persistent directory appearance metadata for Nodevision graph views.

export const DIRECTORY_APPEARANCE_METADATA_VERSION = 1;
export const DIRECTORY_APPEARANCE_CHANGED_EVENT = "nodevision-directory-appearance-changed";

function sortedObjectFromEntries(entries) {
  return Object.fromEntries([...entries].sort(([a], [b]) => a.localeCompare(b)));
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function directoryMetadataPathIsSafe(value = "") {
  let text = String(value ?? "").trim();
  text = text.replace(/\\/g, "/").replace(/[?#].*$/, "").replace(/^https?:\/\/[^/]+\/?/i, "").replace(/^\/+/, "");
  return !text.split("/").some((part) => part === "..");
}

export function normalizeDirectoryMetadataPath(value = "") {
  let text = String(value ?? "").trim();
  if (!text) return "";
  text = text.replace(/\\/g, "/").replace(/[?#].*$/, "").replace(/^https?:\/\/[^/]+\/?/i, "").replace(/^\/+/, "");
  if (text.toLowerCase() === "notebook") return "";
  if (text.toLowerCase().startsWith("notebook/")) text = text.slice("Notebook/".length);

  const parts = [];
  for (const part of text.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") return "";
    parts.push(part);
  }
  return parts.join("/");
}

export function normalizeHexColor(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const candidate = raw.startsWith("#") ? raw.slice(1) : raw;
  if (/^[0-9a-f]{3}$/i.test(candidate)) return "#" + candidate.split("").map((ch) => ch + ch).join("").toUpperCase();
  if (/^[0-9a-f]{6}$/i.test(candidate)) return "#" + candidate.toUpperCase();
  return "";
}

export function normalizeAlpha(value) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const raw = String(value).trim();
  let parsed = Number.parseFloat(raw.endsWith("%") ? raw.slice(0, -1) : raw);
  if (!Number.isFinite(parsed)) return null;
  if (raw.endsWith("%") || parsed > 1) parsed /= 100;
  return Math.round(Math.max(0, Math.min(1, parsed)) * 100) / 100;
}

function customAlpha(source, keys) {
  for (const key of keys) {
    if (!hasOwn(source, key)) continue;
    const alpha = normalizeAlpha(source[key]);
    if (alpha !== null && alpha < 1) return alpha;
  }
  return null;
}

function colorWithAlpha(color, alpha) {
  const nextAlpha = normalizeAlpha(alpha);
  if (nextAlpha === null || nextAlpha >= 1) return color;
  const hex = normalizeHexColor(color);
  if (!hex) return color;
  const num = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${nextAlpha})`;
}

export function sanitizeDirectoryAppearance(raw = {}) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const fillColor = normalizeHexColor(source.fillColor);
  const outlineColor = normalizeHexColor(source.outlineColor || source.lineColor);
  const fillAlpha = customAlpha(source, ["fillAlpha", "fillOpacity"]);
  const outlineAlpha = customAlpha(source, ["outlineAlpha", "outlineOpacity", "lineAlpha", "lineOpacity"]);
  const appearance = {};
  if (fillColor) appearance.fillColor = fillColor;
  if (outlineColor) appearance.outlineColor = outlineColor;
  if (fillAlpha !== null) appearance.fillAlpha = fillAlpha;
  if (outlineAlpha !== null) appearance.outlineAlpha = outlineAlpha;
  return appearance;
}

export function isDirectoryAppearanceEmpty(appearance = {}) {
  const clean = sanitizeDirectoryAppearance(appearance);
  return !clean.fillColor && !clean.outlineColor && !hasOwn(clean, "fillAlpha") && !hasOwn(clean, "outlineAlpha");
}

export function sanitizeDirectoryAppearanceRecord(raw = {}) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const appearanceSource = source.appearance && typeof source.appearance === "object" ? source.appearance : source;
  const appearance = sanitizeDirectoryAppearance(appearanceSource);
  return isDirectoryAppearanceEmpty(appearance) ? {} : { appearance };
}

function directorySourceFromManifest(raw = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  if (raw.directories && typeof raw.directories === "object" && !Array.isArray(raw.directories)) return raw.directories;
  if (raw.directoryAppearance && typeof raw.directoryAppearance === "object" && !Array.isArray(raw.directoryAppearance)) return raw.directoryAppearance;
  if (raw.appearances && typeof raw.appearances === "object" && !Array.isArray(raw.appearances)) return raw.appearances;
  return raw;
}

export function sanitizeDirectoryAppearanceManifest(raw = {}) {
  const directories = new Map();
  const source = directorySourceFromManifest(raw);
  for (const [pathValue, recordValue] of Object.entries(source)) {
    const cleanPath = normalizeDirectoryMetadataPath(pathValue);
    if (!directoryMetadataPathIsSafe(pathValue)) continue;
    const record = sanitizeDirectoryAppearanceRecord(recordValue);
    if (record.appearance) directories.set(cleanPath, record);
  }
  return { version: DIRECTORY_APPEARANCE_METADATA_VERSION, directories: sortedObjectFromEntries(directories) };
}

export function resolveDirectoryAppearanceFileManagerPalette({ appearance, state = "base", base = {}, hover = {}, selected = {} } = {}) {
  const palette = { ...(state === "selected" ? selected : state === "hover" ? hover : base) };
  const clean = sanitizeDirectoryAppearance(appearance);
  if (state !== "base" && state !== "selected") return palette;
  if (clean.fillColor || hasOwn(clean, "fillAlpha")) palette.backgroundColor = colorWithAlpha(clean.fillColor || palette.backgroundColor, hasOwn(clean, "fillAlpha") ? clean.fillAlpha : 1);
  if (clean.outlineColor || hasOwn(clean, "outlineAlpha")) palette.borderColor = colorWithAlpha(clean.outlineColor || palette.borderColor, hasOwn(clean, "outlineAlpha") ? clean.outlineAlpha : 1);
  return palette;
}

export function resolveDirectoryAppearanceGraphColors({ appearance, directoryColor, directoryFillColor, directoryBorderColor, directoryExpandedBorderColor = directoryColor, directoryFillOpacity = 1, directoryBorderOpacity = 1, directoryExpandedBorderOpacity = directoryBorderOpacity } = {}) {
  const clean = sanitizeDirectoryAppearance(appearance);
  const fillOpacity = hasOwn(clean, "fillAlpha") ? clean.fillAlpha : directoryFillOpacity;
  const borderOpacity = hasOwn(clean, "outlineAlpha") ? clean.outlineAlpha : directoryBorderOpacity;
  return {
    directoryColor: clean.fillColor || directoryColor,
    directoryFillColor: clean.fillColor || directoryFillColor,
    directoryBorderColor: clean.outlineColor || directoryBorderColor,
    directoryExpandedBorderColor: clean.outlineColor || directoryExpandedBorderColor,
    directoryFillOpacity: fillOpacity,
    directoryBorderOpacity: borderOpacity,
    directoryExpandedBorderOpacity: hasOwn(clean, "outlineAlpha") ? clean.outlineAlpha : directoryExpandedBorderOpacity,
  };
}

export function setDirectoryAppearanceInManifest(raw, pathValue, appearanceValue) {
  const manifest = sanitizeDirectoryAppearanceManifest(raw);
  const cleanPath = normalizeDirectoryMetadataPath(pathValue);
  if (!directoryMetadataPathIsSafe(pathValue)) return manifest;
  const appearance = sanitizeDirectoryAppearance(appearanceValue);
  if (isDirectoryAppearanceEmpty(appearance)) delete manifest.directories[cleanPath];
  else manifest.directories[cleanPath] = { appearance };
  return sanitizeDirectoryAppearanceManifest(manifest);
}

export function remapDirectoryAppearanceManifest(raw, oldPathValue, newPathValue) {
  const manifest = sanitizeDirectoryAppearanceManifest(raw);
  const oldPath = normalizeDirectoryMetadataPath(oldPathValue);
  const newPath = normalizeDirectoryMetadataPath(newPathValue);
  if (!directoryMetadataPathIsSafe(oldPathValue) || !directoryMetadataPathIsSafe(newPathValue)) return manifest;
  if (!oldPath || !newPath || oldPath === newPath) return manifest;

  const next = new Map();
  const moved = [];
  for (const [entryPath, record] of Object.entries(manifest.directories)) {
    if (entryPath === oldPath) moved.push([newPath, record]);
    else if (entryPath.startsWith(oldPath + "/")) moved.push([newPath + "/" + entryPath.slice(oldPath.length + 1), record]);
    else next.set(entryPath, record);
  }
  for (const [entryPath, record] of moved) next.set(entryPath, record);
  return { version: DIRECTORY_APPEARANCE_METADATA_VERSION, directories: sortedObjectFromEntries(next) };
}
