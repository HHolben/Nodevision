// Nodevision/ApplicationSystem/PhoneImport/PhoneImportErrors.mjs
// Error and redaction helpers for the privacy-sensitive Phone Import workflow.

export const PHONE_IMPORT_ERROR_CODES = Object.freeze({
  INVALID_PATH: "invalid_path",
  INVALID_BACKUP_DIRECTORY: "invalid_backup_directory",
  MULTIPLE_BACKUPS_FOUND: "multiple_backups_found",
  MANIFEST_DB_MISSING: "manifest_db_missing",
  MANIFEST_DB_INVALID: "manifest_db_invalid",
  ENCRYPTED_BACKUP: "encrypted_backup",
  MESSAGES_DB_NOT_FOUND: "messages_db_not_found",
  SQLITE_UNAVAILABLE: "sqlite_unavailable",
  SQLITE_READ_FAILED: "sqlite_read_failed",
  MESSAGE_SCHEMA_UNSUPPORTED: "message_schema_unsupported",
  IMPORT_SELECTION_EMPTY: "import_selection_empty",
  IMPORT_SCAN_NOT_FOUND: "import_scan_not_found",
  IMPORT_DESTINATION_INVALID: "import_destination_invalid",
  NOTEBOOK_WRITE_BLOCKED: "notebook_write_blocked",
  IMPORT_CANCELLED: "import_cancelled",
  IMPORT_FAILED: "import_failed",
});

const ENCRYPTED_MESSAGE = "This backup is encrypted. Encrypted iPhone backups are not supported by this version of the importer.";

const PUBLIC_MESSAGES = Object.freeze({
  [PHONE_IMPORT_ERROR_CODES.INVALID_PATH]: "The selected backup path is invalid.",
  [PHONE_IMPORT_ERROR_CODES.INVALID_BACKUP_DIRECTORY]: "The selected folder is not a valid iPhone backup directory.",
  [PHONE_IMPORT_ERROR_CODES.MULTIPLE_BACKUPS_FOUND]: "The selected folder contains multiple iPhone backups. Select one device backup folder and scan again.",
  [PHONE_IMPORT_ERROR_CODES.MANIFEST_DB_MISSING]: "Manifest.db was not found in the selected backup.",
  [PHONE_IMPORT_ERROR_CODES.MANIFEST_DB_INVALID]: "Manifest.db could not be read as an iPhone backup manifest.",
  [PHONE_IMPORT_ERROR_CODES.ENCRYPTED_BACKUP]: ENCRYPTED_MESSAGE,
  [PHONE_IMPORT_ERROR_CODES.MESSAGES_DB_NOT_FOUND]: "Messages database not found in this backup.",
  [PHONE_IMPORT_ERROR_CODES.SQLITE_UNAVAILABLE]: "The sqlite3 command-line tool is required to read this backup and was not found.",
  [PHONE_IMPORT_ERROR_CODES.SQLITE_READ_FAILED]: "The backup database could not be read safely.",
  [PHONE_IMPORT_ERROR_CODES.MESSAGE_SCHEMA_UNSUPPORTED]: "The Messages database schema is not supported by this importer version.",
  [PHONE_IMPORT_ERROR_CODES.IMPORT_SELECTION_EMPTY]: "Select at least one conversation to import.",
  [PHONE_IMPORT_ERROR_CODES.IMPORT_SCAN_NOT_FOUND]: "The scan result is no longer available. Scan the backup again before importing.",
  [PHONE_IMPORT_ERROR_CODES.IMPORT_DESTINATION_INVALID]: "The import destination must be inside the Notebook.",
  [PHONE_IMPORT_ERROR_CODES.NOTEBOOK_WRITE_BLOCKED]: "The Notebook is protected or not writable. Disable write protection or choose a writable Notebook before importing phone data.",
  [PHONE_IMPORT_ERROR_CODES.IMPORT_CANCELLED]: "Phone import cancelled.",
  [PHONE_IMPORT_ERROR_CODES.IMPORT_FAILED]: "Phone import failed.",
});

