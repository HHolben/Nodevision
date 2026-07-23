// Nodevision/ApplicationSystem/PhoneImport/PhoneImportUtils.mjs
// Shared filesystem, SQLite, plist, timestamp, checksum, and escaping helpers for Phone Import.

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";

import { PhoneImportError, PHONE_IMPORT_ERROR_CODES } from "./PhoneImportErrors.mjs";

export const APPLE_EPOCH_MS = Date.UTC(2001, 0, 1, 0, 0, 0, 0);
const MIN_PLAUSIBLE_MS = Date.UTC(1990, 0, 1, 0, 0, 0, 0);
const MAX_PLAUSIBLE_MS = Date.UTC(2100, 0, 1, 0, 0, 0, 0);

export function nowIso() {
  return new Date().toISOString();
}

export function createJobId(prefix = "phone-import") {
  return prefix + "-" + randomUUID();
}

export function importTimestampSegment(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function assertInside(parentDir, targetPath, message = "Path escaped allowed directory.") {
  const parent = path.resolve(parentDir);
  const target = path.resolve(targetPath);
  const rel = path.relative(parent, target);
  if (rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))) return target;
  throw new PhoneImportError(PHONE_IMPORT_ERROR_CODES.INVALID_PATH, message, {
    statusCode: 400,
    details: { parentDir, targetPath },
  });
}

export function normalizeNotebookRelativeDestination(value = "") {
  let text = String(value || "").replace(/\\/g, "/").replace(/\0/g, "").trim();
  if (!text) text = "Imports/Phones";
  text = text.replace(/^\/+/, "");
  if (/^Notebook\//i.test(text)) text = text.slice("Notebook/".length);
  const parts = text.split("/").filter(Boolean);
  if (parts.includes("..") || /^[A-Za-z]:/.test(text) || text.includes("://")) {
    throw new PhoneImportError(PHONE_IMPORT_ERROR_CODES.IMPORT_DESTINATION_INVALID, "Unsafe Notebook import destination.", {
      statusCode: 400,
      details: { destination: value },
    });
  }
  const normalized = path.posix.normalize(parts.join("/"));
  if (!normalized || normalized === "." || normalized.startsWith("../") || normalized === "..") return "Imports/Phones";
  return normalized;
}

export function sanitizePathComponent(value = "", fallback = "Item", maxLength = 72) {
  const safe = String(value || fallback)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, "_")
    .replace(/\.+/g, ".")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+|\.+$/g, "")
    .slice(0, maxLength)
    .trim();
  return safe || fallback;
}

export async function uniquePath(candidatePath) {
  if (!(await pathExists(candidatePath))) return candidatePath;
  const parsed = path.parse(candidatePath);
  for (let i = 2; i < 10000; i += 1) {
    const next = path.join(parsed.dir, parsed.name + "-" + i + parsed.ext);
    if (!(await pathExists(next))) return next;
  }
  throw new Error("Unable to allocate a collision-safe path.");
}

