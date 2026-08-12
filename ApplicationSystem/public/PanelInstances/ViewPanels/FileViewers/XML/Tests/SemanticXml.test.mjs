// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/XML/Tests/SemanticXml.test.mjs
// This file provides a small browser-compatible test harness for the semantic XML viewer modules. It covers generic XML fallback, malformed XML handling, MathML sanitizing, UnitsML detection, unit model extraction, source preservation, and parser reuse outside UI rendering.

import { parseXmlText } from "../XmlParser.mjs";
import { createDefaultSemanticXmlRegistry } from "../SemanticXmlRegistry.mjs";
import { detectSemanticXml } from "../SemanticXmlDetector.mjs";
import { cloneSafeMathML, findMathMLElements } from "../mathml/SafeMathMLRenderer.mjs";
import { isUnitsMLDocument, parseUnitsMLDocument } from "../unitsml/UnitsMLParser.mjs";
import { formatRootUnitExpression } from "../unitsml/UnitsMLFormatting.mjs";

const FIXTURES = new URL("./fixtures/", import.meta.url);

async function run() {
  if (typeof DOMParser !== "function") return console.log("Semantic XML tests skipped: DOMParser unavailable.");
  const registry = createDefaultSemanticXmlRegistry();
  const generic = await fixture("generic.xml");
  const malformed = await fixture("malformed.xml");
  const mathml = await fixture("mathml-example.xml");
  const meter = await fixture("meter-unitsml.xml");
  const newton = await fixture("newton-unitsml.xml");

  assert(parseXmlText(generic).ok, "ordinary XML parses");
  assert(detectSemanticXml(parseXmlText(generic).document, registry).length === 0, "ordinary XML remains generic");
  assert(!parseXmlText(malformed).ok, "malformed XML reports a parser warning");
  assert(detectSemanticXml(parseXmlText(mathml).document, registry).some((handler) => handler.id === "mathml"), "MathML is detected");
  const safeMath = cloneSafeMathML(findMathMLElements(parseXmlText(mathml).document)[0], parseXmlText(mathml).document);
  assert(safeMath.getElementsByTagName("script").length === 0 && !safeMath.hasAttribute("onclick"), "MathML executable markup is not cloned");
  assert(isUnitsMLDocument(parseXmlText(meter).document), "UnitsML is detected from namespace and structure");

  const meterModel = parseUnitsMLDocument(parseXmlText(meter).document);
  assert(meterModel.units[0].name === "metre", "UnitsML unit name is extracted");
  assert(meterModel.units[0].symbol === "m", "UnitsML unit symbol is extracted");

  const newtonModel = parseUnitsMLDocument(parseXmlText(newton).document);
  assert(formatRootUnitExpression(newtonModel.units[0].rootUnits) === "m·kg·s⁻²", "UnitsML root-unit relationship is displayed");
  assert(parseUnitsMLDocument(parseXmlText(partialUnitsML()).document).units[0].name === "partial", "missing optional UnitsML fields do not crash parsing");
  assert(parseXmlText(newton).source === newton, "source view receives unchanged XML text");
  assert(Array.isArray(newtonModel.units) && newtonModel.units[0].id === "N", "semantic UnitsML model is reusable outside rendering");
  console.log("Semantic XML tests passed.");
}

async function fixture(name) {
  if (typeof window !== "undefined" && typeof fetch === "function") return (await fetch(new URL(name, FIXTURES))).text();
  const fs = await import("node:fs/promises");
  return fs.readFile(new URL(name, FIXTURES), "utf8");
}

function partialUnitsML() {
  return `<UnitsML xmlns="https://schema.unitsml.org/unitsml/1.0"><UnitSet><Unit xml:id="partial"><UnitName>partial</UnitName></Unit></UnitSet></UnitsML>`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

run().catch((error) => {
  console.error(error);
  if (typeof process !== "undefined") process.exitCode = 1;
});
