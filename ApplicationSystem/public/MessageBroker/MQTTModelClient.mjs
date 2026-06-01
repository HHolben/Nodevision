// Nodevision/ApplicationSystem/public/MessageBroker/MQTTModelClient.mjs
// Browser-side singleton MQTT model client shared by MQTT Explorer and Graph Manager.

let singletonClient = null;

function emptySnapshot() {
  return {
    ok: true,
    version: 1,
    generatedAt: "",
    topicPrefix: "",
    status: {
      mqtt: null,
      retainedTopics: 0,
      visibleRetainedTopics: 0,
      subscriptions: 0,
      connectedClients: 0,
      messagesPublished: 0,
      messagesReceived: 0,
      lastMessageAt: null,
    },
    topics: [],
    devices: [],
    publishers: [],
    regions: [],
    subscriptions: [],
  };
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status})`);
  return payload;
}

function normalizePayloadText(text) {
  const raw = String(text ?? "");
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try { return JSON.parse(trimmed); } catch { return raw; }
  }
  return raw;
}

function createClient() {
  const listeners = new Set();
  let snapshot = emptySnapshot();
  let eventSource = null;
  let started = false;

  function emit() {
    for (const listener of listeners) {
      try { listener(snapshot); } catch {}
    }
  }

  async function refresh({ topicPrefix = "" } = {}) {
    snapshot = await fetchJson("/api/mqtt/model?topicPrefix=" + encodeURIComponent(topicPrefix), { cache: "no-store" });
    emit();
    return snapshot;
  }

  function startEvents() {
    if (eventSource || typeof EventSource === "undefined") return;
    eventSource = new EventSource("/api/mqtt/events");
    eventSource.addEventListener("mqtt-model", (event) => {
      try {
        const next = JSON.parse(event.data);
        if (next && typeof next === "object") {
          snapshot = next;
          emit();
        }
      } catch {}
    });
    eventSource.onerror = () => {
      // Keep the native EventSource retry behavior. The explicit refresh catches
      // missed updates after transient disconnects without polling.
      refresh().catch(() => {});
    };
  }

  return {
    async connect(options = {}) {
      if (!started) {
        started = true;
        startEvents();
      }
      return refresh(options);
    },
    snapshot() {
      return snapshot;
    },
    subscribe(listener) {
      if (typeof listener !== "function") return () => {};
      listeners.add(listener);
      listener(snapshot);
      if (!started) this.connect().catch(() => {});
      return () => listeners.delete(listener);
    },
    async publish({ topic, payloadText, retain = true }) {
      const payload = normalizePayloadText(payloadText);
      const response = await fetchJson("/api/mqtt/publish", {
        method: "POST",
        body: JSON.stringify({ topic, payload, retain: retain === true }),
      });
      await refresh().catch(() => {});
      return response;
    },
    close() {
      if (eventSource) eventSource.close();
      eventSource = null;
      started = false;
      listeners.clear();
    },
  };
}

export function getMqttModelClient() {
  if (!singletonClient) singletonClient = createClient();
  return singletonClient;
}

export function formatMqttTimestamp(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString();
}

export function prettyPayload(topic = {}) {
  const payload = topic?.payload;
  if (payload && typeof payload === "object") {
    try { return JSON.stringify(payload, null, 2); } catch {}
  }
  return String(topic?.payloadPreview ?? payload ?? "");
}
