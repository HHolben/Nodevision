// Nodevision/ApplicationSystem/MessageBroker/MQTTModel.mjs
// Shared live MQTT model derived from the singleton broker. Browser panels and
// graph adapters consume snapshots/events from this service instead of building
// their own topic or device models.

import { getBroker } from "./BrokerSingleton.mjs";
import { getMqttServerStatus } from "./MQTT/MqttTcpServer.mjs";

const MODEL_VERSION = 1;
const DEFAULT_TOPIC_PREFIX = "";

let singletonModel = null;

function isSensitiveKey(key) {
  return /privatekey|token|tokenhash|auth|secret|password/i.test(String(key || ""));
}

function safeValue(value, depth = 0) {
  if (depth > 3) return "[truncated]";
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") {
    const text = value.trim();
    if (
      text.includes("ServerSettings") ||
      text.startsWith("/") ||
      /^[A-Za-z]:[\\/]/.test(text) ||
      /privatekey|tokenhash|auth(token)?|secret|bearer\s+/i.test(text)
    ) return "[redacted]";
    return text.length > 240 ? text.slice(0, 240) + "..." : text;
  }
  if (Array.isArray(value)) return value.slice(0, 12).map((item) => safeValue(item, depth + 1));
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value).slice(0, 40)) {
      if (isSensitiveKey(key)) continue;
      out[key] = safeValue(item, depth + 1);
    }
    return out;
  }
  return undefined;
}

function payloadPreview(payload) {
  const safe = safeValue(payload);
  if (safe === undefined) return "";
  if (typeof safe === "string") return safe;
  try {
    return JSON.stringify(safe);
  } catch {
    return String(safe ?? "");
  }
}

function payloadSizeBytes(payload) {
  try {
    if (typeof payload === "string") return Buffer.byteLength(payload, "utf8");
    return Buffer.byteLength(JSON.stringify(payload ?? null), "utf8");
  } catch {
    return 0;
  }
}

function normalizeTopicPrefix(value = DEFAULT_TOPIC_PREFIX) {
  const prefix = String(value || "").trim();
  if (!prefix) return "";
  if (prefix.length > 160 || !/^[A-Za-z0-9_\-/]+$/.test(prefix)) {
    throw new Error("Invalid topicPrefix");
  }
  return prefix;
}

function topicLabel(topic) {
  const parts = String(topic || "").split("/").filter(Boolean);
  return parts[parts.length - 1] || topic;
}

function inferDeviceName(message) {
  const payload = message?.payload;
  const payloadDevice = payload && typeof payload === "object" && !Array.isArray(payload)
    ? String(payload.device || "").trim()
    : "";
  return payloadDevice || String(message?.publisherId || "").trim();
}

function inferRegionName(topic) {
  const parts = String(topic || "").split("/").filter(Boolean);
  const bedIndex = parts.findIndex((part) => /^bed\d+$/i.test(part));
  if (bedIndex >= 0) {
    return parts[bedIndex].replace(/^bed/i, "Garden Bed ");
  }
  return "";
}

function makeTopicRecord(message) {
  const safePayload = safeValue(message?.payload);
  return {
    topic: String(message?.topic || ""),
    label: topicLabel(message?.topic),
    publisherId: message?.publisherId ?? null,
    device: inferDeviceName(message) || null,
    region: inferRegionName(message?.topic) || null,
    timestamp: String(message?.timestamp || ""),
    retained: true,
    payload: safePayload,
    payloadPreview: payloadPreview(message?.payload),
    payloadSize: payloadSizeBytes(message?.payload),
  };
}

function sortByTimestampThenTopic(a, b) {
  const at = Date.parse(a?.timestamp || "") || 0;
  const bt = Date.parse(b?.timestamp || "") || 0;
  if (at !== bt) return at - bt;
  return String(a?.topic || "").localeCompare(String(b?.topic || ""));
}

