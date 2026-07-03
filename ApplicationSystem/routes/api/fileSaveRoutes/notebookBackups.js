// Nodevision/ApplicationSystem/routes/api/fileSaveRoutes/notebookBackups.js
// This file creates point-in-time notebook file backups before save overwrites and prunes old backups based on UserSettings retention settings.

import fs from "node:fs/promises";
import path from "node:path";
import { isWithin, normalizeClientPath } from "./paths.js";

export const NOTEBOOK_BACKUP_DIRNAME = "NotebookBackups";
export const NOTEBOOK_BACKUP_SETTINGS_FILENAME = "NotebookBackupSettings.json";
export const DEFAULT_BACKUP_RETENTION_HOURS = 48;

const MIN_RETENTION_HOURS = 1;
const MAX_RETENTION_HOURS = 24 * 365;

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

export function sanitizeNotebookBackupSettings(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    retentionHours: clampNumber(
      source.retentionHours ?? source.keepBackupsForHours ?? source.maxAgeHours,
      MIN_RETENTION_HOURS,
      MAX_RETENTION_HOURS,
      DEFAULT_BACKUP_RETENTION_HOURS,
    ),
  };
}

async function writeJsonAtomic(filePath, value) {
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(tmp, filePath);
}

export async function loadNotebookBackupSettings(userSettingsRoot) {
  const settingsPath = path.join(userSettingsRoot, NOTEBOOK_BACKUP_SETTINGS_FILENAME);
  await fs.mkdir(userSettingsRoot, { recursive: true });
  try {
    const raw = await fs.readFile(settingsPath, "utf8");
    const settings = sanitizeNotebookBackupSettings(JSON.parse(raw || "{}"));
    return { settings, settingsPath };
  } catch (err) {
    if (err?.code !== "ENOENT" && !(err instanceof SyntaxError)) throw err;
    const settings = sanitizeNotebookBackupSettings({});
    await writeJsonAtomic(settingsPath, settings);
    return { settings, settingsPath };
  }
}

export async function saveNotebookBackupSettings(userSettingsRoot, rawSettings = {}) {
  const settingsPath = path.join(userSettingsRoot, NOTEBOOK_BACKUP_SETTINGS_FILENAME);
  await fs.mkdir(userSettingsRoot, { recursive: true });
  const settings = sanitizeNotebookBackupSettings(rawSettings);
  await writeJsonAtomic(settingsPath, settings);
  return { settings, settingsPath };
}

function timestampForFilename(date = new Date()) {
  const pad = (value, width = 2) => String(value).padStart(width, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + "_" + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("-") + `-${pad(date.getMilliseconds(), 3)}`;
}

export function backupRelativePathForNotebookPath(relativePath, date = new Date()) {
  const normalized = normalizeClientPath(relativePath).replace(/^Notebook\//i, "");
  const parsed = path.posix.parse(normalized.split(path.sep).join("/"));
  const timestamp = timestampForFilename(date);
  const backupName = parsed.ext
    ? `${parsed.name}_${timestamp}${parsed.ext}`
    : `${parsed.name || "untitled"}_${timestamp}`;
  return path.posix.join(parsed.dir, backupName);
}

async function pruneDirectoryIfEmpty(dirPath, stopAt) {
  let current = dirPath;
  while (current && current !== stopAt && isWithin(stopAt, current)) {
    try {
      await fs.rmdir(current);
    } catch {
      return;
    }
    current = path.dirname(current);
  }
}

export async function pruneOldNotebookBackups({ backupRoot, retentionHours, now = Date.now() } = {}) {
  const maxAgeMs = Math.max(MIN_RETENTION_HOURS, Number(retentionHours) || DEFAULT_BACKUP_RETENTION_HOURS) * 60 * 60 * 1000;
  const cutoff = now - maxAgeMs;
  let deleted = 0;

  async function visit(dirPath) {
    let entries = [];
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch (err) {
      if (err?.code === "ENOENT") return;
      throw err;
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
        await pruneDirectoryIfEmpty(fullPath, backupRoot);
        continue;
      }
      if (!entry.isFile()) continue;
      const stat = await fs.stat(fullPath);
      if (stat.mtimeMs < cutoff) {
        await fs.unlink(fullPath);
        deleted += 1;
      }
    }
  }

  await visit(backupRoot);
  return { deleted };
}

export async function backupNotebookFileBeforeSave({ notebookRoot, userSettingsRoot, filePath, relativePath } = {}) {
  const backupRoot = path.join(userSettingsRoot, NOTEBOOK_BACKUP_DIRNAME);
  const { settings } = await loadNotebookBackupSettings(userSettingsRoot);
  await fs.mkdir(backupRoot, { recursive: true });

  let stat = null;
  try {
    stat = await fs.stat(filePath);
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
  }

  let backupPath = null;
  if (stat?.isFile?.()) {
    const backupRelative = backupRelativePathForNotebookPath(relativePath);
    backupPath = path.join(backupRoot, backupRelative);
    if (!isWithin(backupRoot, backupPath)) throw new Error("Backup path escaped NotebookBackups root");
    if (!isWithin(notebookRoot, filePath)) throw new Error("Saved file path escaped Notebook root");
    await fs.mkdir(path.dirname(backupPath), { recursive: true });
    await fs.copyFile(filePath, backupPath);
  }

  await pruneOldNotebookBackups({ backupRoot, retentionHours: settings.retentionHours });

  return {
    backupPath,
    retentionHours: settings.retentionHours,
  };
}
