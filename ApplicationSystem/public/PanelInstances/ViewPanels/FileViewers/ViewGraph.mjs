// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewGraph.mjs
// This file delegates graph markup previews to the generic text viewer.

import { renderFile as renderDelegate } from "./ViewText.mjs";

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  return renderDelegate(filename, viewPanel, iframe, serverBase);
}
