// Nodevision/ApplicationSystem/server/routes/brokerRoutes.mjs
// Authenticated API endpoints for the internal MQTT-style broker benchmark.

import { getBroker as getSharedBroker } from "../../MessageBroker/BrokerSingleton.mjs";

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
      payload: summarizeBrokerEventPayload(event?.payload),
    }));
}


export function registerBrokerRoutes(app, ctx) {
  const broker = getBroker(ctx);

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
      return res.json({ ok: true, retained: broker.listRetained() });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err?.message || "Unable to list retained broker messages" });
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
