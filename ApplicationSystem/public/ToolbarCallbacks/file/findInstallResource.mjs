// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/findInstallResource.mjs
// Opens the standalone shared Resource Acquisition panel.

import { openNodevisionOverlayPanel } from "/TemplateSystem/NodevisionOverlayPanel.mjs";

export default async function findInstallResource() {
  await openNodevisionOverlayPanel("ResourceAcquisitionPanel", {
    displayName: "Find / Install Resource",
  }, { panelClass: "InfoPanel" });
}
