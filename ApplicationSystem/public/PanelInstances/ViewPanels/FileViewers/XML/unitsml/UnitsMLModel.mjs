// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/XML/unitsml/UnitsMLModel.mjs
// This file defines UnitsML namespace constants and the reusable semantic model shape exposed by the XML viewer. The model is intentionally UI-neutral so later calculators or science tools can consume parsed unit definitions directly.

export const UNITSML_NAMESPACE = "https://schema.unitsml.org/unitsml/1.0";
export const UNITSML_SCHEMA_LOCATION = "https://schema.unitsml.org/unitsml/unitsml-v1.0.xsd";
export const LEGACY_UNITSML_NAMESPACES = [
  "urn:oasis:names:tc:unitsml:schema:xsd:UnitsMLSchema-1.0",
  "urn:oasis:names:tc:unitsml:schema:xsd:UnitsMLSchema-0.9.19",
  "urn:oasis:names:tc:unitsml:schema:xsd:UnitsMLSchema-0.9.18"
];
export const KNOWN_UNITSML_NAMESPACES = [UNITSML_NAMESPACE, ...LEGACY_UNITSML_NAMESPACES];

export function createEmptyUnitsMLModel(namespace = UNITSML_NAMESPACE) {
  return {
    vocabulary: "UnitsML",
    namespace,
    units: [],
    dimensions: [],
    quantities: [],
    prefixes: []
  };
}
