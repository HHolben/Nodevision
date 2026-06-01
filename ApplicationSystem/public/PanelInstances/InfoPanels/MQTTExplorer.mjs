// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/MQTTExplorer.mjs
// Standalone MQTT Explorer panel backed by the shared MQTT model client.

import { updateToolbarState } from "/panels/createToolbar.mjs";
import { getNodevisionNavigationState } from "/NodevisionNavigationState.mjs";
import { formatMqttTimestamp, getMqttModelClient, prettyPayload } from "/MessageBroker/MQTTModelClient.mjs";

const navigationState = getNodevisionNavigationState();
const DEFAULT_PREFIX = "nodevision/iot/";
const escapeHtml = (value = "") => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const TEMPLATE = `
  <div data-mqtt-explorer-root style="height:100%;display:flex;flex-direction:column;gap:8px;min-height:0;background:#f7f8fa;color:#1f2933;font-family:system-ui,-apple-system,Segoe UI,sans-serif;">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 10px;border-bottom:1px solid #d8dde6;background:#fff;">
      <div><h3 style="margin:0;font-size:1.02em;">MQTT Explorer</h3><div data-mqtt-status-line style="margin-top:3px;color:#667085;font-size:0.82em;"></div></div>
      <button type="button" data-mqtt-refresh style="border:1px solid #bcc6d4;border-radius:6px;background:#fff;padding:6px 10px;cursor:pointer;">Refresh</button>
    </div>
    <div style="display:grid;grid-template-columns:minmax(220px,0.9fr) minmax(280px,1.25fr) minmax(260px,0.95fr);gap:8px;min-height:0;flex:1;padding:0 8px 8px;">
      <section style="border:1px solid #d8dde6;background:#fff;border-radius:8px;min-width:0;min-height:0;display:flex;flex-direction:column;">
        <div style="padding:8px;border-bottom:1px solid #e2e6ee;display:flex;flex-direction:column;gap:7px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;"><strong>Topic Tree</strong><span data-mqtt-topic-count style="color:#667085;font-size:0.8em;"></span></div>
          <input data-mqtt-search placeholder="Search topics" style="width:100%;box-sizing:border-box;border:1px solid #bcc6d4;border-radius:6px;padding:6px;font-size:0.9em;">
          <input data-mqtt-prefix value="nodevision/iot/" aria-label="Topic prefix" style="width:100%;box-sizing:border-box;border:1px solid #bcc6d4;border-radius:6px;padding:6px;font-size:0.9em;">
        </div>
        <div data-mqtt-tree style="overflow:auto;padding:6px;min-height:0;flex:1;font-size:0.86em;"></div>
      </section>
      <section style="border:1px solid #d8dde6;background:#fff;border-radius:8px;min-width:0;min-height:0;display:flex;flex-direction:column;">
        <div style="padding:8px;border-bottom:1px solid #e2e6ee;"><strong>Topic Details</strong></div>
        <div data-mqtt-details style="overflow:auto;padding:10px;min-height:0;flex:1;"></div>
      </section>
      <section style="border:1px solid #d8dde6;background:#fff;border-radius:8px;min-width:0;min-height:0;display:flex;flex-direction:column;">
        <div style="padding:8px;border-bottom:1px solid #e2e6ee;"><strong>Publish / Device Information</strong></div>
        <div style="overflow:auto;padding:10px;min-height:0;flex:1;display:flex;flex-direction:column;gap:12px;">
          <form data-mqtt-publish-form style="display:flex;flex-direction:column;gap:8px;">
            <label style="display:flex;flex-direction:column;gap:4px;font-size:0.86em;">Topic<input data-mqtt-publish-topic value="nodevision/iot/test" style="border:1px solid #bcc6d4;border-radius:6px;padding:7px;font-size:1em;"></label>
            <label style="display:flex;flex-direction:column;gap:4px;font-size:0.86em;">Payload<textarea data-mqtt-publish-payload rows="7" style="border:1px solid #bcc6d4;border-radius:6px;padding:7px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:0.9em;resize:vertical;">{"hello":"mqtt"}</textarea></label>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><label style="display:flex;align-items:center;gap:6px;color:#4b5565;font-size:0.86em;"><input data-mqtt-publish-retain type="checkbox" checked>Retain</label><button type="submit" style="border:none;border-radius:6px;background:#146c5f;color:#fff;padding:8px 12px;cursor:pointer;font-weight:600;">Publish</button></div>
            <div data-mqtt-publish-result style="display:none;border:1px solid #d8dde6;background:#f7f8fa;border-radius:6px;padding:7px;font-size:0.82em;"></div>
          </form>
          <section data-mqtt-csv-panel style="border-top:1px solid #e2e6ee;padding-top:10px;display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;"><strong>CSV Loggers</strong><button type="button" data-mqtt-csv-refresh style="border:1px solid #bcc6d4;border-radius:6px;background:#fff;padding:4px 8px;cursor:pointer;">Refresh</button></div>
            <div data-mqtt-csv-list style="display:flex;flex-direction:column;gap:6px;font-size:0.84em;"></div>
            <button type="button" data-mqtt-csv-template style="border:1px solid #bcc6d4;border-radius:6px;background:#fff;padding:6px 8px;cursor:pointer;">Garden Bed 1 Moisture Logger</button>
            <label style="display:flex;flex-direction:column;gap:4px;font-size:0.84em;">Name<input data-mqtt-csv-name style="border:1px solid #bcc6d4;border-radius:6px;padding:6px;"></label>
            <label style="display:flex;flex-direction:column;gap:4px;font-size:0.84em;">Topic filter<input data-mqtt-csv-topic style="border:1px solid #bcc6d4;border-radius:6px;padding:6px;"></label>
            <label style="display:flex;flex-direction:column;gap:4px;font-size:0.84em;">CSV relative path<input data-mqtt-csv-path style="border:1px solid #bcc6d4;border-radius:6px;padding:6px;"></label>
            <label style="display:flex;flex-direction:column;gap:4px;font-size:0.84em;">Columns<input data-mqtt-csv-columns style="border:1px solid #bcc6d4;border-radius:6px;padding:6px;"></label>
            <label style="display:flex;flex-direction:column;gap:4px;font-size:0.84em;">Mappings JSON<textarea data-mqtt-csv-mappings rows="5" style="border:1px solid #bcc6d4;border-radius:6px;padding:6px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:0.9em;"></textarea></label>
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;"><label style="display:flex;gap:6px;align-items:center;font-size:0.84em;"><input data-mqtt-csv-enabled type="checkbox" checked>Enabled</label><div style="display:flex;gap:6px;"><button type="button" data-mqtt-csv-test style="border:1px solid #bcc6d4;border-radius:6px;background:#fff;padding:6px 8px;cursor:pointer;">Test</button><button type="button" data-mqtt-csv-save style="border:none;border-radius:6px;background:#146c5f;color:#fff;padding:6px 9px;cursor:pointer;">Save</button></div></div>
            <pre data-mqtt-csv-result style="display:none;margin:0;white-space:pre-wrap;overflow-wrap:anywhere;background:#f7f8fa;border:1px solid #d8dde6;border-radius:6px;padding:7px;font-size:0.82em;"></pre>
          </section>
          <div data-mqtt-device-info></div>
        </div>
      </section>
    </div>
  </div>
`;

