// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewEPUB.mjs
// This file delegates EPUB previews to the archive fallback viewer.

import { renderFile as renderDelegate } from "./ViewArchive.mjs";

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  return renderDelegate(filename, viewPanel, iframe, serverBase);
}
