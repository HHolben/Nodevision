// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewGPS.mjs
// This file delegates GPS log previews to the generic text viewer.

import { renderFile as renderDelegate } from "./ViewText.mjs";

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  return renderDelegate(filename, viewPanel, iframe, serverBase);
}
