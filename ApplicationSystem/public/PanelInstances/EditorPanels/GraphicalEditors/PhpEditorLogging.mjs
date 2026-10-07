// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/PhpEditorLogging.mjs
// This module captures changed runtime values and renders the PHP logging configuration panel.
import { nowIso } from './PhpEditorDevices.mjs';

export function getDeviceSnapshot(state) {
  const snapshot = {};
  for (const device of state.deviceManager.connected) {
    snapshot[device.id] = { ...device.values };
  }
  return snapshot;
}

export function appendLogIfChanged(state, logicResults) {
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

export function recordsToCsv(records) {
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

export function buildLoggerPanel(state, panel) {
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
