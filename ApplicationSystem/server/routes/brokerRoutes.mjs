// Nodevision/ApplicationSystem/server/routes/brokerRoutes.mjs
// Authenticated API endpoints for the internal MQTT-style broker benchmark.

import { getBroker as getSharedBroker } from "../../MessageBroker/BrokerSingleton.mjs";
import { validateTopicName } from "../../MessageBroker/TopicMatcher.mjs";
import { findTokenRecord, readDeviceTokens, resolveDeviceTokensPath } from "../../MessageBroker/IoTDeviceTokens.mjs";
import { getMqttServerStatus } from "../../MessageBroker/MQTT/MqttTcpServer.mjs";

function requireSession(req, res) {
  if (!req.identity) {
    res.status(401).json({ ok: false, error: "Authentication required" });
    return false;
  }
  return true;
}

function getBroker(ctx) {
  if (!ctx.messageBroker) {
    ctx.messageBroker = getSharedBroker();
  }
  return ctx.messageBroker;
}

const MAX_IOT_PAYLOAD_BYTES = 4096;

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function parseBearerToken(req) {
  const authorization = String(req.headers?.authorization || "").trim();
  const prefix = "Bearer ";
  if (!authorization.toLowerCase().startsWith(prefix.toLowerCase())) return null;
  const token = authorization.slice(prefix.length).trim();
  return token || null;
}

function isJsonObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function payloadSizeBytes(payload) {
  return Buffer.byteLength(JSON.stringify(payload), "utf8");
}

function topicAllowedForToken(record, topic) {
  const prefixes = Array.isArray(record?.allowedTopicPrefixes) ? record.allowedTopicPrefixes : [];
  return prefixes.some((prefix) => {
    const text = String(prefix || "");
    return text.length > 0 && topic.startsWith(text);
  });
}

async function authenticateIotPublisher(req, deviceTokensPath) {
  const token = parseBearerToken(req);
  if (!token) throw httpError(401, "Bearer token required");

  const tokenData = await readDeviceTokens(deviceTokensPath);
  const record = findTokenRecord(tokenData, token);
  if (!record) throw httpError(401, "Invalid bearer token");
  if (record.enabled !== true) throw httpError(403, "Bearer token disabled");
  return record;
}


function isSafeRelativePath(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (text.startsWith("/") || /^[A-Za-z]:[\\/]/.test(text)) return null;
  if (text.split(/[\\/]+/).includes("ServerSettings")) return null;
  return text;
}

function safeString(value, maxLength = 160) {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  if (!text) return undefined;
  if (text.includes("privateKey") || text.includes("authToken") || text.includes("ServerSettings")) return undefined;
  if (text.startsWith("/") || /^[A-Za-z]:[\\/]/.test(text)) return undefined;
  return text.slice(0, maxLength);
}

function safeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.max(0, Math.trunc(num)) : undefined;
}

function isSensitivePayloadKey(key) {
  return /privatekey|token|tokenhash|auth|secret/i.test(String(key || ""));
}

function safeGenericValue(value, depth = 0) {
  if (depth > 3) return "[truncated]";
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") {
    const text = value.trim();
    if (text.includes("ServerSettings") || text.startsWith("/") || /^[A-Za-z]:[\\/]/.test(text)) return "[redacted]";
    return text.length > 240 ? text.slice(0, 240) + "..." : text;
  }
  if (Array.isArray(value)) return value.slice(0, 12).map((item) => safeGenericValue(item, depth + 1));
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value).slice(0, 40)) {
      if (isSensitivePayloadKey(key)) continue;
      out[key] = safeGenericValue(item, depth + 1);
    }
    return out;
  }
  return undefined;
}

function safeBrokerPayloadForTopic(topic, payload) {
  return String(topic || "").startsWith("nodevision/sync/")
    ? summarizeBrokerEventPayload(payload)
    : safeGenericValue(payload);
}

export function summarizeBrokerEventPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const currentFile = isSafeRelativePath(payload.currentFile);
  const summary = {
    jobId: safeString(payload.jobId, 80),
    scope: safeString(payload.scope, 120),
    status: safeString(payload.status, 40),
    filesDone: safeNumber(payload.filesDone),
    filesTotal: safeNumber(payload.filesTotal),
    bytesDone: safeNumber(payload.bytesDone),
    bytesTotal: safeNumber(payload.bytesTotal),
  };
  if (currentFile) summary.currentFile = currentFile;
  return Object.fromEntries(Object.entries(summary).filter(([, value]) => value !== undefined));
}

function normalizeLimit(value) {
  const parsed = Number(value ?? 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(200, Math.trunc(parsed)));
}

function normalizeTopicPrefix(value) {
  const prefix = String(value || "").trim();
  if (!prefix) return "";
  if (prefix.length > 160 || !/^[A-Za-z0-9_\-/]+$/.test(prefix)) {
    throw new Error("Invalid topicPrefix");
  }
  return prefix;
}

