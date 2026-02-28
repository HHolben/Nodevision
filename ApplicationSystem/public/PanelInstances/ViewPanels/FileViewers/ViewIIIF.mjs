// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewIIIF.mjs
// This file delegates IIIF metadata previews to the JSON viewer.

import { renderFile as renderDelegate } from "./ViewJSON.mjs";

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  return renderDelegate(filename, viewPanel, iframe, serverBase);
}
