// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewCIR.mjs
// Render .cir netlists using the same schematic look as the graphical editor (no grid).

import { parseNetlist } from "./ViewCIR/parseNetlist.mjs";
import { generateCircuitSummary } from "./ViewCIR/renderers.mjs";
import { getSymbol } from "../../EditorPanels/GraphicalEditors/CircuitEditorComponents/SymbolLibrary.mjs";
import { createDefaultDocument } from "../../EditorPanels/GraphicalEditors/CircuitEditorComponents/CircuitEditorState.mjs";
import { createComponent, createWire } from "../../EditorPanels/GraphicalEditors/CircuitEditorComponents/CircuitObjectFactories.mjs";
import { createSchematicRenderer } from "../../EditorPanels/GraphicalEditors/CircuitEditorComponents/SchematicRenderer.mjs";
import { rotatePoint, translatePoint, distancePointToSegment } from "../../EditorPanels/GraphicalEditors/CircuitEditorComponents/CircuitGeometry.mjs";

// Map SPICE element letters to editor symbol IDs
function symbolIdForComponent(comp) {
  switch (comp.type) {
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

function centroid(points) {
  const n = points.length || 1;
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / n, y: sum.y / n };
}

function buildDocumentFromNetlist(netComponents) {
  const doc = createDefaultDocument();
  doc.sheet.gridSize = 20;

  const colWidth = 260;
  const rowHeight = 220;
  const pinNetMap = new Map(); // net -> [{pinId, point}]

  netComponents.forEach((nc, index) => {
    const symId = symbolIdForComponent(nc);
    const x = colWidth * (index % 3) + 220;
    const y = rowHeight * Math.floor(index / 3) + 200;
    const cmp = createComponent(symId, { x, y }, 0, nc.name || null);
    if (nc.value) cmp.properties.value = nc.value;
    if (nc.model) cmp.properties.model = nc.model;
    if (nc.params) cmp.properties.params = nc.params;
    doc.components.push(cmp);

    const sym = getSymbol(symId);
    const pins = sym?.pins || [];
    const nodes = nc.nodes || [];
    pins.forEach((pin, idx) => {
      const netName = nodes[idx] ?? "";
      if (!netName) return;
      const world = translatePoint(rotatePoint({ x: pin.x, y: pin.y }, cmp.rotation || 0), cmp.x, cmp.y);
      const pinId = `${cmp.id}:pin:${pin.name}`;
      if (!pinNetMap.has(netName)) pinNetMap.set(netName, []);
      pinNetMap.get(netName).push({ pinId, point: world });
    });
  });

  pinNetMap.forEach((pins, netName) => {
    if (pins.length === 0) return;
    const hub = centroid(pins.map((p) => p.point));
    pins.forEach(({ pinId, point }) => {
      const corner = Math.abs(hub.x - point.x) >= Math.abs(hub.y - point.y)
        ? { x: hub.x, y: point.y }
        : { x: point.x, y: hub.y };
      const w = createWire([
        { ...point, __attach: pinId },
        corner,
        { ...hub },
      ]);
      w.net = netName;
      doc.wires.push(w);
    });
  });

  return doc;
}

function createViewerCanvas(container, state) {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("role", "img");
  svg.style.width = "100%";
  svg.style.height = "520px";
  svg.style.background = "#ffffff"; // no grid
  svg.style.border = "1px solid #e2e8f0";
  svg.style.borderRadius = "10px";
  svg.style.touchAction = "none";
  svg.style.userSelect = "none";

  const wireLayer = document.createElementNS(SVG_NS, "g");
  const componentLayer = document.createElementNS(SVG_NS, "g");
  const labelLayer = document.createElementNS(SVG_NS, "g");
  const overlayLayer = document.createElementNS(SVG_NS, "g");
  svg.append(wireLayer, componentLayer, labelLayer, overlayLayer);
  container.appendChild(svg);

  function toWorld(evt) {
    const rect = svg.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top,
    };
  }

  return { svg, wireLayer, componentLayer, labelLayer, overlayLayer, toWorld };
}

