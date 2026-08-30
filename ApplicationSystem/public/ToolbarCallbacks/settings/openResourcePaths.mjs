// Nodevision/ApplicationSystem/public/ToolbarCallbacks/settings/openResourcePaths.mjs
// This toolbar callback opens the Resources settings panel as a Nodevision overlay.

import { openNodevisionOverlayPanel } from "/TemplateSystem/NodevisionOverlayPanel.mjs";

export default async function openResourcePaths() {
  await openNodevisionOverlayPanel("ResourcePathsPanel", { displayName: "Resources" }, { panelClass: "InfoPanel" });
}
