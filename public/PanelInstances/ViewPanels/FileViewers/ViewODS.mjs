// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewODS.mjs
// This file delegates ODS previews to the spreadsheet fallback viewer.

import { renderFile as renderDelegate } from "./ViewSpreadsheet.mjs";

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  return renderDelegate(filename, viewPanel, iframe, serverBase);
}
