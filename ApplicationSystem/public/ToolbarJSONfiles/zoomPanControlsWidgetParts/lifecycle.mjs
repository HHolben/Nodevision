// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/zoomPanControlsWidgetParts/lifecycle.mjs
// This module mounts the zoom and pan toolbar widget and maintains its shared activation listeners.

import { render, syncInputs } from "./presentation.mjs";
import { bind } from "./bindings.mjs";
import { appendPanelZoomModeControls } from "../panelZoomModesWidget.mjs";
import { getActiveZoomTarget as getActivePanelElement } from "/panels/applicationZoom.mjs";

export const WIDGET_KEY = "__nvZoomPanWidget";

export function initToolbarWidget(hostElement) {
  if (!hostElement) return;

  const state = window[WIDGET_KEY] || {};
  window[WIDGET_KEY] = state;
  state.hostElement = hostElement;

  render(hostElement);
  bind(hostElement);
  state.syncModes = appendPanelZoomModeControls(hostElement, getActivePanelElement);
  syncInputs(hostElement);

  if (!state.listenersBound) {
    const syncLive = () => {
      const host = window[WIDGET_KEY]?.hostElement;
      if (!host || !host.isConnected) return;
      syncInputs(host);
      window[WIDGET_KEY]?.syncModes?.();
    };
    window.addEventListener("activePanelChanged", syncLive);
    window.addEventListener("nv-panel-zoom-capabilities-changed", syncLive);
    window.addEventListener("nv-panel-zoom-pan-updated", syncLive);
    state.listenersBound = true;
  }
}
