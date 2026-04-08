// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CircuitEditorComponents/SymbolLibrary.mjs
// This file defines a small built-in circuit symbol library for the schematic editor. This file keeps pin metadata and vector strokes for each symbol.

export const SYMBOL_LIBRARY = [
  {
    id: "resistor",
    label: "Resistor",
    size: { w: 140, h: 40 },
    pins: [{ name: "1", x: -70, y: 0 }, { name: "2", x: 70, y: 0 }],
    shapes: [{ type: "polyline", points: "-70,0 -50,0 -40,-12 -30,12 -20,-12 -10,12 0,-12 10,12 20,-12 30,12 40,-12 50,0 70,0" }],
    defaults: { ref: "R?", value: "1k" },
    placeMode: "twoPoint",
  },
  {
    id: "capacitor",
    label: "Capacitor",
    size: { w: 120, h: 60 },
    pins: [{ name: "1", x: -60, y: 0 }, { name: "2", x: 60, y: 0 }],
    shapes: [
      { type: "line", x1: -20, y1: -30, x2: -20, y2: 30 },
      { type: "line", x1: 20, y1: -30, x2: 20, y2: 30 },
      { type: "line", x1: -60, y1: 0, x2: -20, y2: 0 },
      { type: "line", x1: 20, y1: 0, x2: 60, y2: 0 },
    ],
    defaults: { ref: "C?", value: "1uF" },
  },
  {
    id: "inductor",
    label: "Inductor",
    size: { w: 140, h: 40 },
    pins: [{ name: "1", x: -70, y: 0 }, { name: "2", x: 70, y: 0 }],
    shapes: [
      { type: "arc", cx: -40, cy: 0, r: 15, start: -Math.PI, end: 0 },
      { type: "arc", cx: -10, cy: 0, r: 15, start: -Math.PI, end: 0 },
      { type: "arc", cx: 20, cy: 0, r: 15, start: -Math.PI, end: 0 },
      { type: "arc", cx: 50, cy: 0, r: 15, start: -Math.PI, end: 0 },
      { type: "line", x1: -70, y1: 0, x2: -55, y2: 0 },
      { type: "line", x1: 65, y1: 0, x2: 70, y2: 0 },
    ],
    defaults: { ref: "L?", value: "10uH" },
  },
  {
    id: "vsource",
    label: "Voltage Src",
    size: { w: 80, h: 80 },
    pins: [{ name: "+", x: 0, y: -50 }, { name: "-", x: 0, y: 50 }],
    shapes: [
      { type: "circle", cx: 0, cy: 0, r: 24 },
      { type: "line", x1: 0, y1: -50, x2: 0, y2: -24 },
      { type: "line", x1: 0, y1: 24, x2: 0, y2: 50 },
      { type: "line", x1: -8, y1: -6, x2: 8, y2: -6 },
      { type: "line", x1: 0, y1: -14, x2: 0, y2: 2 },
      { type: "line", x1: -8, y1: 12, x2: 8, y2: 12 },
    ],
    defaults: { ref: "V?", value: "DC 5V" },
  },
  {
    id: "isource",
    label: "Current Src",
    size: { w: 80, h: 80 },
    pins: [{ name: "+", x: 0, y: -50 }, { name: "-", x: 0, y: 50 }],
    shapes: [
      { type: "circle", cx: 0, cy: 0, r: 24 },
      { type: "line", x1: 0, y1: -50, x2: 0, y2: -24 },
      { type: "line", x1: 0, y1: 24, x2: 0, y2: 50 },
      { type: "polyline", points: "0,-12 0,12 -8,4 0,12 8,4" },
    ],
    defaults: { ref: "I?", value: "AC 1mA" },
  },
  {
    id: "ground",
    label: "Ground",
    size: { w: 60, h: 40 },
    pins: [{ name: "0", x: 0, y: -20 }],
    shapes: [
      { type: "line", x1: 0, y1: -20, x2: 0, y2: -4 },
      { type: "line", x1: -14, y1: -4, x2: 14, y2: -4 },
      { type: "line", x1: -10, y1: 4, x2: 10, y2: 4 },
      { type: "line", x1: -6, y1: 12, x2: 6, y2: 12 },
    ],
    defaults: { ref: "GND", value: "0" },
  },
  {
    id: "diode",
    label: "Diode",
    size: { w: 140, h: 60 },
    pins: [{ name: "A", x: -70, y: 0 }, { name: "K", x: 70, y: 0 }],
    shapes: [
      { type: "line", x1: -70, y1: 0, x2: -20, y2: 0 },
      { type: "line", x1: 20, y1: 0, x2: 70, y2: 0 },
      { type: "polygon", points: "-20,-30 20,0 -20,30" },
      { type: "line", x1: 20, y1: -30, x2: 20, y2: 30 },
    ],
    defaults: { ref: "D?", value: "1N4148" },
  },
  {
    id: "npn",
    label: "NPN BJT",
    size: { w: 120, h: 120 },
    pins: [{ name: "C", x: 0, y: -60 }, { name: "B", x: -60, y: 0 }, { name: "E", x: 0, y: 60 }],
    shapes: [
      { type: "circle", cx: 0, cy: 0, r: 22 },
      { type: "line", x1: 0, y1: -60, x2: 0, y2: -22 },
      { type: "line", x1: -60, y1: 0, x2: -22, y2: 0 },
      { type: "line", x1: 0, y1: 22, x2: 0, y2: 60 },
      { type: "polyline", points: "-8,16 16,40 6,46" },
    ],
    defaults: { ref: "Q?", value: "NPN" },
  },
  {
    id: "pnp",
    label: "PNP BJT",
    size: { w: 120, h: 120 },
    pins: [{ name: "C", x: 0, y: -60 }, { name: "B", x: -60, y: 0 }, { name: "E", x: 0, y: 60 }],
    shapes: [
      { type: "circle", cx: 0, cy: 0, r: 22 },
      { type: "line", x1: 0, y1: -60, x2: 0, y2: -22 },
      { type: "line", x1: -60, y1: 0, x2: -22, y2: 0 },
      { type: "line", x1: 0, y1: 22, x2: 0, y2: 60 },
      { type: "polyline", points: "16,16 -8,40 2,46" },
    ],
    defaults: { ref: "Q?", value: "PNP" },
  },
  {
    id: "nmos",
    label: "NMOS",
    size: { w: 140, h: 120 },
    pins: [{ name: "D", x: 0, y: -60 }, { name: "S", x: 0, y: 60 }, { name: "G", x: -60, y: 0 }],
    shapes: [
      { type: "line", x1: 0, y1: -60, x2: 0, y2: -20 },
      { type: "line", x1: 0, y1: 20, x2: 0, y2: 60 },
      { type: "rect", x: -20, y: -20, width: 40, height: 40 },
      { type: "line", x1: -60, y1: 0, x2: -20, y2: 0 },
      { type: "line", x1: -8, y1: -10, x2: -8, y2: 10 },
    ],
    defaults: { ref: "M?", value: "NMOS" },
  },
  {
    id: "pmos",
    label: "PMOS",
    size: { w: 140, h: 120 },
    pins: [{ name: "D", x: 0, y: -60 }, { name: "S", x: 0, y: 60 }, { name: "G", x: -60, y: 0 }],
    shapes: [
      { type: "line", x1: 0, y1: -60, x2: 0, y2: -20 },
      { type: "line", x1: 0, y1: 20, x2: 0, y2: 60 },
      { type: "rect", x: -20, y: -20, width: 40, height: 40 },
      { type: "line", x1: -60, y1: 0, x2: -20, y2: 0 },
      { type: "polyline", points: "-12,-10 -4,-10 -4,10 -12,10" },
    ],
    defaults: { ref: "M?", value: "PMOS" },
  },
  {
    id: "opamp",
    label: "Op-Amp",
    size: { w: 160, h: 140 },
    pins: [{ name: "+", x: -60, y: -20 }, { name: "-", x: -60, y: 20 }, { name: "out", x: 60, y: 0 }],
    shapes: [
      { type: "polygon", points: "-60,-60 60,0 -60,60" },
      { type: "line", x1: -60, y1: -20, x2: -20, y2: -20 },
      { type: "line", x1: -60, y1: 20, x2: -20, y2: 20 },
      { type: "line", x1: 20, y1: 0, x2: 60, y2: 0 },
      { type: "line", x1: -44, y1: -30, x2: -44, y2: -10 },
      { type: "line", x1: -52, y1: -20, x2: -36, y2: -20 },
      { type: "line", x1: -52, y1: 20, x2: -36, y2: 20 },
    ],
    defaults: { ref: "U?", value: "OPAMP" },
  },
];

export function getSymbolList() {
  return SYMBOL_LIBRARY.map((s) => ({ id: s.id, label: s.label }));
}

export function getSymbol(id) {
  return SYMBOL_LIBRARY.find((s) => s.id === id) || null;
}
