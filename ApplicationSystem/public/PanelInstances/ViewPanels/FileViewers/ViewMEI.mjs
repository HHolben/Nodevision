// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewMEI.mjs
// This file delegates MEI previews to the XML viewer.

import { renderFile as renderDelegate } from "./ViewXML.mjs";

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  return renderDelegate(filename, viewPanel, iframe, serverBase);
}