function recomputeWireGeometry(wire) {
  if (wire.points.length < 2) return;
  const start = wire.points[0];
  const end = wire.points[wire.points.length - 1];
  const corner = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)
    ? { x: end.x, y: start.y }
    : { x: start.x, y: end.y };
  wire.points = [start, corner, end];
}

function pinWorldById(doc, pinId) {
  const [cmpId, , pinName] = String(pinId).split(":");
  const cmp = doc.components.find((c) => c.id === cmpId);
  if (!cmp) return null;
  const sym = getSymbol(cmp.type);
  const pin = sym?.pins?.find((p) => p.name === pinName);
  if (!pin) return null;
  return translatePoint(rotatePoint({ x: pin.x, y: pin.y }, cmp.rotation || 0), cmp.x, cmp.y);
}

function updateWiresForComponent(doc, cmp) {
  doc.wires.forEach((w) => {
    const startAttach = w.points[0].__attach || "";
    if (!startAttach.startsWith(cmp.id)) return;
    const next = pinWorldById(doc, startAttach);
    if (next) {
      w.points[0].x = next.x;
      w.points[0].y = next.y;
      recomputeWireGeometry(w);
    }
  });
}

function hitTest(doc, point) {
  // components first
  for (const cmp of doc.components) {
    const sym = getSymbol(cmp.type);
    if (!sym) continue;
    const w = sym.size?.w || 80;
    const h = sym.size?.h || 40;
    if (Math.abs(point.x - cmp.x) <= w / 2 + 6 && Math.abs(point.y - cmp.y) <= h / 2 + 6) {
      return { type: "component", id: cmp.id };
    }
  }
  // wire endpoints (free)
  for (const w of doc.wires) {
    const end = w.points[w.points.length - 1];
    if (!end.__attach) {
      if (Math.hypot(point.x - end.x, point.y - end.y) < 10) {
        return { type: "wireEnd", id: w.id };
      }
    }
  }
  // wire segments
  for (const w of doc.wires) {
    for (let i = 0; i < w.points.length - 1; i += 1) {
      if (distancePointToSegment(point, w.points[i], w.points[i + 1]) < 6) {
        return { type: "wire", id: w.id };
      }
    }
  }
  return null;
}