export function uniqueName(name, usedNames) {
  const parsed = path.parse(sanitizePathComponent(name || "File", "File"));
  let candidate = parsed.base || "File";
  let index = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    candidate = parsed.name + "-" + index + parsed.ext;
    index += 1;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

export async function mkdirPrivate(dirPath) {
  await fs.mkdir(dirPath, { recursive: true, mode: 0o700 });
  await fs.chmod(dirPath, 0o700).catch(() => {});
}

export async function writeFilePrivate(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  await fs.writeFile(filePath, data, { mode: 0o600 });
}

export async function sha256File(filePath) {
  const hash = createHash("sha256");
  const handle = await fs.open(filePath, "r");
  try {
    for await (const chunk of handle.createReadStream()) hash.update(chunk);
  } finally {
    await handle.close().catch(() => {});
  }
  return hash.digest("hex");
}

export function sha256Buffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function jsonForHtmlScript(value) {
  return JSON.stringify(value, null, 2)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export function formatHumanDate(isoValue) {
  if (!isoValue) return "Unknown";
  const date = new Date(isoValue);
  if (!Number.isFinite(date.getTime())) return "Unknown";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function decodeXmlEntities(value = "") {
  return String(value)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseScalarXmlValue(tag, content = "") {
  if (tag === "true") return true;
  if (tag === "false") return false;
  const text = decodeXmlEntities(content.trim());
  if (tag === "integer") {
    const n = Number(text);
    return Number.isFinite(n) ? n : text;
  }
  if (tag === "real") {
    const n = Number(text);
    return Number.isFinite(n) ? n : text;
  }
  if (tag === "date") return text;
  if (tag === "data") return text.replace(/\s+/g, "");
  return text;
}

export function parseXmlPlist(text = "") {
  const out = {};
  const keyValue = /<key>([\s\S]*?)<\/key>\s*<(true|false)\s*\/>|<key>([\s\S]*?)<\/key>\s*<(string|integer|real|date|data)[^>]*>([\s\S]*?)<\/\4>/gi;
  let match;
  while ((match = keyValue.exec(text))) {
    const key = decodeXmlEntities((match[1] || match[3] || "").trim());
    if (!key) continue;
    const tag = match[2] || match[4];
    const content = match[5] || "";
    out[key] = parseScalarXmlValue(tag, content);
  }
  return out;
}

function readUnsignedBE(buffer, offset, byteLength) {
  let value = 0n;
  for (let i = 0; i < byteLength; i += 1) value = (value << 8n) + BigInt(buffer[offset + i]);
  if (value <= BigInt(Number.MAX_SAFE_INTEGER)) return Number(value);
  return value;
}

function readSignedBE(buffer, offset, byteLength) {
  const unsigned = readUnsignedBE(buffer, offset, byteLength);
  if (typeof unsigned === "bigint") return Number(unsigned);
  const signBit = 2 ** (byteLength * 8 - 1);
  return unsigned >= signBit ? unsigned - 2 ** (byteLength * 8) : unsigned;
}

export function parseBinaryPlist(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 40 || buffer.subarray(0, 8).toString("ascii") !== "bplist00") {
    throw new Error("Not a binary plist");
  }
  const trailer = buffer.subarray(buffer.length - 32);
  const offsetIntSize = trailer[6];
  const objectRefSize = trailer[7];
  const objectCount = readUnsignedBE(trailer, 8, 8);
  const topObject = readUnsignedBE(trailer, 16, 8);
  const offsetTableOffset = readUnsignedBE(trailer, 24, 8);
  if (!Number.isFinite(objectCount) || !Number.isFinite(topObject) || !Number.isFinite(offsetTableOffset)) throw new Error("Unsupported large binary plist");
  const offsets = [];
  for (let i = 0; i < objectCount; i += 1) {
    offsets.push(readUnsignedBE(buffer, offsetTableOffset + i * offsetIntSize, offsetIntSize));
  }
  const cache = new Map();

  const readLength = (info, cursor) => {
    if (info < 0x0f) return { length: info, cursor };
    const marker = buffer[cursor];
    if ((marker & 0xf0) !== 0x10) throw new Error("Unsupported binary plist length marker");
    const byteLength = 2 ** (marker & 0x0f);
    const length = readUnsignedBE(buffer, cursor + 1, byteLength);
    if (!Number.isFinite(length)) throw new Error("Unsupported binary plist collection length");
    return { length, cursor: cursor + 1 + byteLength };
  };

  const readRef = (cursor) => readUnsignedBE(buffer, cursor, objectRefSize);

  const readObject = (index, depth = 0) => {
    if (depth > 64) throw new Error("Binary plist nesting too deep");
    if (cache.has(index)) return cache.get(index);
    const offset = offsets[index];
    const marker = buffer[offset];
    const type = marker & 0xf0;
    const info = marker & 0x0f;
    let value;
    if (marker === 0x00) value = null;
    else if (marker === 0x08) value = false;
    else if (marker === 0x09) value = true;
    else if (type === 0x10) {
      const byteLength = 2 ** info;
      value = readSignedBE(buffer, offset + 1, byteLength);
    } else if (type === 0x20) {
      const byteLength = 2 ** info;
      if (byteLength === 4) value = buffer.readFloatBE(offset + 1);
      else if (byteLength === 8) value = buffer.readDoubleBE(offset + 1);
      else throw new Error("Unsupported binary plist real width");
    } else if (type === 0x30) {
      const seconds = buffer.readDoubleBE(offset + 1);
      value = new Date(APPLE_EPOCH_MS + seconds * 1000).toISOString();
    } else if (type === 0x40) {
      const lenInfo = readLength(info, offset + 1);
      value = buffer.subarray(lenInfo.cursor, lenInfo.cursor + lenInfo.length);
    } else if (type === 0x50) {
      const lenInfo = readLength(info, offset + 1);
      value = buffer.subarray(lenInfo.cursor, lenInfo.cursor + lenInfo.length).toString("ascii");
    } else if (type === 0x60) {
      const lenInfo = readLength(info, offset + 1);
      const raw = buffer.subarray(lenInfo.cursor, lenInfo.cursor + lenInfo.length * 2);
      value = "";
      for (let i = 0; i < raw.length; i += 2) value += String.fromCharCode(raw.readUInt16BE(i));
    } else if (type === 0xa0) {
      const lenInfo = readLength(info, offset + 1);
      value = [];
      cache.set(index, value);
      for (let i = 0; i < lenInfo.length; i += 1) {
        value.push(readObject(readRef(lenInfo.cursor + i * objectRefSize), depth + 1));
      }
      return value;
    } else if (type === 0xd0) {
      const lenInfo = readLength(info, offset + 1);
      value = {};
      cache.set(index, value);
      const keyRefStart = lenInfo.cursor;
      const valueRefStart = keyRefStart + lenInfo.length * objectRefSize;
      for (let i = 0; i < lenInfo.length; i += 1) {
        const key = readObject(readRef(keyRefStart + i * objectRefSize), depth + 1);
        value[String(key)] = readObject(readRef(valueRefStart + i * objectRefSize), depth + 1);
      }
      return value;
    } else {
      throw new Error("Unsupported binary plist object type 0x" + type.toString(16));
    }
    cache.set(index, value);
    return value;
  };

  return readObject(topObject);
}

export function parsePlistBuffer(buffer) {
  if (!buffer || !buffer.length) return {};
  const header = buffer.subarray(0, Math.min(buffer.length, 32)).toString("utf8");
  if (header.startsWith("bplist00")) return parseBinaryPlist(buffer);
  const text = buffer.toString("utf8");
  if (/<plist[\s>]/i.test(text) || /<dict[\s>]/i.test(text)) return parseXmlPlist(text);
  return {};
}

export async function readPlistFile(filePath) {
  return parsePlistBuffer(await fs.readFile(filePath));
}

export async function sqliteCommandAvailable() {
  return await new Promise((resolve) => {
    const child = spawn("sqlite3", ["-version"], { stdio: ["ignore", "ignore", "ignore"] });
    child.once("error", () => resolve(false));
    child.once("exit", (code) => resolve(code === 0));
  });
}

export async function runSqliteJson(databasePath, sql, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 30000);
  return await new Promise((resolve, reject) => {
    const child = spawn("sqlite3", ["-readonly", "-json", databasePath, sql], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new PhoneImportError(PHONE_IMPORT_ERROR_CODES.SQLITE_READ_FAILED, "SQLite query timed out.", {
        statusCode: 500,
        details: { databasePath, timeoutMs },
      }));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.once("error", (err) => {
      clearTimeout(timer);
      const code = err?.code === "ENOENT" ? PHONE_IMPORT_ERROR_CODES.SQLITE_UNAVAILABLE : PHONE_IMPORT_ERROR_CODES.SQLITE_READ_FAILED;
      reject(new PhoneImportError(code, err?.message || "sqlite3 failed", {
        statusCode: code === PHONE_IMPORT_ERROR_CODES.SQLITE_UNAVAILABLE ? 500 : 400,
        cause: err,
        details: { databasePath },
      }));
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new PhoneImportError(PHONE_IMPORT_ERROR_CODES.SQLITE_READ_FAILED, stderr.trim() || "sqlite3 exited with code " + code, {
          statusCode: 400,
          details: { databasePath, stderr: stderr.trim().slice(0, 1200) },
        }));
        return;
      }
      const trimmed = stdout.trim();
      if (!trimmed) {
        resolve([]);
        return;
      }
      try {
        const parsed = JSON.parse(trimmed);
        resolve(Array.isArray(parsed) ? parsed : [parsed]);
      } catch (err) {
        reject(new PhoneImportError(PHONE_IMPORT_ERROR_CODES.SQLITE_READ_FAILED, "sqlite3 returned malformed JSON.", {
          statusCode: 400,
          cause: err,
          details: { databasePath, stdout: trimmed.slice(0, 1200) },
        }));
      }
    });
  });
}

