// Nodevision/ApplicationSystem/public/panels/panelZoomPan.mjs
// This module preserves the public panelZoomPan API while composing focused implementation modules.

import { setPanelViewportState, getPanelViewportState, applyPanelViewport } from "./panelZoomPanParts/viewport.mjs";
import { resetPanelViewport, fitPanelViewport, zoomPanelAt, zoomPanelBy, panPanelBy } from "./panelZoomPanParts/commands.mjs";
import { getActivePanelElement, getPanelElementFromElement, getPanelElementFromEvent } from "./panelZoomPanParts/ownership.mjs";
import { installPanelZoomShortcuts } from "./panelZoomPanParts/shortcuts.mjs";
export { getActivePanelElement, getPanelElementFromElement, getPanelElementFromEvent } from "./panelZoomPanParts/ownership.mjs";
export { getPanelViewportState, applyPanelViewport, setPanelViewportState } from "./panelZoomPanParts/viewport.mjs";
export { zoomPanelBy, zoomPanelAt, panPanelBy, resetPanelViewport, fitPanelViewport } from "./panelZoomPanParts/commands.mjs";
export { installPanelZoomShortcuts } from "./panelZoomPanParts/shortcuts.mjs";

window.NodevisionPanelViewportTools = {
  getActivePanelElement,
  getPanelElementFromElement,
  getPanelElementFromEvent,
  getPanelViewportState,
  setPanelViewportState,
  applyPanelViewport,
  zoomPanelBy,
  zoomPanelAt,
  panPanelBy,
  resetPanelViewport,
  fitPanelViewport,
  installPanelZoomShortcuts,
};
