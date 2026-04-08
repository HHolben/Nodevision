// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CircuitEditorComponents/SchematicRenderer.mjs
// This file defines rendering helpers for the circuit editor. This file draws grid layers, components, wires, and selection overlays into SVG.

import { getSymbol } from "./SymbolLibrary.mjs";
import { rotatePoint, translatePoint } from "./CircuitGeometry.mjs";

const SVG_NS = "http://www.w3.org/2000/svg";

function clearLayer(layer) {
  while (layer.firstChild) layer.removeChild(layer.firstChild);
}

function make(el, attrs = {}) {
  const n = document.createElementNS(SVG_NS, el);
  Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
  return n;
}

function arcPath(cx, cy, r, start, end) {
  const sx = cx + r * Math.cos(start);
  const sy = cy + r * Math.sin(start);
  const ex = cx + r * Math.cos(end);
  const ey = cy + r * Math.sin(end);
  const large = Math.abs(end - start) > Math.PI ? 1 : 0;
  const sweep = end > start ? 1 : 0;
  return `M ${sx} ${sy} A ${r} ${r} 0 ${large} ${sweep} ${ex} ${ey}`;
}

function drawSymbol(component) {
  const sym = getSymbol(component.type);
  if (!sym) return null;
  const g = make("g", {
    transform: `translate(${component.x} ${component.y}) rotate(${component.rotation || 0})`,
    "data-id": component.id,
  });
  sym.shapes.forEach((shape) => {
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
  label.textContent = `${component.properties?.ref || ""} ${component.properties?.value || ""}`.trim();
  g.appendChild(label);
  return g;
}

export function componentPinsWorld(component) {
  const sym = getSymbol(component.type);
  if (!sym) return [];
  const rot = component.rotation || 0;
  return sym.pins.map((p) => {
    const rotated = rotatePoint({ x: p.x, y: p.y }, rot);
    return translatePoint(rotated, component.x, component.y);
  });
}

export function createSchematicRenderer(layers, state) {
  function render() {
    clearLayer(layers.componentLayer);
    clearLayer(layers.wireLayer);
    clearLayer(layers.labelLayer);
    clearLayer(layers.overlayLayer);

    state.document.wires.forEach((wire) => {
      const poly = make("polyline", {
        points: wire.points.map((p) => `${p.x},${p.y}`).join(" "),
        fill: "none",
        stroke: state.selection.includes(wire.id)
          ? "#38bdf8"
          : state.hover === wire.id
            ? "#facc15"
            : "#0f172a",
        "stroke-width": 2,
        "data-id": wire.id,
      });
      layers.wireLayer.appendChild(poly);
    });

    state.document.components.forEach((cmp) => {
      const g = drawSymbol(cmp);
      if (!g) return;
      if (state.selection.includes(cmp.id)) {
        g.querySelectorAll("*").forEach((el) => {
          if (el.tagName !== "circle") el.setAttribute("stroke", "#38bdf8");
        });
      }
      g.querySelectorAll("circle").forEach((pinEl) => {
        const name = pinEl.getAttribute("data-pin");
        const pinKey = `${cmp.id}:pin:${name}`;
        if (state.hover === pinKey) {
          pinEl.setAttribute("fill", "#facc15");
          pinEl.setAttribute("stroke", "#facc15");
        } else if (state.selection.includes(pinKey)) {
          pinEl.setAttribute("fill", "#38bdf8");
          pinEl.setAttribute("stroke", "#38bdf8");
        }
      });
      layers.componentLayer.appendChild(g);
    });

    if (state.wireDraft?.points?.length) {
      const draft = make("polyline", {
        points: state.wireDraft.points.map((p) => `${p.x},${p.y}`).join(" "),
        fill: "none",
        stroke: "#38bdf8",
        "stroke-width": 2,
        "stroke-dasharray": "4 3",
      });
      layers.overlayLayer.appendChild(draft);
    }

    if (state.placeDraft?.start && state.placeDraft?.end) {
      const draft = make("line", {
        x1: state.placeDraft.start.x,
        y1: state.placeDraft.start.y,
        x2: state.placeDraft.end.x,
        y2: state.placeDraft.end.y,
        stroke: "#38bdf8",
        "stroke-width": 2,
        "stroke-dasharray": "4 3",
      });
      layers.overlayLayer.appendChild(draft);
    }

    const highlight = new Set(state.selection || []);
    highlight.forEach((id) => {
      const cmp = state.document.components.find((c) => c.id === id);
      if (cmp) {
        const sym = getSymbol(cmp.type);
        if (sym) {
          const box = make("rect", {
            x: cmp.x - (sym.size?.w || 80) / 2 - 6,
            y: cmp.y - (sym.size?.h || 40) / 2 - 6,
            width: (sym.size?.w || 80) + 12,
            height: (sym.size?.h || 40) + 12,
            fill: "none",
            stroke: "#38bdf8",
            "stroke-width": 2,
          });
          layers.overlayLayer.appendChild(box);
        }
      }
      const wire = state.document.wires.find((w) => w.id === id);
      if (wire) {
        const poly = make("polyline", {
          points: wire.points.map((p) => `${p.x},${p.y}`).join(" "),
          fill: "none",
          stroke: "#38bdf8",
          "stroke-width": 4,
          "stroke-opacity": 0.35,
        });
        layers.overlayLayer.appendChild(poly);
      }
    });
  }

  return { render };
}
