// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewODS.mjs
// This file defines browser-side View ODS logic for the Nodevision UI. It renders interface components and handles user interactions.

import { renderFile as renderDelegate } from "./ViewSpreadsheet.mjs";

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  return renderDelegate(filename, viewPanel, iframe, serverBase);
}
