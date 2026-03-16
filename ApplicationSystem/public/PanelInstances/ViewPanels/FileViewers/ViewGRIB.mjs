// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewGRIB.mjs
// This file defines browser-side View GRIB logic for the Nodevision UI. It renders interface components and handles user interactions.

import { renderFile as renderDelegate } from "./ViewBinary.mjs";

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  return renderDelegate(filename, viewPanel, iframe, serverBase);
}
