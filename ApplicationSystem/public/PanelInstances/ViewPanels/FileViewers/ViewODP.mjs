// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewODP.mjs
// This file defines browser-side View ODP logic for the Nodevision UI. It renders interface components and handles user interactions.

import { renderFile as renderDelegate } from "./ViewArchive.mjs";

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  return renderDelegate(filename, viewPanel, iframe, serverBase);
}
