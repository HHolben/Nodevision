// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewLilyPond.mjs
// This file delegates LilyPond previews to the generic text viewer.

import { renderFile as renderDelegate } from "./ViewText.mjs";

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  return renderDelegate(filename, viewPanel, iframe, serverBase);
}
