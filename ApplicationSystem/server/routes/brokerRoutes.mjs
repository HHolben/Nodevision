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

function summarizePayload(payload) {
  if (!payload || typeof payload !== "object") return payload;
  return {
    jobId: payload.jobId,
    scope: payload.scope,
    peerUrl: payload.peerUrl,
    status: payload.status,
    filesDone: payload.filesDone,
    filesTotal: payload.filesTotal,
    bytesDone: payload.bytesDone,
    bytesTotal: payload.bytesTotal,
    currentFile: payload.currentFile,
    timestamp: payload.timestamp,
  };
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
      const events = typeof broker.listEvents === "function"
        ? broker.listEvents().map((event) => ({
            topic: event.topic,
            timestamp: event.timestamp,
            payload: summarizePayload(event.payload),
          }))
        : [];
      return res.json({ ok: true, events });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err?.message || "Unable to list broker events" });
    }
  });
}