export function listSafeBrokerEvents(broker, { topicPrefix = "", limit = 50 } = {}) {
  const normalizedPrefix = normalizeTopicPrefix(topicPrefix);
  const normalizedLimit = normalizeLimit(limit);
  const rawEvents = typeof broker?.listEvents === "function" ? broker.listEvents() : [];
  return rawEvents
    .filter((event) => !normalizedPrefix || String(event?.topic || "").startsWith(normalizedPrefix))
    .slice(-normalizedLimit)
    .map((event) => ({
      topic: String(event?.topic || ""),
      timestamp: String(event?.timestamp || ""),
      publisherId: event?.publisherId ?? null,
      payload: safeBrokerPayloadForTopic(event?.topic, event?.payload),
    }));
}


export function listSafeBrokerRetained(broker, { topicPrefix = "", limit = 50 } = {}) {
  const normalizedPrefix = normalizeTopicPrefix(topicPrefix);
  const normalizedLimit = normalizeLimit(limit);
  const retainedMessages = typeof broker?.listRetained === "function" ? broker.listRetained() : [];
  return retainedMessages
    .filter((message) => !normalizedPrefix || String(message?.topic || "").startsWith(normalizedPrefix))
    .slice(-normalizedLimit)
    .map((message) => ({
      topic: String(message?.topic || ""),
      timestamp: String(message?.timestamp || ""),
      publisherId: message?.publisherId ?? null,
      payload: safeBrokerPayloadForTopic(message?.topic, message?.payload),
    }));
}


export function registerBrokerRoutes(app, ctx) {
  const broker = getBroker(ctx);
  const deviceTokensPath = resolveDeviceTokensPath({
    runtimeRoot: ctx.runtimeRoot,
    deviceTokensPath: ctx.deviceTokensPath,
  });

  app.get("/api/mqtt/status", (req, res) => {
    if (!requireSession(req, res)) return;
    const status = getMqttServerStatus();
    return res.json({ ok: true, mqtt: status });
  });

  app.post("/api/iot/publish", async (req, res) => {
    try {
      const tokenRecord = await authenticateIotPublisher(req, deviceTokensPath);
      const { topic, payload, retain = false } = req.body || {};

      validateTopicName(topic);
      if (!topicAllowedForToken(tokenRecord, topic)) {
        throw httpError(403, "Topic is not allowed for this token");
      }
      if (!isJsonObject(payload)) {
        throw httpError(400, "Payload must be a JSON object");
      }
      if (payloadSizeBytes(payload) > MAX_IOT_PAYLOAD_BYTES) {
        throw httpError(413, "Payload exceeds 4KB limit");
      }

      const message = broker.publish(topic, payload, {
        retain: retain === true,
        publisherId: tokenRecord.name || null,
      });
      return res.json({ ok: true, topic: message.topic, retained: retain === true });
    } catch (err) {
      const status = err?.statusCode || 400;
      return res.status(status).json({ ok: false, error: err?.message || "Invalid IoT publish request" });
    }
  });

  app.get("/api/iot/tokens", async (req, res) => {
    if (!requireSession(req, res)) return;

    try {
      const tokenData = await readDeviceTokens(deviceTokensPath);
      const tokens = (Array.isArray(tokenData.tokens) ? tokenData.tokens : []).map((record) => ({
        name: String(record?.name || ""),
        allowedTopicPrefixes: Array.isArray(record?.allowedTopicPrefixes) ? record.allowedTopicPrefixes.map((prefix) => String(prefix)) : [],
        enabled: record?.enabled === true,
        createdAt: String(record?.createdAt || ""),
      }));
      return res.json({ ok: true, tokens });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err?.message || "Unable to list IoT token metadata" });
    }
  });

  app.post("/api/broker/publish", (req, res) => {
    if (!requireSession(req, res)) return;

    const { topic, payload, retain = false } = req.body || {};
    try {
      const message = broker.publish(topic, payload, {
        retain: retain === true,
        publisherId: req.identity?.user?.id || req.identity?.user?.username || req.identity?.username || null,
      });
      return res.json({ ok: true, message });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err?.message || "Invalid broker publish request" });
    }
  });

  app.get("/api/broker/retained", (req, res) => {
    if (!requireSession(req, res)) return;

    try {
      const retained = listSafeBrokerRetained(broker, {
        topicPrefix: req.query?.topicPrefix || "",
        limit: req.query?.limit || 50,
      });
      return res.json({ ok: true, retained });
    } catch (err) {
      const status = err?.message === "Invalid topicPrefix" ? 400 : 500;
      return res.status(status).json({ ok: false, error: err?.message || "Unable to list retained broker messages" });
    }
  });

  app.get("/api/broker/events", (req, res) => {
    if (!requireSession(req, res)) return;

    try {
      const events = listSafeBrokerEvents(broker, {
        topicPrefix: req.query?.topicPrefix || "",
        limit: req.query?.limit || 50,
      });
      return res.json({ ok: true, events });
    } catch (err) {
      const status = err?.message === "Invalid topicPrefix" ? 400 : 500;
      return res.status(status).json({ ok: false, error: err?.message || "Unable to list broker events" });
    }
  });
}
