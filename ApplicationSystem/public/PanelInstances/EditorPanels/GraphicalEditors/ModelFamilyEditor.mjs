// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/ModelFamilyEditor.mjs
// This file defines browser-side Model Family Editor logic for the Nodevision UI. It renders interface components and handles user interactions.
import {
  resetEditorHooks,
  ensureNodevisionState,
  createBaseLayout,
  fetchArrayBuffer,
  fileExt,
  saveText,
  saveBase64,
} from "./FamilyEditorCommon.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";
import { parseNetlist } from "/PanelInstances/ViewPanels/FileViewers/ViewCIR/parseNetlist.mjs";

function detectText(bytes) {
  if (!bytes || bytes.length === 0) return true;
  let suspicious = 0;
  const sampleLen = Math.min(bytes.length, 4096);
  for (let i = 0; i < sampleLen; i += 1) {
    const b = bytes[i];
    if (b === 0) return false;
    if (b < 7 || (b > 14 && b < 32)) suspicious += 1;
  }
  return suspicious / sampleLen < 0.15;
}

function buildCircuitSVG(components = []) {
  const width = 640;
  const rowHeight = 90;
  const height = Math.max(200, components.length * rowHeight + 40);
  const xLeft = 50;
  const xRight = width - 50;
  const xCenter = (xLeft + xRight) / 2;

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.style.background = "#fafafa";

  components.forEach((comp, idx) => {
    const y = 50 + idx * rowHeight;
    const group = document.createElementNS(svgNS, "g");

    const nodeLeft = document.createElementNS(svgNS, "circle");
    nodeLeft.setAttribute("cx", xLeft);
    nodeLeft.setAttribute("cy", y);
    nodeLeft.setAttribute("r", 4);
    nodeLeft.setAttribute("fill", "#333");

    const nodeRight = document.createElementNS(svgNS, "circle");
    nodeRight.setAttribute("cx", xRight);
    nodeRight.setAttribute("cy", y);
    nodeRight.setAttribute("r", 4);
    nodeRight.setAttribute("fill", "#333");

    const wireLeft = document.createElementNS(svgNS, "line");
    wireLeft.setAttribute("x1", xLeft);
    wireLeft.setAttribute("y1", y);
    wireLeft.setAttribute("x2", xCenter - 30);
    wireLeft.setAttribute("y2", y);
    wireLeft.setAttribute("stroke", "#444");
    wireLeft.setAttribute("stroke-width", "2");

    const wireRight = document.createElementNS(svgNS, "line");
    wireRight.setAttribute("x1", xCenter + 30);
    wireRight.setAttribute("y1", y);
    wireRight.setAttribute("x2", xRight);
    wireRight.setAttribute("y2", y);
    wireRight.setAttribute("stroke", "#444");
    wireRight.setAttribute("stroke-width", "2");

    const symbolGroup = document.createElementNS(svgNS, "g");
    const type = (comp.type || "").toUpperCase();

    if (type === "V") {
      const circle = document.createElementNS(svgNS, "circle");
      circle.setAttribute("cx", xCenter);
      circle.setAttribute("cy", y);
      circle.setAttribute("r", 20);
      circle.setAttribute("fill", "#fff");
      circle.setAttribute("stroke", "#1f6feb");
      circle.setAttribute("stroke-width", "2.5");

      const text = document.createElementNS(svgNS, "text");
      text.setAttribute("x", xCenter);
      text.setAttribute("y", y + 5);
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("font-size", "16");
      text.setAttribute("font-family", "ui-monospace, SFMono-Regular, Menlo, monospace");
      text.setAttribute("fill", "#1f6feb");
      text.textContent = "V";

      symbolGroup.appendChild(circle);
      symbolGroup.appendChild(text);
    } else if (type === "R") {
      const rect = document.createElementNS(svgNS, "rect");
      rect.setAttribute("x", xCenter - 28);
      rect.setAttribute("y", y - 12);
      rect.setAttribute("width", 56);
      rect.setAttribute("height", 24);
      rect.setAttribute("rx", 4);
      rect.setAttribute("fill", "#fff");
      rect.setAttribute("stroke", "#f97316");
      rect.setAttribute("stroke-width", "2.5");
      symbolGroup.appendChild(rect);
    } else if (type === "C") {
      const plate1 = document.createElementNS(svgNS, "line");
      plate1.setAttribute("x1", xCenter - 12);
      plate1.setAttribute("y1", y - 16);
      plate1.setAttribute("x2", xCenter - 12);
      plate1.setAttribute("y2", y + 16);
      plate1.setAttribute("stroke", "#0f172a");
      plate1.setAttribute("stroke-width", "2.5");

      const plate2 = document.createElementNS(svgNS, "line");
      plate2.setAttribute("x1", xCenter + 12);
      plate2.setAttribute("y1", y - 16);
      plate2.setAttribute("x2", xCenter + 12);
      plate2.setAttribute("y2", y + 16);
      plate2.setAttribute("stroke", "#0f172a");
      plate2.setAttribute("stroke-width", "2.5");

      symbolGroup.appendChild(plate1);
      symbolGroup.appendChild(plate2);
    } else {
      const rect = document.createElementNS(svgNS, "rect");
      rect.setAttribute("x", xCenter - 24);
      rect.setAttribute("y", y - 10);
      rect.setAttribute("width", 48);
      rect.setAttribute("height", 20);
      rect.setAttribute("rx", 3);
      rect.setAttribute("fill", "#fff");
      rect.setAttribute("stroke", "#111");
      rect.setAttribute("stroke-width", "2");
      symbolGroup.appendChild(rect);
    }

    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("x", xCenter);
    label.setAttribute("y", y - 28);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("font-size", "12");
    label.setAttribute("font-family", "ui-monospace, SFMono-Regular, Menlo, monospace");
    label.setAttribute("fill", "#111");
    label.textContent = `${type}${comp.name || ""}`;

    const leftNodeLabel = document.createElementNS(svgNS, "text");
    leftNodeLabel.setAttribute("x", xLeft - 4);
    leftNodeLabel.setAttribute("y", y + 16);
    leftNodeLabel.setAttribute("text-anchor", "end");
    leftNodeLabel.setAttribute("font-size", "11");
    leftNodeLabel.setAttribute("font-family", "ui-monospace, SFMono-Regular, Menlo, monospace");
    leftNodeLabel.setAttribute("fill", "#444");
    leftNodeLabel.textContent = comp.nodes?.[0] || "";

    const rightNodeLabel = document.createElementNS(svgNS, "text");
    rightNodeLabel.setAttribute("x", xRight + 4);
    rightNodeLabel.setAttribute("y", y + 16);
    rightNodeLabel.setAttribute("text-anchor", "start");
    rightNodeLabel.setAttribute("font-size", "11");
    rightNodeLabel.setAttribute("font-family", "ui-monospace, SFMono-Regular, Menlo, monospace");
    rightNodeLabel.setAttribute("fill", "#444");
    rightNodeLabel.textContent = comp.nodes?.[1] || "";

    group.appendChild(wireLeft);
    group.appendChild(wireRight);
    group.appendChild(symbolGroup);
    group.appendChild(nodeLeft);
    group.appendChild(nodeRight);
    group.appendChild(label);
    group.appendChild(leftNodeLabel);
    group.appendChild(rightNodeLabel);

    svg.appendChild(group);
  });

  return svg;
}

