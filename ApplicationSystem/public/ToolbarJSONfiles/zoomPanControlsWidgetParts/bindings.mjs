// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/zoomPanControlsWidgetParts/bindings.mjs
// This module binds zoom and pan toolbar controls to the existing viewport and capability commands.

import { applyFromInputs, clamp, PAN_MIN, PAN_MAX, readStep, syncInputs } from "./presentation.mjs";
import { getActivePanelElement } from "/panels/panelZoomPan.mjs";
import { executePanelZoom } from "../../panels/panelZoomCapabilities.mjs";

export function bind(hostElement) {
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
        executePanelZoom(panel, "geometric", { action: "zoom", factor: 1.1 });
        break;
      case "zoom-out":
        executePanelZoom(panel, "geometric", { action: "zoom", factor: 1 / 1.1 });
        break;
      case "pan-left":
        executePanelZoom(panel, "geometric", { action: "pan", dx: -panStep, dy: 0 });
        break;
      case "pan-right":
        executePanelZoom(panel, "geometric", { action: "pan", dx: panStep, dy: 0 });
        break;
      case "pan-up":
        executePanelZoom(panel, "geometric", { action: "pan", dx: 0, dy: -panStep });
        break;
      case "pan-down":
        executePanelZoom(panel, "geometric", { action: "pan", dx: 0, dy: panStep });
        break;
      case "fit":
        executePanelZoom(panel, "geometric", { action: "fit" });
        break;
      case "reset":
        executePanelZoom(panel, "geometric", { action: "reset" });
        break;
    }
    syncInputs(hostElement);
  });
}
