// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewPDF.mjs
// This file mounts the native Nodevision PDF viewer. The shared PDF workspace renders pages through PDF.js when available and overlays saved Nodevision annotations.

import { renderPdfWorkspace } from "./PDF/PDFOverlayEditor.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  console.log("ViewPDF: initializing for", filename);

  if (!filename || !filename.toLowerCase().endsWith(".pdf")) {
    viewPanel.innerHTML = `<p>No PDF file selected.</p>`;
    return;
  }

  viewPanel.innerHTML = "";
  const container = document.createElement("div");
  Object.assign(container.style, {
    width: "100%",
    height: "100%",
    minHeight: "0",
  });
  viewPanel.appendChild(container);

  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.currentMode = "PDF Viewing";
  window.NodevisionState.selectedFile = filename;
  window.NodevisionState.activeFileViewPath = filename;
  window.currentActiveFilePath = filename;
  window.filePath = filename;
  updateToolbarState({ currentMode: "PDF Viewing", selectedFile: filename, activeFileViewPath: filename });

  await renderPdfWorkspace(filename, container, { editable: false });
  return true;
}
