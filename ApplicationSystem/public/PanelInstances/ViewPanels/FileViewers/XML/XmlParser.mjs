// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/XML/XmlParser.mjs
// This file provides the XML viewer's safe browser parsing entry point. It keeps the original source text intact, reports parser errors without throwing away source access, and avoids any custom entity loading or executable markup evaluation.

export function parseXmlText(source, parser = null) {
  const text = String(source ?? "");
  const activeParser = parser || createDomParser();
  const xmlDocument = activeParser.parseFromString(text, "application/xml");
  const parserError = getXmlParserError(xmlDocument);
  return {
    source: text,
    document: xmlDocument,
    ok: !parserError,
    errorMessage: parserError?.textContent?.trim() || "",
    hasDoctype: /<!DOCTYPE\s+/i.test(text)
  };
}

export function getXmlParserError(xmlDocument) {
  if (!xmlDocument) return null;
  const byName = xmlDocument.getElementsByTagName?.("parsererror")?.[0] || null;
  if (byName) return byName;
  const all = xmlDocument.getElementsByTagName?.("*") || [];
  for (const element of all) {
    if (element.localName === "parsererror") return element;
  }
  return null;
}

function createDomParser() {
  if (typeof DOMParser !== "function") {
    throw new Error("DOMParser is unavailable in this environment.");
  }
  return new DOMParser();
}
