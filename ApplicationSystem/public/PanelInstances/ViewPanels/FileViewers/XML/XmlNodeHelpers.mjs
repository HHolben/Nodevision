// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/XML/XmlNodeHelpers.mjs
// This file contains small XML DOM traversal helpers used by semantic XML detectors and parsers. It centralizes namespace-aware lookups so semantic handlers can stay focused on vocabulary rules rather than DOM ceremony.

export function elementLocalName(element) {
  return element?.localName || String(element?.nodeName || "").split(":").pop();
}

export function elementNamespace(element) {
  return element?.namespaceURI || "";
}

export function isElement(node) {
  return node?.nodeType === 1;
}

export function xmlId(element) {
  return element?.getAttribute?.("xml:id")
    || element?.getAttributeNS?.("http://www.w3.org/XML/1998/namespace", "id")
    || element?.getAttribute?.("id")
    || "";
}

export function attr(element, name, fallback = "") {
  const value = element?.getAttribute?.(name);
  return value == null ? fallback : value;
}

export function textOf(element) {
  return String(element?.textContent || "").replace(/\s+/g, " ").trim();
}

export function elementsByNamespace(root, namespace) {
  if (!root || !namespace) return [];
  const documentElement = root.documentElement || root;
  const direct = root.getElementsByTagNameNS?.(namespace, "*");
  return Array.from(direct || []).filter((element) => isElement(element) || element === documentElement);
}

export function elementsByLocalName(root, namespace, localName) {
  return elementsByNamespace(root, namespace).filter((element) => elementLocalName(element) === localName);
}

export function directChildrenByLocalName(element, namespace, localName) {
  return Array.from(element?.children || []).filter((child) => {
    const namespaceOk = !namespace || elementNamespace(child) === namespace;
    return namespaceOk && elementLocalName(child) === localName;
  });
}

export function firstChildText(element, namespace, localName) {
  return textOf(directChildrenByLocalName(element, namespace, localName)[0]);
}

export function childTexts(element, namespace, localName) {
  return directChildrenByLocalName(element, namespace, localName).map(textOf).filter(Boolean);
}

export function firstElementByLocalName(root, namespace, localName) {
  return elementsByLocalName(root, namespace, localName)[0] || null;
}

export function hasNamespaceDeclaration(element, namespace) {
  if (!element?.attributes || !namespace) return false;
  for (const attribute of element.attributes) {
    if (attribute.value === namespace && (attribute.name === "xmlns" || attribute.name.startsWith("xmlns:"))) return true;
  }
  return false;
}
