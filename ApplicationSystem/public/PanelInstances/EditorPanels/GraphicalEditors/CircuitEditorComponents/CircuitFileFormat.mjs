// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CircuitEditorComponents/CircuitFileFormat.mjs
// This file defines load and save helpers for the native .nvcircuit.json format. This file keeps defaults merged so corrupted files do not crash the editor.

import { fetchText, saveText } from "../FamilyEditorCommon.mjs";
import { createDefaultDocument } from "./CircuitEditorState.mjs";
import { getSymbol } from "./SymbolLibrary.mjs";
import { createComponent, createWire } from "./CircuitObjectFactories.mjs";
// NOTE: parseNetlist lives under PanelInstances/ViewPanels, not inside EditorPanels.
// We need to traverse up from GraphicalEditors/CircuitEditorComponents to PanelInstances
// before descending into ViewPanels.
import { parseNetlist } from "../../../ViewPanels/FileViewers/ViewCIR/parseNetlist.mjs";

function looksLikeJson(text = "") {
  const t = String(text).trim();
  return t.startsWith("{") || t.startsWith("[");
}

function mergeDefaults(parsed) {
  const base = createDefaultDocument();
  return {
    metadata: { ...base.metadata, ...(parsed.metadata || {}) },
    sheet: { ...base.sheet, ...(parsed.sheet || {}) },
    components: parsed.components || [],
    wires: parsed.wires || [],
    junctions: parsed.junctions || [],
    labels: parsed.labels || [],
    texts: parsed.texts || [],
  };
}

export async function loadCircuitFile(path) {
  if (!path) return createDefaultDocument();

  if (path.toLowerCase().endsWith(".cir")) {
    try {
      const text = await fetchText(path);
      if (looksLikeJson(text)) {
        const parsed = JSON.parse(text);
        return mergeDefaults(parsed);
      }
      return netlistToDocument(text);
    } catch (err) {
      console.warn("Circuit editor: failed to import .cir, using blank document", err);
      return createDefaultDocument();
    }
  }

  try {
    const text = await fetchText(path);
    const parsed = JSON.parse(text);
    return mergeDefaults(parsed);
  } catch (err) {
    console.warn("Circuit editor: failed to load file, using blank document", err);
    return createDefaultDocument();
  }
}

export async function saveCircuitFile(path, document) {
  const target = path || "Notebook/untitled.nvcircuit.json";
  const isNetlist = target.toLowerCase().endsWith(".cir");

  if (isNetlist) {
    const netlist = serializeNetlist(document);
    await saveText(target, netlist);
    return;
  }

  const text = JSON.stringify(document, null, 2);
  await saveText(target, text);
}

// --- Netlist serialization -------------------------------------------------
function serializeNetlist(doc) {
  const uf = new UnionFind();
  const pointMap = new Map(); // id -> {x,y,attach}

  // Component pins as union nodes
  doc.components.forEach((cmp) => {
    const sym = getSymbol(cmp.type);
    if (!sym?.pins) return;
    sym.pins.forEach((pin) => {
      const world = rotateAndTranslate(pin, cmp);
      const id = `${cmp.id}:pin:${pin.name}`;
      pointMap.set(id, { ...world, attach: null });
    });
  });

  // Wire points
  doc.wires.forEach((w) => {
    w.points.forEach((p, idx) => {
      const id = `${w.id}:pt:${idx}`;
      pointMap.set(id, { x: p.x, y: p.y, attach: p.__attach || null });
    });
    // Connect consecutive points
    for (let i = 0; i < w.points.length - 1; i += 1) {
      uf.union(`${w.id}:pt:${i}`, `${w.id}:pt:${i + 1}`);
    }
  });

  // Attachments (wire endpoints to pins/other wires)
  pointMap.forEach((p, id) => {
    if (!p.attach) return;
    if (pointMap.has(p.attach)) {
      uf.union(id, p.attach);
      return;
    }
    // If attachment is a component pin id like "cmp:pin:X"
    if (pointMap.has(`${p.attach}`)) {
      uf.union(id, `${p.attach}`);
    }
  });

  // Merge coincident points (simple grid match)
  const byCoord = new Map();
  pointMap.forEach((p, id) => {
    const key = `${Math.round(p.x)}:${Math.round(p.y)}`;
    if (!byCoord.has(key)) byCoord.set(key, []);
    byCoord.get(key).push(id);
  });
  byCoord.forEach((ids) => {
    for (let i = 1; i < ids.length; i += 1) {
      uf.union(ids[0], ids[i]);
    }
  });

  // Assign net names
  const netNameByRoot = new Map();
  let netSeq = 1;
  function nameFor(root) {
    if (netNameByRoot.has(root)) return netNameByRoot.get(root);
    const name = `N${netSeq.toString().padStart(3, "0")}`;
    netSeq += 1;
    netNameByRoot.set(root, name);
    return name;
  }

  // Preserve explicit net names stored on wires (when imported from .cir).
  doc.wires.forEach((w) => {
    const net = (w.net || "").trim();
    if (!net) return;
    const ptId = `${w.id}:pt:0`;
    if (!pointMap.has(ptId)) return;
    const root = uf.find(ptId);
    if (!netNameByRoot.has(root)) netNameByRoot.set(root, net);
  });

  // Ground pin forces net 0
  pointMap.forEach((p, id) => {
    if (!id.includes(":pin:")) return;
    const [cmpId, , pinName] = id.split(":");
    const cmp = doc.components.find((c) => c.id === cmpId);
    if (cmp?.type === "ground" || pinName === "0" || cmp?.properties?.ref === "GND") {
      const root = uf.find(id);
      netNameByRoot.set(root, "0");
    }
  });

  // Build components lines
  const lines = ["* Netlist exported from Nodevision circuit editor"];
  doc.components.forEach((cmp) => {
    const sym = getSymbol(cmp.type);
    if (!sym?.pins?.length) return;
    if (cmp.type === "ground") return; // no element line; net is handled via union naming
    const ref = (cmp.properties?.ref || guessRefPrefix(cmp.type)) || "X";
    const value = cmp.properties?.value || null;
    const model = cmp.properties?.model || null;
    const params = cmp.properties?.params || null;
    const prefix = letterForSymbol(cmp.type, ref);
    const nodes = sym.pins.map((pin) => {
      const id = `${cmp.id}:pin:${pin.name}`;
      const root = uf.find(id);
      return nameFor(root);
    });
    const tail = [];
    switch (prefix) {
      case "R":
      case "L":
      case "C":
        if (value) tail.push(value);
        if (model) tail.push(model);
        if (params) tail.push(params);
        break;
      case "V":
      case "I":
        if (value) tail.push(value);
        if (params) tail.push(params);
        break;
      case "D":
      case "Q":
      case "M":
      case "J":
        if (model) tail.push(model);
        if (params) tail.push(params);
        break;
      case "X":
        if (model) tail.push(model);
        else if (value) tail.push(value);
        if (params) tail.push(params);
        break;
      default:
        if (value) tail.push(value);
        if (params) tail.push(params);
    }
    const line = `${prefix}${ref.replace(/[^A-Za-z0-9]/g, "")} ${nodes.join(" ")}${tail.length ? " " + tail.join(" ") : ""}`;
    lines.push(line.trim());
  });
  lines.push(".END");
  return lines.join("\n");
}

