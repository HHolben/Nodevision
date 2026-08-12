// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/XML/mathml/SafeMathMLRenderer.mjs
// This file clones trusted subsets of parsed MathML into browser-native MathML elements. It rejects executable or resource-loading markup and keeps rendering separate from the original XML DOM.

export const MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML";

const ALLOWED_ELEMENTS = new Set([
  "math", "mrow", "mi", "mn", "mo", "ms", "mtext", "mspace", "mfrac", "msqrt", "mroot", "msub", "msup", "msubsup", "munder", "mover", "munderover", "mmultiscripts", "mprescripts", "none", "mtable", "mtr", "mtd", "mlabeledtr", "menclose", "mfenced", "mphantom", "mpadded", "mstyle", "merror", "semantics", "apply", "ci", "cn", "plus", "minus", "times", "divide", "power"
]);
const BLOCKED_ELEMENTS = new Set(["annotation", "annotation-xml", "script"]);
const ALLOWED_ATTRIBUTES = new Set([
  "display", "dir", "mathvariant", "mathsize", "mathcolor", "mathbackground", "accent", "accentunder", "stretchy", "fence", "separator", "form", "lspace", "rspace", "largeop", "movablelimits", "symmetric", "maxsize", "minsize", "width", "height", "depth", "rowalign", "columnalign", "columnspan", "rowspan", "bevelled", "notation", "open", "close", "separators"
]);

export function cloneSafeMathML(sourceElement, targetDocument = document) {
  if (!isSafeMathElement(sourceElement)) return targetDocument.createTextNode(sourceElement?.textContent || "");
  const clone = targetDocument.createElementNS(MATHML_NAMESPACE, sourceElement.localName);
  copySafeAttributes(sourceElement, clone);
  for (const child of Array.from(sourceElement.childNodes || [])) {
    const safeChild = cloneSafeMathChild(child, targetDocument);
    if (safeChild) clone.appendChild(safeChild);
  }
  return clone;
}

export function findMathMLElements(xmlDocument) {
  const all = Array.from(xmlDocument?.getElementsByTagNameNS?.(MATHML_NAMESPACE, "*") || []);
  const root = xmlDocument?.documentElement;
  if (isMathMLElement(root) && !all.includes(root)) all.unshift(root);
  return all.filter((element) => !isMathMLElement(element.parentElement));
}

export function isMathMLElement(element) {
  return element?.nodeType === 1 && element.namespaceURI === MATHML_NAMESPACE;
}

function cloneSafeMathChild(child, targetDocument) {
  if (child.nodeType === 3) return targetDocument.createTextNode(child.textContent || "");
  if (child.nodeType !== 1 || !isSafeMathElement(child)) return null;
  return cloneSafeMathML(child, targetDocument);
}

function isSafeMathElement(element) {
  if (!isMathMLElement(element)) return false;
  const localName = element.localName || "";
  return ALLOWED_ELEMENTS.has(localName) && !BLOCKED_ELEMENTS.has(localName);
}

function copySafeAttributes(sourceElement, clone) {
  for (const attribute of Array.from(sourceElement.attributes || [])) {
    const name = attribute.localName || attribute.name;
    const lower = String(name || "").toLowerCase();
    if (!ALLOWED_ATTRIBUTES.has(lower) || lower.startsWith("on")) continue;
    if (/^(?:javascript|data):/i.test(attribute.value || "")) continue;
    clone.setAttribute(lower, attribute.value);
  }
}
