// Nodevision/ApplicationSystem/MessageBroker/MQTTCsvLogger.mjs
// Configurable MQTT topic-to-Notebook CSV logging for the shared broker.

import fs from "node:fs/promises";
import path from "node:path";

import { validateTopicFilter } from "./TopicMatcher.mjs";
import { extractCsvLoggersFromThingDescription, parseThingDescriptionText } from "../public/ThingDescription/ThingDescriptionModel.mjs";

export const DEFAULT_TOPIC_CSV_LOGGERS_FILE = path.join("MQTT", "TopicCsvLoggers.json");

function configPathFor(settingsDir) {
  if (!settingsDir) throw new Error("settingsDir is required");
  return path.join(settingsDir, DEFAULT_TOPIC_CSV_LOGGERS_FILE);
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function assertSafeLoggerId(id) {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(String(id || ""))) {
    throw new Error("Logger id must contain only letters, numbers, underscores, or hyphens");
  }
}

export function resolveSafeCsvPath(notebookDir, csvRelativePath) {
  if (!notebookDir) throw new Error("notebookDir is required");
  const rel = String(csvRelativePath || "").trim();
  if (!rel) throw new Error("csvRelativePath is required");
  if (path.isAbsolute(rel)) throw new Error("csvRelativePath must be Notebook-relative");
  if (rel.includes("\\")) throw new Error("csvRelativePath must use forward slashes");
  const parts = rel.split("/");
  if (parts.some((part) => part === "..")) throw new Error("csvRelativePath must not contain ..");
  if (parts.some((part) => part === "ServerSettings" || /token|secret|privatekey/i.test(part))) throw new Error("csvRelativePath contains a restricted segment");
  if (!/\.csv$/i.test(rel)) throw new Error("csvRelativePath must end with .csv");

  const root = path.resolve(notebookDir);
  const target = path.resolve(root, rel);
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error("csvRelativePath must stay inside Notebook");
  }
  return target;
}

function validateLogger(logger) {
  if (!isPlainObject(logger)) throw new Error("Logger must be an object");
  assertSafeLoggerId(logger.id);
  if (logger.name !== undefined && typeof logger.name !== "string") throw new Error("Logger name must be a string");
  validateTopicFilter(logger.topicFilter);
  resolveSafeCsvPath("/tmp/nodevision-notebook-validation", logger.csvRelativePath);
  if (!Array.isArray(logger.columns) || logger.columns.length === 0) throw new Error("Logger columns must be a nonempty array");
  if (logger.columns.some((column) => typeof column !== "string" || !column.trim())) throw new Error("Logger columns must be nonempty strings");
  if (!isPlainObject(logger.mappings)) throw new Error("Logger mappings must be an object");
  for (const column of logger.columns) {
    if (typeof logger.mappings[column] !== "string" || !logger.mappings[column].trim()) {
      throw new Error(`Logger mapping missing for column ${column}`);
    }
  }
  if (logger.timezone !== undefined && !["local", "utc"].includes(String(logger.timezone))) throw new Error("Logger timezone must be local or utc");
  if (logger.minIntervalMs !== undefined) {
    const interval = Number(logger.minIntervalMs);
    if (!Number.isFinite(interval) || interval < 0) throw new Error("Logger minIntervalMs must be nonnegative");
  }
  return true;
}

export function validateTopicCsvLoggerConfig(config) {
  if (!isPlainObject(config)) throw new Error("Topic CSV logger config must be an object");
  if (!Array.isArray(config.loggers)) throw new Error("Topic CSV logger config must contain loggers array");
  const ids = new Set();
  for (const logger of config.loggers) {
    validateLogger(logger);
    if (ids.has(logger.id)) throw new Error(`Duplicate logger id ${logger.id}`);
    ids.add(logger.id);
  }
  return true;
}

export async function loadTopicCsvLoggerConfig({ settingsDir }) {
  const filePath = configPathFor(settingsDir);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    validateTopicCsvLoggerConfig(parsed);
    return parsed;
  } catch (err) {
    if (err?.code === "ENOENT") return { loggers: [] };
    throw err;
  }
}

