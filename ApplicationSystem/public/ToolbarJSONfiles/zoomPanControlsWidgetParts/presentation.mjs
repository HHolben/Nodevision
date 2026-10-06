// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/zoomPanControlsWidgetParts/presentation.mjs
// This module renders the zoom and pan controls and synchronizes their values with the active panel.

import { getActivePanelElement } from "/panels/panelZoomPan.mjs";
import { getPanelZoomState, executePanelZoom, getPanelZoomCapabilities, getPanelZoomMetadata } from "../../panels/panelZoomCapabilities.mjs";

export const PAN_MIN = -4000;

export const PAN_MAX = 4000;

export function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function render(hostElement) {
  hostElement.setAttribute("data-nv-zoom-toolbar", "true");
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

export function readStep(hostElement) {
  const input = hostElement.querySelector("[data-nv-zp-step]");
  return clamp(input?.value, 1, 500, 20);
}

export function syncInputs(hostElement) {
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

  const state = getPanelZoomState(activePanel) || { zoom: 1, panX: 0, panY: 0 };
  const capabilities = getPanelZoomCapabilities(activePanel);
  const actions = getPanelZoomMetadata(activePanel, 'geometric')?.actions || [];
  for (const input of [zoomInput, zoomRange]) if (input) input.disabled = !capabilities.geometric || !Number.isFinite(state.zoom);
  for (const input of [panXInput, panXRange, panYInput, panYRange]) if (input) input.disabled = !actions.includes('pan');
  for (const button of hostElement.querySelectorAll('[data-nv-zp-action]')) {
    const action = button.dataset.nvZpAction;
    button.disabled = !capabilities.geometric || (action.startsWith('pan-') ? !actions.includes('pan') : action === 'fit' && !actions.includes('fit'));
  }
  if (state.fontSize && panelLabel) panelLabel.textContent += ` — ${state.fontSize}px text`;
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

export function applyFromInputs(hostElement) {
  const activePanel = getActivePanelElement();
  if (!activePanel) return;

  const zoomInput = hostElement.querySelector("[data-nv-zp-zoom]");
  const panXInput = hostElement.querySelector("[data-nv-zp-panx]");
  const panYInput = hostElement.querySelector("[data-nv-zp-pany]");

  const zoomPct = clamp(zoomInput?.value, 10, 800, 100);
  const panX = clamp(panXInput?.value, PAN_MIN, PAN_MAX, 0);
  const panY = clamp(panYInput?.value, PAN_MIN, PAN_MAX, 0);

  const command = { action: "set", zoom: zoomPct / 100, panX, panY };
  executePanelZoom(activePanel, "geometric", command);
  syncInputs(hostElement);
}
