// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CircuitEditorComponents/SchematicRenderer.mjs
// This file defines rendering helpers for the circuit editor. This file draws grid layers, components, wires, and selection overlays into SVG.

import { getSymbol } from "./SymbolLibrary.mjs";
import { rotatePoint, translatePoint } from "./CircuitGeometry.mjs";
import { clearLayer, drawSymbol, make } from "./SchematicSymbolRenderer.mjs";

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
