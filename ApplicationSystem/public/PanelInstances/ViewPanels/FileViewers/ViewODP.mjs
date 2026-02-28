// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewODP.mjs
// This file delegates ODP previews to the archive fallback viewer.

import { renderFile as renderDelegate } from "./ViewArchive.mjs";

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  return renderDelegate(filename, viewPanel, iframe, serverBase);
}
