// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewXML.mjs
// This file fetches XML-like Notebook files for the File View panel and delegates parsing, semantic detection, structured rendering, and source rendering to shared XML viewer modules so ordinary XML remains generic while recognized vocabularies can render human-readable content.

import { parseXmlText } from "./XML/XmlParser.mjs";
import { createDefaultSemanticXmlRegistry } from "./XML/SemanticXmlRegistry.mjs";
import { renderXmlViewer } from "./XML/XmlViewerRenderer.mjs";

export async function renderFile(filename, viewPanel, iframe, serverBase = "/Notebook") {
  const url = `${serverBase}/${filename}`;
  viewPanel.textContent = "";

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const source = await response.text();
    const parseResult = parseXmlText(source);
    renderXmlViewer(parseResult, viewPanel, {
      filename,
      registry: createDefaultSemanticXmlRegistry()
    });
  } catch (error) {
    viewPanel.textContent = "";
    const message = document.createElement("p");
    message.style.cssText = "color:#b00020;padding:1rem;font:13px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;";
    message.textContent = `Failed to render XML: ${error.message}`;
    viewPanel.appendChild(message);
  }
}
