// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewJSON.mjs
// Fetches JSON resources and renders them as a top-down tree rooted at the file node.

import { parseJsonText, renderJsonTree } from "./jsonTreeRenderer.mjs";

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  const url = `${serverBase}/${filename}`;
  viewPanel.innerHTML = "";

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await response.text();
    const data = parseJsonText(text, filename);
    renderJsonTree(viewPanel, data, { filePath: filename });
  } catch (error) {
    viewPanel.innerHTML = `<p style="color:#b00020;padding:12px;">Failed to render JSON: ${error.message}</p>`;
  }
}
