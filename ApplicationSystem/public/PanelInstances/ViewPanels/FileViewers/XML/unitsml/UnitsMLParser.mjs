// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/XML/unitsml/UnitsMLParser.mjs
// This file parses UnitsML XML into a reusable semantic unit model. It recognizes the official current UnitsML namespace, tolerates partial documents, and keeps extraction independent from viewer DOM rendering.

import { attr, childTexts, directChildrenByLocalName, elementNamespace, elementsByLocalName, firstChildText, hasNamespaceDeclaration, textOf, xmlId } from "../XmlNodeHelpers.mjs";
import { KNOWN_UNITSML_NAMESPACES, UNITSML_NAMESPACE, createEmptyUnitsMLModel } from "./UnitsMLModel.mjs";

export function isUnitsMLDocument(xmlDocument) {
  const namespace = detectUnitsMLNamespace(xmlDocument);
  if (!namespace) return false;
  return elementsByLocalName(xmlDocument, namespace, "Unit").length > 0
    || elementsByLocalName(xmlDocument, namespace, "UnitSet").length > 0
    || elementNamespace(xmlDocument.documentElement) === namespace;
}

export function detectUnitsMLNamespace(xmlDocument) {
  const root = xmlDocument?.documentElement;
  if (!root) return "";
  for (const namespace of KNOWN_UNITSML_NAMESPACES) {
    if (elementNamespace(root) === namespace || hasNamespaceDeclaration(root, namespace)) return namespace;
    if (xmlDocument.getElementsByTagNameNS?.(namespace, "Unit").length) return namespace;
    if (xmlDocument.getElementsByTagNameNS?.(namespace, "UnitSet").length) return namespace;
  }
  return "";
}

export function parseUnitsMLDocument(xmlDocument) {
  const namespace = detectUnitsMLNamespace(xmlDocument) || UNITSML_NAMESPACE;
  const model = createEmptyUnitsMLModel(namespace);
  model.dimensions = parseDimensions(xmlDocument, namespace);
  model.quantities = parseQuantities(xmlDocument, namespace);
  model.prefixes = parsePrefixes(xmlDocument, namespace);
  model.units = elementsByLocalName(xmlDocument, namespace, "Unit").map((unit) => parseUnit(unit, model, namespace));
  return model;
}

function parseUnit(unitElement, model, namespace) {
  const id = xmlId(unitElement);
  const dimensionRef = attr(unitElement, "dimensionURL");
  const unit = {
    id,
    names: childTexts(unitElement, namespace, "UnitName"),
    symbol: preferredSymbol(unitElement, namespace),
    symbols: parseSymbols(unitElement, namespace, "UnitSymbol"),
    quantityKind: attr(unitElement, "quantityKind") || attr(unitElement, "quantityURL") || "",
    dimensionRef,
    dimension: findByRef(model.dimensions, dimensionRef),
    rootUnits: parseRootUnits(unitElement, namespace),
    conversions: parseConversions(unitElement, namespace),
    definitions: childTexts(unitElement, namespace, "UnitDefinition"),
    remarks: childTexts(unitElement, namespace, "UnitRemark"),
    identifiers: parseCodeListValues(unitElement, namespace),
    references: parseReferences(unitElement, namespace)
  };
  unit.name = unit.names[0] || id || "Unnamed unit";
  unit.quantityKind = unit.quantityKind || quantityForUnit(model.quantities, id);
  return unit;
}

function parseSymbols(parent, namespace, localName) {
  return directChildrenByLocalName(parent, namespace, localName).map((element) => ({
    value: textOf(element),
    typeface: attr(element, "typeface") || attr(element, "format") || ""
  })).filter((symbol) => symbol.value);
}

function preferredSymbol(unitElement, namespace) {
  const symbols = parseSymbols(unitElement, namespace, "UnitSymbol");
  return symbols.find((symbol) => symbol.typeface.toLowerCase() === "ascii")?.value || symbols[0]?.value || "";
}

function parseRootUnits(unitElement, namespace) {
  const rootUnits = directChildrenByLocalName(unitElement, namespace, "RootUnits")[0];
  return Array.from(rootUnits?.children || []).map((element) => ({
    kind: element.localName || element.nodeName,
    unit: attr(element, "unit") || attr(element, "unitURL") || attr(element, "itemURL"),
    prefix: attr(element, "prefix"),
    powerNumerator: attr(element, "powerNumerator", "1"),
    powerDenominator: attr(element, "powerDenominator", "1")
  })).filter((entry) => entry.unit);
}

function parseConversions(unitElement, namespace) {
  const conversions = directChildrenByLocalName(unitElement, namespace, "Conversions")[0];
  return Array.from(conversions?.children || []).map((element) => ({
    type: element.localName || element.nodeName,
    id: xmlId(element),
    initialUnit: attr(element, "initialUnit"),
    finalUnit: attr(element, "finalUnit"),
    initialAddend: attr(element, "initialAddend"),
    multiplicand: attr(element, "multiplicand"),
    multiplier: attr(element, "multiplier"),
    finalAddend: attr(element, "finalAddend"),
    exact: attr(element, "exact"),
    multiplicandDigits: attr(element, "multiplicandDigits")
  }));
}

function parseDimensions(xmlDocument, namespace) {
  return elementsByLocalName(xmlDocument, namespace, "Dimension").map((element) => ({
    id: xmlId(element),
    parts: Array.from(element.children || []).map((child) => ({
      name: child.localName || child.nodeName,
      symbol: attr(child, "symbol") || child.localName || "",
      powerNumerator: attr(child, "powerNumerator", "1"),
      powerDenominator: attr(child, "powerDenominator", "1")
    }))
  }));
}

function parseQuantities(xmlDocument, namespace) {
  return elementsByLocalName(xmlDocument, namespace, "Quantity").map((element) => ({
    id: xmlId(element),
    name: firstChildText(element, namespace, "QuantityName") || xmlId(element),
    dimensionRef: attr(element, "dimensionURL"),
    unitRefs: directChildrenByLocalName(element, namespace, "UnitReference").map((ref) => attr(ref, "unitURL") || attr(ref, "unit"))
  }));
}

function parsePrefixes(xmlDocument, namespace) {
  return elementsByLocalName(xmlDocument, namespace, "Prefix").map((element) => ({
    id: xmlId(element),
    names: childTexts(element, namespace, "PrefixName"),
    symbols: parseSymbols(element, namespace, "PrefixSymbol"),
    base: attr(element, "base"),
    power: attr(element, "power")
  }));
}

function parseCodeListValues(unitElement, namespace) {
  return directChildrenByLocalName(unitElement, namespace, "CodeListValue").map((element) => ({
    value: attr(element, "unitCodeValue"),
    list: attr(element, "codeListName"),
    version: attr(element, "codeListVersion"),
    organization: attr(element, "organizationName")
  })).filter((entry) => entry.value || entry.list);
}

function parseReferences(unitElement, namespace) {
  return directChildrenByLocalName(unitElement, namespace, "Reference").map((element) => textOf(element)).filter(Boolean);
}

function findByRef(items, ref) {
  const id = String(ref || "").replace(/^#/, "");
  return items.find((item) => item.id === id) || null;
}

function quantityForUnit(quantities, unitId) {
  if (!unitId) return "";
  const ref = `#${unitId}`;
  return quantities.find((quantity) => quantity.unitRefs.includes(ref) || quantity.unitRefs.includes(unitId))?.name || "";
}
