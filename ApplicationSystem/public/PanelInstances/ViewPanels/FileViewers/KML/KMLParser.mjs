let nextRecordId = 1;

const GEOMETRY_TYPES = ["Point", "LineString", "Polygon"];
const EMPTY_KML_DOCUMENT = '<kml xmlns="http://www.opengis.net/kml/2.2"><Document/></kml>';

function localName(node) {
  return node?.localName || node?.nodeName || "";
}

function elementChildren(node) {
  return Array.from(node?.childNodes || []).filter((child) => child.nodeType === 1);
}

function directChild(node, name) {
  return elementChildren(node).find((child) => localName(child) === name) || null;
}

function directText(node, name) {
  const child = directChild(node, name);
  return child ? child.textContent || "" : "";
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

function findGeometryNode(placemarkNode) {
  for (const type of GEOMETRY_TYPES) {
    const found = firstDescendant(placemarkNode, type);
    if (found) return found;
  }
  return null;
}

export function parseCoordinates(text = "") {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .map((chunk) => chunk.split(",").map((value) => Number(value)))
    .filter((parts) => Number.isFinite(parts[0]) && Number.isFinite(parts[1]))
    .map(([lon, lat, alt]) => ({ lon, lat, alt: Number.isFinite(alt) ? alt : null }));
}

export function formatCoordinates(coords = []) {
  return coords
    .map((coord) => {
      const lon = Number(coord.lon);
      const lat = Number(coord.lat);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return "";
      return coord.alt === null || coord.alt === undefined || coord.alt === ""
        ? `${lon},${lat}`
        : `${lon},${lat},${Number(coord.alt)}`;
    })
    .filter(Boolean)
    .join(" ");
}

function readGeometry(placemarkNode) {
  const geometryNode = findGeometryNode(placemarkNode);
  if (!geometryNode) return null;

  const type = localName(geometryNode);
  const coordinatesNode = firstDescendant(geometryNode, "coordinates");
  const coordinatesText = coordinatesNode?.textContent?.trim() || "";
  const coordinates = parseCoordinates(coordinatesText);

  return {
    type,
    node: geometryNode,
    coordinatesNode,
    coordinatesText,
    coordinates,
    altitudeMode: directText(geometryNode, "altitudeMode") || directText(geometryNode, "gx:altitudeMode"),
    tessellate: directText(geometryNode, "tessellate"),
    extrude: directText(geometryNode, "extrude"),
  };
}

function kmlColorToCss(kmlColor = "", fallback = "#2f6fed") {
  const clean = String(kmlColor || "").trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{8}$/.test(clean)) return fallback;
  const alpha = parseInt(clean.slice(0, 2), 16) / 255;
  const blue = parseInt(clean.slice(2, 4), 16);
  const green = parseInt(clean.slice(4, 6), 16);
  const red = parseInt(clean.slice(6, 8), 16);
  if (alpha >= 0.98) return `rgb(${red}, ${green}, ${blue})`;
  return `rgba(${red}, ${green}, ${blue}, ${Number(alpha.toFixed(2))})`;
}

function collectStyles(xmlDoc) {
  const styles = new Map();
  Array.from(xmlDoc.getElementsByTagName("*")).forEach((node) => {
    if (localName(node) !== "Style") return;
    const id = node.getAttribute("id");
    if (!id) return;

    const lineStyle = firstDescendant(node, "LineStyle");
    const polyStyle = firstDescendant(node, "PolyStyle");
    const iconStyle = firstDescendant(node, "IconStyle");
    const lineColor = directText(lineStyle, "color");
    const polyColor = directText(polyStyle, "color");
    const iconColor = directText(iconStyle, "color");
    const width = Number(directText(lineStyle, "width"));

    styles.set(`#${id}`, {
      id,
      lineColor,
      polyColor,
      iconColor,
      stroke: kmlColorToCss(lineColor),
      fill: kmlColorToCss(polyColor, "rgba(47, 111, 237, 0.25)"),
      marker: kmlColorToCss(iconColor, "#d93b30"),
      weight: Number.isFinite(width) && width > 0 ? width : 3,
    });
  });
  return styles;
}

