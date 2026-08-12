// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/XML/unitsml/UnitsMLFormatting.mjs
// This file formats parsed UnitsML model values for human-readable display. It converts root-unit decomposition and conversion attributes into compact notation without changing the authoritative XML source.

const ROOT_UNIT_SYMBOLS = new Map([
  ["meter", "m"], ["metre", "m"], ["second", "s"], ["gram", "g"], ["kilogram", "kg"], ["ampere", "A"], ["kelvin", "K"], ["mole", "mol"], ["candela", "cd"], ["radian", "rad"], ["steradian", "sr"]
]);
const SUPERSCRIPTS = new Map([["-", "⁻"], ["0", "⁰"], ["1", "¹"], ["2", "²"], ["3", "³"], ["4", "⁴"], ["5", "⁵"], ["6", "⁶"], ["7", "⁷"], ["8", "⁸"], ["9", "⁹"]]);

export function formatRootUnitExpression(rootUnits = []) {
  return rootUnits.map(formatRootUnitPart).filter(Boolean).join("·");
}

export function formatDimension(dimension) {
  if (!dimension?.parts?.length) return "";
  return dimension.parts.map((part) => `${part.symbol || part.name}${formatPower(part)}`).join("·");
}

export function formatConversion(conversion) {
  const initial = conversion.initialUnit ? `from ${conversion.initialUnit}` : "";
  const final = conversion.finalUnit ? `to ${conversion.finalUnit}` : "";
  const factor = conversion.multiplicand || conversion.multiplier || "";
  const scale = factor ? `factor ${factor}` : "";
  const offsets = [conversion.initialAddend && `initial +${conversion.initialAddend}`, conversion.finalAddend && `final +${conversion.finalAddend}`].filter(Boolean).join(", ");
  return [conversion.type, initial, final, scale, offsets, conversion.exact && `exact=${conversion.exact}`].filter(Boolean).join("; ");
}

export function plainRootUnitLabel(entry) {
  return `${entry.prefix || ""}${rootUnitSymbol(entry.unit)}${formatPower(entry)}`;
}

function formatRootUnitPart(entry) {
  return `${entry.prefix || ""}${rootUnitSymbol(entry.unit)}${formatPower(entry)}`;
}

function rootUnitSymbol(unitName) {
  const clean = String(unitName || "").replace(/^#/, "");
  return ROOT_UNIT_SYMBOLS.get(clean.toLowerCase()) || clean;
}

function formatPower(entry) {
  const numerator = String(entry.powerNumerator || "1");
  const denominator = String(entry.powerDenominator || "1");
  if (numerator === "1" && denominator === "1") return "";
  const text = denominator === "1" ? numerator : `${numerator}/${denominator}`;
  return superscript(text);
}

function superscript(text) {
  return String(text).split("").map((char) => SUPERSCRIPTS.get(char) || char).join("");
}
