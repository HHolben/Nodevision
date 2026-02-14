// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewGPX.mjs
// This file delegates GPX previews to the XML viewer.

import { renderFile as renderDelegate } from "./ViewXML.mjs";

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  return renderDelegate(filename, viewPanel, iframe, serverBase);
}
