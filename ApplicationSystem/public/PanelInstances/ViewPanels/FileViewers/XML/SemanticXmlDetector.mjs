// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/XML/SemanticXmlDetector.mjs
// This file runs namespace and structure based semantic XML detection against the registered handlers. It keeps detection independent from rendering so machine-readable models can be queried later without scraping UI output.

export function detectSemanticXml(xmlDocument, registry, context = {}) {
  if (!xmlDocument?.documentElement || !registry?.handlers?.length) return [];
  const matches = [];
  for (const handler of registry.handlers) {
    try {
      if (handler.matches(xmlDocument, context)) matches.push(handler);
    } catch (error) {
      console.warn(`[SemanticXML] Handler ${handler.id} failed during matching:`, error);
    }
  }
  return matches;
}

export function buildSemanticXmlResults(xmlDocument, handlers, context = {}) {
  return handlers.map((handler) => ({
    handler,
    model: parseHandlerModel(handler, xmlDocument, context)
  }));
}

function parseHandlerModel(handler, xmlDocument, context) {
  if (typeof handler.parse !== "function") return null;
  try {
    return handler.parse(xmlDocument, context);
  } catch (error) {
    console.warn(`[SemanticXML] Handler ${handler.id} failed during parsing:`, error);
    return { error: error.message || String(error) };
  }
}