function normalizePrefix(value) {
  return String(value || "").trim() || DEFAULT_PREFIX;
}

async function apiJson(url, init = {}) {
  const response = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Request failed ()`);
  return payload;
}

function getTopics(snapshot, prefix, search) {
  const q = String(search || "").trim().toLowerCase();
  return (Array.isArray(snapshot?.topics) ? snapshot.topics : [])
    .filter((topic) => !prefix || String(topic.topic || "").startsWith(prefix))
    .filter((topic) => !q || String(topic.topic || "").toLowerCase().includes(q) || String(topic.payloadPreview || "").toLowerCase().includes(q));
}

function ensurePathExpanded(expanded, topic) {
  const parts = String(topic || "").split("/").filter(Boolean);
  let path = "";
  for (let i = 0; i < parts.length - 1; i += 1) {
    path = path ? `${path}/${parts[i]}` : parts[i];
    expanded.add(path);
  }
}

function buildTree(topics) {
  const root = { name: "", path: "", children: new Map(), topic: null };
  for (const topic of topics) {
    const parts = String(topic.topic || "").split("/").filter(Boolean);
    let node = root;
    let path = "";
    for (const part of parts) {
      path = path ? `${path}/${part}` : part;
      if (!node.children.has(part)) node.children.set(part, { name: part, path, children: new Map(), topic: null });
      node = node.children.get(part);
    }
    node.topic = topic;
  }
  return root;
}

function renderNode(node, state, depth = 0) {
  const children = [...node.children.values()].sort((a, b) => a.name.localeCompare(b.name));
  const hasChildren = children.length > 0;
  const expanded = state.expanded.has(node.path);
  const selected = state.selectedTopic === node.topic?.topic;
  const isTopic = Boolean(node.topic);
  const padding = depth * 14;
  const row = node.path ? `
    <div data-tree-row data-path="${escapeHtml(node.path)}" data-topic="${escapeHtml(node.topic?.topic || "")}" style="display:flex;align-items:center;gap:4px;padding:4px 4px 4px ${padding}px;border-radius:5px;cursor:pointer;${selected ? "background:#dff7ef;" : ""}">
      <button type="button" data-tree-toggle="${escapeHtml(node.path)}" style="width:20px;height:20px;border:none;background:transparent;cursor:pointer;color:#52606d;">${hasChildren ? (expanded ? "-" : "+") : ""}</button>
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${isTopic ? "font-weight:600;" : ""}" title="${escapeHtml(node.path)}">${escapeHtml(node.name)}</span>
    </div>` : "";
  const childRows = hasChildren && (!node.path || expanded) ? children.map((child) => renderNode(child, state, depth + (node.path ? 1 : 0))).join("") : "";
  return row + childRows;
}

function detailStat(label, value) {
  return `<div style="border:1px solid #e2e6ee;border-radius:6px;padding:7px;background:#fbfcfd;min-width:0;"><div style="color:#667085;font-size:0.76em;">${escapeHtml(label)}</div><div style="font-weight:600;overflow-wrap:anywhere;">${escapeHtml(value)}</div></div>`;
}

function renderDetails(container, topic) {
  if (!container) return;
  if (!topic) {
    container.innerHTML = `<div style="color:#667085;">Select a retained topic to inspect its payload.</div>`;
    return;
  }
  const jsonText = topic.payload && typeof topic.payload === "object" ? prettyPayload(topic) : "";
  const rawText = String(topic.payloadPreview ?? "");
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px;min-width:0;">
      <div><div style="color:#667085;font-size:0.78em;">Topic</div><code style="font-weight:700;overflow-wrap:anywhere;">${escapeHtml(topic.topic)}</code></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;">
        ${detailStat("Publisher", topic.publisherId || "unknown")}
        ${detailStat("Timestamp", formatMqttTimestamp(topic.timestamp) || "unknown")}
        ${detailStat("Retained", topic.retained ? "yes" : "no")}
        ${detailStat("Payload Size", `${Number(topic.payloadSize || 0)} bytes`)}
      </div>
      <div><div style="font-weight:600;margin-bottom:5px;">JSON view</div><pre style="margin:0;white-space:pre-wrap;overflow-wrap:anywhere;background:#f7f8fa;border:1px solid #d8dde6;border-radius:6px;padding:8px;min-height:70px;">${escapeHtml(jsonText || "Not JSON")}</pre></div>
      <div><div style="font-weight:600;margin-bottom:5px;">Raw text view</div><pre style="margin:0;white-space:pre-wrap;overflow-wrap:anywhere;background:#f7f8fa;border:1px solid #d8dde6;border-radius:6px;padding:8px;min-height:70px;">${escapeHtml(rawText)}</pre></div>
    </div>`;
}

