// Nodevision/public/PanelInstances/EditorPanels/GraphicalEditors/PHPeditor.mjs
// PHP graphical editor module with device, logic, logging, and dashboard scaffolding.
// This module is designed to fit Nodevision editor conventions and exposes renderEditor + renderFile.

import { updateToolbarState } from "/panels/createToolbar.mjs";
import { createPanelDOM } from "/panels/panelFactory.mjs";

const SAVE_ENDPOINT = "/api/save";
const NOTEBOOK_PREFIX = "/Notebook/";
const PHP_EDITOR_COMMAND_EVENT = "nv-php-editor-command";
const PHP_TOOL_PANEL_INSTANCE = {
  devices: "nv-php-device-manager-panel",
  logic: "nv-php-logic-editor-panel",
  dashboard: "nv-php-dashboard-config-panel",
  logging: "nv-php-logging-panel"
};

const PHP_KEYWORDS = new Set([
  "if", "else", "elseif", "while", "for", "foreach", "function", "class", "public", "private",
  "protected", "static", "return", "new", "switch", "case", "break", "continue", "try", "catch",
  "throw", "namespace", "use", "echo", "print", "true", "false", "null", "const", "final", "extends"
]);

function escapeHTML(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function normalizePath(filePath = "") {
  const text = String(filePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (text.startsWith("Notebook/")) return text.slice("Notebook/".length);
  return text;
}

function toNotebookUrl(filePath = "") {
  return `${NOTEBOOK_PREFIX}${normalizePath(filePath)}`;
}

async function fetchTextFile(filePath) {
  const res = await fetch(toNotebookUrl(filePath), { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}

async function saveTextFile(filePath, content) {
  const res = await fetch(SAVE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: normalizePath(filePath), content })
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || `${res.status} ${res.statusText}`);
  }
  return true;
}

function createStyleTagOnce() {
  if (document.getElementById("nv-php-editor-style")) return;
  const style = document.createElement("style");
  style.id = "nv-php-editor-style";
  style.textContent = `
    .nv-php-root { display:flex; flex-direction:column; width:100%; height:100%; overflow:hidden; font-family:monospace; }
    .nv-php-layout { display:grid; grid-template-rows:minmax(260px, 1fr) minmax(280px, 0.9fr); flex:1; min-height:0; overflow:hidden; }
    .nv-php-pane { min-width:0; min-height:0; overflow:hidden; border-bottom:1px solid #e1e1e1; }
    .nv-php-pane:last-child { border-bottom:none; }
    .nv-php-editor-wrap { position:relative; width:100%; height:100%; background:#14161c; color:#e9efff; }
    .nv-php-highlight { position:absolute; inset:0; margin:0; padding:12px; overflow:auto; white-space:pre; pointer-events:none; font:13px/1.45 monospace; }
    .nv-php-input { position:absolute; inset:0; margin:0; border:none; resize:none; outline:none; padding:12px; background:transparent; color:transparent; caret-color:#f2f7ff; font:13px/1.45 monospace; }
    .nv-php-right { display:grid; grid-template-rows:56% 44%; height:100%; min-height:0; }
    .nv-php-preview-wrap { border-bottom:1px solid #e1e1e1; display:flex; flex-direction:column; min-height:0; }
    .nv-php-preview-title { padding:6px 8px; border-bottom:1px solid #e1e1e1; background:#fafafa; font:12px monospace; }
    .nv-php-preview { flex:1; width:100%; border:none; background:#fff; }
    .nv-php-dashboard-wrap { display:flex; flex-direction:column; min-height:0; }
    .nv-php-dashboard-title { padding:6px 8px; border-bottom:1px solid #e1e1e1; background:#fafafa; font:12px monospace; }
    .nv-php-dashboard { flex:1; min-height:0; overflow:auto; background:#fff; padding:8px; display:grid; grid-template-columns:repeat(2, minmax(180px, 1fr)); gap:8px; }
    .nv-php-widget { border:1px solid #ddd; border-radius:6px; padding:8px; background:#fcfcfc; min-height:120px; }
    .nv-php-widget h4 { margin:0 0 8px; font:12px monospace; }
    .nv-php-oscilloscope, .nv-php-graph { width:100%; height:80px; border:1px solid #cfcfcf; background:#121212; }
    .nv-php-meter { width:100%; }
    .nv-php-led { width:16px; height:16px; border-radius:50%; border:1px solid #444; background:#4d4d4d; box-shadow:inset 0 0 2px rgba(0,0,0,0.6); }
    .nv-php-led.on { background:#24d35f; box-shadow:0 0 8px rgba(36, 211, 95, 0.8); }
    .nv-php-grid { display:grid; grid-template-columns:repeat(2, minmax(240px, 1fr)); gap:10px; }
    .nv-php-card { border:1px solid #ddd; border-radius:6px; background:#fff; padding:8px; }
    .nv-php-card h3 { margin:0 0 6px; font:12px monospace; }
    .nv-php-list { margin:0; padding-left:18px; font:12px monospace; max-height:140px; overflow:auto; }
    .nv-php-label { display:block; margin-bottom:6px; font:12px monospace; }
    .nv-php-label input, .nv-php-label select { width:100%; box-sizing:border-box; margin-top:3px; font:12px monospace; }
    .nv-php-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
    .nv-php-actions button { padding:4px 10px; font:12px monospace; }
    .nv-php-status { padding:6px 8px; border-top:1px solid #ddd; background:#f7f7f7; font:11px monospace; color:#1a1a1a; }
    .nv-kw { color:#ffb86b; } .nv-var { color:#7dd3fc; } .nv-num { color:#9be564; } .nv-str { color:#f3f99d; } .nv-com { color:#7f8c8d; }
  `;
  document.head.appendChild(style);
}

function highlightPHP(source = "") {
  const escaped = escapeHTML(source);
  return escaped
    .replace(/(\/\*[\s\S]*?\*\/|\/\/[^\n]*)/g, '<span class="nv-com">$1</span>')
    .replace(/(["'`])((?:\\.|(?!\1)[\s\S])*)\1/g, '<span class="nv-str">$&</span>')
    .replace(/\$[a-zA-Z_]\w*/g, '<span class="nv-var">$&</span>')
    .replace(/\b\d+(?:\.\d+)?\b/g, '<span class="nv-num">$&</span>')
    .replace(/\b[a-zA-Z_]\w*\b/g, (word) => (PHP_KEYWORDS.has(word) ? `<span class="nv-kw">${word}</span>` : word));
}

function nowIso() {
  return new Date().toISOString();
}

function createEditorState(filePath, serverBase = "") {
  return {
    filePath,
    serverBase,
    code: "",
    lastRenderedCode: "",
    lastDeviceSnapshot: {},
    generatedPhp: "",
    runtimeEnabled: true,
    deviceManager: {
      connected: [],
      nextId: 1
    },
    logic: {
      blocks: [],
      nextId: 1
    },
    logging: {
      format: "json",
      records: [],
      lastValues: {}
    },
    dashboard: {
      widgets: [],
      nextId: 1
    }
  };
}

// Driver placeholder layer:
// Each protocol has connect/poll hooks so production integrations can be added without rewriting the editor.
const DEVICE_DRIVERS = {
  serial: {
    async connect(device) {
      device.driverNote = "Serial driver placeholder (Web Serial / native bridge).";
      device.values = { value: 0 };
    },
    async poll(device) {
      if (typeof device.values.value !== "number") device.values.value = 0;
      device.values.value = Number((device.values.value + 0.05) % 100).toFixed(3);
      device.values.value = Number(device.values.value);
    }
  },
  usb: {
    async connect(device) {
      device.driverNote = "USB driver placeholder (WebUSB / native bridge).";
      device.values = { state: 0 };
    },
    async poll(device) {
      device.values.state = Number(device.values.state || 0) ^ 1;
    }
  },
  gpio: {
    async connect(device) {
      device.driverNote = "GPIO driver placeholder (Node bridge required).";
      device.values = { pin: 17, value: 0 };
    },
    async poll(device) {
      device.values.value = Number((Date.now() / 500) % 2 >= 1);
    }
  },
  http: {
    async connect(device) {
      device.driverNote = "HTTP driver placeholder (AJAX polling endpoint).";
      device.values = { value: 0, endpoint: "/api/device/http-placeholder" };
    },
    async poll(device) {
      // Placeholder for real AJAX poll:
      // const res = await fetch(device.values.endpoint); device.values.value = (await res.json()).value;
      device.values.value = Number((50 + Math.sin(Date.now() / 800) * 30).toFixed(3));
    }
  },
  websocket: {
    async connect(device) {
      device.driverNote = "WebSocket driver placeholder.";
      device.values = { connected: false, value: 0 };
    },
    async poll(device) {
      device.values.connected = true;
      device.values.value = Number((Math.cos(Date.now() / 700) * 0.9).toFixed(3));
    }
  },
  mqtt: {
    async connect(device) {
      device.driverNote = "MQTT driver placeholder (broker bridge required).";
      device.values = { topic: "nodevision/sensor", value: 0 };
    },
    async poll(device) {
      device.values.value = Number((Math.sin(Date.now() / 1200) * 100).toFixed(2));
    }
  },
  "gamepad-api": {
    async connect(device) {
      device.driverNote = "Gamepad API driver.";
      device.values = { axes: [0, 0], buttons: [false, false], triggerL: 0, triggerR: 0 };
    },
    async poll(device, runtime) {
      const gp = runtime?.gamepad || null;
      if (!gp) return;
      device.values.axes = gp.axes.slice(0, 4).map((v) => Number(v.toFixed(3)));
      device.values.buttons = gp.buttons.slice(0, 8);
      device.values.triggerL = Number(gp.triggers.left.toFixed(3));
      device.values.triggerR = Number(gp.triggers.right.toFixed(3));
    }
  }
};

function createDeviceNode(state, type, protocol, name, extra = {}) {
  const id = `dev-${state.deviceManager.nextId++}`;
  const node = {
    id,
    type,
    protocol,
    name: name || `${type}-${id}`,
    connectedAt: nowIso(),
    values: {},
    ...extra
  };
  state.deviceManager.connected.push(node);
  return node;
}

function ensureDefaultBlocks(state) {
  if (state.logic.blocks.length > 0) return;
  const defaults = [
    { type: "AND", params: { left: 0, right: 0 } },
    { type: "OR", params: { left: 0, right: 0 } },
    { type: "NOT", params: { input: 0 } },
    { type: "COMPARE", params: { left: 0, op: ">", right: 0 } },
    { type: "TIMER", params: { intervalMs: 1000 } },
    { type: "COUNTER", params: { value: 0 } }
  ];
  defaults.forEach((block) => {
    state.logic.blocks.push({
      id: `logic-${state.logic.nextId++}`,
      ...block,
      last: 0
    });
  });
}

function ensureDefaultWidgets(state) {
  if (state.dashboard.widgets.length > 0) return;
  state.dashboard.widgets.push(
    { id: `widget-${state.dashboard.nextId++}`, type: "oscilloscope", source: "gamepad.axis0", history: [] },
    { id: `widget-${state.dashboard.nextId++}`, type: "gauge", source: "sensor.temperature", value: 0 },
    { id: `widget-${state.dashboard.nextId++}`, type: "led", source: "logic.AND", value: false },
    { id: `widget-${state.dashboard.nextId++}`, type: "graph", source: "gamepad.triggerL", history: [] }
  );
}

function evaluateLogicBlock(block, context, nowMs) {
  const p = block.params || {};
  if (block.type === "AND") return Boolean(p.left) && Boolean(p.right);
  if (block.type === "OR") return Boolean(p.left) || Boolean(p.right);
  if (block.type === "NOT") return !Boolean(p.input);
  if (block.type === "COMPARE") {
    const left = Number(p.left || 0);
    const right = Number(p.right || 0);
    if (p.op === "<") return left < right;
    if (p.op === "==") return left === right;
    return left > right;
  }
  if (block.type === "TIMER") {
    const interval = Math.max(50, Number(p.intervalMs || 1000));
    if (!block.last || nowMs - block.last >= interval) {
      block.last = nowMs;
      return true;
    }
    return false;
  }
  if (block.type === "COUNTER") {
    block.params.value = Number(block.params.value || 0) + 1;
    return block.params.value;
  }
  return null;
}

function buildGeneratedPhp(state) {
  const lines = [];
  lines.push("<?php");
  lines.push("// Auto-generated by Nodevision PHP Editor logic layer.");
  lines.push("$devices = [];");
  for (const device of state.deviceManager.connected) {
    lines.push(`$devices["${device.id}"] = ["type" => "${device.type}", "protocol" => "${device.protocol}"];`);
  }
  lines.push("");
  lines.push("// Logic blocks generated scaffold");
  for (const block of state.logic.blocks) {
    lines.push(`// ${block.id} (${block.type})`);
  }
  lines.push("");
  lines.push("// User script follows");
  lines.push("?>");
  state.generatedPhp = lines.join("\n");
  return state.generatedPhp;
}

function getDeviceSnapshot(state) {
  const snapshot = {};
  for (const device of state.deviceManager.connected) {
    snapshot[device.id] = { ...device.values };
  }
  return snapshot;
}

function appendLogIfChanged(state, logicResults) {
  const snap = getDeviceSnapshot(state);
  const payload = {
    ts: nowIso(),
    devices: snap,
    logic: { ...logicResults }
  };
  const key = JSON.stringify(payload.devices) + JSON.stringify(payload.logic);
  if (state.logging.lastValues.key === key) return;
  state.logging.lastValues.key = key;
  state.logging.records.push(payload);
  if (state.logging.records.length > 400) state.logging.records.shift();
}

function recordsToCsv(records) {
  const header = "timestamp,source,value\n";
  const rows = [];
  for (const row of records) {
    for (const [logicKey, value] of Object.entries(row.logic || {})) {
      rows.push(`${row.ts},logic.${logicKey},${JSON.stringify(value)}`);
    }
    for (const [deviceId, values] of Object.entries(row.devices || {})) {
      for (const [k, v] of Object.entries(values || {})) {
        rows.push(`${row.ts},${deviceId}.${k},${JSON.stringify(v)}`);
      }
    }
  }
  return header + rows.join("\n");
}

function buildPreviewHtml(state) {
  const escapedCode = escapeHTML(state.code);
  const escapedGenerated = escapeHTML(state.generatedPhp);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Nodevision PHP Preview</title>
  <style>
    body { font-family: monospace; margin: 0; background: #f4f5f8; color: #1a1d22; }
    .bar { padding: 8px 10px; border-bottom: 1px solid #d2d6de; background: #fff; }
    .wrap { display:grid; grid-template-columns:1fr 1fr; gap:10px; padding:10px; }
    pre { margin:0; white-space:pre-wrap; background:#12161d; color:#dce9ff; padding:8px; min-height:190px; border-radius:6px; }
    .panel { border:1px solid #d4d8df; border-radius:8px; background:#fff; overflow:hidden; }
    h3 { margin:0; padding:8px; font:12px monospace; border-bottom:1px solid #e5e8ed; }
  </style>
</head>
<body>
  <div class="bar">Nodevision PHP Preview (simulated render)</div>
  <div class="wrap">
    <div class="panel"><h3>User PHP</h3><pre>${escapedCode}</pre></div>
    <div class="panel"><h3>Generated Runtime PHP</h3><pre>${escapedGenerated}</pre></div>
  </div>
</body>
</html>`;
}

function drawWave(canvas, values, color = "#39f08c") {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = "#121212";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * w;
    const y = h / 2 - v * (h * 0.45);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function readGamepadValues() {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return null;
  const pads = navigator.getGamepads();
  if (!pads) return null;
  const pad = Array.from(pads).find(Boolean);
  if (!pad) return null;
  return {
    axes: (pad.axes || []).slice(0, 8),
    buttons: (pad.buttons || []).slice(0, 12).map((b) => Boolean(b?.pressed)),
    triggers: {
      left: Number(pad.buttons?.[6]?.value || 0),
      right: Number(pad.buttons?.[7]?.value || 0)
    }
  };
}

function bindSaveHooks(state) {
  window.getEditorMarkdown = () => state.code;
  window.setEditorMarkdown = (next) => {
    state.code = String(next || "");
  };
  window.saveMDFile = async (path) => saveTextFile(path || state.filePath, state.code);
}

function cleanupSaveHooks() {
  try {
    delete window.getEditorMarkdown;
    delete window.setEditorMarkdown;
    delete window.saveMDFile;
  } catch (_) {
    window.getEditorMarkdown = undefined;
    window.setEditorMarkdown = undefined;
    window.saveMDFile = undefined;
  }
}

function buildDeviceManagerPanel(state, panel) {
  panel.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "nv-php-grid";
  panel.appendChild(grid);

  const createCard = document.createElement("div");
  createCard.className = "nv-php-card";
  createCard.innerHTML = `<h3>Connect Device</h3>`;
  grid.appendChild(createCard);

  const typeLabel = document.createElement("label");
  typeLabel.className = "nv-php-label";
  typeLabel.textContent = "Device Type";
  const typeSelect = document.createElement("select");
  ["sensor", "actuator", "gamepad", "custom"].forEach((v) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    typeSelect.appendChild(o);
  });
  typeLabel.appendChild(typeSelect);
  createCard.appendChild(typeLabel);

  const protoLabel = document.createElement("label");
  protoLabel.className = "nv-php-label";
  protoLabel.textContent = "Protocol";
  const protoSelect = document.createElement("select");
  ["serial", "usb", "gpio", "http", "websocket", "mqtt", "gamepad-api"].forEach((v) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    protoSelect.appendChild(o);
  });
  protoLabel.appendChild(protoSelect);
  createCard.appendChild(protoLabel);

  const nameLabel = document.createElement("label");
  nameLabel.className = "nv-php-label";
  nameLabel.textContent = "Name";
  const nameInput = document.createElement("input");
  nameInput.placeholder = "e.g. WarehousePad";
  nameLabel.appendChild(nameInput);
  createCard.appendChild(nameLabel);

  const actions = document.createElement("div");
  actions.className = "nv-php-actions";
  createCard.appendChild(actions);

  const listCard = document.createElement("div");
  listCard.className = "nv-php-card";
  listCard.innerHTML = `<h3>Connected Device Nodes</h3>`;
  const list = document.createElement("ul");
  list.className = "nv-php-list";
  listCard.appendChild(list);
  grid.appendChild(listCard);

  function refreshList() {
    list.innerHTML = "";
    state.deviceManager.connected.forEach((device) => {
      const li = document.createElement("li");
      li.textContent = `${device.id} ${device.name} (${device.protocol})`;
      list.appendChild(li);
    });
  }

  const connectBtn = document.createElement("button");
  connectBtn.type = "button";
  connectBtn.textContent = "Connect Device";
  connectBtn.addEventListener("click", async () => {
    const type = typeSelect.value;
    const protocol = protoSelect.value;
    const node = createDeviceNode(state, type, protocol, nameInput.value.trim());
    if (DEVICE_DRIVERS[protocol]?.connect) {
      await DEVICE_DRIVERS[protocol].connect(node);
    } else if (type === "sensor") {
      node.values = { value: 0 };
    } else {
      node.values = { state: 0 };
    }
    refreshList();
  });
  actions.appendChild(connectBtn);

  const seedBtn = document.createElement("button");
  seedBtn.type = "button";
  seedBtn.textContent = "Seed Sample Devices";
  seedBtn.addEventListener("click", () => {
    if (state.deviceManager.connected.length > 0) return;
    createDeviceNode(state, "sensor", "serial", "temperature").values = { value: 22.3 };
    createDeviceNode(state, "sensor", "http", "humidity").values = { value: 50.2 };
    createDeviceNode(state, "gamepad", "gamepad-api", "controller-1").values = {
      axes: [0, 0], buttons: [false, false, false, false], triggerL: 0, triggerR: 0
    };
    refreshList();
  });
  actions.appendChild(seedBtn);

  refreshList();
}

function buildLogicPanel(state, panel) {
  panel.innerHTML = "";
  ensureDefaultBlocks(state);
  const card = document.createElement("div");
  card.className = "nv-php-card";
  card.innerHTML = `<h3>Logic Blocks (Visual Scaffold)</h3>`;
  panel.appendChild(card);
  const list = document.createElement("ul");
  list.className = "nv-php-list";
  card.appendChild(list);
  state.logic.blocks.forEach((block) => {
    const li = document.createElement("li");
    li.textContent = `${block.id}: ${block.type}`;
    list.appendChild(li);
  });
}

function buildDashboardPanel(state, panel) {
  panel.innerHTML = "";
  ensureDefaultWidgets(state);
  const card = document.createElement("div");
  card.className = "nv-php-card";
  card.innerHTML = `<h3>Dashboard Widgets</h3>`;
  panel.appendChild(card);
  const list = document.createElement("ul");
  list.className = "nv-php-list";
  card.appendChild(list);
  state.dashboard.widgets.forEach((widget) => {
    const li = document.createElement("li");
    li.textContent = `${widget.id}: ${widget.type} <- ${widget.source}`;
    list.appendChild(li);
  });
}

function buildLoggerPanel(state, panel) {
  panel.innerHTML = "";
  const card = document.createElement("div");
  card.className = "nv-php-card";
  card.innerHTML = `<h3>Data Logging</h3>`;
  panel.appendChild(card);

  const fmtLabel = document.createElement("label");
  fmtLabel.className = "nv-php-label";
  fmtLabel.textContent = "Output Format";
  const fmtSelect = document.createElement("select");
  ["json", "csv", "nodevisiondb"].forEach((fmt) => {
    const o = document.createElement("option");
    o.value = fmt;
    o.textContent = fmt;
    if (fmt === state.logging.format) o.selected = true;
    fmtSelect.appendChild(o);
  });
  fmtSelect.addEventListener("change", () => {
    state.logging.format = fmtSelect.value;
  });
  fmtLabel.appendChild(fmtSelect);
  card.appendChild(fmtLabel);

  const preview = document.createElement("pre");
  preview.style.cssText = "max-height:180px;overflow:auto;background:#0f1320;color:#d8e1ff;padding:8px;font:11px/1.35 monospace;";
  card.appendChild(preview);

  const actions = document.createElement("div");
  actions.className = "nv-php-actions";
  card.appendChild(actions);

  const refresh = () => {
    if (state.logging.format === "csv") {
      preview.textContent = recordsToCsv(state.logging.records);
      return;
    }
    if (state.logging.format === "nodevisiondb") {
      preview.textContent = JSON.stringify({
        bucket: "php-editor-runtime",
        count: state.logging.records.length,
        records: state.logging.records.slice(-30)
      }, null, 2);
      return;
    }
    preview.textContent = JSON.stringify(state.logging.records.slice(-30), null, 2);
  };

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.textContent = "Clear Logs";
  clearBtn.addEventListener("click", () => {
    state.logging.records.length = 0;
    refresh();
  });
  actions.appendChild(clearBtn);

  refresh();
  return { refresh };
}

async function openPhpToolPanel(kind, state) {
  const panelId = PHP_TOOL_PANEL_INSTANCE[kind];
  if (!panelId) return null;

  const titleByKind = {
    devices: "PHP Device Management",
    logic: "PHP Logic Blocks",
    dashboard: "PHP Dashboard Config",
    logging: "PHP Data Logging"
  };

  const builderByKind = {
    devices: () => buildDeviceManagerPanel(state, content),
    logic: () => buildLogicPanel(state, content),
    dashboard: () => buildDashboardPanel(state, content),
    logging: () => buildLoggerPanel(state, content)
  };

  const existing = document.querySelector(`.panel[data-instance-id="${panelId}"]`);
  let content = existing?.querySelector?.(".panel-content");
  if (!content) {
    const panelInst = await createPanelDOM(
      "PHPToolPanel",
      panelId,
      "InfoPanel",
      { displayName: titleByKind[kind] || "PHP Tools" }
    );
    document.body.appendChild(panelInst.panel);
    panelInst.panel.__nvDefaultDockCell = (
      window.activeCell && window.activeCell.classList?.contains("panel-cell")
    ) ? window.activeCell : null;
    if (panelInst.dockBtn && typeof panelInst.dockBtn.click === "function") {
      panelInst.dockBtn.click();
    }
    panelInst.panel.style.width = "min(520px, 90vw)";
    panelInst.panel.style.height = "auto";
    panelInst.panel.style.maxHeight = "min(620px, 86vh)";
    panelInst.panel.style.left = `${Math.max(20, Math.round(window.innerWidth * 0.2))}px`;
    panelInst.panel.style.top = `${Math.max(20, Math.round(window.innerHeight * 0.12))}px`;
    panelInst.panel.style.zIndex = "23000";
    panelInst.content.style.padding = "10px";
    panelInst.content.style.background = "#f8f8f8";
    panelInst.content.style.overflow = "auto";
    panelInst.content.innerHTML = "";
    content = panelInst.content;
  }

  const builder = builderByKind[kind];
  if (typeof builder === "function") {
    return builder();
  }
  return null;
}

function mountDashboardWidgets(state, host) {
  host.innerHTML = "";
  ensureDefaultWidgets(state);
  const widgetRefs = [];
  state.dashboard.widgets.forEach((widget) => {
    const card = document.createElement("div");
    card.className = "nv-php-widget";
    const title = document.createElement("h4");
    title.textContent = `${widget.type} (${widget.source})`;
    card.appendChild(title);

    const ref = { widget, card };
    if (widget.type === "oscilloscope" || widget.type === "graph") {
      const canvas = document.createElement("canvas");
      canvas.width = 260;
      canvas.height = 80;
      canvas.className = widget.type === "oscilloscope" ? "nv-php-oscilloscope" : "nv-php-graph";
      ref.canvas = canvas;
      card.appendChild(canvas);
    } else if (widget.type === "gauge") {
      const meter = document.createElement("meter");
      meter.min = 0;
      meter.max = 100;
      meter.value = 0;
      meter.className = "nv-php-meter";
      ref.meter = meter;
      card.appendChild(meter);
      const valueLabel = document.createElement("div");
      valueLabel.textContent = "0";
      ref.valueLabel = valueLabel;
      card.appendChild(valueLabel);
    } else if (widget.type === "led") {
      const led = document.createElement("div");
      led.className = "nv-php-led";
      ref.led = led;
      card.appendChild(led);
    }
    host.appendChild(card);
    widgetRefs.push(ref);
  });
  return widgetRefs;
}

function createPreviewRenderer(state, iframe, modeBadge) {
  return function renderPreview(force = false) {
    if (!force && state.code === state.lastRenderedCode) return;
    state.lastRenderedCode = state.code;

    if (state.serverBase) {
      iframe.src = `${state.serverBase.replace(/\/+$/, "")}/${normalizePath(state.filePath)}`;
      modeBadge.textContent = "Live Preview: server render";
      return;
    }

    buildGeneratedPhp(state);
    iframe.srcdoc = buildPreviewHtml(state);
    modeBadge.textContent = "Live Preview: simulated render";
  };
}

function setupEditorUI(state, container, options = {}) {
  createStyleTagOnce();
  const root = document.createElement("div");
  root.className = "nv-php-root";
  container.innerHTML = "";
  container.appendChild(root);

  const layout = document.createElement("div");
  layout.className = "nv-php-layout";
  root.appendChild(layout);

  const left = document.createElement("section");
  left.className = "nv-php-pane";
  layout.appendChild(left);

  const right = document.createElement("section");
  right.className = "nv-php-pane";
  layout.appendChild(right);

  const status = document.createElement("div");
  status.className = "nv-php-status";
  status.textContent = "Ready.";
  root.appendChild(status);

  const editorWrap = document.createElement("div");
  editorWrap.className = "nv-php-editor-wrap";
  left.appendChild(editorWrap);

  const highlight = document.createElement("pre");
  highlight.className = "nv-php-highlight";
  highlight.innerHTML = highlightPHP(state.code);
  editorWrap.appendChild(highlight);

  const input = document.createElement("textarea");
  input.className = "nv-php-input";
  input.spellcheck = false;
  input.value = state.code;
  editorWrap.appendChild(input);

  const rightGrid = document.createElement("div");
  rightGrid.className = "nv-php-right";
  right.appendChild(rightGrid);

  const previewWrap = document.createElement("div");
  previewWrap.className = "nv-php-preview-wrap";
  rightGrid.appendChild(previewWrap);
  const previewTitle = document.createElement("div");
  previewTitle.className = "nv-php-preview-title";
  previewWrap.appendChild(previewTitle);
  const previewIframe = document.createElement("iframe");
  previewIframe.className = "nv-php-preview";
  previewWrap.appendChild(previewIframe);

  const dashWrap = document.createElement("div");
  dashWrap.className = "nv-php-dashboard-wrap";
  rightGrid.appendChild(dashWrap);
  const dashTitle = document.createElement("div");
  dashTitle.className = "nv-php-dashboard-title";
  dashTitle.textContent = "Runtime Dashboard";
  dashWrap.appendChild(dashTitle);
  const dashHost = document.createElement("div");
  dashHost.className = "nv-php-dashboard";
  dashWrap.appendChild(dashHost);

  const widgetRefs = mountDashboardWidgets(state, dashHost);
  const renderPreview = createPreviewRenderer(state, previewIframe, previewTitle);

  function syncInputScroll() {
    highlight.scrollTop = input.scrollTop;
    highlight.scrollLeft = input.scrollLeft;
  }

  input.addEventListener("scroll", syncInputScroll);
  input.addEventListener("input", () => {
    state.code = input.value;
    highlight.innerHTML = highlightPHP(state.code);
    syncInputScroll();
    renderPreview();
  });

  let commandHandler = null;
  const runtimePanelState = {
    loggingRefresh: () => {}
  };

  async function executeCommand(command) {
    if (command === "device-manager") {
      await openPhpToolPanel("devices", state);
      status.textContent = "Opened Device Management panel.";
      return;
    }
    if (command === "logic-editor") {
      await openPhpToolPanel("logic", state);
      status.textContent = "Opened Logic Blocks panel.";
      return;
    }
    if (command === "dashboard-config") {
      await openPhpToolPanel("dashboard", state);
      status.textContent = "Opened Dashboard Configuration panel.";
      return;
    }
    if (command === "data-logging") {
      const logger = await openPhpToolPanel("logging", state);
      runtimePanelState.loggingRefresh = logger?.refresh || (() => {});
      status.textContent = "Opened Data Logging panel.";
      return;
    }
    if (command === "toggle-preview") {
      state.runtimeEnabled = !state.runtimeEnabled;
      status.textContent = state.runtimeEnabled
        ? "Runtime enabled."
        : "Runtime paused.";
      renderPreview(true);
      return;
    }
    if (command === "save") {
      try {
        await saveTextFile(state.filePath, state.code);
        status.textContent = `Saved ${state.filePath}`;
      } catch (err) {
        status.textContent = `Save failed: ${err.message}`;
        console.error("PHP editor save failed:", err);
      }
    }
  }
  commandHandler = async (event) => {
    const command = event?.detail?.command;
    if (!command) return;
    await executeCommand(command);
  };
  window.addEventListener(PHP_EDITOR_COMMAND_EVENT, commandHandler);

  let rafId = 0;
  function tick() {
    const nowMs = performance.now();
    if (state.runtimeEnabled) {
      // Poll gamepad-backed devices.
      const gp = readGamepadValues();
      const runtimeContext = { gamepad: gp };
      state.deviceManager.connected.forEach((device) => {
        DEVICE_DRIVERS[device.protocol]?.poll?.(device, runtimeContext);
      });

      const logicResults = {};
      state.logic.blocks.forEach((block) => {
        logicResults[block.type] = evaluateLogicBlock(block, state, nowMs);
      });
      appendLogIfChanged(state, logicResults);

      // Update widgets.
      widgetRefs.forEach((ref) => {
        const widget = ref.widget;
        let value = 0;
        if (widget.source === "gamepad.axis0") {
          const gpDevice = state.deviceManager.connected.find((d) => d.protocol === "gamepad-api");
          value = Number(gpDevice?.values?.axes?.[0] || 0);
        } else if (widget.source === "gamepad.triggerL") {
          const gpDevice = state.deviceManager.connected.find((d) => d.protocol === "gamepad-api");
          value = Number(gpDevice?.values?.triggerL || 0);
        } else if (widget.source === "sensor.temperature") {
          const sensor = state.deviceManager.connected.find((d) => d.name === "temperature") || state.deviceManager.connected.find((d) => d.type === "sensor");
          value = Number(sensor?.values?.value || 0);
        } else if (widget.source === "logic.AND") {
          value = Boolean(state.logic.blocks.find((b) => b.type === "AND") ? 1 : 0);
        }

        if (widget.type === "oscilloscope" || widget.type === "graph") {
          widget.history.push(Number(value));
          if (widget.history.length > 90) widget.history.shift();
          drawWave(ref.canvas, widget.history, widget.type === "graph" ? "#6fa8ff" : "#39f08c");
        } else if (widget.type === "gauge") {
          const gaugeValue = Math.max(0, Math.min(100, Number(value)));
          ref.meter.value = gaugeValue;
          ref.valueLabel.textContent = `${gaugeValue.toFixed(2)}`;
        } else if (widget.type === "led") {
          ref.led.classList.toggle("on", Boolean(value));
        }
      });

      runtimePanelState.loggingRefresh();
      renderPreview();
      status.textContent = `Runtime update @ ${new Date().toLocaleTimeString()} | Devices: ${state.deviceManager.connected.length} | Logs: ${state.logging.records.length}`;
    }
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);

  renderPreview(true);

  return {
    dispose() {
      cancelAnimationFrame(rafId);
      if (commandHandler) {
        window.removeEventListener(PHP_EDITOR_COMMAND_EVENT, commandHandler);
      }
    }
  };
}

function setupEditorGlobals(state) {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.currentMode = "PHPediting";
  window.NodevisionState.activePanelType = "GraphicalEditor";
  window.NodevisionState.selectedFile = state.filePath;
  window.NodevisionState.activeEditorFilePath = state.filePath;
  updateToolbarState({
    currentMode: "PHPediting",
    activePanelType: "GraphicalEditor",
    selectedFile: state.filePath
  });

  bindSaveHooks(state);
}

async function renderInternal(filePath, container, options = {}) {
  if (!container) throw new Error("Container required");
  const state = createEditorState(filePath, options.serverBase || "");
  state.code = await fetchTextFile(filePath);
  setupEditorGlobals(state);
  ensureDefaultBlocks(state);
  ensureDefaultWidgets(state);
  createDeviceNode(state, "gamepad", "gamepad-api", "controller-1").values = {
    axes: [0, 0, 0, 0], buttons: [false, false, false, false], triggerL: 0, triggerR: 0
  };
  const instance = setupEditorUI(state, container, options);

  return {
    state,
    dispose() {
      instance?.dispose?.();
      cleanupSaveHooks();
    }
  };
}

// Graphical editor API expected by GraphicalEditor.mjs.
export async function renderEditor(filePath, container) {
  return renderInternal(filePath, container, {});
}

// Required compatibility API requested by user; aligns with many Nodevision renderFile modules.
export async function renderFile(filename, viewPanel, iframe, serverBase) {
  const host = viewPanel || iframe?.parentElement;
  if (!host) throw new Error("viewPanel required");
  return renderInternal(filename, host, { serverBase: serverBase || "" });
}