export async function saveTopicCsvLoggerConfig({ settingsDir, config }) {
  validateTopicCsvLoggerConfig(config);
  const filePath = configPathFor(settingsDir);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify({ loggers: config.loggers }, null, 2)}\n`, "utf8");
  return { loggers: config.loggers };
}

function parsePayload(payload) {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) return payload;
  if (typeof payload === "string") {
    const text = payload.trim();
    if ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"))) {
      try { return JSON.parse(text); } catch {}
    }
  }
  return payload;
}

function formatDate(date, timezone = "local") {
  const y = timezone === "utc" ? date.getUTCFullYear() : date.getFullYear();
  const m = (timezone === "utc" ? date.getUTCMonth() : date.getMonth()) + 1;
  const d = timezone === "utc" ? date.getUTCDate() : date.getDate();
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function formatTime(date, timezone = "local") {
  const h = timezone === "utc" ? date.getUTCHours() : date.getHours();
  const m = timezone === "utc" ? date.getUTCMinutes() : date.getMinutes();
  const s = timezone === "utc" ? date.getUTCSeconds() : date.getSeconds();
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getPathValue(source, fieldPath) {
  const clean = String(fieldPath || "").trim();
  if (!clean) return "";
  const parts = clean.split(".").filter(Boolean);
  let cursor = source;
  if (parts[0] === "payload") parts.shift();
  for (const part of parts) {
    if (cursor === null || cursor === undefined) return "";
    if (typeof cursor !== "object") return "";
    cursor = cursor[part];
  }
  return cursor;
}

function normalizeCsvValue(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  try { return JSON.stringify(value); } catch { return String(value); }
}

export function buildCsvLoggerRow({ logger, message, now }) {
  validateLogger(logger);
  const date = typeof now === "function" ? now() : new Date();
  const payload = parsePayload(message?.payload);
  const source = isPlainObject(payload) ? payload : { value: payload };
  const timezone = logger.timezone || "local";
  const headers = logger.columns.map((column) => String(column));
  const row = headers.map((column) => {
    const mapping = String(logger.mappings?.[column] || "").trim();
    if (mapping === "$date") return formatDate(date, timezone);
    if (mapping === "$time") return formatTime(date, timezone);
    if (mapping === "$timestamp") return date.toISOString();
    return normalizeCsvValue(getPathValue(source, mapping));
  });
  return { headers, row };
}

function escapeCsvValue(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, "\"\"")}"`;
  return text;
}

function csvLine(values) {
  return values.map(escapeCsvValue).join(",") + "\n";
}

async function fileIsMissingOrEmpty(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.size === 0;
  } catch (err) {
    if (err?.code === "ENOENT") return true;
    throw err;
  }
}

export async function appendCsvLoggerRow({ notebookDir, logger, message, now }) {
  const targetPath = resolveSafeCsvPath(notebookDir, logger.csvRelativePath);
  const { headers, row } = buildCsvLoggerRow({ logger, message, now });
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const shouldWriteHeader = logger.writeHeader !== false && await fileIsMissingOrEmpty(targetPath);
  const text = (shouldWriteHeader ? csvLine(headers) : "") + csvLine(row);
  await fs.appendFile(targetPath, text, "utf8");
  return { headers, row, csvRelativePath: logger.csvRelativePath };
}

async function walkThingDescriptionFiles(dir, root = dir, out = []) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === "ServerSettings" || entry.name === ".git" || entry.name === "node_modules") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkThingDescriptionFiles(fullPath, root, out);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".td.json")) {
      out.push(fullPath);
    }
  }
  return out;
}

export async function loadThingDescriptionCsvLoggers({ notebookDir }) {
  if (!notebookDir) return [];
  const files = await walkThingDescriptionFiles(notebookDir);
  const loggers = [];
  for (const filePath of files) {
    try {
      const td = parseThingDescriptionText(await fs.readFile(filePath, "utf8"));
      for (const logger of extractCsvLoggersFromThingDescription(td)) {
        validateLogger(logger);
        loggers.push(logger);
      }
    } catch (err) {
      const safeMessage = String(err?.message || err).replace(/token|secret|privatekey/gi, "[redacted]");
      console.warn("[mqtt-csv] skipped TD logger config:", safeMessage);
    }
  }
  return loggers;
}

export async function startMqttCsvLoggers({ broker, notebookDir, settingsDir, now = () => new Date() }) {
  if (!broker || typeof broker.subscribe !== "function") throw new Error("broker is required");
  const config = await loadTopicCsvLoggerConfig({ settingsDir });
  const tdLoggers = await loadThingDescriptionCsvLoggers({ notebookDir });
  const loggers = [];
  const loggerIds = new Set();
  for (const logger of [...config.loggers, ...tdLoggers]) {
    if (loggerIds.has(logger.id)) continue;
    loggerIds.add(logger.id);
    loggers.push(logger);
  }
  const lastWrites = new Map();
  const unsubscribes = [];
  for (const logger of loggers) {
    if (logger.enabled !== true) continue;
    validateLogger(logger);
    const unsubscribe = broker.subscribe(logger.topicFilter, (message) => {
      const current = now();
      const last = lastWrites.get(logger.id) || 0;
      const interval = Math.max(0, Number(logger.minIntervalMs || 0));
      if (interval > 0 && current.getTime() - last < interval) return;
      lastWrites.set(logger.id, current.getTime());
      appendCsvLoggerRow({ notebookDir, logger, message, now: () => current }).catch((err) => {
        console.warn(`[mqtt-csv] logger ${logger.id} failed:`, String(err?.message || err).replace(/token|secret|privatekey/gi, "[redacted]"));
      });
    }, { replayRetained: false });
    unsubscribes.push(unsubscribe);
  }
  const cleanup = () => {
    for (const unsubscribe of unsubscribes.splice(0)) {
      try { unsubscribe(); } catch {}
    }
  };
  cleanup.count = unsubscribes.length;
  return cleanup;
}