function renderDeviceInfo(container, snapshot, selectedTopic) {
  if (!container) return;
  const devices = Array.isArray(snapshot?.devices) ? snapshot.devices : [];
  const device = selectedTopic?.device ? devices.find((item) => item.name === selectedTopic.device) : devices[0];
  if (!device) {
    container.innerHTML = `<div style="color:#667085;font-size:0.86em;">No devices inferred yet. Publish a retained payload with <code>device</code> or a publisher id.</div>`;
    return;
  }
  const latest = (Array.isArray(device.latestPayloads) ? device.latestPayloads : []).slice(-6).reverse();
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px;">
      <div style="font-weight:700;">${escapeHtml(device.name)}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:7px;">
        ${detailStat("Publisher", device.publisherId || "unknown")}
        ${detailStat("Last Seen", formatMqttTimestamp(device.lastSeen) || "unknown")}
        ${detailStat("Retained Topics", String(device.retainedTopicCount || 0))}
      </div>
      <div style="font-weight:600;">Topics Published</div>
      <div style="display:flex;flex-direction:column;gap:5px;">${(device.topics || []).map((topic) => `<code style="display:block;overflow-wrap:anywhere;background:#f7f8fa;border:1px solid #e2e6ee;border-radius:5px;padding:5px;">${escapeHtml(topic)}</code>`).join("")}</div>
      <div style="font-weight:600;">Latest Payloads</div>
      <div style="display:flex;flex-direction:column;gap:5px;">${latest.map((item) => `<div style="border:1px solid #e2e6ee;border-radius:5px;padding:6px;background:#fbfcfd;"><code style="display:block;overflow-wrap:anywhere;">${escapeHtml(item.topic)}</code><pre style="margin:4px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:0.82em;">${escapeHtml(item.payloadPreview || "")}</pre></div>`).join("")}</div>
    </div>`;
}

function renderStatus(container, snapshot) {
  if (!container) return;
  const status = snapshot?.status || {};
  const mqtt = status.mqtt || {};
  container.textContent = [
    mqtt.enabled ? (mqtt.listening ? `MQTT ${mqtt.host || "127.0.0.1"}:${mqtt.port || 1883}` : "MQTT enabled") : "MQTT disabled",
    `${status.connectedClients || 0} clients`,
    `${status.subscriptions || 0} subscriptions`,
    `${status.retainedTopics || 0} retained`,
    `${status.messagesReceived || 0} messages`,
  ].join(" | ");
}

export async function setupPanel(panelElem) {
  updateToolbarState({ activePanelType: "MQTTExplorer" });
  navigationState.setLastInfoPanelType("MQTTExplorer");
  if (typeof panelElem.cleanup === "function") { try { panelElem.cleanup(); } catch {} }
  panelElem.style.height = "100%";
  panelElem.innerHTML = TEMPLATE;

  const client = getMqttModelClient();
  const state = { snapshot: client.snapshot(), expanded: new Set(), selectedTopic: null, unsubscribe: null };
  const statusLine = panelElem.querySelector("[data-mqtt-status-line]");
  const refreshBtn = panelElem.querySelector("[data-mqtt-refresh]");
  const treeEl = panelElem.querySelector("[data-mqtt-tree]");
  const countEl = panelElem.querySelector("[data-mqtt-topic-count]");
  const searchInput = panelElem.querySelector("[data-mqtt-search]");
  const prefixInput = panelElem.querySelector("[data-mqtt-prefix]");
  const detailsEl = panelElem.querySelector("[data-mqtt-details]");
  const deviceInfoEl = panelElem.querySelector("[data-mqtt-device-info]");
  const form = panelElem.querySelector("[data-mqtt-publish-form]");
  const publishTopic = panelElem.querySelector("[data-mqtt-publish-topic]");
  const publishPayload = panelElem.querySelector("[data-mqtt-publish-payload]");
  const publishRetain = panelElem.querySelector("[data-mqtt-publish-retain]");
  const publishResult = panelElem.querySelector("[data-mqtt-publish-result]");
  const csvListEl = panelElem.querySelector("[data-mqtt-csv-list]");
  const csvRefreshBtn = panelElem.querySelector("[data-mqtt-csv-refresh]");
  const csvTemplateBtn = panelElem.querySelector("[data-mqtt-csv-template]");
  const csvNameInput = panelElem.querySelector("[data-mqtt-csv-name]");
  const csvTopicInput = panelElem.querySelector("[data-mqtt-csv-topic]");
  const csvPathInput = panelElem.querySelector("[data-mqtt-csv-path]");
  const csvColumnsInput = panelElem.querySelector("[data-mqtt-csv-columns]");
  const csvMappingsInput = panelElem.querySelector("[data-mqtt-csv-mappings]");
  const csvEnabledInput = panelElem.querySelector("[data-mqtt-csv-enabled]");
  const csvSaveBtn = panelElem.querySelector("[data-mqtt-csv-save]");
  const csvTestBtn = panelElem.querySelector("[data-mqtt-csv-test]");
  const csvResultEl = panelElem.querySelector("[data-mqtt-csv-result]");
  const selectedRecord = () => (state.snapshot?.topics || []).find((topic) => topic.topic === state.selectedTopic) || null;


  const csvLoggerIdFromName = (name) => String(name || "mqtt-csv-logger").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "mqtt-csv-logger";

  const showCsvResult = (value, isError = false) => {
    if (!csvResultEl) return;
    csvResultEl.style.display = "block";
    csvResultEl.style.borderColor = isError ? "#d92d20" : "#d8dde6";
    csvResultEl.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  };

  const fillCsvTemplate = () => {
    if (csvNameInput) csvNameInput.value = "Garden Bed 1 Moisture";
    if (csvTopicInput) csvTopicInput.value = "nodevision/iot/garden/bed1/moisture";
    if (csvPathInput) csvPathInput.value = "IoTGarden/MoistureReadings.csv";
    if (csvColumnsInput) csvColumnsInput.value = "Date,Time,Moisture Reading";
    if (csvMappingsInput) csvMappingsInput.value = JSON.stringify({ Date: "$date", Time: "$time", "Moisture Reading": "moisture" }, null, 2);
    if (csvEnabledInput) csvEnabledInput.checked = true;
  };

  const readCsvForm = () => {
    const name = String(csvNameInput?.value || "").trim();
    const mappingsText = String(csvMappingsInput?.value || "{}").trim();
    return {
      id: csvLoggerIdFromName(name),
      name,
      enabled: csvEnabledInput?.checked === true,
      topicFilter: String(csvTopicInput?.value || "").trim(),
      csvRelativePath: String(csvPathInput?.value || "").trim(),
      columns: String(csvColumnsInput?.value || "").split(",").map((item) => item.trim()).filter(Boolean),
      mappings: JSON.parse(mappingsText || "{}"),
      timezone: "local",
      writeHeader: true,
      minIntervalMs: 0,
    };
  };

  const renderCsvLoggers = (loggers = []) => {
    if (!csvListEl) return;
    if (!loggers.length) {
      csvListEl.innerHTML = `<div style="color:#667085;">No CSV loggers configured.</div>`;
      return;
    }
    csvListEl.innerHTML = loggers.map((logger) => `
      <div data-csv-logger-id="${escapeHtml(logger.id)}" style="border:1px solid #e2e6ee;border-radius:6px;padding:6px;background:#fbfcfd;">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;"><strong>${escapeHtml(logger.name || logger.id)}</strong><span>${logger.enabled ? "enabled" : "disabled"}</span></div>
        <code style="display:block;margin-top:4px;overflow-wrap:anywhere;">${escapeHtml(logger.topicFilter)}</code>
        <div style="margin-top:4px;color:#52606d;overflow-wrap:anywhere;">${escapeHtml(logger.csvRelativePath)}</div>
        <div style="display:flex;gap:6px;margin-top:6px;"><button type="button" data-csv-toggle>${logger.enabled ? "Disable" : "Enable"}</button><button type="button" data-csv-load>Load</button><button type="button" data-csv-preview>Preview</button></div>
      </div>`).join("");
  };

  const loadCsvLoggers = async () => {
    const payload = await apiJson("/api/mqtt/csv-loggers", { cache: "no-store" });
    renderCsvLoggers(Array.isArray(payload.loggers) ? payload.loggers : []);
    return payload.loggers || [];
  };


  const render = () => {
    const prefix = normalizePrefix(prefixInput?.value);
    const topics = getTopics(state.snapshot, prefix, searchInput?.value || "");
    if (topics.length && !state.selectedTopic) state.selectedTopic = topics[topics.length - 1].topic;
    if (state.selectedTopic) ensurePathExpanded(state.expanded, state.selectedTopic);
    renderStatus(statusLine, state.snapshot);
    if (countEl) countEl.textContent = `${topics.length} topics`;
    if (treeEl) treeEl.innerHTML = topics.length ? renderNode(buildTree(topics), state) : `<div style="color:#667085;padding:6px;">No retained topics for this filter.</div>`;
    const selected = selectedRecord();
    renderDetails(detailsEl, selected);
    renderDeviceInfo(deviceInfoEl, state.snapshot, selected);
  };

  state.unsubscribe = client.subscribe((snapshot) => {
    state.snapshot = snapshot;
    render();
  });

  await client.connect({ topicPrefix: normalizePrefix(prefixInput?.value) }).catch((err) => {
    if (statusLine) statusLine.textContent = err?.message || "MQTT model unavailable";
  });

  treeEl?.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-tree-toggle]");
    if (toggle) {
      event.stopPropagation();
      const path = toggle.getAttribute("data-tree-toggle") || "";
      if (state.expanded.has(path)) state.expanded.delete(path); else state.expanded.add(path);
      render();
      return;
    }
    const row = event.target.closest("[data-tree-row]");
    const topic = row?.getAttribute("data-topic") || "";
    if (topic) {
      state.selectedTopic = topic;
      if (publishTopic) publishTopic.value = topic;
      const record = selectedRecord();
      if (record && publishPayload) publishPayload.value = prettyPayload(record);
      render();
    }
  });

  refreshBtn?.addEventListener("click", () => client.connect({ topicPrefix: normalizePrefix(prefixInput?.value) }).catch(() => {}));
  searchInput?.addEventListener("input", render);
  prefixInput?.addEventListener("change", () => client.connect({ topicPrefix: normalizePrefix(prefixInput?.value) }).catch(() => render()));

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (publishResult) {
      publishResult.style.display = "block";
      publishResult.textContent = "Publishing...";
    }
    try {
      const response = await client.publish({
        topic: String(publishTopic?.value || "").trim(),
        payloadText: publishPayload?.value || "",
        retain: publishRetain?.checked === true,
      });
      state.selectedTopic = response.topic;
      if (publishResult) publishResult.textContent = `Published ${response.topic}`;
    } catch (err) {
      if (publishResult) publishResult.textContent = err?.message || "Publish failed";
    }
  });


  csvTemplateBtn?.addEventListener("click", () => fillCsvTemplate());
  csvRefreshBtn?.addEventListener("click", () => loadCsvLoggers().catch((err) => showCsvResult(err?.message || "Unable to load CSV loggers", true)));
  csvSaveBtn?.addEventListener("click", async () => {
    try {
      const logger = readCsvForm();
      const payload = await apiJson("/api/mqtt/csv-loggers", { method: "POST", body: JSON.stringify({ logger }) });
      showCsvResult({ saved: payload.logger });
      await loadCsvLoggers();
    } catch (err) {
      showCsvResult(err?.message || "Unable to save CSV logger", true);
    }
  });
  csvTestBtn?.addEventListener("click", async () => {
    try {
      const logger = readCsvForm();
      await apiJson("/api/mqtt/csv-loggers", { method: "POST", body: JSON.stringify({ logger }) });
      const payload = await apiJson(`/api/mqtt/csv-loggers/${encodeURIComponent(logger.id)}/test`, { method: "POST", body: JSON.stringify({ write: false }) });
      showCsvResult(payload.preview || payload);
      await loadCsvLoggers();
    } catch (err) {
      showCsvResult(err?.message || "Unable to test CSV logger", true);
    }
  });
  csvListEl?.addEventListener("click", async (event) => {
    const card = event.target.closest("[data-csv-logger-id]");
    if (!card) return;
    const id = card.getAttribute("data-csv-logger-id") || "";
    try {
      const loggers = await loadCsvLoggers();
      const logger = loggers.find((item) => item.id === id);
      if (!logger) return;
      if (event.target.closest("[data-csv-load]")) {
        if (csvNameInput) csvNameInput.value = logger.name || logger.id;
        if (csvTopicInput) csvTopicInput.value = logger.topicFilter || "";
        if (csvPathInput) csvPathInput.value = logger.csvRelativePath || "";
        if (csvColumnsInput) csvColumnsInput.value = (logger.columns || []).join(",");
        if (csvMappingsInput) csvMappingsInput.value = JSON.stringify(logger.mappings || {}, null, 2);
        if (csvEnabledInput) csvEnabledInput.checked = logger.enabled === true;
      } else if (event.target.closest("[data-csv-toggle]")) {
        await apiJson(`/api/mqtt/csv-loggers/${encodeURIComponent(id)}/${logger.enabled ? "disable" : "enable"}`, { method: "POST", body: "{}" });
        await loadCsvLoggers();
      } else if (event.target.closest("[data-csv-preview]")) {
        const payload = await apiJson(`/api/mqtt/csv-loggers/${encodeURIComponent(id)}/test`, { method: "POST", body: JSON.stringify({ write: false }) });
        showCsvResult(payload.preview || payload);
      }
    } catch (err) {
      showCsvResult(err?.message || "CSV logger action failed", true);
    }
  });
  fillCsvTemplate();
  loadCsvLoggers().catch(() => {});


  panelElem.cleanup = () => {
    if (state.unsubscribe) state.unsubscribe();
  };

  render();
}
