// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/zoomPanControlsWidget.mjs
// Sub-toolbar widget for View -> Zoom and Pan panel-scoped controls.

import {
  getActivePanelElement,
  getPanelViewportState,
  setPanelViewportState,
  zoomPanelBy,
  panPanelBy,
  resetPanelViewport,
  fitPanelViewport,
} from "/panels/panelZoomPan.mjs";

const WIDGET_KEY = "__nvZoomPanWidget";
const PAN_MIN = -4000;
const PAN_MAX = 4000;

function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function render(hostElement) {
  hostElement.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:nowrap;white-space:nowrap;font:12px system-ui, -apple-system, Segoe UI, sans-serif;">
      <span data-nv-zp-panel style="min-width:160px;max-width:220px;overflow:hidden;text-overflow:ellipsis;">Panel: (none)</span>

      <button type="button" data-nv-zp-action="zoom-out" style="height:26px;padding:0 8px;">-</button>
      <label style="display:flex;align-items:center;gap:6px;">
        Zoom %
        <input data-nv-zp-zoom type="number" min="10" max="800" step="1" style="width:72px;height:24px;" />
      </label>
      <input data-nv-zp-zoom-range type="range" min="10" max="800" step="1" style="width:140px;" />
      <button type="button" data-nv-zp-action="zoom-in" style="height:26px;padding:0 8px;">+</button>

      <label style="display:flex;align-items:center;gap:6px;">
        Pan X
        <input data-nv-zp-panx type="number" min="-4000" max="4000" step="1" style="width:74px;height:24px;" />
      </label>
      <input data-nv-zp-panx-range type="range" min="-4000" max="4000" step="1" style="width:120px;" />
      <label style="display:flex;align-items:center;gap:6px;">
        Pan Y
        <input data-nv-zp-pany type="number" min="-4000" max="4000" step="1" style="width:74px;height:24px;" />
      </label>
      <input data-nv-zp-pany-range type="range" min="-4000" max="4000" step="1" style="width:120px;" />
      <label style="display:flex;align-items:center;gap:6px;">
        Step
        <input data-nv-zp-step type="number" min="1" max="500" step="1" value="20" style="width:60px;height:24px;" />
      </label>

      <button type="button" data-nv-zp-action="pan-left" style="height:26px;padding:0 8px;">◀</button>
      <button type="button" data-nv-zp-action="pan-right" style="height:26px;padding:0 8px;">▶</button>
      <button type="button" data-nv-zp-action="pan-up" style="height:26px;padding:0 8px;">▲</button>
      <button type="button" data-nv-zp-action="pan-down" style="height:26px;padding:0 8px;">▼</button>

      <button type="button" data-nv-zp-action="fit" style="height:26px;padding:0 10px;">Fit</button>
      <button type="button" data-nv-zp-action="reset" style="height:26px;padding:0 10px;">Reset</button>
    </div>
  `;
}

function readStep(hostElement) {
  const input = hostElement.querySelector("[data-nv-zp-step]");
  return clamp(input?.value, 1, 500, 20);
}

function syncInputs(hostElement) {
  const panelLabel = hostElement.querySelector("[data-nv-zp-panel]");
  const zoomInput = hostElement.querySelector("[data-nv-zp-zoom]");
  const zoomRange = hostElement.querySelector("[data-nv-zp-zoom-range]");
  const panXInput = hostElement.querySelector("[data-nv-zp-panx]");
  const panXRange = hostElement.querySelector("[data-nv-zp-panx-range]");
  const panYInput = hostElement.querySelector("[data-nv-zp-pany]");
  const panYRange = hostElement.querySelector("[data-nv-zp-pany-range]");
  const activePanel = getActivePanelElement();

  if (!activePanel) {
    if (panelLabel) panelLabel.textContent = "Panel: (none)";
    if (zoomInput) zoomInput.value = "100";
    if (zoomRange) zoomRange.value = "100";
    if (panXInput) panXInput.value = "0";
    if (panXRange) panXRange.value = "0";
    if (panYInput) panYInput.value = "0";
    if (panYRange) panYRange.value = "0";
    return;
  }

  const name =
    activePanel.dataset?.id ||
    activePanel.dataset?.instanceName ||
    activePanel.dataset?.instanceId ||
    activePanel.dataset?.panelClass ||
    "Panel";
  if (panelLabel) {
    panelLabel.textContent = `Panel: ${name}`;
    panelLabel.title = name;
  }

  const state = getPanelViewportState(activePanel) || { zoom: 1, panX: 0, panY: 0 };
  const zoomPct = Math.round((state.zoom || 1) * 100);
  if (zoomInput) zoomInput.value = String(zoomPct);
  if (zoomRange) zoomRange.value = String(zoomPct);
  const panX = Math.round(state.panX || 0);
  const panY = Math.round(state.panY || 0);
  if (panXInput) panXInput.value = String(panX);
  if (panXRange) panXRange.value = String(clamp(panX, PAN_MIN, PAN_MAX, 0));
  if (panYInput) panYInput.value = String(panY);
  if (panYRange) panYRange.value = String(clamp(panY, PAN_MIN, PAN_MAX, 0));
}

function applyFromInputs(hostElement) {
  const activePanel = getActivePanelElement();
  if (!activePanel) return;

  const zoomInput = hostElement.querySelector("[data-nv-zp-zoom]");
  const panXInput = hostElement.querySelector("[data-nv-zp-panx]");
  const panYInput = hostElement.querySelector("[data-nv-zp-pany]");

  const zoomPct = clamp(zoomInput?.value, 10, 800, 100);
  const panX = clamp(panXInput?.value, PAN_MIN, PAN_MAX, 0);
  const panY = clamp(panYInput?.value, PAN_MIN, PAN_MAX, 0);

  setPanelViewportState({
    zoom: zoomPct / 100,
    panX,
    panY,
  }, activePanel);
  syncInputs(hostElement);
}

function bind(hostElement) {
  const zoomInput = hostElement.querySelector("[data-nv-zp-zoom]");
  const zoomRange = hostElement.querySelector("[data-nv-zp-zoom-range]");
  const panXInput = hostElement.querySelector("[data-nv-zp-panx]");
  const panXRange = hostElement.querySelector("[data-nv-zp-panx-range]");
  const panYInput = hostElement.querySelector("[data-nv-zp-pany]");
  const panYRange = hostElement.querySelector("[data-nv-zp-pany-range]");

  if (zoomRange && zoomInput) {
    zoomRange.addEventListener("input", () => {
      zoomInput.value = zoomRange.value;
      applyFromInputs(hostElement);
    });
  }

  if (zoomInput && zoomRange) {
    zoomInput.addEventListener("input", () => {
      const raw = Number(zoomInput.value);
      if (!Number.isFinite(raw)) return;
      const v = clamp(raw, 10, 800, 100);
      zoomRange.value = String(v);
      applyFromInputs(hostElement);
    });
    zoomInput.addEventListener("change", () => {
      const v = clamp(zoomInput.value, 10, 800, 100);
      zoomInput.value = String(v);
      zoomRange.value = String(v);
      applyFromInputs(hostElement);
    });
    zoomInput.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") {
        evt.preventDefault();
        zoomInput.blur();
      }
    });
  }

  if (panXRange && panXInput) {
    panXRange.addEventListener("input", () => {
      panXInput.value = panXRange.value;
      applyFromInputs(hostElement);
    });
  }
  if (panXInput) {
    panXInput.addEventListener("input", () => {
      const raw = Number(panXInput.value);
      if (!Number.isFinite(raw)) return;
      if (panXRange) panXRange.value = String(clamp(raw, PAN_MIN, PAN_MAX, 0));
      applyFromInputs(hostElement);
    });
    panXInput.addEventListener("change", () => {
      const v = clamp(panXInput.value, PAN_MIN, PAN_MAX, 0);
      panXInput.value = String(v);
      if (panXRange) panXRange.value = String(v);
      applyFromInputs(hostElement);
    });
    panXInput.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") {
        evt.preventDefault();
        panXInput.blur();
      }
    });
  }
  if (panYRange && panYInput) {
    panYRange.addEventListener("input", () => {
      panYInput.value = panYRange.value;
      applyFromInputs(hostElement);
    });
  }
  if (panYInput) {
    panYInput.addEventListener("input", () => {
      const raw = Number(panYInput.value);
      if (!Number.isFinite(raw)) return;
      if (panYRange) panYRange.value = String(clamp(raw, PAN_MIN, PAN_MAX, 0));
      applyFromInputs(hostElement);
    });
    panYInput.addEventListener("change", () => {
      const v = clamp(panYInput.value, PAN_MIN, PAN_MAX, 0);
      panYInput.value = String(v);
      if (panYRange) panYRange.value = String(v);
      applyFromInputs(hostElement);
    });
    panYInput.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") {
        evt.preventDefault();
        panYInput.blur();
      }
    });
  }

  hostElement.addEventListener("click", (evt) => {
    const action = evt.target?.closest?.("[data-nv-zp-action]")?.dataset?.nvZpAction;
    if (!action) return;
    evt.preventDefault();
    const panel = getActivePanelElement();
    if (!panel) return;

    const panStep = readStep(hostElement);
    switch (action) {
      case "zoom-in":
        zoomPanelBy(0.1, panel);
        break;
      case "zoom-out":
        zoomPanelBy(-0.1, panel);
        break;
      case "pan-left":
        panPanelBy(-panStep, 0, panel);
        break;
      case "pan-right":
        panPanelBy(panStep, 0, panel);
        break;
      case "pan-up":
        panPanelBy(0, -panStep, panel);
        break;
      case "pan-down":
        panPanelBy(0, panStep, panel);
        break;
      case "fit":
        fitPanelViewport(panel);
        break;
      case "reset":
        resetPanelViewport(panel);
        break;
    }
    syncInputs(hostElement);
  });
}

export function initToolbarWidget(hostElement) {
  if (!hostElement) return;

  const state = window[WIDGET_KEY] || {};
  window[WIDGET_KEY] = state;
  state.hostElement = hostElement;

  render(hostElement);
  bind(hostElement);
  syncInputs(hostElement);

  if (!state.listenersBound) {
    const syncLive = () => {
      const host = window[WIDGET_KEY]?.hostElement;
      if (!host || !host.isConnected) return;
      syncInputs(host);
    };
    window.addEventListener("activePanelChanged", syncLive);
    window.addEventListener("nv-panel-zoom-pan-updated", syncLive);
    state.listenersBound = true;
  }
}