function createMqttModel({ broker = getBroker() } = {}) {
  const listeners = new Set();
  const stats = {
    messagesReceived: 0,
    messagesPublished: 0,
    startedAt: new Date().toISOString(),
    lastMessageAt: null,
  };
  let unsubscribe = null;
  let snapshot = null;

  function emit(reason = "update") {
    snapshot = buildSnapshot();
    const event = { type: "mqtt-model", reason, snapshot };
    for (const listener of listeners) {
      try { listener(event); } catch {}
    }
  }

  function ensureSubscribed() {
    if (unsubscribe || typeof broker?.subscribe !== "function") return;
    unsubscribe = broker.subscribe("#", (message) => {
      stats.messagesReceived += 1;
      stats.messagesPublished += 1;
      stats.lastMessageAt = message?.timestamp || new Date().toISOString();
      emit("broker-message");
    }, { replayRetained: false });
  }

  function buildSnapshot({ topicPrefix = "" } = {}) {
    const normalizedPrefix = normalizeTopicPrefix(topicPrefix);
    const retainedMessages = typeof broker?.listRetained === "function" ? broker.listRetained() : [];
    const topics = retainedMessages
      .filter((message) => !normalizedPrefix || String(message?.topic || "").startsWith(normalizedPrefix))
      .map(makeTopicRecord)
      .sort(sortByTimestampThenTopic);

    const devicesByName = new Map();
    const publishersByName = new Map();
    const regionsByName = new Map();

    for (const topic of topics) {
      if (topic.publisherId) {
        const publisher = publishersByName.get(topic.publisherId) || {
          name: topic.publisherId,
          topics: [],
          retainedTopicCount: 0,
          lastSeen: "",
        };
        publisher.topics.push(topic.topic);
        publisher.retainedTopicCount += 1;
        if (!publisher.lastSeen || Date.parse(topic.timestamp) > Date.parse(publisher.lastSeen)) publisher.lastSeen = topic.timestamp;
        publishersByName.set(topic.publisherId, publisher);
      }

      if (topic.region) {
        const region = regionsByName.get(topic.region) || { name: topic.region, topics: [] };
        region.topics.push(topic.topic);
        regionsByName.set(topic.region, region);
      }

      if (topic.device) {
        const device = devicesByName.get(topic.device) || {
          name: topic.device,
          publisherId: topic.publisherId || null,
          topics: [],
          retainedTopicCount: 0,
          lastSeen: "",
          latestPayloads: [],
        };
        if (!device.publisherId && topic.publisherId) device.publisherId = topic.publisherId;
        device.topics.push(topic.topic);
        device.retainedTopicCount += 1;
        device.latestPayloads.push({
          topic: topic.topic,
          timestamp: topic.timestamp,
          payload: topic.payload,
          payloadPreview: topic.payloadPreview,
        });
        if (!device.lastSeen || Date.parse(topic.timestamp) > Date.parse(device.lastSeen)) device.lastSeen = topic.timestamp;
        devicesByName.set(topic.device, device);
      }
    }

    const mqttStatus = getMqttServerStatus();
    return {
      ok: true,
      version: MODEL_VERSION,
      generatedAt: new Date().toISOString(),
      topicPrefix: normalizedPrefix,
      status: {
        mqtt: mqttStatus,
        retainedTopics: retainedMessages.length,
        visibleRetainedTopics: topics.length,
        subscriptions: Number(mqttStatus?.subscriptionCount || 0),
        connectedClients: Number(mqttStatus?.clientCount || 0),
        messagesPublished: stats.messagesPublished,
        messagesReceived: stats.messagesReceived,
        lastMessageAt: stats.lastMessageAt,
      },
      topics,
      devices: [...devicesByName.values()].sort((a, b) => a.name.localeCompare(b.name)),
      publishers: [...publishersByName.values()].sort((a, b) => a.name.localeCompare(b.name)),
      regions: [...regionsByName.values()].sort((a, b) => a.name.localeCompare(b.name)),
      subscriptions: Array.isArray(mqttStatus?.subscriptions) ? mqttStatus.subscriptions : [],
      future: {
        qos1: false,
        qos2: false,
        lastWill: false,
        persistentSessions: false,
        mqtt5Properties: false,
        websocketMqtt: false,
        federation: false,
        thingDescriptions: false,
      },
    };
  }

  ensureSubscribed();
  snapshot = buildSnapshot();

  return {
    getSnapshot(options = {}) {
      ensureSubscribed();
      return buildSnapshot(options);
    },
    publish(topic, payload, options = {}) {
      ensureSubscribed();
      return broker.publish(topic, payload, options);
    },
    onUpdate(listener) {
      ensureSubscribed();
      if (typeof listener !== "function") return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close() {
      if (unsubscribe) unsubscribe();
      unsubscribe = null;
      listeners.clear();
    },
  };
}

export function getMqttModel(options = {}) {
  if (!singletonModel) singletonModel = createMqttModel(options);
  return singletonModel;
}

export function resetMqttModelForTests() {
  if (singletonModel) singletonModel.close();
  singletonModel = null;
}

export { createMqttModel, normalizeTopicPrefix, payloadPreview };
