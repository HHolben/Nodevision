// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/IoTDashboard.mjs
// This file renders the IoT Dashboard info panel for internal MQTT-style broker topics, retained IoT state, and local publish tests.

import { updateToolbarState } from "/panels/createToolbar.mjs";
import { getNodevisionNavigationState } from "/NodevisionNavigationState.mjs";
import { DEFAULT_IOT_TOPIC_PREFIX, mapGardenBed1Payload, parseIotPublishPayload, truncatePayloadPreview } from "./IoTDashboardHelpers.mjs";

const navigationState = getNodevisionNavigationState();

const POLL_INTERVAL_MS = 3000;

const TEMPLATE = `
  <div data-iot-dashboard-root style="display:flex;flex-direction:column;gap:10px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
      <div>
        <h3 style="margin:0;font-size:1.1em;">IoT Dashboard</h3>
        <p style="margin:4px 0 0;color:#666;font-size:0.9em;">Monitor MQTT-style Nodevision topics, retained device state, and IoT publish tests.</p>
      </div>
      <button type="button" data-iot-refresh style="border:1px solid #ccc;border-radius:6px;background:#fff;padding:6px 10px;font-size:0.85em;cursor:pointer;">Refresh</button>
    </div>

    <section style="border:1px solid #ddd;border-radius:8px;padding:10px;background:#fafafa;">
      <div style="font-weight:600;margin-bottom:6px;">Broker Status</div>
      <div data-iot-status-grid style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;font-size:0.86em;"></div>
    </section>

    <section data-garden-bed-card style="border:1px solid #ddd;border-radius:8px;padding:10px;background:#fff;display:none;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;">
        <div style="font-weight:600;">Garden Bed 1</div>
        <span data-garden-bed-updated style="font-size:0.78em;color:#666;"></span>
      </div>
      <div data-garden-bed-values style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;font-size:0.86em;"></div>
    </section>

    <section style="border:1px solid #ddd;border-radius:8px;padding:10px;background:#fff;">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
        <div style="font-weight:600;">Retained Topics</div>
        <div style="display:flex;align-items:flex-end;gap:6px;flex-wrap:wrap;">
          <label style="display:flex;flex-direction:column;gap:3px;font-size:0.82em;color:#555;min-width:190px;">Topic prefix
            <input data-iot-prefix value="nodevision/iot/" style="padding:6px;border:1px solid #bbb;border-radius:6px;font-size:1em;">
          </label>
          <button type="button" data-iot-retained-refresh style="border:1px solid #bbb;border-radius:6px;background:#fff;padding:6px 10px;cursor:pointer;font-size:0.82em;">Refresh</button>
        </div>
      </div>
      <div data-iot-retained-list style="display:flex;flex-direction:column;gap:6px;max-height:220px;overflow:auto;font-size:0.82em;"></div>
    </section>

    <section style="border:1px solid #ddd;border-radius:8px;padding:10px;background:#fff;">
      <div style="font-weight:600;margin-bottom:8px;">IoT Device Publish Test</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <label style="display:flex;flex-direction:column;gap:4px;font-size:0.86em;">Topic
          <input data-iot-test-topic value="nodevision/iot/test" style="padding:7px;border:1px solid #bbb;border-radius:6px;font-size:1em;">
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;font-size:0.86em;">Payload JSON
          <textarea data-iot-test-payload rows="4" style="padding:7px;border:1px solid #bbb;border-radius:6px;font-family:monospace;font-size:0.95em;resize:vertical;">{"hello":"world"}</textarea>
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;font-size:0.86em;">Bearer token
          <input data-iot-test-token type="password" autocomplete="off" placeholder="paste IoT token for local testing" style="padding:7px;border:1px solid #bbb;border-radius:6px;font-size:1em;">
        </label>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
          <label style="display:flex;gap:6px;align-items:center;font-size:0.85em;color:#555;"><input type="checkbox" data-iot-test-retain checked>Retain</label>
          <button type="button" data-iot-test-publish style="border:none;border-radius:6px;background:#0a84ff;color:#fff;padding:8px 12px;cursor:pointer;font-size:0.88em;">Publish Test Message</button>
        </div>
        <pre data-iot-test-result style="display:none;margin:0;max-height:180px;overflow:auto;white-space:pre-wrap;background:#f7f7f7;border:1px solid #ddd;border-radius:6px;padding:8px;font-size:0.82em;"></pre>
      </div>
    </section>

    <section style="border:1px solid #ddd;border-radius:8px;padding:10px;background:#fafafa;">
      <div style="font-weight:600;margin-bottom:6px;">Wokwi Connection Help</div>
      <pre data-wokwi-help style="margin:0;white-space:pre-wrap;background:#fff;border:1px solid #ddd;border-radius:6px;padding:8px;font-size:0.82em;user-select:text;">POST http://127.0.0.1:3000/api/iot/publish

If Wokwi cannot reach 127.0.0.1, use the host computer LAN IP, for example http://192.168.x.x:3000/api/iot/publish

Example ESP32 headers:
Content-Type: application/json
Authorization: Bearer &lt;your-device-token&gt;

MQTT 3.1.1 QoS 0 support is experimental. Use localhost:1883 unless explicitly enabled for LAN.</pre>
    </section>

    <section style="border:1px solid #ddd;border-radius:8px;padding:10px;background:#fff;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;">
        <div>
          <div style="font-weight:600;">Recent IoT Events</div>
          <div data-iot-events-warning style="display:none;margin-top:3px;color:#8f4f00;font-size:0.78em;"></div>
        </div>
        <button type="button" data-iot-events-refresh style="border:1px solid #bbb;border-radius:6px;background:#fff;padding:5px 9px;cursor:pointer;font-size:0.82em;">Refresh Events</button>
      </div>
      <div data-iot-events-list style="display:flex;flex-direction:column;gap:6px;max-height:220px;overflow:auto;font-size:0.82em;"></div>
    </section>
  </div>
`;

