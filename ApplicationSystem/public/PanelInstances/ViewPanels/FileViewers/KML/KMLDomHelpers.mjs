// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/KML/KMLDomHelpers.mjs
// This module provides XML DOM traversal helpers shared by KML parser and editor utilities.

export function localName(node) {
  return node?.localName || node?.nodeName || "";
}

export function elementChildren(node) {
  return Array.from(node?.childNodes || []).filter((child) => child.nodeType === 1);
}

export function directChild(node, name) {
  return elementChildren(node).find((child) => localName(child) === name) || null;
}

export function directText(node, name) {
  const child = directChild(node, name);
  return child ? child.textContent || "" : "";
}

export function firstDescendant(node, name) {
  if (!node) return null;
  const queue = [...elementChildren(node)];
  while (queue.length) {
    const current = queue.shift();
    if (localName(current) === name) return current;
    queue.push(...elementChildren(current));
  }
  return null;
}
