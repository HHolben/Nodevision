// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/MetaWorldLayersPanel.mjs
// This panel inherits the shared SVG Layers panel shell for MetaWorld layer editing. The module selects the MetaWorld provider so the panel stays identical to Nodevision layers panels.

import { setupPanel as setupSharedLayersPanel } from "/PanelInstances/InfoPanels/SVGLayersPanel.mjs";
import { ensureMetaWorldLayersContext } from "/MetaWorld/MetaWorldLayerState.mjs";

export async function setupPanel(panel, instanceVars = {}) {
  ensureMetaWorldLayersContext();
  return setupSharedLayersPanel(panel, {
    ...instanceVars,
    providerId: "metaworld",
    displayName: instanceVars.displayName || "MetaWorld Layers",
  });
}
