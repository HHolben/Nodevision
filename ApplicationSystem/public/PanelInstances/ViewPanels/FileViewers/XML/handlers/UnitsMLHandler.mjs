// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/XML/handlers/UnitsMLHandler.mjs
// This file registers UnitsML recognition for the semantic XML viewer. It detects UnitsML from XML namespaces and structure rather than filenames, parses a reusable unit model, and delegates human-readable rendering to the UnitsML renderer.

import { isUnitsMLDocument, parseUnitsMLDocument } from "../unitsml/UnitsMLParser.mjs";
import { renderUnitsMLModel } from "../unitsml/UnitsMLRenderer.mjs";

export const unitsMLHandler = {
  id: "unitsml",
  label: "UnitsML",
  matches(xmlDocument) {
    return isUnitsMLDocument(xmlDocument);
  },
  parse(xmlDocument) {
    return parseUnitsMLDocument(xmlDocument);
  },
  render(xmlDocument, context = {}) {
    return renderUnitsMLModel(context.model || parseUnitsMLDocument(xmlDocument));
  }
};
