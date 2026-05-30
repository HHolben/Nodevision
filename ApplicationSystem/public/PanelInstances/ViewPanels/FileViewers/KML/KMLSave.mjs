import { formatCoordinates, parseCoordinates } from "./KMLParser.mjs";

function localName(node) {
  return node?.localName || node?.nodeName || "";
}

function elementChildren(node) {
  return Array.from(node?.childNodes || []).filter((child) => child.nodeType === 1);
}

function directChild(node, name) {
  return elementChildren(node).find((child) => localName(child) === name) || null;
}

function firstDescendant(node, name) {
  if (!node) return null;
  const queue = [...elementChildren(node)];
  while (queue.length) {
    const current = queue.shift();
    if (localName(current) === name) return current;
    queue.push(...elementChildren(current));
  }
  return null;
}

function createElement(xmlDoc, name) {
  const ns = xmlDoc.documentElement?.namespaceURI || "http://www.opengis.net/kml/2.2";
  return ns ? xmlDoc.createElementNS(ns, name) : xmlDoc.createElement(name);
}

function setDirectText(xmlDoc, parent, name, value) {
  let child = directChild(parent, name);
  if (!child) {
    child = createElement(xmlDoc, name);
    parent.appendChild(child);
  }
  child.textContent = value ?? "";
  return child;
}

export function updateFeatureText(state, record, patch = {}) {
  if (!state?.xmlDoc || !record?.node) return;
  if (Object.prototype.hasOwnProperty.call(patch, "name")) {
    setDirectText(state.xmlDoc, record.node, "name", patch.name);
    record.name = patch.name || "(unnamed)";
  }
  if (Object.prototype.hasOwnProperty.call(patch, "description")) {
    setDirectText(state.xmlDoc, record.node, "description", patch.description);
    record.description = patch.description || "";
  }
}

export function updateFeatureCoordinates(state, record, coordinatesText) {
  if (!state?.xmlDoc || !record?.geometry) return [];
  const coords = parseCoordinates(coordinatesText);
  if (!coords.length) throw new Error("Coordinates must contain at least one lon,lat pair.");

  let coordinatesNode = record.geometry.coordinatesNode;
  if (!coordinatesNode) {
    coordinatesNode = createElement(state.xmlDoc, "coordinates");
    record.geometry.node.appendChild(coordinatesNode);
  }
  coordinatesNode.textContent = formatCoordinates(coords);
  record.geometry.coordinatesNode = coordinatesNode;
  record.geometry.coordinates = coords;
  record.geometry.coordinatesText = coordinatesNode.textContent;
  return coords;
}

export function updateFeatureOption(state, record, key, value) {
  if (!state?.xmlDoc || !record?.geometry?.node || !key) return;
  setDirectText(state.xmlDoc, record.geometry.node, key, value);
  record.geometry[key] = value;
}

export function updateFeatureStyleColor(state, record, value) {
  if (!state?.xmlDoc || !record?.node) return;
  let styleNode = directChild(record.node, "Style");
  if (!styleNode) {
    styleNode = createElement(state.xmlDoc, "Style");
    record.node.appendChild(styleNode);
  }
  const geometryType = record.geometry?.type;
  const styleType = geometryType === "Polygon" ? "PolyStyle" : geometryType === "LineString" ? "LineStyle" : "IconStyle";
  let stylePart = directChild(styleNode, styleType);
  if (!stylePart) {
    stylePart = createElement(state.xmlDoc, styleType);
    styleNode.appendChild(stylePart);
  }
  setDirectText(state.xmlDoc, stylePart, "color", cssHexToKmlColor(value));
}

function cssHexToKmlColor(value = "") {
  const clean = String(value || "").trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return value;
  return `ff${clean.slice(4, 6)}${clean.slice(2, 4)}${clean.slice(0, 2)}`;
}

function findInsertParent(xmlDoc) {
  const documentNode = firstDescendant(xmlDoc.documentElement, "Document");
  if (documentNode) return documentNode;
  const folderNode = firstDescendant(xmlDoc.documentElement, "Folder");
  if (folderNode) return folderNode;
  return xmlDoc.documentElement;
}

function closePolygonCoordinates(coords = []) {
  if (coords.length < 3) return coords;
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first.lon === last.lon && first.lat === last.lat && first.alt === last.alt) return coords;
  return [...coords, { ...first }];
}

export function createPlacemark(state, { name = "Untitled Placemark", description = "", geometryType = "Point", coordinates = [] } = {}) {
  if (!state?.xmlDoc) throw new Error("KML document is not loaded.");
  const xmlDoc = state.xmlDoc;
  const placemark = createElement(xmlDoc, "Placemark");
  setDirectText(xmlDoc, placemark, "name", name);
  if (description) setDirectText(xmlDoc, placemark, "description", description);

  const geometry = createElement(xmlDoc, geometryType);
  if (geometryType === "Polygon") {
    const outer = createElement(xmlDoc, "outerBoundaryIs");
    const ring = createElement(xmlDoc, "LinearRing");
    setDirectText(xmlDoc, ring, "coordinates", formatCoordinates(closePolygonCoordinates(coordinates)));
    outer.appendChild(ring);
    geometry.appendChild(outer);
  } else {
    setDirectText(xmlDoc, geometry, "coordinates", formatCoordinates(coordinates));
  }
  placemark.appendChild(geometry);
  findInsertParent(xmlDoc).appendChild(placemark);
  return placemark;
}

export function deleteFeature(record) {
  if (record?.node?.parentNode) record.node.parentNode.removeChild(record.node);
}

export function serializeKML(state) {
  return new XMLSerializer().serializeToString(state.xmlDoc);
}

export async function saveKMLFile(filePath, state) {
  const content = serializeKML(state);
  const res = await fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: filePath, content, encoding: "utf8" }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) throw new Error(json?.error || `${res.status} ${res.statusText}`);
  window.dispatchEvent(new CustomEvent("nodevision-file-saved", { detail: { filePath } }));
  return content;
}
