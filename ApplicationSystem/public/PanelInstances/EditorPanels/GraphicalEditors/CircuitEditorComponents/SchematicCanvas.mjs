// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CircuitEditorComponents/SchematicCanvas.mjs
// This file defines the SVG canvas used by the circuit editor. This file manages grid defs, zoom, and pan while exposing layer references.

const SVG_NS = "http://www.w3.org/2000/svg";

function createLayer(name) {
  const g = document.createElementNS(SVG_NS, "g");
  g.setAttribute("data-layer", name);
  return g;
}

export function createSchematicCanvas(host, state, onViewChange) {
  host.innerHTML = "";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("tabindex", "0");
  Object.assign(svg.style, {
    width: "100%",
    height: "100%",
    background: "#ffffff",
    touchAction: "none",
  });

  const defs = document.createElementNS(SVG_NS, "defs");
  const pattern = document.createElementNS(SVG_NS, "pattern");
  pattern.id = "grid-pattern";
  pattern.setAttribute("patternUnits", "userSpaceOnUse");
  pattern.setAttribute("width", state.document.sheet.gridSize);
  pattern.setAttribute("height", state.document.sheet.gridSize);
  const plus = document.createElementNS(SVG_NS, "path");
  const half = state.document.sheet.gridSize / 2;
  const arm = Math.max(2, Math.min(half - 1, 4));
  plus.setAttribute("d", `M ${half} ${half - arm} L ${half} ${half + arm} M ${half - arm} ${half} L ${half + arm} ${half}`);
  plus.setAttribute("stroke", "#cbd5e1");
  plus.setAttribute("stroke-width", "1.2");
  plus.setAttribute("stroke-linecap", "round");
  pattern.appendChild(plus);
  defs.appendChild(pattern);
  svg.appendChild(defs);

  const content = document.createElementNS(SVG_NS, "g");
  const gridLayer = createLayer("grid");
  const wireLayer = createLayer("wires");
  const componentLayer = createLayer("components");
  const labelLayer = createLayer("labels");
  const overlayLayer = createLayer("overlay");
  content.append(gridLayer, wireLayer, componentLayer, labelLayer, overlayLayer);
  svg.appendChild(content);
  host.appendChild(svg);

  const gridRect = document.createElementNS(SVG_NS, "rect");
  gridRect.setAttribute("fill", "url(#grid-pattern)");
  gridRect.setAttribute("width", "10000");
  gridRect.setAttribute("height", "10000");
  gridRect.setAttribute("x", "-2000");
  gridRect.setAttribute("y", "-2000");
  gridLayer.appendChild(gridRect);

  function updateTransform() {
    content.setAttribute("transform", `translate(${state.pan.x} ${state.pan.y}) scale(${state.zoom})`);
  }

  function updateGridSize(size) {
    pattern.setAttribute("width", size);
    pattern.setAttribute("height", size);
    const halfSize = size / 2;
    const arm = Math.max(2, Math.min(halfSize - 1, 4));
    plus.setAttribute("d", `M ${halfSize} ${halfSize - arm} L ${halfSize} ${halfSize + arm} M ${halfSize - arm} ${halfSize} L ${halfSize + arm} ${halfSize}`);
  }

  function updateCursor(tool = state.tool) {
    const cursor = tool === "place" ? "crosshair" : tool === "wire" ? "crosshair" : "default";
    svg.style.cursor = cursor;
  }

  let panning = false;
  let last = null;
  svg.addEventListener("pointerdown", (evt) => {
    if (evt.button === 1 || evt.button === 2 || evt.altKey) {
      panning = true;
      last = { x: evt.clientX, y: evt.clientY };
      svg.setPointerCapture(evt.pointerId);
    }
  });
  svg.addEventListener("pointermove", (evt) => {
    if (!panning || !last) return;
    const dx = evt.clientX - last.x;
    const dy = evt.clientY - last.y;
    state.pan.x += dx;
    state.pan.y += dy;
    last = { x: evt.clientX, y: evt.clientY };
    updateTransform();
    onViewChange?.("pan");
  });
  const stopPan = (evt) => {
    if (!panning) return;
    panning = false;
    last = null;
    svg.releasePointerCapture(evt.pointerId);
  };
  svg.addEventListener("pointerup", stopPan);
  svg.addEventListener("pointerleave", stopPan);

  svg.addEventListener("wheel", (evt) => {
    evt.preventDefault();
    const factor = evt.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(4, Math.max(0.35, state.zoom * factor));
    const rect = svg.getBoundingClientRect();
    const px = evt.clientX - rect.left;
    const py = evt.clientY - rect.top;
    const wx = (px - state.pan.x) / state.zoom;
    const wy = (py - state.pan.y) / state.zoom;
    state.zoom = newZoom;
    state.pan.x = px - wx * state.zoom;
    state.pan.y = py - wy * state.zoom;
    updateTransform();
    onViewChange?.("zoom");
  }, { passive: false });

  function toWorld(evt) {
    const rect = svg.getBoundingClientRect();
    const x = (evt.clientX - rect.left - state.pan.x) / state.zoom;
    const y = (evt.clientY - rect.top - state.pan.y) / state.zoom;
    return { x, y };
  }

  updateTransform();

  return {
    svg,
    gridLayer,
    wireLayer,
    componentLayer,
    labelLayer,
    overlayLayer,
    content,
    updateTransform,
    updateGridSize,
    toWorld,
    updateCursor,
  };
}
