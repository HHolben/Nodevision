// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerDependencies/MQTTGraphAdapter.mjs
// Live, non-persistent MQTT graph layer for Graph Manager.

import { formatMqttTimestamp, getMqttModelClient } from "/MessageBroker/MQTTModelClient.mjs";

export const MQTT_GRAPH_STYLE = [
  { selector: 'node[source="mqtt"]', style: { 'border-style': 'dashed', 'border-width': 2, 'font-size': '10px', 'text-wrap': 'wrap', 'text-max-width': 130, 'text-valign': 'center', 'text-halign': 'center', 'color': '#12312c', 'text-outline-width': 1, 'text-outline-color': '#f5fffb' } },
  { selector: 'node[type="mqtt-device"]', style: { 'shape': 'round-rectangle', 'background-color': '#8fd7c7', 'border-color': '#146c5f', 'width': 108, 'height': 58, 'font-weight': '700' } },
  { selector: 'node[type="mqtt-topic"]', style: { 'shape': 'ellipse', 'background-color': '#d7f2eb', 'border-color': '#208170', 'width': 132, 'height': 64 } },
  { selector: 'node[type="mqtt-publisher"]', style: { 'shape': 'hexagon', 'background-color': '#dce8ff', 'border-color': '#466fb0', 'width': 104, 'height': 62 } },
  { selector: 'node[type="mqtt-payload"]', style: { 'shape': 'round-tag', 'background-color': '#fff3c4', 'border-color': '#a67200', 'width': 118, 'height': 54 } },
  { selector: 'node[type="mqtt-region"]', style: { 'shape': 'round-rectangle', 'background-color': '#f0fbf7', 'background-opacity': 0.2, 'border-color': '#7dbfaf', 'border-style': 'dashed', 'border-width': 2, 'padding': 12, 'text-valign': 'top' } },
  { selector: 'edge[layer="mqtt"]', style: { 'line-color': '#208170', 'target-arrow-color': '#208170', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier', 'width': 2, 'line-style': 'dashed', 'label': 'data(label)', 'font-size': '8px', 'text-background-color': '#ffffff', 'text-background-opacity': 0.8 } },
];

function idFor(kind, value) {
  return `mqtt:${kind}:${encodeURIComponent(String(value || kind))}`;
}

function shortTopic(topic) {
  const parts = String(topic || "").split("/").filter(Boolean);
  return parts.slice(-3).join("/") || topic;
}

function shortPayload(text) {
  const raw = String(text || "");
  return raw.length > 80 ? raw.slice(0, 77) + "..." : raw;
}

function addNode(elements, ids, id, data) {
  ids.add(id);
  elements.push({ group: 'nodes', classes: 'mqtt-live', data: { id, source: 'mqtt', ...data } });
}

function addEdge(elements, ids, id, sourceNode, target, label) {
  ids.add(id);
  elements.push({ group: 'edges', classes: 'mqtt-live', data: { id, source: sourceNode, target, label, layer: 'mqtt' } });
}

function ensureControlsSection(container) {
  if (!container) return null;
  let section = container.querySelector("[data-mqtt-layer-controls]");
  if (!section) {
    section = document.createElement("div");
    section.dataset.mqttLayerControls = "true";
    section.style.cssText = "display:flex;align-items:center;gap:10px;flex-wrap:wrap;";
    container.appendChild(section);
  }
  return section;
}

function renderControls(container, state, render) {
  const section = ensureControlsSection(container);
  if (!section) return;
  section.innerHTML = `
    <label style="display:flex;align-items:center;gap:5px;white-space:nowrap;"><input data-mqtt-layer-devices type="checkbox" ${state.showDevices ? "checked" : ""}>MQTT Devices</label>
    <label style="display:flex;align-items:center;gap:5px;white-space:nowrap;"><input data-mqtt-layer-topics type="checkbox" ${state.showTopics ? "checked" : ""}>MQTT Topics</label>
  `;
  section.querySelector("[data-mqtt-layer-devices]")?.addEventListener("change", (event) => {
    state.showDevices = event.target.checked;
    render();
  });
  section.querySelector("[data-mqtt-layer-topics]")?.addEventListener("change", (event) => {
    state.showTopics = event.target.checked;
    render();
  });
}

function renderInspector(container, nodeData, snapshot) {
  if (!container) return;
  if (!nodeData || nodeData.source !== 'mqtt') {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }
  container.style.display = 'block';
  const deviceName = nodeData.device || nodeData.label;
  const device = (snapshot.devices || []).find((item) => item.name === deviceName);
  if (nodeData.type !== 'mqtt-device' || !device) {
    container.innerHTML = `<strong>${escapeHtml(nodeData.label || nodeData.id)}</strong><div style="margin-top:4px;color:#52606d;">${escapeHtml(nodeData.kind || 'MQTT node')}</div>`;
    return;
  }
  const payloads = (device.latestPayloads || []).slice(-5).reverse();
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;"><strong>${escapeHtml(device.name)}</strong><button data-mqtt-inspector-close type="button" style="border:none;background:transparent;cursor:pointer;font-size:16px;">x</button></div>
    <div style="margin-top:6px;color:#52606d;font-size:0.82em;">Publisher: ${escapeHtml(device.publisherId || 'unknown')}</div>
    <div style="color:#52606d;font-size:0.82em;">Last Seen: ${escapeHtml(formatMqttTimestamp(device.lastSeen) || 'unknown')}</div>
    <div style="color:#52606d;font-size:0.82em;">Retained Topics: ${Number(device.retainedTopicCount || 0)}</div>
    <div style="margin-top:8px;font-weight:600;">Topics Published</div>
    ${(device.topics || []).map((topic) => `<code style="display:block;margin-top:4px;overflow-wrap:anywhere;">${escapeHtml(topic)}</code>`).join('')}
    <div style="margin-top:8px;font-weight:600;">Latest Payloads</div>
    ${payloads.map((item) => `<div style="margin-top:5px;border-top:1px solid #d8dde6;padding-top:5px;"><code style="overflow-wrap:anywhere;">${escapeHtml(item.topic)}</code><pre style="white-space:pre-wrap;overflow-wrap:anywhere;margin:3px 0 0;">${escapeHtml(item.payloadPreview || '')}</pre></div>`).join('')}
  `;
  container.querySelector('[data-mqtt-inspector-close]')?.addEventListener('click', () => renderInspector(container, null, snapshot));
}

function escapeHtml(value = '') {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function elementsForSnapshot(snapshot, state) {
  const elements = [];
  const ids = new Set();
  const topics = Array.isArray(snapshot?.topics) ? snapshot.topics : [];
  const regions = new Set();

  for (const topic of topics) {
    const regionId = topic.region ? idFor('region', topic.region) : null;
    if (regionId && !regions.has(regionId) && (state.showDevices || state.showTopics)) {
      regions.add(regionId);
      addNode(elements, ids, regionId, { label: topic.region, type: 'mqtt-region', kind: 'region' });
    }

    const topicId = idFor('topic', topic.topic);
    if (state.showTopics) {
      addNode(elements, ids, topicId, { label: shortTopic(topic.topic), topic: topic.topic, type: 'mqtt-topic', kind: 'topic', parent: regionId || undefined, payloadPreview: topic.payloadPreview, lastSeen: topic.timestamp });
      const payloadId = idFor('payload', topic.topic);
      addNode(elements, ids, payloadId, { label: shortPayload(topic.payloadPreview), topic: topic.topic, type: 'mqtt-payload', kind: 'payload', parent: regionId || undefined });
      addEdge(elements, ids, idFor('edge:payload', topic.topic), topicId, payloadId, 'latest value');
    }

    if (state.showDevices) {
      if (topic.device) {
        const deviceId = idFor('device', topic.device);
        addNode(elements, ids, deviceId, { label: topic.device, device: topic.device, type: 'mqtt-device', kind: 'device' });
        if (state.showTopics) addEdge(elements, ids, idFor('edge:device', `${topic.device}->${topic.topic}`), deviceId, topicId, 'publishes');
      }
      if (topic.publisherId) {
        const publisherId = idFor('publisher', topic.publisherId);
        addNode(elements, ids, publisherId, { label: topic.publisherId, publisherId: topic.publisherId, type: 'mqtt-publisher', kind: 'publisher' });
        if (state.showTopics) addEdge(elements, ids, idFor('edge:publisher', `${topic.publisherId}->${topic.topic}`), publisherId, topicId, 'publishes');
      }
    }
  }

  return { elements, ids };
}

export function attachMqttGraphLayer({ cy, controlsEl, inspectorEl, relayout } = {}) {
  if (!cy) return { setControlsElement: () => {}, cleanup: () => {} };
  const client = getMqttModelClient();
  const state = { showDevices: true, showTopics: true, snapshot: client.snapshot() };
  let currentControlsEl = controlsEl || null;

  const render = () => {
    const { elements, ids } = elementsForSnapshot(state.snapshot, state);
    cy.batch(() => {
      cy.elements('.mqtt-live').filter((element) => !ids.has(element.id())).remove();
      for (const element of elements) {
        const existing = cy.getElementById(element.data.id);
        if (existing.empty()) cy.add(element);
        else existing.data(element.data);
      }
    });
    relayout?.({ fit: false, reason: 'mqtt-layer' });
  };

  renderControls(currentControlsEl, state, render);
  const unsubscribe = client.subscribe((snapshot) => {
    state.snapshot = snapshot;
    render();
  });
  client.connect().catch(() => {});

  cy.on('tap', 'node[source="mqtt"]', (event) => {
    renderInspector(inspectorEl, event.target.data(), state.snapshot);
  });

  render();
  return {
    setControlsElement(container) {
      currentControlsEl = container || null;
      renderControls(currentControlsEl, state, render);
    },
    cleanup() {
      unsubscribe();
      cy.off("tap", "node[source=\"mqtt\"]");
      cy.elements(".mqtt-live").remove();
      if (inspectorEl) inspectorEl.style.display = "none";
    },
  };
}
