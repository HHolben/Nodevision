// Nodevision/ApplicationSystem/Aviation/SectionalMaps/SectionalMapSettings.mjs
// This module stores and validates FAA sectional-map directory settings as Notebook-relative paths.

import path from "node:path";
import fs from "node:fs/promises";
import { isWithin } from "../../routes/api/fileSaveRoutes/paths.js";

export const SECTIONAL_SETTINGS_FILENAME = "SectionalMapSettings.json";
export const DEFAULT_SECTIONAL_MAPS_DIRECTORY = "Resources/Aviation/Sectionals";

export function normalizeSectionalMapsDirectory(value, options = {}) {
  let text = String(value ?? "").replace(/\\/g, "/").trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) throw new Error("Sectional Maps Directory must be inside the active Notebook.");
  if (/^[A-Za-z]:\//.test(text)) throw new Error("Windows absolute paths are not valid Notebook-relative directories.");
  if (text.startsWith("/")) throw new Error("Use a Notebook-relative Sectional Maps Directory.");
  if (/^Notebook\//i.test(text)) text = text.slice("Notebook/".length);
  text = text.replace(/^\/+|\/+$/g, "");
  if (!text) {
    if (options.allowDefault) return DEFAULT_SECTIONAL_MAPS_DIRECTORY;
    throw new Error("Sectional Maps Directory is required.");
  }

  const parts = text.split("/").filter(Boolean);
  if (parts.some((part) => part === "." || part === "..")) {
    throw new Error("Sectional Maps Directory cannot contain traversal segments.");
  }
  return parts.join("/");
}

export function toNotebookRelativeSectionalDirectory(ctx, value) {
  const text = String(value ?? "").replace(/\\/g, "/").trim();
  if (text.startsWith("/")) {
    const targetPath = path.resolve(text);
    const notebookPath = path.resolve(ctx.notebookDir);
    if (!isWithin(notebookPath, targetPath)) throw new Error("Absolute Sectional Maps Directory is outside the active Notebook.");
    return normalizeSectionalMapsDirectory(path.relative(notebookPath, targetPath).split(path.sep).join("/"), { allowDefault: false });
  }
  return normalizeSectionalMapsDirectory(value, { allowDefault: false });
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
  try {
    const raw = JSON.parse(await fs.readFile(getSectionalSettingsPath(ctx), "utf8"));
    return sanitizeSectionalMapSettings(raw);
  } catch (err) {
    if (err?.code === "ENOENT" || err instanceof SyntaxError) return sanitizeSectionalMapSettings({});
    throw err;
  }
}

export async function getSectionalMapsDirectory(ctx) {
  const settings = await loadSectionalMapSettings(ctx);
  return resolveSectionalMapsDirectory(ctx, settings.sectionalMapsDirectory);
}

export async function saveSectionalMapSettings(ctx, input) {
  const settings = { sectionalMapsDirectory: toNotebookRelativeSectionalDirectory(ctx, input.sectionalMapsDirectory) };
  await resolveSectionalMapsDirectory(ctx, settings.sectionalMapsDirectory);
  await fs.mkdir(ctx.userSettingsDir, { recursive: true });
  const target = getSectionalSettingsPath(ctx);
  const temp = target + ".tmp";
  await fs.writeFile(temp, JSON.stringify(settings, null, 2) + "\n");
  await fs.rename(temp, target);
  return settings;
}

async function nearestExistingParent(targetPath) {
  let candidate = targetPath;
  while (true) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) return candidate;
    } catch (err) {
      if (err?.code !== "ENOENT") throw err;
    }
    const parent = path.dirname(candidate);
    if (parent === candidate) return candidate;
    candidate = parent;
  }
}

export async function resolveSectionalMapsDirectory(ctx, relativeDirectory) {
  const relative = toNotebookRelativeSectionalDirectory(ctx, relativeDirectory);
  const targetPath = path.resolve(ctx.notebookDir, relative);
  if (!isWithin(ctx.notebookDir, targetPath)) throw new Error("Sectional Maps Directory must remain inside the Notebook.");

  const notebookReal = await fs.realpath(ctx.notebookDir);
  const parentReal = await fs.realpath(await nearestExistingParent(targetPath));
  if (!isWithin(notebookReal, parentReal)) throw new Error("Sectional Maps Directory parent escapes the Notebook.");

  return { relativeDirectory: relative, absoluteDirectory: targetPath };
}