const escapeHtml = (value = "") => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function safeTopicPrefix(value) {
  const text = String(value || "").trim();
  return text || DEFAULT_IOT_TOPIC_PREFIX;
}

async function apiFetchJson(url, init = {}) {
  const response = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const baseError = String(payload?.error || `Request failed (${response.status})`).trim();
    const details = String(payload?.details || "").trim();
    throw new Error(details ? `${baseError}: ${details}` : baseError);
  }
  return payload;
}

export async function setupPanel(panelElem, panelVars = {}) {
  updateToolbarState({ activePanelType: "IoTDashboard" });
  navigationState.setLastInfoPanelType("IoTDashboard");
  if (typeof panelElem.cleanup === "function") { try { panelElem.cleanup(); } catch {} }
  panelElem.innerHTML = TEMPLATE;
  const titleEl = panelElem.querySelector(".panel-title");
  if (titleEl) titleEl.textContent = panelVars.displayName || "IoT Dashboard";

  const refreshBtn = panelElem.querySelector("[data-iot-refresh]");
  const statusGridEl = panelElem.querySelector("[data-iot-status-grid]");
  const prefixInput = panelElem.querySelector("[data-iot-prefix]");
  const retainedRefreshBtn = panelElem.querySelector("[data-iot-retained-refresh]");
  const retainedListEl = panelElem.querySelector("[data-iot-retained-list]");
  const eventsWarningEl = panelElem.querySelector("[data-iot-events-warning]");
  const eventsRefreshBtn = panelElem.querySelector("[data-iot-events-refresh]");
  const eventsListEl = panelElem.querySelector("[data-iot-events-list]");
  const testTopicInput = panelElem.querySelector("[data-iot-test-topic]");
  const testPayloadInput = panelElem.querySelector("[data-iot-test-payload]");
  const testTokenInput = panelElem.querySelector("[data-iot-test-token]");
  const testRetainInput = panelElem.querySelector("[data-iot-test-retain]");
  const testPublishBtn = panelElem.querySelector("[data-iot-test-publish]");
  const testResultEl = panelElem.querySelector("[data-iot-test-result]");
  const gardenCardEl = panelElem.querySelector("[data-garden-bed-card]");
  const gardenValuesEl = panelElem.querySelector("[data-garden-bed-values]");
  const gardenUpdatedEl = panelElem.querySelector("[data-garden-bed-updated]");

  const state = {
    disposed: false,
    pollTimer: null,
    retained: [],
    events: [],
    status: { retainedCount: 0, eventCount: 0, lastRefresh: null, mqtt: null },
  };

  const setEventsWarning = (message = "") => {
    if (!eventsWarningEl) return;
    const text = String(message || "").trim();
    eventsWarningEl.style.display = text ? "block" : "none";
    eventsWarningEl.textContent = text;
  };

  const renderStatus = () => {
    const lastRefresh = state.status.lastRefresh ? state.status.lastRefresh.toLocaleTimeString() : "Not refreshed";
    renderStatGrid(statusGridEl, [
      ["Broker", "Internal broker available"],
      ["MQTT", state.status.mqtt?.enabled ? (state.status.mqtt?.listening ? String(state.status.mqtt.host || "127.0.0.1") + ":" + String(state.status.mqtt.port || 1883) : "Enabled, not listening") : "Disabled"],
      ["MQTT Clients", String(state.status.mqtt?.clientCount || 0)],
      ["Anonymous MQTT", state.status.mqtt?.anonymousAllowed ? "Allowed" : "Disabled"],
      ["Retained", String(state.status.retainedCount || 0)],
      ["Recent IoT Events", String(state.status.eventCount || 0)],
      ["Broker Events", String(state.status.allEventCount || 0)],
      ["Last Refresh", lastRefresh],
    ]);
  };

  const renderGardenCard = () => {
    const garden = mapGardenBed1Payload(state.retained);
    if (!gardenCardEl) return;
    if (!garden) {
      gardenCardEl.style.display = "none";
      return;
    }
    gardenCardEl.style.display = "block";
    if (gardenUpdatedEl) {
      gardenUpdatedEl.textContent = garden.timestamp ? `updated ${new Date(garden.timestamp).toLocaleTimeString()}` : "";
    }
    renderStatGrid(gardenValuesEl, [
      ["Moisture", formatValue(garden.moisture)],
      ["Threshold", formatValue(garden.threshold)],
      ["Pump On", formatValue(garden.pumpOn)],
    ]);
  };

  const renderRetained = () => {
    renderBrokerMessageList(retainedListEl, state.retained, "No retained IoT messages for this prefix.");
    renderGardenCard();
  };

  const renderEvents = () => renderBrokerMessageList(eventsListEl, state.events, "No recent IoT broker events for this prefix.");

  const loadDashboardData = async () => {
    const prefix = safeTopicPrefix(prefixInput?.value);
    if (prefixInput && prefixInput.value !== prefix) prefixInput.value = prefix;
    const encodedPrefix = encodeURIComponent(prefix);
    const iotPrefix = encodeURIComponent(DEFAULT_IOT_TOPIC_PREFIX);
    try {
      const [statusEventsPayload, statusRetainedPayload, retainedPayload, eventsPayload, mqttStatusPayload] = await Promise.all([
        apiFetchJson("/api/broker/events?limit=50", { cache: "no-store" }),
        apiFetchJson("/api/broker/retained?topicPrefix=" + iotPrefix + "&limit=50", { cache: "no-store" }),
        apiFetchJson("/api/broker/retained?topicPrefix=" + encodedPrefix + "&limit=50", { cache: "no-store" }),
        apiFetchJson("/api/broker/events?topicPrefix=" + iotPrefix + "&limit=50", { cache: "no-store" }),
        apiFetchJson("/api/mqtt/status", { cache: "no-store" }),
      ]);
      state.retained = Array.isArray(retainedPayload.retained) ? retainedPayload.retained.slice().reverse() : [];
      state.events = Array.isArray(eventsPayload.events) ? eventsPayload.events.slice().reverse() : [];
      state.status = {
        retainedCount: Array.isArray(statusRetainedPayload.retained) ? statusRetainedPayload.retained.length : 0,
        eventCount: state.events.length,
        allEventCount: Array.isArray(statusEventsPayload.events) ? statusEventsPayload.events.length : 0,
        lastRefresh: new Date(),
        mqtt: mqttStatusPayload?.mqtt || null,
      };
      setEventsWarning("");
      renderStatus();
      renderRetained();
      renderEvents();
    } catch (err) {
      setEventsWarning(err?.message || "IoT broker data unavailable.");
      renderStatus();
      renderRetained();
      renderEvents();
    }
  };

  const showTestResult = (value, isError = false) => {
    if (!testResultEl) return;
    testResultEl.style.display = "block";
    testResultEl.style.borderColor = isError ? "#e0a1a1" : "#ddd";
    testResultEl.style.background = isError ? "#fff4f4" : "#f7f7f7";
    testResultEl.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  };

  const publishTestMessage = async () => {
    try {
      const payload = parseIotPublishPayload(testPayloadInput?.value || "");
      const token = String(testTokenInput?.value || "").trim();
      const topic = String(testTopicInput?.value || "nodevision/iot/test").trim();
      if (!topic) throw new Error("Topic is required.");
      const headers = { "Content-Type": "application/json" };
      if (token) headers.Authorization = "Bearer " + token;
      const response = await fetch("/api/iot/publish", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({ topic, payload, retain: testRetainInput?.checked === true }),
      });
      const responsePayload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(responsePayload?.error || "Publish failed");
      showTestResult(responsePayload);
      await loadDashboardData().catch(() => {});
    } catch (err) {
      showTestResult(err?.message || "Invalid publish request", true);
    }
  };

  const stopPolling = () => {
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = null;
  };

  const startPolling = () => {
    stopPolling();
    state.pollTimer = setInterval(() => {
      if (!state.disposed) loadDashboardData().catch(() => {});
    }, POLL_INTERVAL_MS);
  };

  refreshBtn?.addEventListener("click", () => loadDashboardData().catch((err) => setEventsWarning(err?.message || "Refresh failed")));
  retainedRefreshBtn?.addEventListener("click", () => loadDashboardData().catch((err) => setEventsWarning(err?.message || "Refresh failed")));
  eventsRefreshBtn?.addEventListener("click", () => loadDashboardData().catch((err) => setEventsWarning(err?.message || "Refresh failed")));
  prefixInput?.addEventListener("change", () => loadDashboardData().catch((err) => setEventsWarning(err?.message || "Refresh failed")));
  testPublishBtn?.addEventListener("click", () => publishTestMessage());

  panelElem.cleanup = () => {
    state.disposed = true;
    stopPolling();
  };

  renderStatus();
  renderRetained();
  renderEvents();
  await loadDashboardData();
  startPolling();
}