const CIR_ELEMENT_LIBRARY = [
  { key: "cirInsertResistor", type: "R", label: "Resistor", prefix: "R", defaultValue: "1k", terminals: 2, color: "#f97316" },
  { key: "cirInsertCapacitor", type: "C", label: "Capacitor", prefix: "C", defaultValue: "10u", terminals: 2, color: "#0ea5e9" },
  { key: "cirInsertInductor", type: "L", label: "Inductor", prefix: "L", defaultValue: "1m", terminals: 2, color: "#7c3aed" },
  { key: "cirInsertVoltageSource", type: "V", label: "Voltage Source", prefix: "V", defaultValue: "DC 5", terminals: 2, color: "#1f6feb" },
  { key: "cirInsertCurrentSource", type: "I", label: "Current Source", prefix: "I", defaultValue: "1mA", terminals: 2, color: "#16a34a" },
  { key: "cirInsertDiode", type: "D", label: "Diode", prefix: "D", defaultValue: "1N4148", terminals: 2, color: "#b91c1c" },
  { key: "cirInsertNPN", type: "Q", label: "BJT NPN", prefix: "Q", defaultValue: "NPN", terminals: 3, color: "#f59e0b" },
  { key: "cirInsertPNP", type: "Q", label: "BJT PNP", prefix: "Q", defaultValue: "PNP", terminals: 3, color: "#f59e0b" },
  { key: "cirInsertNMOS", type: "M", label: "NMOS", prefix: "M", defaultValue: "NMOS L=1u W=10u", terminals: 4, color: "#0f172a" },
  { key: "cirInsertPMOS", type: "M", label: "PMOS", prefix: "M", defaultValue: "PMOS L=1u W=10u", terminals: 4, color: "#0f172a" },
  { key: "cirInsertOpAmp", type: "X", label: "Op Amp", prefix: "X", defaultValue: "opamp_model", terminals: 3, color: "#2563eb" },
  { key: "cirInsertGround", type: "GND", label: "Ground", prefix: "GND", defaultValue: "0", terminals: 1, color: "#111827", isGround: true },
];

