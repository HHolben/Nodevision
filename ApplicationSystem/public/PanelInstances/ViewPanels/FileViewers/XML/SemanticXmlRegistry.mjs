// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/XML/SemanticXmlRegistry.mjs
// This file defines the small semantic XML handler registry used by the XML viewer. Handlers advertise an id, matching function, optional parser, and renderer so future XML vocabularies can be added without rewriting ViewXML.mjs.

import { mathMLHandler } from "./handlers/MathMLHandler.mjs";
import { unitsMLHandler } from "./handlers/UnitsMLHandler.mjs";

export function createSemanticXmlRegistry(handlers = []) {
  const registryHandlers = [];
  const registry = {
    handlers: registryHandlers,
    register(handler) {
      if (!handler?.id || typeof handler.matches !== "function" || typeof handler.render !== "function") {
        throw new Error("Semantic XML handlers need id, matches(document), and render(document, context).");
      }
      registryHandlers.push(handler);
      return handler;
    }
  };
  handlers.forEach((handler) => registry.register(handler));
  return registry;
}

export function createDefaultSemanticXmlRegistry() {
  return createSemanticXmlRegistry([
    unitsMLHandler,
    mathMLHandler
  ]);
}
