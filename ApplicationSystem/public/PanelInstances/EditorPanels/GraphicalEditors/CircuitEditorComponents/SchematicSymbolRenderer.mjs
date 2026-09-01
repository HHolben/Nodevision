// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CircuitEditorComponents/SchematicSymbolRenderer.mjs
// This module builds SVG elements and component symbols for the circuit schematic renderer.

import { getSymbol } from "./SymbolLibrary.mjs";

const SVG_NS = "http://www.w3.org/2000/svg";

export function clearLayer(layer) {
  while (layer.firstChild) layer.removeChild(layer.firstChild);
}

export function make(el, attrs = {}) {
  const n = document.createElementNS(SVG_NS, el);
  Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
  return n;
}

export function arcPath(cx, cy, r, start, end) {
  const sx = cx + r * Math.cos(start);
  const sy = cy + r * Math.sin(start);
  const ex = cx + r * Math.cos(end);
  const ey = cy + r * Math.sin(end);
  const large = Math.abs(end - start) > Math.PI ? 1 : 0;
  const sweep = end > start ? 1 : 0;
  return `M ${sx} ${sy} A ${r} ${r} 0 ${large} ${sweep} ${ex} ${ey}`;
}

export function parseShapePoints(points = "") {
  return String(points || "")
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(",").map((value) => Number.parseFloat(value));
      return { x, y };
    })
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

export function visitSymbolShapes(symbol, visitor) {
  if (!symbol || typeof visitor !== "function") return;
  (symbol.shapes || []).forEach((shape) => visitor(shape));
}

export function componentSymbolLabelText(component) {
  return `${component.properties?.ref || ""} ${component.properties?.value || ""}`.trim();
}

export function drawSymbol(component) {
  const sym = getSymbol(component.type);
  if (!sym) return null;
  const g = make("g", {
    transform: `translate(${component.x} ${component.y}) rotate(${component.rotation || 0})`,
    "data-id": component.id,
  });
  visitSymbolShapes(sym, (shape) => {
    if (shape.type === "line") {
      g.appendChild(make("line", {
        x1: shape.x1,
        y1: shape.y1,
        x2: shape.x2,
        y2: shape.y2,
        stroke: "#0f172a",
        "stroke-width": 2,
      }));
    } else if (shape.type === "polyline") {
      g.appendChild(make("polyline", {
        points: shape.points,
        fill: "none",
        stroke: "#0f172a",
        "stroke-width": 2,
      }));
    } else if (shape.type === "polygon") {
      g.appendChild(make("polygon", {
        points: shape.points,
        fill: "none",
        stroke: "#0f172a",
        "stroke-width": 2,
      }));
    } else if (shape.type === "circle") {
      g.appendChild(make("circle", {
        cx: shape.cx,
        cy: shape.cy,
        r: shape.r,
        fill: "none",
        stroke: "#0f172a",
        "stroke-width": 2,
      }));
    } else if (shape.type === "rect") {
      g.appendChild(make("rect", {
        x: shape.x,
        y: shape.y,
        width: shape.width,
        height: shape.height,
        fill: "none",
        stroke: "#0f172a",
        "stroke-width": 2,
      }));
    } else if (shape.type === "arc") {
      g.appendChild(make("path", {
        d: arcPath(shape.cx, shape.cy, shape.r, shape.start, shape.end),
        fill: "none",
        stroke: "#0f172a",
        "stroke-width": 2,
      }));
    }
  });
  sym.pins.forEach((pin) => {
    const pinCircle = make("circle", {
      cx: pin.x,
      cy: pin.y,
      r: 4,
      "data-pin": pin.name,
      fill: "#0ea5e9",
      stroke: "#0f172a",
      "stroke-width": 1,
    });
    g.appendChild(pinCircle);
  });
  const label = make("text", {
    x: 0,
    y: -(sym.size?.h || 40) / 2 - 6,
    "text-anchor": "middle",
    "font-size": 12,
    "font-family": "Inter, sans-serif",
    fill: "#0f172a",
  });
  label.textContent = componentSymbolLabelText(component);
  g.appendChild(label);
  return g;
}
