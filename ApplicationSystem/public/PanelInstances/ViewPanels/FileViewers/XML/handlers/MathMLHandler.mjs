// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/XML/handlers/MathMLHandler.mjs
// This file registers generic MathML recognition for the semantic XML viewer. It detects the W3C MathML namespace and renders sanitized MathML subtrees with the browser's native MathML support.

import { MATHML_NAMESPACE, cloneSafeMathML, findMathMLElements } from "../mathml/SafeMathMLRenderer.mjs";

export const mathMLHandler = {
  id: "mathml",
  label: "MathML",
  matches(xmlDocument) {
    return findMathMLElements(xmlDocument).length > 0;
  },
  parse(xmlDocument) {
    const expressions = findMathMLElements(xmlDocument);
    return { namespace: MATHML_NAMESPACE, expressionCount: expressions.length };
  },
  render(xmlDocument) {
    const section = document.createElement("section");
    section.style.cssText = "border:1px solid #d1d5db;border-radius:6px;padding:1rem;background:#fff;";
    const title = document.createElement("h2");
    title.style.cssText = "margin:0 0 0.75rem 0;font:600 18px/1.3 system-ui,sans-serif;";
    title.textContent = "MathML";
    section.appendChild(title);

    const formulas = findMathMLElements(xmlDocument);
    if (!formulas.length) section.appendChild(emptyMessage());
    formulas.forEach((formula) => section.appendChild(renderFormula(formula)));
    return section;
  }
};

function renderFormula(formula) {
  const block = document.createElement("div");
  block.style.cssText = "padding:0.5rem 0;border-top:1px solid #eef2f7;font-size:1.2rem;";
  const safeFormula = cloneSafeMathML(formula, document);
  if (formula.localName === "math") block.appendChild(safeFormula);
  else block.appendChild(wrapMathRoot(safeFormula));
  return block;
}

function wrapMathRoot(child) {
  const math = document.createElementNS(MATHML_NAMESPACE, "math");
  math.setAttribute("display", "block");
  math.appendChild(child);
  return math;
}

function emptyMessage() {
  const div = document.createElement("div");
  div.style.cssText = "color:#6b7280;";
  div.textContent = "No MathML expressions were found.";
  return div;
}