export function quoteIdentifier(name) {
  const text = String(name || "");
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(text)) throw new Error("Unsafe SQLite identifier: " + text);
  return '"' + text.replace(/"/g, '""') + '"';
}

export function sqlStringLiteral(value) {
  return "'" + String(value ?? "").replace(/\0/g, "").replace(/'/g, "''") + "'";
}

export function sqlIntegerLiteral(value) {
  const number = Number(value);
  if (!Number.isInteger(number)) throw new Error("Expected integer SQLite value");
  return String(number);
}

export function sqlIntegerInList(values) {
  const ints = [...new Set(values.map((value) => Number(value)).filter(Number.isInteger))];
  if (!ints.length) return "(NULL)";
  return "(" + ints.map(String).join(",") + ")";
}

export function chunkArray(values, size = 200) {
  const chunks = [];
  for (let i = 0; i < values.length; i += size) chunks.push(values.slice(i, i + size));
  return chunks;
}

function timestampCandidates(rawNumber) {
  const units = [
    { unit: "seconds", divisor: 1 },
    { unit: "milliseconds", divisor: 1000 },
    { unit: "microseconds", divisor: 1000000 },
    { unit: "nanoseconds", divisor: 1000000000 },
  ];
  const epochs = [
    { epoch: "apple", baseMs: APPLE_EPOCH_MS },
    { epoch: "unix", baseMs: 0 },
  ];
  const candidates = [];
  for (const epoch of epochs) {
    for (const unit of units) {
      const ms = epoch.baseMs + rawNumber / unit.divisor * 1000;
      if (!Number.isFinite(ms)) continue;
      const plausible = ms >= MIN_PLAUSIBLE_MS && ms <= MAX_PLAUSIBLE_MS;
      const modern = ms >= APPLE_EPOCH_MS && ms <= Date.now() + 366 * 24 * 60 * 60 * 1000;
      const score = (plausible ? 10 : 0) + (modern ? 8 : 0) - Math.abs(Date.now() - ms) / (365 * 24 * 60 * 60 * 1000 * 100);
      candidates.push({ epoch: epoch.epoch, unit: unit.unit, ms, plausible, score });
    }
  }
  return candidates.sort((a, b) => b.score - a.score);
}

export function normalizeAppleTimestamp(originalValue) {
  if (originalValue === null || originalValue === undefined || originalValue === "") {
    return { iso: null, original: originalValue, epoch: null, unit: null, valid: false };
  }
  const rawNumber = Number(originalValue);
  if (!Number.isFinite(rawNumber)) {
    return { iso: null, original: originalValue, epoch: null, unit: null, valid: false };
  }
  if (rawNumber === 0) {
    return { iso: null, original: originalValue, epoch: null, unit: null, valid: false };
  }
  const best = timestampCandidates(rawNumber).find((candidate) => candidate.plausible) || timestampCandidates(rawNumber)[0];
  if (!best || !best.plausible) {
    return { iso: null, original: originalValue, epoch: best?.epoch || null, unit: best?.unit || null, valid: false };
  }
  return {
    iso: new Date(best.ms).toISOString(),
    original: originalValue,
    epoch: best.epoch,
    unit: best.unit,
    valid: true,
  };
}

export function redactParticipantValue(value = "") {
  const text = String(value || "").trim();
  if (!text) return "Unknown participant";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return "Email address";
  const digits = text.replace(/\D/g, "");
  if (digits.length >= 7) return "Phone ending in " + digits.slice(-4);
  if (/^chat\d+/i.test(text)) return "Group conversation";
  return text.length > 48 ? text.slice(0, 45) + "..." : text;
}

export function classifyParticipant(value = "") {
  const text = String(value || "").trim();
  if (!text) return "unknown";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return "email";
  if (text.replace(/\D/g, "").length >= 7) return "phone";
  return "unknown";
}

const TRUSTED_ATTACHMENT_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".heic", ".heif", ".webp",
  ".mp4", ".m4v", ".mov", ".mp3", ".m4a", ".aac", ".wav", ".caf",
  ".pdf", ".txt", ".csv", ".vcf", ".ics", ".bin",
]);