function rotateAndTranslate(pin, cmp) {
  const angle = ((cmp.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const x = pin.x * cos - pin.y * sin + cmp.x;
  const y = pin.x * sin + pin.y * cos + cmp.y;
  return { x, y };
}

function letterForSymbol(type, ref) {
  const map = {
    resistor: "R",
    capacitor: "C",
    inductor: "L",
    vsource: "V",
    isource: "I",
    diode: "D",
    npn: "Q",
    pnp: "Q",
    nmos: "M",
    pmos: "M",
    opamp: "X",
    ground: "",
  };
  return map[type] ?? ref?.[0] ?? "X";
}

function guessRefPrefix(type) {
  const map = {
    resistor: "R",
    capacitor: "C",
    inductor: "L",
    vsource: "V",
    isource: "I",
    diode: "D",
    npn: "Q",
    pnp: "Q",
    nmos: "M",
    pmos: "M",
    opamp: "U",
    ground: "GND",
  };
  return map[type] || "X";
}

class UnionFind {
  constructor() {
    this.parent = new Map();
  }
  find(x) {
    if (!this.parent.has(x)) this.parent.set(x, x);
    const p = this.parent.get(x);
    if (p === x) return x;
    const root = this.find(p);
    this.parent.set(x, root);
    return root;
  }
  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

// --- Netlist import --------------------------------------------------------
function netlistToDocument(text) {
  const { components: netComponents, nodes: /*unused*/ _nodes } = parseNetlist(text || "");
  const doc = createDefaultDocument();

  // Layout components in rows.
  const colWidth = 240;
  const rowHeight = 200;

  const netPinMap = new Map(); // netName -> array of {id, point}

  netComponents.forEach((nc, index) => {
    const symId = symbolFromNetType(nc.type) || "resistor";
    const x = colWidth * (index % 3) + 200;
    const y = rowHeight * Math.floor(index / 3) + 200;

    const cmp = createComponent(symId, { x, y }, 0, nc.name || null);
    if (nc.value) cmp.properties.value = nc.value;
    if (nc.model) cmp.properties.model = nc.model;
    if (nc.params) cmp.properties.params = nc.params;

    doc.components.push(cmp);

    const sym = getSymbol(symId);
    const pinOrder = pinOrderForSymbol(symId, sym);
    const nodes = nc.nodes || [];

    pinOrder.forEach((pinName, idx) => {
      const netName = nodes[idx] ?? "";
      if (!netName) return;
      const pinPos = rotateAndTranslate(sym?.pins?.find((p) => p.name === pinName) || { x: 0, y: 0 }, cmp);
      const pinId = `${cmp.id}:pin:${pinName}`;
      if (!netPinMap.has(netName)) netPinMap.set(netName, []);
      netPinMap.get(netName).push({ id: pinId, point: pinPos });
    });
  });

  // Create wires by fanning each pin to a net hub point.
  netPinMap.forEach((pins, netName) => {
    if (pins.length === 0) return;
    // Ground handled as net name "0" or "GND" but no separate symbol needed.
    const hub = centroid(pins.map((p) => p.point));
    pins.forEach(({ id, point }) => {
      const corner = {
        x: hub.x,
        y: point.y,
      };
      const wirePoints = [
        { ...point, __attach: id },
        corner,
        { ...hub },
      ];
      const wire = createWire(wirePoints);
      wire.net = netName;
      doc.wires.push(wire);
    });
  });

  return doc;
}

function symbolFromNetType(type) {
  switch (type) {
    case "R": return "resistor";
    case "C": return "capacitor";
    case "L": return "inductor";
    case "V": return "vsource";
    case "I": return "isource";
    case "D": return "diode";
    case "Q": return "npn";
    case "J": return "npn";
    case "M": return "nmos";
    case "X": return "opamp";
    case "O": return "opamp";
    default: return "resistor";
  }
}

function pinOrderForSymbol(symId, sym) {
  // Return pin names in the order that nodes should map.
  if (sym?.pins?.length) {
    return sym.pins.map((p) => p.name);
  }
  // Fallback
  return ["1", "2"];
}

function centroid(points) {
  const n = points.length || 1;
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / n, y: sum.y / n };
}
