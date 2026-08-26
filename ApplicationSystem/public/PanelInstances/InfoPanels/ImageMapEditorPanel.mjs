// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/ImageMapEditorPanel.mjs
// This panel module hosts the reusable image-map editor inside Nodevision's existing overlay panel shell.

import { mountImageMapOverlay } from "/PanelInstances/Common/ImageMap/ImageMapOverlay.mjs";

export function createPanel(content, vars = {}) {
  const mounted = mountImageMapOverlay(content, vars);
  content.__nvImageMapOverlayCleanup = () => mounted.destroy?.();
}