function symbolDataUrl(symbolId, size = 32) {
  const svg = symbolSvg(symbolId, size);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function symbolSvg(symbolId, size = 32) {
  const sym = getSymbol(symbolId) || getSymbol("resistor");
  const w = sym?.size?.w || 80;
  const h = sym?.size?.h || 40;
  const stroke = Math.max(2, Math.min(w, h) / 14);
  const viewBox = `${-w / 2} ${-h / 2} ${w} ${h}`;
  const parts = [];

  (sym.shapes || []).forEach((s) => {
    if (s.type === "line") {
      parts.push(`<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke="black" stroke-width="${stroke}" stroke-linecap="round" />`);
    } else if (s.type === "polyline") {
      parts.push(`<polyline points="${s.points}" fill="none" stroke="black" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" />`);
    } else if (s.type === "polygon") {
      parts.push(`<polygon points="${s.points}" fill="none" stroke="black" stroke-width="${stroke}" stroke-linejoin="round" />`);
    } else if (s.type === "circle") {
      parts.push(`<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" fill="none" stroke="black" stroke-width="${stroke}" />`);
    } else if (s.type === "arc") {
      const x1 = s.cx + s.r * Math.cos(s.start);
      const y1 = s.cy + s.r * Math.sin(s.start);
      const x2 = s.cx + s.r * Math.cos(s.end);
      const y2 = s.cy + s.r * Math.sin(s.end);
      const largeArc = Math.abs(s.end - s.start) > Math.PI ? 1 : 0;
      const sweep = s.end > s.start ? 1 : 0;
      parts.push(`<path d="M ${x1} ${y1} A ${s.r} ${s.r} 0 ${largeArc} ${sweep} ${x2} ${y2}" fill="none" stroke="black" stroke-width="${stroke}" />`);
    }
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}" aria-hidden="true">${parts.join("")}</svg>`;
}

function createSchematicView(doc) {
  const container = document.createElement("div");
  const canvas = createViewerCanvas(container, { document: doc });

  const state = {
    document: doc,
    selection: [],
    hover: null,
    wireDraft: null,
    placeDraft: null,
  };

  const renderer = createSchematicRenderer(
    {
      wireLayer: canvas.wireLayer,
      componentLayer: canvas.componentLayer,
      labelLayer: canvas.labelLayer,
      overlayLayer: canvas.overlayLayer,
    },
    state
  );

  renderer.render();

  let drag = null;

  canvas.svg.addEventListener("pointerdown", (evt) => {
    if (evt.button !== 0) return;
    const world = canvas.toWorld(evt);
    const hit = hitTest(doc, world);
    if (!hit) return;
    if (hit.type === "component") {
      const cmp = doc.components.find((c) => c.id === hit.id);
      drag = {
        kind: "component",
        id: cmp.id,
        start: world,
        origin: { x: cmp.x, y: cmp.y },
      };
      canvas.svg.setPointerCapture(evt.pointerId);
    } else if (hit.type === "wireEnd") {
      const wire = doc.wires.find((w) => w.id === hit.id);
      const end = { ...wire.points[wire.points.length - 1] };
      drag = {
        kind: "wireEnd",
        id: wire.id,
        start: world,
        origin: end,
      };
      canvas.svg.setPointerCapture(evt.pointerId);
    }
  });

  canvas.svg.addEventListener("pointermove", (evt) => {
    if (!drag) return;
    const world = canvas.toWorld(evt);
    const dx = world.x - drag.start.x;
    const dy = world.y - drag.start.y;

    if (drag.kind === "component") {
      const cmp = doc.components.find((c) => c.id === drag.id);
      if (!cmp) return;
      cmp.x = drag.origin.x + dx;
      cmp.y = drag.origin.y + dy;
      updateWiresForComponent(doc, cmp);
      renderer.render();
    } else if (drag.kind === "wireEnd") {
      const wire = doc.wires.find((w) => w.id === drag.id);
      if (!wire) return;
      const end = wire.points[wire.points.length - 1];
      end.x = drag.origin.x + dx;
      end.y = drag.origin.y + dy;
      recomputeWireGeometry(wire);
      renderer.render();
    }
  });

  const stopDrag = (evt) => {
    if (!drag) return;
    canvas.svg.releasePointerCapture(evt.pointerId);
    drag = null;
  };

  canvas.svg.addEventListener("pointerup", stopDrag);
  canvas.svg.addEventListener("pointercancel", stopDrag);

  return container;
}

/**
 * Renders the contents of a netlist (.cir) file.
 */
export async function renderFile(filename, viewPanel, iframe, serverBase) {
  viewPanel.innerHTML = '<p style="padding:10px;">Loading and parsing circuit netlist...</p>';

  try {
    const response = await fetch(`${serverBase}/${filename}`);
    const netlistText = await response.text();

    const { components } = parseNetlist(netlistText);

    if (components.length === 0) {
      viewPanel.innerHTML = '<p style="color:orange;padding:10px;">Netlist loaded, but no components were identified or parsed.</p>';
      return;
    }

    const doc = buildDocumentFromNetlist(components);
    const schematic = createSchematicView(doc);
    const summaryEl = document.createElement("div");
    summaryEl.innerHTML = generateCircuitSummary(components, {
      renderIcon: (comp) => {
        const symId = symbolIdForComponent(comp);
        return `<img src="${symbolDataUrl(symId, 28)}" alt="${symId}" width="28" height="28" />`;
      },
    });

    viewPanel.innerHTML = "";
    const shell = document.createElement("div");
    shell.style.display = "flex";
    shell.style.flexDirection = "column";
    shell.style.gap = "16px";
    shell.style.padding = "10px";
    shell.append(schematic, summaryEl);
    viewPanel.appendChild(shell);
  } catch (err) {
    console.error("Error loading or parsing CIR netlist:", err);
    viewPanel.innerHTML = '<p style="color:red;padding:10px;">Error loading or parsing netlist file.</p>';
  }
}
