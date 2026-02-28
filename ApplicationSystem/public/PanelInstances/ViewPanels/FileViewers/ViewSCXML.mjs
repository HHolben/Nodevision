// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewSCXML.mjs
// This file delegates SCXML previews to the XML viewer.

import { renderFile as renderDelegate } from "./ViewXML.mjs";

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  return renderDelegate(filename, viewPanel, iframe, serverBase);
}
