// Nodevision/ApplicationSystem/PhoneImport/IOSBackupManifest.mjs
// Read-only resolver for logical iOS backup paths stored in Manifest.db.

import fs from "node:fs/promises";
import path from "node:path";

import { PhoneImportError, PHONE_IMPORT_ERROR_CODES } from "./PhoneImportErrors.mjs";
import { assertInside, pathExists, runSqliteJson, sqlStringLiteral } from "./PhoneImportUtils.mjs";

export const IOS_MESSAGES_LOGICAL_PATH = Object.freeze({
  domain: "HomeDomain",
  relativePath: "Library/SMS/sms.db",
});

function normalizeFileId(value = "") {
  const text = String(value || "").trim();
  return /^[a-f0-9]{40,64}$/i.test(text) ? text : "";
}

export class IOSBackupManifest {
  constructor(backupPath) {
    this.backupPath = path.resolve(String(backupPath || ""));
    this.manifestDbPath = path.join(this.backupPath, "Manifest.db");
    this.warnings = [];
    this._schemaChecked = false;
  }

  async ensureReadable() {
    if (this._schemaChecked) return;
    if (!(await pathExists(this.manifestDbPath))) {
      throw new PhoneImportError(PHONE_IMPORT_ERROR_CODES.MANIFEST_DB_MISSING, "Manifest.db was not found.", {
        statusCode: 400,
        details: { manifestDbPath: this.manifestDbPath },
      });
    }
    const rows = await runSqliteJson(this.manifestDbPath, "SELECT name FROM sqlite_master WHERE type='table' AND name='Files';");
    if (!rows.length) {
      throw new PhoneImportError(PHONE_IMPORT_ERROR_CODES.MANIFEST_DB_INVALID, "Manifest.db does not contain a Files table.", {
        statusCode: 400,
        details: { manifestDbPath: this.manifestDbPath },
      });
    }
    this._schemaChecked = true;
  }

  async lookupFile(domain, relativePath, options = {}) {
    await this.ensureReadable();
    const sql = "SELECT fileID, domain, relativePath, flags, hex(file) AS fileBlobHex " +
      "FROM Files WHERE domain = " + sqlStringLiteral(domain) +
      " AND relativePath = " + sqlStringLiteral(relativePath) + " LIMIT 2;";
    const rows = await runSqliteJson(this.manifestDbPath, sql);
    if (!rows.length) {
      if (options.required) {
        throw new PhoneImportError(PHONE_IMPORT_ERROR_CODES.MESSAGES_DB_NOT_FOUND, "Logical backup file was not found in Manifest.db.", {
          statusCode: 404,
          details: { domain, relativePath },
        });
      }
      return null;
    }
    const row = rows[0];
    const fileID = normalizeFileId(row.fileID);
    if (!fileID) {
      const warning = { code: "manifest_row_malformed", domain, relativePath, message: "Manifest row is missing a usable fileID." };
      this.warnings.push(warning);
      if (options.required) {
        throw new PhoneImportError(PHONE_IMPORT_ERROR_CODES.MANIFEST_DB_INVALID, warning.message, {
          statusCode: 400,
          details: warning,
        });
      }
      return null;
    }
    return {
      fileID,
      domain: String(row.domain || domain),
      relativePath: String(row.relativePath || relativePath),
      flags: row.flags ?? null,
      fileBlobHex: row.fileBlobHex || null,
    };
  }

  candidatePhysicalPaths(fileID) {
    return [
      path.join(this.backupPath, fileID.slice(0, 2), fileID),
      path.join(this.backupPath, fileID),
    ];
  }

  async resolvePhysicalFile(record, options = {}) {
    if (!record?.fileID) return null;
    for (const candidate of this.candidatePhysicalPaths(record.fileID)) {
      try {
        const real = await fs.realpath(candidate);
        assertInside(this.backupPath, real, "Resolved backup file escaped the backup directory.");
        const stat = await fs.stat(real);
        if (!stat.isFile()) continue;
        return {
          ...record,
          sourcePath: real,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
        };
      } catch (err) {
        if (err?.code !== "ENOENT" && err?.code !== "ENOTDIR") throw err;
      }
    }
    const warning = {
      code: "physical_file_missing",
      domain: record.domain,
      relativePath: record.relativePath,
      fileID: record.fileID.slice(0, 6) + "..." + record.fileID.slice(-4),
      message: "Manifest record exists but the hashed backup file is missing.",
    };
    this.warnings.push(warning);
    if (options.required) {
      throw new PhoneImportError(PHONE_IMPORT_ERROR_CODES.MANIFEST_DB_INVALID, warning.message, {
        statusCode: 404,
        details: warning,
      });
    }
    return null;
  }

  async resolveLogicalPath(domain, relativePath, options = {}) {
    const record = await this.lookupFile(domain, relativePath, options);
    if (!record) return null;
    return await this.resolvePhysicalFile(record, options);
  }

  async resolveMessagesDatabase() {
    return await this.resolveLogicalPath(IOS_MESSAGES_LOGICAL_PATH.domain, IOS_MESSAGES_LOGICAL_PATH.relativePath, { required: true });
  }

  getWarnings() {
    return [...this.warnings];
  }
}

export default IOSBackupManifest;
