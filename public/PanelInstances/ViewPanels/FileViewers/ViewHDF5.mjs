// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewHDF5.mjs
// This file delegates HDF5 previews to the binary fallback viewer.

import { renderFile as renderDelegate } from "./ViewBinary.mjs";

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  return renderDelegate(filename, viewPanel, iframe, serverBase);
}
