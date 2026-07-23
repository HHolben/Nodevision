// Nodevision/ApplicationSystem/PhoneImport/IOSBackupValidator.mjs
// Validates an existing local unencrypted iTunes/Finder/libimobiledevice backup without modifying it.

import fs from "node:fs/promises";
import path from "node:path";

import { PhoneImportError, PHONE_IMPORT_ERROR_CODES, redactPath } from "./PhoneImportErrors.mjs";
import { pathExists, readPlistFile } from "./PhoneImportUtils.mjs";

const REQUIRED_MANIFEST_DB = "Manifest.db";
const OPTIONAL_METADATA = ["Manifest.plist", "Info.plist", "Status.plist"];

function hasTraversalSegment(value = "") {
  return String(value || "").replace(/\\/g, "/").split("/").includes("..");
}

async function statDirectory(candidate) {
  let stat;
  try {
    stat = await fs.stat(candidate);
  } catch (err) {
    throw new PhoneImportError(PHONE_IMPORT_ERROR_CODES.INVALID_PATH, "Selected backup path does not exist.", {
      statusCode: 400,
      cause: err,
      details: { candidate },
    });
  }
  if (!stat.isDirectory()) {
    throw new PhoneImportError(PHONE_IMPORT_ERROR_CODES.INVALID_BACKUP_DIRECTORY, "Selected path is not a directory.", {
      statusCode: 400,
      details: { candidate },
    });
  }
}

async function isBackupDirectory(candidate) {
  return await pathExists(path.join(candidate, REQUIRED_MANIFEST_DB));
}

async function readMetadataFile(backupPath, filename, warnings) {
  const fullPath = path.join(backupPath, filename);
  if (!(await pathExists(fullPath))) return null;
  try {
    return await readPlistFile(fullPath);
  } catch (err) {
    warnings.push({ code: "plist_parse_failed", file: filename, message: err?.message || "Unable to parse plist" });
    return null;
  }
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function firstDateLike(...values) {
  for (const value of values) {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function extractBackupMetadata(info = {}, manifest = {}, status = {}) {
  return {
    deviceName: firstString(info["Device Name"], info.DeviceName, manifest.DeviceName, "iPhone Backup"),
    productType: firstString(info["Product Type"], info.ProductType, manifest.ProductType),
    productVersion: firstString(info["Product Version"], info.ProductVersion, manifest.ProductVersion),
    buildVersion: firstString(info["Build Version"], info.BuildVersion, manifest.BuildVersion),
    backupDate: firstDateLike(info["Last Backup Date"], info.LastBackupDate, status["Date"], status.Date, manifest.Date),
  };
}

async function findCandidateBackupDirectories(realSelectedPath) {
  if (await isBackupDirectory(realSelectedPath)) {
    return [{ path: realSelectedPath, inputKind: "device-backup" }];
  }
  let entries;
  try {
    entries = await fs.readdir(realSelectedPath, { withFileTypes: true });
  } catch (err) {
    throw new PhoneImportError(PHONE_IMPORT_ERROR_CODES.INVALID_BACKUP_DIRECTORY, "Unable to read selected directory.", {
      statusCode: 400,
      cause: err,
      details: { selectedPath: realSelectedPath },
    });
  }
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const child = path.join(realSelectedPath, entry.name);
    try {
      const childReal = await fs.realpath(child);
      if (await isBackupDirectory(childReal)) candidates.push({ path: childReal, inputKind: "backup-parent", folderName: entry.name });
    } catch {
      // Ignore unreadable child directories.
    }
  }
  return candidates;
}

export class IOSBackupValidator {
  async validateBackupPath(inputPath) {
    const requested = String(inputPath || "").replace(/\0/g, "").trim();
    if (!requested) {
      throw new PhoneImportError(PHONE_IMPORT_ERROR_CODES.INVALID_PATH, "No backup directory selected.", {
        statusCode: 400,
      });
    }
    if (hasTraversalSegment(requested)) {
      throw new PhoneImportError(PHONE_IMPORT_ERROR_CODES.INVALID_PATH, "Backup path traversal is not allowed.", {
        statusCode: 400,
        details: { requested },
      });
    }

    const resolved = path.resolve(requested);
    await statDirectory(resolved);
    const realSelectedPath = await fs.realpath(resolved);
    const candidates = await findCandidateBackupDirectories(realSelectedPath);
    if (!candidates.length) {
      throw new PhoneImportError(PHONE_IMPORT_ERROR_CODES.MANIFEST_DB_MISSING, "Manifest.db was not found.", {
        statusCode: 400,
        details: { selectedPath: realSelectedPath },
      });
    }
    if (candidates.length > 1) {
      throw new PhoneImportError(PHONE_IMPORT_ERROR_CODES.MULTIPLE_BACKUPS_FOUND, "Selected folder contains multiple backups.", {
        statusCode: 409,
        details: { candidates: candidates.map((candidate) => redactPath(candidate.path)) },
      });
    }

    const backupPath = candidates[0].path;
    const manifestDbPath = path.join(backupPath, REQUIRED_MANIFEST_DB);
    const metadataFiles = { manifestDb: manifestDbPath };
    for (const filename of OPTIONAL_METADATA) {
      const full = path.join(backupPath, filename);
      if (await pathExists(full)) metadataFiles[filename] = full;
    }

    const warnings = [];
    const manifestPlist = await readMetadataFile(backupPath, "Manifest.plist", warnings);
    const infoPlist = await readMetadataFile(backupPath, "Info.plist", warnings);
    const statusPlist = await readMetadataFile(backupPath, "Status.plist", warnings);
    const encrypted = [manifestPlist, infoPlist, statusPlist].some((plist) =>
      plist?.IsEncrypted === true || plist?.Encrypted === true || plist?.["Is Encrypted"] === true
    );
    const backup = extractBackupMetadata(infoPlist || {}, manifestPlist || {}, statusPlist || {});

    if (!manifestPlist && (await pathExists(path.join(backupPath, "Manifest.plist")))) {
      warnings.push({ code: "manifest_plist_unreadable", message: "Manifest.plist could not be parsed; encryption status may be incomplete." });
    }

    if (encrypted) {
      throw new PhoneImportError(PHONE_IMPORT_ERROR_CODES.ENCRYPTED_BACKUP, "Encrypted iPhone backup detected.", {
        statusCode: 409,
        details: { backupPath },
      });
    }

    return {
      ok: true,
      valid: true,
      encrypted: false,
      selectedPath: realSelectedPath,
      backupPath,
      inputKind: candidates[0].inputKind,
      metadataFiles,
      backup,
      warnings,
      diagnostics: {
        selectedPath: redactPath(realSelectedPath),
        backupPath: redactPath(backupPath),
        metadataFiles: Object.fromEntries(Object.entries(metadataFiles).map(([key, value]) => [key, redactPath(value)])),
      },
    };
  }
}

export default IOSBackupValidator;
