// Nodevision/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditor.mjs
// Rich in-panel SVG editor with layers, drawing tools, fill/stroke controls, and crop/resize.

import { createElementLayers } from "./ElementLayers.mjs";

const SVG_NS = "http://www.w3.org/2000/svg";

function createSvgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, String(v)));
  return node;
}

function toSvgPoint(svgRoot, clientX, clientY) {
  const pt = svgRoot.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svgRoot.getScreenCTM();
  return ctm ? pt.matrixTransform(ctm.inverse()) : { x: 0, y: 0 };
}

function ensureSvgSizeAttrs(svgRoot) {
  if (!svgRoot.getAttribute("width")) svgRoot.setAttribute("width", "800");
  if (!svgRoot.getAttribute("height")) svgRoot.setAttribute("height", "600");
  if (!svgRoot.getAttribute("viewBox")) {
    const w = Number.parseFloat(svgRoot.getAttribute("width")) || 800;
    const h = Number.parseFloat(svgRoot.getAttribute("height")) || 600;
    svgRoot.setAttribute("viewBox", `0 0 ${w} ${h}`);
  }
}

export async function renderEditor(filePath, container) {
  if (!container) throw new Error("Container required");
  container.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.id = "editor-root";
  Object.assign(wrapper.style, {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    width: "100%",
    overflow: "hidden"
  });
  container.appendChild(wrapper);

  const topBar = document.createElement("div");
  Object.assign(topBar.style, {
    display: "flex",
    gap: "6px",
    alignItems: "center",
    padding: "6px",
    borderBottom: "1px solid #ddd",
    background: "#f4f4f4",
    fontFamily: "monospace"
  });
  wrapper.appendChild(topBar);

  const status = document.createElement("div");
  status.id = "svg-message";
  status.textContent = "SVG editor ready";
  status.style.marginLeft = "auto";
  status.style.fontSize = "12px";
  topBar.appendChild(status);

  const body = document.createElement("div");
  Object.assign(body.style, {
    display: "flex",
    flex: "1",
    minHeight: "0",
    overflow: "hidden",
    position: "relative"
  });
  wrapper.appendChild(body);

  const svgWrapper = document.createElement("div");
  Object.assign(svgWrapper.style, {
    flex: "1",
    overflow: "auto",
    background: "#fff",
    borderRight: "1px solid #ddd",
    position: "relative"
  });
  body.appendChild(svgWrapper);

  let svgRoot = createSvgEl("svg");
  svgRoot.id = "svg-editor";
  Object.assign(svgRoot.style, {
    width: "100%",
    height: "100%",
    minHeight: "400px",
    display: "block"
  });
  svgWrapper.appendChild(svgRoot);

  try {
    const res = await fetch(`/Notebook/${filePath}`);
    if (!res.ok) throw new Error(res.statusText);
    const svgText = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const loaded = doc.documentElement;
    svgRoot.replaceWith(loaded);
    svgRoot = loaded;
    svgRoot.id = "svg-editor";
    svgRoot.setAttribute("xmlns", SVG_NS);
  } catch (err) {
    wrapper.innerHTML = `<div style="color:red;padding:12px">Failed to load SVG: ${err.message}</div>`;
    console.error(err);
    return;
  }

  ensureSvgSizeAttrs(svgRoot);

  const layersPanelHost = document.createElement("div");
  Object.assign(layersPanelHost.style, {
    width: "260px",
    minWidth: "220px",
    maxWidth: "320px",
    display: "none",
    flexDirection: "column",
    gap: "8px",
    padding: "8px",
    background: "#fcfcfc",
    overflow: "auto",
    borderRight: "1px solid #ddd"
  });
  body.appendChild(layersPanelHost);

  const sidePanel = document.createElement("div");
  Object.assign(sidePanel.style, {
    width: "290px",
    minWidth: "240px",
    maxWidth: "340px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "8px",
    background: "#fcfcfc",
    overflow: "auto"
  });
  body.appendChild(sidePanel);

  const layersMgr = createElementLayers(svgRoot, layersPanelHost);

  const stylePanel = document.createElement("div");
  stylePanel.style.border = "1px solid #d0d0d0";
  stylePanel.style.background = "#fafafa";
  stylePanel.style.padding = "6px";
  stylePanel.innerHTML = `
    <div style="font-weight:700;margin-bottom:6px;">Style</div>
    <label style="display:block;font-size:12px;">Fill
      <input id="svg-fill-color" type="color" value="#80c0ff" style="margin-left:6px;">
    </label>
    <label style="display:block;font-size:12px;margin-top:6px;">Stroke
      <input id="svg-stroke-color" type="color" value="#000000" style="margin-left:6px;">
    </label>
    <label style="display:block;font-size:12px;margin-top:6px;">Stroke Width
      <input id="svg-stroke-width" type="number" min="0" step="0.5" value="2" style="width:78px;margin-left:6px;">
    </label>
    <button id="svg-apply-style" style="margin-top:8px;">Apply to Selected</button>
  `;
  sidePanel.appendChild(stylePanel);

  const canvasPanel = document.createElement("div");
  canvasPanel.style.border = "1px solid #d0d0d0";
  canvasPanel.style.background = "#fafafa";
  canvasPanel.style.padding = "6px";
  canvasPanel.innerHTML = `
    <div style="font-weight:700;margin-bottom:6px;">Canvas</div>
    <label style="display:block;font-size:12px;">Width
      <input id="svg-canvas-width" type="number" min="1" value="800" style="width:80px;margin-left:6px;">
    </label>
    <label style="display:block;font-size:12px;margin-top:6px;">Height
      <input id="svg-canvas-height" type="number" min="1" value="600" style="width:80px;margin-left:6px;">
    </label>
    <button id="svg-resize-canvas" style="margin-top:8px;">Resize / Crop</button>
    <button id="svg-crop-selection" style="margin-top:6px;">Crop To Selection</button>
  `;
  sidePanel.appendChild(canvasPanel);

  const widthInput = canvasPanel.querySelector("#svg-canvas-width");
  const heightInput = canvasPanel.querySelector("#svg-canvas-height");
  const fillInput = stylePanel.querySelector("#svg-fill-color");
  const strokeInput = stylePanel.querySelector("#svg-stroke-color");
  const strokeWidthInput = stylePanel.querySelector("#svg-stroke-width");

  const currentViewBox = (svgRoot.getAttribute("viewBox") || "").trim().split(/\s+/).map((n) => Number.parseFloat(n));
  widthInput.value = String(Number.isFinite(currentViewBox[2]) ? currentViewBox[2] : Number.parseFloat(svgRoot.getAttribute("width")) || 800);
  heightInput.value = String(Number.isFinite(currentViewBox[3]) ? currentViewBox[3] : Number.parseFloat(svgRoot.getAttribute("height")) || 600);

  const toolState = {
    mode: "select",
    drawing: false,
    startPoint: null,
    tempShape: null,
    bezierStep: 0,
    bezierPoints: []
  };

  let selectedElement = null;

  function setStatus(text) {
    status.textContent = text;
  }

  function setLayersPanelVisible(visible) {
    const show = Boolean(visible);
    layersPanelHost.style.display = show ? "flex" : "none";
    layersMgr.renderPanel();
    setStatus(show ? "Layers panel shown" : "Layers panel hidden");
    return show;
  }

  function toggleLayersPanel() {
    const isVisible = layersPanelHost.style.display !== "none";
    return setLayersPanelVisible(!isVisible);
  }

  function cropToSelection(padding = 8) {
    if (!selectedElement || selectedElement === svgRoot) {
      setStatus("Select an element first");
      return false;
    }
    try {
      const bbox = selectedElement.getBBox();
      if (!bbox || !Number.isFinite(bbox.width) || !Number.isFinite(bbox.height) || bbox.width <= 0 || bbox.height <= 0) {
        setStatus("Unable to crop: invalid selection bounds");
        return false;
      }
      const pad = Number.isFinite(padding) ? Math.max(0, padding) : 0;
      const x = bbox.x - pad;
      const y = bbox.y - pad;
      const w = Math.max(1, bbox.width + pad * 2);
      const h = Math.max(1, bbox.height + pad * 2);
      svgRoot.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
      svgRoot.setAttribute("width", String(w));
      svgRoot.setAttribute("height", String(h));
      widthInput.value = String(Math.round(w));
      heightInput.value = String(Math.round(h));
      setStatus(`Cropped to selection (${Math.round(w)}x${Math.round(h)})`);
      return true;
    } catch (err) {
      console.warn("Crop to selection failed:", err);
      setStatus("Crop failed");
      return false;
    }
  }

  function selectElement(el) {
    if (selectedElement && selectedElement !== el) {
      selectedElement.removeAttribute("data-selected");
      selectedElement.style.filter = "";
    }
    selectedElement = el;
    window.selectedSVGElement = el;
    if (!el) return;
    el.setAttribute("data-selected", "true");
    el.style.filter = "drop-shadow(0 0 2px #ff2f2f)";
  }

  function appendElement(el) {
    layersMgr.appendToActiveLayer(el);
    selectElement(el);
  }

  function currentStyleDefaults() {
    return {
      fill: fillInput.value || "#80c0ff",
      stroke: strokeInput.value || "#000000",
      strokeWidth: strokeWidthInput.value || "2"
    };
  }

  function insertShape(kind) {
    const style = currentStyleDefaults();
    let el = null;
    if (kind === "rect") {
      el = createSvgEl("rect", { x: 20, y: 20, width: 120, height: 80, fill: style.fill, stroke: style.stroke, "stroke-width": style.strokeWidth });
    } else if (kind === "circle") {
      el = createSvgEl("circle", { cx: 80, cy: 80, r: 40, fill: style.fill, stroke: style.stroke, "stroke-width": style.strokeWidth });
    } else if (kind === "ellipse") {
      el = createSvgEl("ellipse", { cx: 90, cy: 70, rx: 70, ry: 35, fill: style.fill, stroke: style.stroke, "stroke-width": style.strokeWidth });
    } else if (kind === "polygon") {
      el = createSvgEl("polygon", { points: "60,20 110,90 20,90", fill: style.fill, stroke: style.stroke, "stroke-width": style.strokeWidth });
    } else if (kind === "line") {
      el = createSvgEl("line", { x1: 20, y1: 20, x2: 140, y2: 80, stroke: style.stroke, "stroke-width": style.strokeWidth });
    } else if (kind === "path-bezier") {
      el = createSvgEl("path", { d: "M 20 20 C 60 0 120 120 170 70", fill: "none", stroke: style.stroke, "stroke-width": style.strokeWidth });
    }
    if (!el) return null;
    appendElement(el);
    setStatus(`Inserted ${kind}`);
    return el;
  }

  function setMode(mode) {
    toolState.mode = mode;
    toolState.drawing = false;
    toolState.tempShape = null;
    toolState.startPoint = null;
    toolState.bezierStep = 0;
    toolState.bezierPoints = [];
    const cursor = mode === "select" ? "default" : "crosshair";
    svgRoot.style.cursor = cursor;
    setStatus(`Tool: ${mode}`);
  }

  svgRoot.addEventListener("click", (e) => {
    if (!(e.target instanceof SVGElement)) return;
    if (toolState.mode !== "select") return;
    if (e.target === svgRoot) {
      selectElement(null);
      return;
    }
    selectElement(e.target);
  });

  svgRoot.addEventListener("pointerdown", (e) => {
    if (toolState.mode === "select") return;
    const p = toSvgPoint(svgRoot, e.clientX, e.clientY);

    if (toolState.mode === "line") {
      const style = currentStyleDefaults();
      toolState.drawing = true;
      toolState.startPoint = p;
      toolState.tempShape = createSvgEl("line", {
        x1: p.x, y1: p.y, x2: p.x, y2: p.y,
        stroke: style.stroke,
        "stroke-width": style.strokeWidth
      });
      appendElement(toolState.tempShape);
      return;
    }

    if (toolState.mode === "freehand") {
      const style = currentStyleDefaults();
      toolState.drawing = true;
      toolState.tempShape = createSvgEl("path", {
        d: `M ${p.x} ${p.y}`,
        fill: "none",
        stroke: style.stroke,
        "stroke-width": style.strokeWidth
      });
      appendElement(toolState.tempShape);
      return;
    }

    if (toolState.mode === "bezier") {
      toolState.bezierPoints.push(p);
      if (toolState.bezierPoints.length === 4) {
        const style = currentStyleDefaults();
        const [p0, p1, p2, p3] = toolState.bezierPoints;
        const d = `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`;
        const path = createSvgEl("path", {
          d,
          fill: "none",
          stroke: style.stroke,
          "stroke-width": style.strokeWidth
        });
        appendElement(path);
        toolState.bezierPoints = [];
        setStatus("Bezier created");
      } else {
        setStatus(`Bezier point ${toolState.bezierPoints.length}/4`);
      }
    }
  });

  svgRoot.addEventListener("pointermove", (e) => {
    if (!toolState.drawing || !toolState.tempShape) return;
    const p = toSvgPoint(svgRoot, e.clientX, e.clientY);
    if (toolState.mode === "line") {
      toolState.tempShape.setAttribute("x2", String(p.x));
      toolState.tempShape.setAttribute("y2", String(p.y));
    } else if (toolState.mode === "freehand") {
      const d = toolState.tempShape.getAttribute("d") || "";
      toolState.tempShape.setAttribute("d", `${d} L ${p.x} ${p.y}`);
    }
  });

  svgRoot.addEventListener("pointerup", () => {
    if (!toolState.drawing) return;
    toolState.drawing = false;
    toolState.tempShape = null;
  });

  stylePanel.querySelector("#svg-apply-style").addEventListener("click", () => {
    if (!selectedElement) {
      setStatus("No selected element");
      return;
    }
    selectedElement.setAttribute("fill", fillInput.value);
    selectedElement.setAttribute("stroke", strokeInput.value);
    selectedElement.setAttribute("stroke-width", strokeWidthInput.value || "2");
    setStatus("Applied style");
  });

  canvasPanel.querySelector("#svg-resize-canvas").addEventListener("click", () => {
    const w = Math.max(1, Number.parseFloat(widthInput.value) || 1);
    const h = Math.max(1, Number.parseFloat(heightInput.value) || 1);
    svgRoot.setAttribute("width", String(w));
    svgRoot.setAttribute("height", String(h));
    svgRoot.setAttribute("viewBox", `0 0 ${w} ${h}`);
    setStatus(`Canvas resized to ${w}x${h}`);
  });

  canvasPanel.querySelector("#svg-crop-selection").addEventListener("click", () => {
    cropToSelection(8);
  });

  // Nodevision hooks
  window.getEditorHTML = () => new XMLSerializer().serializeToString(svgRoot);

  window.setEditorHTML = (svgString) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    const fresh = doc.documentElement;
    svgRoot.replaceWith(fresh);
    svgRoot = fresh;
    svgRoot.id = "svg-editor";
    ensureSvgSizeAttrs(svgRoot);
  };

  window.saveWYSIWYGFile = async (path) => {
    const content = window.getEditorHTML();
    await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: path || filePath, content })
    });
    setStatus(`Saved: ${path || filePath}`);
  };

  window.selectSVGElement = selectElement;
  window.SVGEditorContext = {
    svgRoot,
    layers: layersMgr,
    setMode,
    insertShape,
    toggleLayersPanel,
    setLayersPanelVisible,
    isLayersPanelVisible() {
      return layersPanelHost.style.display !== "none";
    },
    setFillColor(value) {
      fillInput.value = value;
      if (selectedElement) selectedElement.setAttribute("fill", value);
    },
    resizeCanvas(width, height) {
      widthInput.value = String(width);
      heightInput.value = String(height);
      canvasPanel.querySelector("#svg-resize-canvas").click();
    },
    cropToSelection(padding = 8) {
      return cropToSelection(padding);
    },
    getSelectedElement() {
      return selectedElement;
    }
  };
  window.toggleSVGLayersPanel = toggleLayersPanel;

  setMode("select");
  console.log("SVG editor loaded for:", filePath);
}