const TERMINAL_LAYOUTS = {
  1: [{ x: 0, y: 20 }],
  2: [
    { x: -32, y: 0 },
    { x: 32, y: 0 },
  ],
  3: [
    { x: -32, y: -16 },
    { x: -32, y: 16 },
    { x: 32, y: 0 },
  ],
  4: [
    { x: -32, y: -18 },
    { x: -32, y: 18 },
    { x: 32, y: -18 },
    { x: 32, y: 18 },
  ],
};

function terminalLayout(count = 2) {
  return (TERMINAL_LAYOUTS[count] || TERMINAL_LAYOUTS[2]).map((p) => ({ ...p }));
}

function normalizeNetName(name = "") {
  const trimmed = String(name).trim();
  if (!trimmed) return "n";
  if (trimmed.toLowerCase() === "gnd") return "0";
  return trimmed;
}

function buildStateFromNetlist(text = "") {
  const { components } = parseNetlist(text);
  const state = {
    components: [],
    nets: new Map(), // netName -> Set of { compId, terminal }
    counters: {},
  };

  const getCount = (prefix) => {
    state.counters[prefix] = (state.counters[prefix] || 0) + 1;
    return state.counters[prefix];
  };

  components.forEach((comp, idx) => {
    const library = CIR_ELEMENT_LIBRARY.find((e) => e.type === comp.type) || {
      prefix: comp.type,
      type: comp.type,
      terminals: comp.nodes?.length || 2,
      defaultValue: comp.value || comp.model || "",
      color: "#111827",
    };

    const id = comp.name || `${library.prefix}${getCount(library.prefix)}`;
    const terminals = terminalLayout(library.terminals || comp.nodes?.length || 2);

    const x = 140 + (idx % 4) * 160;
    const y = 120 + Math.floor(idx / 4) * 140;

    const nodes = [...(comp.nodes || [])];
    while (nodes.length < terminals.length) nodes.push(`n${getCount("n")}`);

    const element = {
      id,
      type: library.type,
      label: library.label || library.type,
      value: comp.value || comp.model || library.defaultValue || "",
      nodes,
      x,
      y,
      rotation: 0,
      color: library.color || "#111827",
      terminals: terminals.length,
    };

    state.components.push(element);

    element.nodes.forEach((netName, termIdx) => {
      const net = normalizeNetName(netName);
      const entry = state.nets.get(net) || new Set();
      entry.add(`${element.id}:${termIdx}`);
      state.nets.set(net, entry);
    });
  });

  if (!state.nets.has("0")) {
    state.nets.set("0", new Set());
  }

  return state;
}

function nextNetName(state) {
  state.counters.net = (state.counters.net || 0) + 1;
  return `n${state.counters.net}`;
}

function ensureComponentIds(state) {
  const used = new Set(state.components.map((c) => c.id));
  const counters = {};
  state.components.forEach((c) => {
    if (!c.id) {
      counters[c.type] = (counters[c.type] || 0) + 1;
      let candidate = `${c.type}${counters[c.type]}`;
      while (used.has(candidate)) {
        counters[c.type] += 1;
        candidate = `${c.type}${counters[c.type]}`;
      }
      c.id = candidate;
      used.add(candidate);
    }
  });
}

