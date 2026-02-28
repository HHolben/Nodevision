// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewSpreadsheet.mjs
// This file provides a lightweight fallback preview for spreadsheet documents.

import { renderFile as renderBinaryFile } from "./ViewBinary.mjs";

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  await renderBinaryFile(filename, viewPanel, iframe, serverBase);

  const note = document.createElement("p");
  note.style.margin = "0 1rem 1rem 1rem";
  note.textContent = "Spreadsheet parsing is not yet enabled for this viewer.";
  viewPanel.appendChild(note);
}
