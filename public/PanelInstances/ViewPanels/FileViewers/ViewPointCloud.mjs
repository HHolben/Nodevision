// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewPointCloud.mjs
// This file delegates point-cloud previews to the binary fallback viewer.

import { renderFile as renderDelegate } from "./ViewBinary.mjs";

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  return renderDelegate(filename, viewPanel, iframe, serverBase);
}