function generateNetlist(state) {
  ensureComponentIds(state);
  const lines = [];

  for (const comp of state.components) {
    if (comp.type === "GND") continue;
    const nodes = (comp.nodes || []).slice(0, comp.terminals || 2);
    const value = comp.value || "";
    const name = comp.id || `${comp.type}?`;
    const joinedNodes = nodes.join(" ");

    if (["R", "L", "C"].includes(comp.type)) {
      lines.push(`${name} ${joinedNodes} ${value || "1"}`);
    } else if (["V", "I"].includes(comp.type)) {
      lines.push(`${name} ${joinedNodes} ${value || "DC 0"}`);
    } else if (["D", "Q", "M", "X"].includes(comp.type)) {
      const model = value || "MODEL";
      lines.push(`${name} ${joinedNodes} ${model}`);
    } else {
      lines.push(`${name} ${joinedNodes} ${value}`.trim());
    }
  }

  return lines.join("\n");
}

function renderCanvasEditor(root, state, status, textarea, renderPreview) {
  root.innerHTML = "";

  const layout = document.createElement("div");
  layout.style.cssText = "display:flex;gap:12px;align-items:flex-start;min-height:360px;";

  const palette = document.createElement("div");
  palette.style.cssText = "width:200px;display:flex;flex-direction:column;gap:8px;";
  const paletteTitle = document.createElement("div");
  paletteTitle.textContent = "Palette";
  paletteTitle.style.cssText = "font:12px monospace;color:#222;";
  palette.appendChild(paletteTitle);

  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "Filter components";
  search.style.cssText = "padding:6px 8px;border:1px solid #cbd5e1;border-radius:6px;font:12px monospace;";
  palette.appendChild(search);

  const paletteList = document.createElement("div");
  paletteList.style.cssText = "display:grid;grid-template-columns:1fr;gap:6px;max-height:480px;overflow:auto;";
  palette.appendChild(paletteList);

  const canvasWrapper = document.createElement("div");
  canvasWrapper.style.cssText = [
    "flex:1",
    "min-height:360px",
    "border:1px solid #cbd5e1",
    "border-radius:10px",
    "background:linear-gradient(90deg, #f8fafc 24px, transparent 24px), linear-gradient(#f8fafc 24px, transparent 24px), linear-gradient(90deg, #e2e8f0 25px, transparent 26px), linear-gradient(#e2e8f0 25px, transparent 26px)",
    "background-size:48px 48px, 48px 48px, 48px 48px, 48px 48px",
    "background-position:-1px -1px, -1px -1px, -1px -1px, -1px -1px",
    "position:relative",
    "overflow:auto",
    "padding:24px",
    "box-sizing:border-box",
  ].join(";");

  const netLegend = document.createElement("div");
  netLegend.style.cssText = "width:220px;display:flex;flex-direction:column;gap:8px;";
  const legendTitle = document.createElement("div");
  legendTitle.textContent = "Nets";
  legendTitle.style.cssText = "font:12px monospace;color:#222;";
  netLegend.appendChild(legendTitle);

  const netsList = document.createElement("div");
  netsList.style.cssText = "display:flex;flex-direction:column;gap:4px;max-height:420px;overflow:auto;font:12px monospace;";
  netLegend.appendChild(netsList);

  layout.appendChild(palette);
  layout.appendChild(canvasWrapper);
  layout.appendChild(netLegend);
  root.appendChild(layout);

  const selection = new Set();
  let dragging = null;

  const addElement = (entry) => {
    if (!entry) return;
    const counters = state.counters;
    counters[entry.prefix] = (counters[entry.prefix] || 0) + 1;
    const id = `${entry.prefix}${counters[entry.prefix]}`;
    const posX = 120 + (state.components.length % 3) * 180;
    const posY = 120 + Math.floor(state.components.length / 3) * 140;
    const nodes = terminalLayout(entry.terminals).map(() => nextNetName(state));
    const element = {
      id,
      type: entry.type,
      label: entry.label,
      value: entry.defaultValue,
      nodes,
      x: posX,
      y: posY,
      rotation: 0,
      color: entry.color,
      terminals: entry.terminals,
    };

    state.components.push(element);
    nodes.forEach((net, termIdx) => {
      const n = normalizeNetName(net);
      const set = state.nets.get(n) || new Set();
      set.add(`${id}:${termIdx}`);
      state.nets.set(n, set);
    });

    renderCanvas();
    renderNets();
    syncTextarea();
  };

  const renderNets = () => {
    netsList.innerHTML = "";
    [...state.nets.keys()].sort().forEach((net) => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;";
      const label = document.createElement("span");
      label.textContent = net === "0" ? "0 (GND)" : net;
      row.appendChild(label);
      netsList.appendChild(row);
    });
  };

  const syncTextarea = () => {
    const netlist = generateNetlist(state);
    textarea.value = netlist;
    renderPreview(netlist);
    status.textContent = "Canvas updated -> netlist";
  };

  const renderPalette = () => {
    const query = search.value.trim().toLowerCase();
    paletteList.innerHTML = "";
    CIR_ELEMENT_LIBRARY.filter((e) => !query || e.label.toLowerCase().includes(query)).forEach((entry) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = `${entry.label} (${entry.type})`;
      btn.style.cssText = [
        "display:flex",
        "justify-content:space-between",
        "align-items:center",
        "gap:6px",
        "padding:8px 10px",
        "border:1px solid #cbd5e1",
        "border-radius:8px",
        "background:#fff",
        "cursor:grab",
        "font:12px monospace",
        `color:${entry.color}`,
      ].join(";");

      btn.addEventListener("click", () => addElement(entry));

      paletteList.appendChild(btn);
    });
  };

  function renderCanvas() {
    canvasWrapper.innerHTML = "";
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "2000");
    svg.setAttribute("height", "1200");
    svg.style.pointerEvents = "none";
    svg.style.position = "absolute";
    svg.style.left = "0";
    svg.style.top = "0";
    svg.style.overflow = "visible";
    canvasWrapper.appendChild(svg);

    const drawTerminalDot = (x, y, color = "#111") => {
      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("cx", x);
      dot.setAttribute("cy", y);
      dot.setAttribute("r", "4");
      dot.setAttribute("fill", color);
      svg.appendChild(dot);
    };

    const drawWire = (start, end, highlight = false) => {
      const path = document.createElementNS(svgNS, "path");
      const midX = (start.x + end.x) / 2;
      const d = `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
      path.setAttribute("d", d);
      path.setAttribute("stroke", highlight ? "#ef4444" : "#0f172a");
      path.setAttribute("stroke-width", highlight ? "3" : "2");
      path.setAttribute("fill", "none");
      svg.appendChild(path);
    };

    const cardLayer = document.createElement("div");
    cardLayer.style.position = "relative";
    cardLayer.style.width = "100%";
    cardLayer.style.height = "100%";
    canvasWrapper.appendChild(cardLayer);

    // Wires
    state.components.forEach((comp) => {
      const layout = terminalLayout(comp.terminals || 2);
      comp.nodes.forEach((net, idx) => {
        const netName = normalizeNetName(net);
        const peers = [...(state.nets.get(netName) || [])];
        peers.forEach((peer) => {
          const [peerId, peerTerm] = peer.split(":");
          if (peerId === comp.id) return;
          const peerComp = state.components.find((c) => c.id === peerId);
          if (!peerComp) return;
          const peerLayout = terminalLayout(peerComp.terminals || 2);
          const pPos = {
            x: peerComp.x + peerLayout[peerTerm]?.x || 0,
            y: peerComp.y + peerLayout[peerTerm]?.y || 0,
          };
          const cPos = {
            x: comp.x + layout[idx]?.x || 0,
            y: comp.y + layout[idx]?.y || 0,
          };
          const idKey = [comp.id, peerId].sort().join("::") + `:${idx}:${peerTerm}`;
          if (!svg.__drawnPaths) svg.__drawnPaths = new Set();
          if (svg.__drawnPaths.has(idKey)) return;
          svg.__drawnPaths.add(idKey);
          drawWire(cPos, pPos, selection.has(comp.id) || selection.has(peerId));
        });
      });
    });

    // Components
    state.components.forEach((comp) => {
      const card = document.createElement("div");
      card.style.cssText = [
        "position:absolute",
        `left:${comp.x - 60}px`,
        `top:${comp.y - 40}px`,
        "width:120px",
        "height:80px",
        "border:1px solid #cbd5e1",
        "border-radius:10px",
        "background:#fff",
        "box-shadow:0 4px 12px rgba(15,23,42,0.08)",
        "padding:8px",
        "box-sizing:border-box",
        "cursor:grab",
        `border-color:${selection.has(comp.id) ? "#ef4444" : "#cbd5e1"}`,
      ].join(";");

      const title = document.createElement("div");
      title.textContent = `${comp.id} (${comp.type})`;
      title.style.cssText = `font:12px monospace;color:${comp.color};margin-bottom:6px;`;

      const valueInput = document.createElement("input");
      valueInput.type = "text";
      valueInput.value = comp.value || "";
      valueInput.style.cssText = "width:100%;font:12px monospace;padding:4px 6px;border:1px solid #e2e8f0;border-radius:6px;";
      valueInput.addEventListener("input", () => {
        comp.value = valueInput.value;
        syncTextarea();
      });

      const netWrap = document.createElement("div");
      netWrap.style.cssText = "margin-top:6px;display:flex;flex-direction:column;gap:4px;";

      comp.nodes.forEach((net, idx) => {
        const row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;gap:6px;font:11px monospace;";
        const lbl = document.createElement("span");
        lbl.textContent = `n${idx+1}`;
        lbl.style.minWidth = "28px";
        const inp = document.createElement("input");
        inp.type = "text";
        inp.value = net;
        inp.style.cssText = "flex:1;font:11px monospace;padding:4px 6px;border:1px solid #e2e8f0;border-radius:6px;";
        inp.addEventListener("input", () => {
          const oldNet = normalizeNetName(comp.nodes[idx]);
          comp.nodes[idx] = inp.value;
          const newNet = normalizeNetName(inp.value);
          if (oldNet !== newNet) {
            const oldSet = state.nets.get(oldNet);
            if (oldSet) {
              oldSet.delete(`${comp.id}:${idx}`);
            }
            const set = state.nets.get(newNet) || new Set();
            set.add(`${comp.id}:${idx}`);
            state.nets.set(newNet, set);
          }
          renderNets();
          syncTextarea();
        });
        row.appendChild(lbl);
        row.appendChild(inp);
        netWrap.appendChild(row);
      });

      card.appendChild(title);
      card.appendChild(valueInput);
      card.appendChild(netWrap);

      card.addEventListener("pointerdown", (evt) => {
        selection.clear();
        selection.add(comp.id);
        dragging = {
          id: comp.id,
          startX: evt.clientX,
          startY: evt.clientY,
          origX: comp.x,
          origY: comp.y,
        };
        renderCanvas();
        card.setPointerCapture(evt.pointerId);
      });

      card.addEventListener("pointermove", (evt) => {
        if (!dragging || dragging.id !== comp.id) return;
        const dx = evt.clientX - dragging.startX;
        const dy = evt.clientY - dragging.startY;
        comp.x = dragging.origX + dx;
        comp.y = dragging.origY + dy;
        renderCanvas();
      });

      card.addEventListener("pointerup", () => {
        dragging = null;
        syncTextarea();
      });

      cardLayer.appendChild(card);

      // Terminals dots on overlay
      const layout = terminalLayout(comp.terminals || 2);
      layout.forEach((pos) => {
        drawTerminalDot(comp.x + pos.x, comp.y + pos.y, comp.color);
      });
    });
  }

  renderPalette();
  renderNets();
  renderCanvas();

  return { addElement };
}

export async function renderEditor(filePath, container) {
  resetEditorHooks();
  const ext = fileExt(filePath);
  const isCIR = ext === "cir";
  const currentMode = isCIR ? "CIRediting" : "ModelFamilyEditing";

  ensureNodevisionState(currentMode);
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.activeActionHandler = null;
  updateToolbarState({ currentMode, selectedFile: filePath, activeActionHandler: null });

  const { status, body } = createBaseLayout(container, `Model/CAD Editor — ${filePath}`);

  try {
    const buffer = await fetchArrayBuffer(filePath);
    const bytes = new Uint8Array(buffer);
    const likelyTextExt = new Set(["obj", "ply", "step", "stp", "scad", "gcode", "dxf", "vtk", "sdf", "ifc", "usd", "usda", "cir"]);
    const isText = detectText(bytes) || likelyTextExt.has(ext);

    const info = document.createElement("div");
    info.style.cssText = "font:12px monospace;color:#555;";
    info.textContent = `Extension: ${ext || "(none)"} | Size: ${bytes.length.toLocaleString()} bytes`;
    body.appendChild(info);

    if (isText && bytes.length < 4 * 1024 * 1024) {
      const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);

      const layout = document.createElement("div");
      layout.style.cssText = "display:flex;gap:12px;align-items:stretch;min-height:320px;";

      const editorCol = document.createElement("div");
      editorCol.style.cssText = "flex:1;min-width:320px;display:flex;flex-direction:column;gap:8px;";

      const textarea = document.createElement("textarea");
      textarea.id = "markdown-editor";
      textarea.value = text;
      textarea.spellcheck = false;
      textarea.style.cssText = [
        "width:100%",
        "height:100%",
        "min-height:260px",
        "resize:none",
        "padding:12px",
        "box-sizing:border-box",
        "font:13px/1.5 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        "border:1px solid #c9c9c9",
        "border-radius:8px",
        "background:#fff",
        "color:#111",
        "flex:1",
      ].join(";");

      editorCol.appendChild(textarea);
      layout.appendChild(editorCol);

      if (isCIR) {
        const previewTitle = document.createElement("div");
        previewTitle.style.cssText = "font:12px monospace;color:#333;margin-bottom:4px;";
        previewTitle.textContent = "Circuit preview";

        const previewArea = document.createElement("div");
        previewArea.id = "cir-preview";
        previewArea.style.cssText = "width:100%;min-height:280px;";

        const renderPreview = (value) => {
          try {
            const { components } = parseNetlist(value || "");
            previewArea.innerHTML = "";
            if (!components.length) {
              previewArea.innerHTML = "<div style='color:#666;font:12px monospace;'>No components to render.</div>";
              return;
            }
            const svg = buildCircuitSVG(components);
            previewArea.appendChild(svg);
          } catch (err) {
            previewArea.innerHTML = `<div style="color:#b00020;font:12px monospace;">Preview error: ${err.message}</div>`;
          }
        };

        const previewCol = document.createElement("div");
        previewCol.style.cssText = [
          "flex:1",
          "min-width:320px",
          "border:1px solid #c9c9c9",
          "border-radius:8px",
          "background:#fff",
          "padding:8px",
          "box-sizing:border-box",
          "min-height:360px",
          "overflow:auto",
          "display:flex",
          "flex-direction:column",
          "gap:10px",
        ].join(";");

        const canvasArea = document.createElement("div");
        canvasArea.id = "cir-canvas";
        canvasArea.style.cssText = "width:100%;min-height:320px;";

        previewCol.appendChild(previewTitle);
        previewCol.appendChild(canvasArea);
        previewCol.appendChild(previewArea);
        layout.appendChild(previewCol);
        body.appendChild(layout);

        const initialState = buildStateFromNetlist(textarea.value);
        const canvasApi = renderCanvasEditor(canvasArea, initialState, status, textarea, renderPreview);
        renderPreview(textarea.value);

        const cirToolbarHandler = (callbackKey) => {
          const entry = CIR_ELEMENT_LIBRARY.find((e) => e.key === callbackKey);
          if (!entry || !canvasApi?.addElement) return;
          canvasApi.addElement(entry);
        };
        window.NodevisionState.activeActionHandler = cirToolbarHandler;
        updateToolbarState({ currentMode, activeActionHandler: cirToolbarHandler });
      } else {
        body.appendChild(layout);
      }

      window.getEditorMarkdown = () => textarea.value;
      window.saveMDFile = async (path = filePath) => {
        await saveText(path, textarea.value);
      };
      status.textContent = isCIR ? "Circuit netlist mode" : "Model text mode";
      return;
    }

    let replacementBase64 = "";
    const panel = document.createElement("div");
    panel.style.cssText = "margin-top:8px;border:1px solid #c9c9c9;border-radius:8px;padding:12px;background:#fafafa;font:13px/1.45 monospace;";
    panel.innerHTML = "<div>Binary model mode: use replacement upload and Save.</div>";
    body.appendChild(panel);

    const input = document.createElement("input");
    input.type = "file";
    input.style.cssText = "margin-top:10px;max-width:420px;";
    panel.appendChild(input);

    const msg = document.createElement("div");
    msg.style.cssText = "margin-top:8px;color:#666;font:12px monospace;";
    msg.textContent = "No replacement file loaded.";
    panel.appendChild(msg);

    input.addEventListener("change", async () => {
      const f = input.files?.[0];
      if (!f) return;
      const dataURL = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });
      replacementBase64 = String(dataURL).split(",")[1] || "";
      msg.textContent = `Ready: ${f.name} (${f.size.toLocaleString()} bytes)`;
      status.textContent = "Replacement loaded. Press Save.";
    });

    window.saveWYSIWYGFile = async (path = filePath) => {
      if (!replacementBase64) throw new Error("No replacement file selected.");
      await saveBase64(path, replacementBase64);
    };
    status.textContent = "Model binary mode";
  } catch (err) {
    body.innerHTML = `<div style="color:#b00020;font:13px monospace;">Failed to load model file: ${err.message}</div>`;
    status.textContent = "Load failed";
  }
}