function extensionFromMagic(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) return "";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return ".jpg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return ".png";
  if (buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"))) return ".gif";
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buffer.subarray(8, 12).toString("ascii").toLowerCase();
    if (brand.includes("heic")) return ".heic";
    if (brand.includes("heif")) return ".heif";
    if (brand.includes("qt")) return ".mov";
    return ".mp4";
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "%PDF") return ".pdf";
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "RIFF") return ".wav";
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "OggS") return ".bin";
  if (buffer.length >= 3 && buffer.subarray(0, 3).toString("ascii") === "ID3") return ".mp3";
  return "";
}

export function safeAttachmentExtension({ filename = "", mimeType = "" } = {}) {
  const ext = path.extname(String(filename || "")).toLowerCase().replace(/[^.a-z0-9]/g, "");
  if (TRUSTED_ATTACHMENT_EXTENSIONS.has(ext)) return ext;
  const mime = String(mimeType || "").toLowerCase().split(";")[0].trim();
  const map = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/heic": ".heic",
    "image/heif": ".heif",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/aac": ".aac",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "text/csv": ".csv",
    "text/vcard": ".vcf",
    "text/calendar": ".ics",
  };
  return map[mime] || ".bin";
}

export async function detectAttachmentExtension(filePath, metadata = {}) {
  let handle = null;
  try {
    handle = await fs.open(filePath, "r");
    const buffer = Buffer.alloc(64);
    const result = await handle.read(buffer, 0, buffer.length, 0);
    const sniffed = extensionFromMagic(buffer.subarray(0, result.bytesRead));
    if (sniffed) return sniffed;
  } catch {
    // Fall back to conservative metadata-derived extensions.
  } finally {
    await handle?.close?.().catch(() => {});
  }
  return safeAttachmentExtension(metadata);
}

export function phoneImportWorkspaceRoot(ctx = {}) {
  return path.join(ctx.cacheDir || path.join(os.tmpdir(), "nodevision-cache"), "phone-import");
}
