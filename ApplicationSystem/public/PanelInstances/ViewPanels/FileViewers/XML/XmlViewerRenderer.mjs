// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/XML/XmlViewerRenderer.mjs
// This file orchestrates XML viewer rendering after a file has been fetched and parsed. It coordinates semantic detection, safe rendered panes, generic structure display, and unchanged source display without tying any vocabulary parser directly to the UI shell.

import { detectSemanticXml, buildSemanticXmlResults } from "./SemanticXmlDetector.mjs";
import { createXmlSourceView } from "./XmlSourceView.mjs";
import { createXmlStructureView } from "./XmlStructureView.mjs";
import { createXmlViewerLayout } from "./XmlViewerLayout.mjs";

export function renderXmlViewer(parseResult, viewPanel, options = {}) {
  const registry = options.registry;
  const semanticHandlers = parseResult.ok ? detectSemanticXml(parseResult.document, registry, options) : [];
  const semanticResults = buildSemanticXmlResults(parseResult.document, semanticHandlers, options);
  const panes = {
    rendered: createRenderedPane(parseResult, semanticResults, options),
    structure: parseResult.ok ? createXmlStructureView(parseResult.document) : createParserErrorPane(parseResult),
    source: createXmlSourceView(parseResult.source)
  };
  const activeMode = parseResult.ok && semanticResults.length ? "rendered" : "source";
  const warning = parseResult.ok ? doctypeWarning(parseResult) : "XML parser warning";

  publishSemanticModels(options.filename, parseResult.source, semanticResults);
  viewPanel.textContent = "";
  viewPanel.appendChild(createXmlViewerLayout({ panes, activeMode, warning }));
}

function createRenderedPane(parseResult, semanticResults, options) {
  const pane = document.createElement("div");
  pane.style.cssText = "padding:1rem;display:flex;flex-direction:column;gap:1rem;";
  if (!parseResult.ok) return createParserErrorPane(parseResult);
  if (!semanticResults.length) {
    pane.appendChild(message("No known semantic XML vocabulary was detected. Use Structure or Source for the generic XML view."));
    return pane;
  }
  for (const result of semanticResults) {
    const rendered = renderSemanticResult(result, parseResult.document, options);
    if (rendered) pane.appendChild(rendered);
  }
  return pane;
}

function renderSemanticResult(result, xmlDocument, options) {
  try {
    return result.handler.render(xmlDocument, { ...options, model: result.model });
  } catch (error) {
    const block = message(`${result.handler.id} renderer failed: ${error.message || error}`);
    block.style.color = "#b00020";
    return block;
  }
}

function createParserErrorPane(parseResult) {
  const pane = document.createElement("div");
  pane.style.cssText = "padding:1rem;color:#92400e;font:13px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;";
  pane.textContent = parseResult.errorMessage || "The XML parser reported a syntax warning while rendering.";
  return pane;
}

function message(text) {
  const div = document.createElement("div");
  div.style.cssText = "color:#374151;font:14px/1.45 system-ui,sans-serif;";
  div.textContent = text;
  return div;
}

function doctypeWarning(parseResult) {
  return parseResult.hasDoctype ? "DOCTYPE shown as source only; external entities are not loaded." : "";
}

function publishSemanticModels(filename, source, semanticResults) {
  if (typeof window === "undefined") return;
  window.NodevisionSemanticXmlLastResult = {
    filename,
    source,
    handlers: semanticResults.map((result) => result.handler.id),
    models: Object.fromEntries(semanticResults.map((result) => [result.handler.id, result.model]))
  };
}
