// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewXMP.mjs
// This file delegates XMP previews to the XML viewer.

import { renderFile as renderDelegate } from "./ViewXML.mjs";

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  return renderDelegate(filename, viewPanel, iframe, serverBase);
}
