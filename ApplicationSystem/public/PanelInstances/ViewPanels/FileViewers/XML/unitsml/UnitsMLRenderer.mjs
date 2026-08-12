// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/XML/unitsml/UnitsMLRenderer.mjs
// This file renders parsed UnitsML semantic models as human-readable DOM. It builds notation from the parsed model and native MathML elements while leaving the user's XML source untouched.

import { MATHML_NAMESPACE } from "../mathml/SafeMathMLRenderer.mjs";
import { formatConversion, formatDimension, formatRootUnitExpression, plainRootUnitLabel } from "./UnitsMLFormatting.mjs";

export function renderUnitsMLModel(model) {
  const section = document.createElement("section");
  section.style.cssText = "border:1px solid #d1d5db;border-radius:6px;padding:1rem;background:#fff;";
  section.appendChild(title("UnitsML"));
  if (model?.error) {
    section.appendChild(field("Parser", model.error));
    return section;
  }
  if (!model?.units?.length) {
    section.appendChild(field("Units", "No Unit elements were found."));
    return section;
  }
  model.units.forEach((unit) => section.appendChild(renderUnit(unit)));
  return section;
}

function renderUnit(unit) {
  const block = document.createElement("article");
  block.style.cssText = "padding:0.75rem 0;border-top:1px solid #eef2f7;";
  block.appendChild(title(unit.name || "Unnamed unit", "h3"));
  appendIf(block, "Symbol", unit.symbol);
  appendIf(block, "Identifier", unit.id);
  appendIf(block, "Quantity", unit.quantityKind);
  appendIf(block, "Dimension", formatDimension(unit.dimension) || unit.dimensionRef);
  appendDefinition(block, unit);
  appendList(block, "Definitions", unit.definitions);
  appendList(block, "Conversions", unit.conversions.map(formatConversion));
  appendList(block, "Identifiers", unit.identifiers.map(formatIdentifier));
  appendList(block, "References", unit.references);
  appendList(block, "Remarks", unit.remarks);
  return block;
}

function appendDefinition(block, unit) {
  if (!unit.rootUnits?.length) return;
  const row = document.createElement("div");
  row.style.cssText = "margin:0.4rem 0;display:flex;gap:0.5rem;align-items:baseline;flex-wrap:wrap;";
  const label = document.createElement("strong");
  label.textContent = "Definition:";
  row.appendChild(label);
  const prefix = document.createElement("span");
  prefix.textContent = `1 ${unit.symbol || unit.name} = `;
  row.appendChild(prefix);
  row.appendChild(createRootUnitsMath(unit.rootUnits));
  block.appendChild(row);
}

function createRootUnitsMath(rootUnits) {
  const math = document.createElementNS(MATHML_NAMESPACE, "math");
  math.setAttribute("display", "inline");
  const row = document.createElementNS(MATHML_NAMESPACE, "mrow");
  rootUnits.forEach((entry, index) => {
    if (index) row.appendChild(mathText("mo", "·"));
    appendUnitMath(row, entry);
  });
  math.appendChild(row);
  math.title = formatRootUnitExpression(rootUnits);
  return math;
}

function appendUnitMath(row, entry) {
  const power = String(entry.powerNumerator || "1");
  const denominator = String(entry.powerDenominator || "1");
  if (power === "1" && denominator === "1") {
    row.appendChild(mathText("mi", plainRootUnitLabel({ ...entry, powerNumerator: "1", powerDenominator: "1" })));
    return;
  }
  const sup = document.createElementNS(MATHML_NAMESPACE, "msup");
  sup.appendChild(mathText("mi", plainRootUnitLabel({ ...entry, powerNumerator: "1", powerDenominator: "1" })));
  sup.appendChild(mathText("mn", denominator === "1" ? power : `${power}/${denominator}`));
  row.appendChild(sup);
}

function mathText(localName, value) {
  const element = document.createElementNS(MATHML_NAMESPACE, localName);
  element.textContent = value;
  return element;
}

function appendIf(block, label, value) {
  if (value) block.appendChild(field(label, value));
}

function appendList(block, label, values = []) {
  const clean = values.filter(Boolean);
  if (!clean.length) return;
  block.appendChild(field(label, clean.join("; ")));
}

function field(label, value) {
  const div = document.createElement("div");
  div.style.cssText = "margin:0.25rem 0;font:14px/1.45 system-ui,sans-serif;";
  const strong = document.createElement("strong");
  strong.textContent = `${label}: `;
  div.appendChild(strong);
  div.appendChild(document.createTextNode(value));
  return div;
}

function title(text, tag = "h2") {
  const heading = document.createElement(tag);
  heading.style.cssText = tag === "h2" ? "margin:0 0 0.75rem 0;font:600 18px/1.3 system-ui,sans-serif;" : "margin:0 0 0.5rem 0;font:600 17px/1.3 system-ui,sans-serif;";
  heading.textContent = text;
  return heading;
}

function formatIdentifier(identifier) {
  return [identifier.list, identifier.value, identifier.version, identifier.organization].filter(Boolean).join(" ");
}