export class PhoneImportError extends Error {
  constructor(code, message, options = {}) {
    super(message || PUBLIC_MESSAGES[code] || "Phone import failed");
    this.name = "PhoneImportError";
    this.code = code || PHONE_IMPORT_ERROR_CODES.IMPORT_FAILED;
    this.statusCode = normalizeStatusCode(options.statusCode) || 400;
    this.publicMessage = options.publicMessage || PUBLIC_MESSAGES[this.code] || PUBLIC_MESSAGES[PHONE_IMPORT_ERROR_CODES.IMPORT_FAILED];
    this.details = options.details && typeof options.details === "object" ? options.details : {};
    if (options.cause) this.cause = options.cause;
  }
}

function normalizeStatusCode(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 100 && number <= 599 ? number : null;
}

export function isPhoneImportError(err) {
  return err instanceof PhoneImportError || (err && typeof err === "object" && typeof err.code === "string" && typeof err.publicMessage === "string");
}

export function phoneImportPublicMessage(code) {
  return PUBLIC_MESSAGES[code] || PUBLIC_MESSAGES[PHONE_IMPORT_ERROR_CODES.IMPORT_FAILED];
}

export function redactIdentifier(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.includes("@")) return "[email address]";
  const digits = text.replace(/\D/g, "");
  if (digits.length >= 7) return "[phone ending " + digits.slice(-4) + "]";
  if (/^[a-f0-9]{20,}$/i.test(text)) return text.slice(0, 6) + "..." + text.slice(-4);
  if (text.length > 48) return text.slice(0, 20) + "..." + text.slice(-8);
  return text;
}

export function redactPath(value = "") {
  const text = String(value || "").replace(/\\/g, "/");
  if (!text) return "";
  const parts = text.split("/").filter(Boolean);
  if (!parts.length) return text;
  const tail = parts.slice(-2).join("/");
  const prefix = text.startsWith("/") ? "/[redacted]/" : "[redacted]/";
  return prefix + tail;
}

export function redactDiagnostics(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => redactDiagnostics(item));
  if (typeof value === "object") {
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
      const lowered = key.toLowerCase();
      if (lowered.includes("path") || lowered.includes("directory") || lowered.includes("file")) {
        out[key] = typeof entry === "string" ? redactPath(entry) : redactDiagnostics(entry);
      } else if (lowered.includes("phone") || lowered.includes("email") || lowered.includes("identifier") || lowered.includes("deviceid")) {
        out[key] = typeof entry === "string" ? redactIdentifier(entry) : redactDiagnostics(entry);
      } else {
        out[key] = redactDiagnostics(entry);
      }
    }
    return out;
  }
  if (typeof value !== "string") return value;
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email address]")
    .replace(/(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/g, (match) => {
      const digits = String(match).replace(/\D/g, "");
      return "[phone ending " + digits.slice(-4) + "]";
    })
    .replace(/(?:[A-Za-z]:)?(?:\/|\\)[^\n\r\t"'`<>]+/g, (match) => redactPath(match));
}

export function serializePhoneImportError(err) {
  const code = isPhoneImportError(err) ? err.code : PHONE_IMPORT_ERROR_CODES.IMPORT_FAILED;
  const publicMessage = isPhoneImportError(err) ? err.publicMessage : phoneImportPublicMessage(code);
  const statusCode = normalizeStatusCode(err?.statusCode || err?.status) || (code === PHONE_IMPORT_ERROR_CODES.ENCRYPTED_BACKUP ? 409 : 400);
  return {
    ok: false,
    code,
    error: publicMessage,
    statusCode,
    technicalDetails: redactDiagnostics({
      message: err?.message || String(err || "Unknown error"),
      code,
      stack: err?.stack || null,
      details: err?.details || null,
    }),
  };
}

export function throwIfCancelled(isCancelled, message = "Phone import cancelled.") {
  if (typeof isCancelled === "function" && isCancelled()) {
    throw new PhoneImportError(PHONE_IMPORT_ERROR_CODES.IMPORT_CANCELLED, message, {
      statusCode: 499,
      publicMessage: message,
    });
  }
}