function styleForPlacemark(placemarkNode, styles) {
  const styleUrl = directText(placemarkNode, "styleUrl").trim();
  const inlineStyle = directChild(placemarkNode, "Style");
  if (inlineStyle) {
    const lineStyle = firstDescendant(inlineStyle, "LineStyle");
    const polyStyle = firstDescendant(inlineStyle, "PolyStyle");
    const iconStyle = firstDescendant(inlineStyle, "IconStyle");
    const lineColor = directText(lineStyle, "color");
    const polyColor = directText(polyStyle, "color");
    const iconColor = directText(iconStyle, "color");
    const width = Number(directText(lineStyle, "width"));
    return {
      styleUrl,
      lineColor,
      polyColor,
      iconColor,
      stroke: kmlColorToCss(lineColor),
      fill: kmlColorToCss(polyColor, "rgba(47, 111, 237, 0.25)"),
      marker: kmlColorToCss(iconColor, "#d93b30"),
      weight: Number.isFinite(width) && width > 0 ? width : 3,
    };
  }


  const shared = styleUrl ? styles.get(styleUrl) : null;
  if (shared) return { ...shared, styleUrl };

  return { styleUrl, stroke: "#2f6fed", fill: "rgba(47, 111, 237, 0.25)", marker: "#d93b30", weight: 3 };
}

function recordBase(node, type, depth) {
  return {
    id: `kml-${nextRecordId++}`,
    node,
    type,
    depth,
    name: directText(node, "name").trim() || (type === "placemark" ? "(unnamed)" : type),
    visible: true,
  };
}

function walkContainer(node, depth, state, parentRecord = null) {
  for (const child of elementChildren(node)) {
    const name = localName(child);
    if (name === "Document" || name === "Folder") {
      const record = recordBase(child, name.toLowerCase(), depth);
      record.parentId = parentRecord?.id || null;
      state.treeRecords.push(record);
      state.recordsById.set(record.id, record);
      walkContainer(child, depth + 1, state, record);
    } else if (name === "Placemark") {
      const record = recordBase(child, "placemark", depth);
      record.parentId = parentRecord?.id || null;
      record.description = directText(child, "description");
      record.styleUrl = directText(child, "styleUrl").trim();
      record.geometry = readGeometry(child);
      record.style = styleForPlacemark(child, state.styles);
      state.treeRecords.push(record);
      state.recordsById.set(record.id, record);
      if (record.geometry) state.features.push(record);
    }
  }
}

function parseErrorMessage(xmlDoc) {
  const parserError = Array.from(xmlDoc.getElementsByTagName("parsererror"))[0];
  return parserError?.textContent?.trim() || "";
}

export function parseKML(kmlText = "") {
  nextRecordId = 1;
  const sourceText = String(kmlText ?? "");
  const xmlText = sourceText.trim() ? sourceText : EMPTY_KML_DOCUMENT;
  const xmlDoc = new DOMParser().parseFromString(xmlText, "application/xml");
  const parseError = parseErrorMessage(xmlDoc);
  if (parseError) throw new Error(parseError.split("\n")[0] || "Invalid KML/XML.");

  const root = xmlDoc.documentElement;
  if (!root || localName(root) !== "kml") throw new Error("This file does not look like a KML document.");

  const state = {
    xmlDoc,
    root,
    sourceText,
    styles: collectStyles(xmlDoc),
    treeRecords: [],
    features: [],
    recordsById: new Map(),
  };

  walkContainer(root, 0, state, null);
  return state;
}

export function refreshKMLRecords(state) {
  if (!state?.xmlDoc) return state;
  return parseKML(new XMLSerializer().serializeToString(state.xmlDoc));
}

export function getFeatureLabel(record) {
  if (!record) return "";
  if (record.type !== "placemark") return record.name;
  return `${record.geometry?.type || "Placemark"}: ${record.name || "(unnamed)"}`;
}
