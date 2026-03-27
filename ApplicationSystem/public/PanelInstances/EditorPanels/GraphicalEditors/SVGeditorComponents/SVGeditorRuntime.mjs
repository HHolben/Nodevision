// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntime.mjs
// This module implements the SVG editor runtime. This module manages pointer interactions so users can select, draw, and transform SVG elements. This module exposes a stable window context so Nodevision tool callbacks and panels can control the editor.

import { createElementLayers } from "../ElementLayers.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";
import { ensureSvgEditingSplit, loadPanelIntoCell } from "/panels/workspace.mjs";
import {
  createSvgEl,
  toSvgPoint,
  ensureSvgSizeAttrs,
  parsePoints,
  formatPoints,
  getAttrNumber,
  setAttrNumber,
  distancePointToSegment,
} from "./svgDom.mjs";
import { fetchSvgText } from "./svgFetch.mjs";
import { createBezierToolController } from "./BezierToolController.mjs";
import { createPathNodeEditor } from "./PathNodeEditor.mjs";
import { createSvgUndoStack } from "./SvgUndoStack.mjs";

const SVG_NS = "http://www.w3.org/2000/svg";
const SVG_UI_ATTR = "data-nv-editor-ui";
const SVG_RULER_THICKNESS = 26;
const SVG_RULER_SIDE = 34;

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
  wrapper.tabIndex = 0;
  container.appendChild(wrapper);

  window.NodevisionState = window.NodevisionState || {};
  updateToolbarState({ currentMode: "SVG Editing" });

  const status = document.createElement("div");
  status.id = "svg-message";
  status.textContent = "SVG editor ready";
  status.style.display = "none";
  wrapper.appendChild(status);

  const body = document.createElement("div");
  Object.assign(body.style, {
    display: "flex",
    flex: "1",
    minHeight: "0",
    overflow: "hidden",
    position: "relative"
  });
  wrapper.appendChild(body);

  const rulerLayout = document.createElement("div");
  Object.assign(rulerLayout.style, {
    flex: "1",
    minHeight: "0",
    minWidth: "0",
    display: "grid",
    width: "100%",
    height: "100%",
    gridTemplateColumns: `${SVG_RULER_SIDE}px 1fr`,
    gridTemplateRows: `${SVG_RULER_THICKNESS}px 1fr`,
    overflow: "hidden"
  });
  body.appendChild(rulerLayout);

  const rulerCorner = document.createElement("div");
  Object.assign(rulerCorner.style, {
    gridArea: "1 / 1 / 2 / 2",
    background: "#f4f4f4",
    borderRight: "1px solid #ccc",
    borderBottom: "1px solid #ccc"
  });

  const svgTopRuler = document.createElement("canvas");
  Object.assign(svgTopRuler.style, {
    gridArea: "1 / 2 / 2 / 3",
    width: "100%",
    height: `${SVG_RULER_THICKNESS}px`,
    display: "block",
    background: "#f4f4f4"
  });

  const svgLeftRuler = document.createElement("canvas");
  Object.assign(svgLeftRuler.style, {
    gridArea: "2 / 1 / 3 / 2",
    width: `${SVG_RULER_SIDE}px`,
    height: "100%",
    display: "block",
    background: "#f4f4f4"
  });

  const svgViewportHost = document.createElement("div");
  Object.assign(svgViewportHost.style, {
    gridArea: "2 / 2 / 3 / 3",
    position: "relative",
    overflow: "hidden",
    background: "#ffffff",
    minWidth: "0",
    minHeight: "0"
  });

  const svgViewport = document.createElement("div");
  Object.assign(svgViewport.style, {
    position: "absolute",
    inset: "0",
    overflow: "auto",
    background: "#fff"
  });
  svgViewportHost.appendChild(svgViewport);

  rulerLayout.append(rulerCorner, svgTopRuler, svgLeftRuler, svgViewportHost);

  let svgRoot = createSvgEl("svg");
  svgRoot.id = "svg-editor";
  Object.assign(svgRoot.style, {
    width: "100%",
    height: "100%",
    minHeight: "400px",
    display: "block"
  });
  svgViewport.appendChild(svgRoot);

  let svgText = "";
  let loadError = null;
  if (filePath) {
    try {
      svgText = await fetchSvgText(filePath);
    } catch (err) {
      loadError = err;
    }
  }
  if (loadError && filePath) {
    wrapper.innerHTML = `<div style="color:red;padding:12px">Failed to load SVG: ${loadError.message}</div>`;
    console.warn("SVG editor: failed to load file, showing blank canvas as fallback.", loadError);
    svgText = "";
  }

  if (!svgText.trim()) {
    svgRoot.setAttribute("xmlns", SVG_NS);
    ensureSvgSizeAttrs(svgRoot);
  } else {
    const parser = new DOMParser();
    let doc = parser.parseFromString(svgText, "image/svg+xml");
    let parseError = doc.querySelector("parsererror");
    let loaded = doc.documentElement?.localName?.toLowerCase() === "svg"
      ? doc.documentElement
      : doc.querySelector("svg");
    if (parseError || !loaded) {
      // Fallback for SVG-like content that is not strict XML but still contains renderable SVG.
      const htmlDoc = parser.parseFromString(svgText, "text/html");
      const htmlSvg = htmlDoc.querySelector("svg");
      if (htmlSvg) {
        loaded = document.importNode(htmlSvg, true);
      }
    }
    if (!loaded || loaded.localName?.toLowerCase() !== "svg") {
      console.warn("SVG editor: loaded content was not parseable, defaulting to blank SVG.");
      svgRoot.setAttribute("xmlns", SVG_NS);
      ensureSvgSizeAttrs(svgRoot);
    } else {
      svgRoot.replaceWith(loaded);
      svgRoot = loaded;
      svgRoot.id = "svg-editor";
      svgRoot.setAttribute("xmlns", SVG_NS);
    }
  }

  ensureSvgSizeAttrs(svgRoot);

  const layersMgr = createElementLayers(svgRoot);
  let layersPanelHost = null;
  const originalLayersAttachHost =
    typeof layersMgr?.attachHost === "function"
      ? layersMgr.attachHost.bind(layersMgr)
      : null;
  if (originalLayersAttachHost) {
    layersMgr.attachHost = (host) => {
      layersPanelHost = host || null;
      return originalLayersAttachHost(host);
    };
  }
  const styleState = {
    fill: "#80c0ff",
    stroke: "#000000",
    strokeWidth: "0.1"
  };

  const toolState = {
    mode: "select",
    drawing: false,
    startPoint: null,
    tempShape: null,
    bezierStep: 0,
    bezierPoints: []
  };

  function syncModeFromToolbarState() {
    const desired = window.NodevisionState?.svgDrawTool;
    if (typeof desired !== "string" || !desired) return false;
    if (!["select", "line", "freehand", "bezier"].includes(desired)) return false;
    if (desired === toolState.mode) return false;
    if (toolState.drawing || dragState || marqueeState || lineHandleDragState || resizeState || rotateState) return false;
    setMode(desired);
    return true;
  }

  let selectedElement = null;
  let selectedElements = [];
  let svgClipboard = [];
  let dragState = null;
  let marqueeState = null;
  let lineHandleDragState = null;
  let resizeState = null;
  let rotateState = null;

  const overlayLayer = createSvgEl("g", { [SVG_UI_ATTR]: "overlay" });
  overlayLayer.style.pointerEvents = "none";
  const selectionBox = createSvgEl("rect", {
    [SVG_UI_ATTR]: "selection-box",
    fill: "none",
    stroke: "#2f80ff",
    "stroke-width": "1",
    "stroke-dasharray": "6 4",
    display: "none"
  });
  const marqueeBox = createSvgEl("rect", {
    [SVG_UI_ATTR]: "marquee-box",
    fill: "rgba(47,128,255,0.12)",
    stroke: "#2f80ff",
    "stroke-width": "1",
    "stroke-dasharray": "3 3",
    display: "none"
  });
  selectionBox.style.pointerEvents = "none";
  marqueeBox.style.pointerEvents = "none";

  function createOverlayHandle(kind, attrs = {}) {
    const node = createSvgEl(kind, {
      [SVG_UI_ATTR]: "handle",
      fill: "#ffffff",
      stroke: "#2f80ff",
      "stroke-width": "1.5",
      display: "none",
      ...attrs
    });
    node.style.pointerEvents = "all";
    node.style.cursor = "pointer";
    return node;
  }

  const lineStartHandle = createOverlayHandle("circle", { r: "5" });
  const lineEndHandle = createOverlayHandle("circle", { r: "5" });
  const resizeHandles = {
    nw: createOverlayHandle("rect", { width: "8", height: "8", rx: "1.5", ry: "1.5" }),
    ne: createOverlayHandle("rect", { width: "8", height: "8", rx: "1.5", ry: "1.5" }),
    se: createOverlayHandle("rect", { width: "8", height: "8", rx: "1.5", ry: "1.5" }),
    sw: createOverlayHandle("rect", { width: "8", height: "8", rx: "1.5", ry: "1.5" })
  };
  resizeHandles.nw.style.cursor = "nwse-resize";
  resizeHandles.se.style.cursor = "nwse-resize";
  resizeHandles.ne.style.cursor = "nesw-resize";
  resizeHandles.sw.style.cursor = "nesw-resize";

  overlayLayer.appendChild(selectionBox);
  overlayLayer.appendChild(marqueeBox);
  overlayLayer.appendChild(lineStartHandle);
  overlayLayer.appendChild(lineEndHandle);
  Object.values(resizeHandles).forEach((handle) => overlayLayer.appendChild(handle));

  const lineToolPreviewLine = createSvgEl("line", {
    [SVG_UI_ATTR]: "line-tool-preview-line",
    fill: "none",
    stroke: "#2f80ff",
    "stroke-width": "1.5",
    display: "none",
  });
  lineToolPreviewLine.style.pointerEvents = "none";

  const lineToolPreviewEnd = createSvgEl("circle", {
    [SVG_UI_ATTR]: "line-tool-preview-end",
    r: "3",
    fill: "#ffffff",
    stroke: "#2f80ff",
    "stroke-width": "1.5",
    display: "none",
  });
  lineToolPreviewEnd.style.pointerEvents = "none";

  const lineToolAngleArc = createSvgEl("path", {
    [SVG_UI_ATTR]: "line-tool-angle-arc",
    fill: "none",
    stroke: "#2f80ff",
    "stroke-width": "0.05",
    "stroke-dasharray": "1 4",
    "stroke-linecap": "round",
    display: "none",
  });
  lineToolAngleArc.style.pointerEvents = "none";

  const lineToolLengthLabel = createSvgEl("text", {
    [SVG_UI_ATTR]: "line-tool-length-label",
    fill: "#ffffff",
    "font-family": "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial",
    "font-size": "12",
    "text-anchor": "start",
    display: "none",
  });
  lineToolLengthLabel.style.pointerEvents = "none";
  lineToolLengthLabel.style.mixBlendMode = "difference";

  const lineToolAngleLabel = createSvgEl("text", {
    [SVG_UI_ATTR]: "line-tool-angle-label",
    fill: "#ffffff",
    "font-family": "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial",
    "font-size": "12",
    "text-anchor": "start",
    display: "none",
  });
  lineToolAngleLabel.style.pointerEvents = "none";
  lineToolAngleLabel.style.mixBlendMode = "difference";

  overlayLayer.appendChild(lineToolAngleArc);
  overlayLayer.appendChild(lineToolPreviewLine);
  overlayLayer.appendChild(lineToolPreviewEnd);
  overlayLayer.appendChild(lineToolLengthLabel);
  overlayLayer.appendChild(lineToolAngleLabel);

  // === Bezier tool preview ===
  const bezierToolPreviewPath = createSvgEl("path", {
    [SVG_UI_ATTR]: "bezier-tool-preview",
    fill: "none",
    stroke: "#2f80ff",
    "stroke-width": "1.5",
    display: "none",
  });
  bezierToolPreviewPath.style.pointerEvents = "none";
  overlayLayer.appendChild(bezierToolPreviewPath);
  svgRoot.appendChild(overlayLayer);

  const history = createSvgUndoStack(120);

  // Bezier creation + node editing controllers
  const bezierController = createBezierToolController({
    svgRoot,
    overlayPath: bezierToolPreviewPath,
    currentStyleDefaults,
    pointerToleranceInSvgUnits,
    findNearestSnapPointInRoot,
    snapAngleEndpointInRoot,
    rootPointToElementPoint,
    toRootPoint: (clientX, clientY) => toSvgPoint(svgRoot, clientX, clientY),
    setSelection,
    setStatus,
    getActiveLayer,
    history,
  });

  const nodeEditor = createPathNodeEditor({
    svgRoot,
    overlayLayer,
    pointerToleranceInSvgUnits,
    setStatus,
    history,
  });

  const lineToolState = {
    active: false,
    layer: null,
    startRoot: null,
    startSpace: null,
    pointsSpace: [],
    placedLines: [],
  };

  function hideLineToolOverlays() {
    lineToolPreviewLine.setAttribute("display", "none");
    lineToolPreviewEnd.setAttribute("display", "none");
    lineToolAngleArc.setAttribute("display", "none");
    lineToolLengthLabel.setAttribute("display", "none");
    lineToolAngleLabel.setAttribute("display", "none");
  }

  function setLineToolOverlayStyle(style) {
    const stroke = style?.stroke || "#2f80ff";
    const strokeWidth = style?.strokeWidth || "1.5";
    lineToolPreviewLine.setAttribute("stroke", stroke);
    lineToolPreviewLine.setAttribute("stroke-width", strokeWidth);
    lineToolPreviewEnd.setAttribute("stroke", stroke);
    lineToolPreviewEnd.setAttribute("stroke-width", strokeWidth);
    lineToolAngleArc.setAttribute("stroke", stroke);
  }

  function clearLineToolState() {
    lineToolState.active = false;
    lineToolState.layer = null;
    lineToolState.startRoot = null;
    lineToolState.startSpace = null;
    lineToolState.pointsSpace = [];
    lineToolState.placedLines = [];
    hideLineToolOverlays();
  }

  function commitLineToolGeometry() {
    const layer = lineToolState.layer;
    const points = lineToolState.pointsSpace || [];
    if (!layer || !Array.isArray(points) || points.length < 2) return null;

    if (points.length === 2) {
      const lastLine = lineToolState.placedLines[lineToolState.placedLines.length - 1] || null;
      if (lastLine) setSelection([lastLine], { primary: lastLine });
      return lastLine;
    }

    const style = currentStyleDefaults();
    const poly = createSvgEl("polygon", {
      points: formatPoints(points),
      fill: style.fill,
      stroke: style.stroke,
      "stroke-width": style.strokeWidth,
    });
    try {
      lineToolState.placedLines.forEach((el) => {
        try {
          el.remove();
        } catch {
          // ignore
        }
      });
      layer.appendChild(poly);
    } catch {
      // ignore
    }
    setSelection([poly], { primary: poly });
    return poly;
  }

  function finishLineTool() {
    if (!lineToolState.active) return false;
    commitLineToolGeometry();
    lineToolState.active = false;
    lineToolState.startRoot = null;
    lineToolState.startSpace = null;
    lineToolState.placedLines = [];
    lineToolState.pointsSpace = [];
    hideLineToolOverlays();
    setStatus("Line tool finished");
    return true;
  }

  function cancelLineToolAndDeletePlaced() {
    if (!lineToolState.active && lineToolState.placedLines.length === 0) return false;
    lineToolState.placedLines.forEach((el) => {
      try {
        el.remove();
      } catch {
        // ignore
      }
    });
    clearLineToolState();
    setStatus("Line tool canceled (cleared placed lines)");
    return true;
  }

  function updateLineToolAngleArc(start, current) {
    if (!start || !current) {
      lineToolAngleArc.setAttribute("display", "none");
      return;
    }
    const mid = { x: (start.x + current.x) / 2, y: (start.y + current.y) / 2 };
    const dx = mid.x - start.x;
    const dy = mid.y - start.y;
    const len = Math.hypot(dx, dy);
    if (!Number.isFinite(len) || len <= 1e-6) {
      lineToolAngleArc.setAttribute("display", "none");
      return;
    }
    const minR = pointerToleranceInSvgUnits(14);
    const maxR = pointerToleranceInSvgUnits(72);
    const r = Math.max(minR, Math.min(maxR, len * 0.7));
    const theta = Math.atan2(dy, dx); // SVG coords: +y down -> positive theta is clockwise
    const startPt = { x: start.x + r, y: start.y };
    const endPt = { x: start.x + r * Math.cos(theta), y: start.y + r * Math.sin(theta) };
    const sweep = theta >= 0 ? 1 : 0;
    const dot = Math.max(0.001, pointerToleranceInSvgUnits(0.6));
    const gap = Math.max(dot * 2, pointerToleranceInSvgUnits(5));
    lineToolAngleArc.setAttribute("stroke-dasharray", `${dot} ${gap}`);
    lineToolAngleArc.setAttribute(
      "d",
      `M ${startPt.x} ${startPt.y} A ${r} ${r} 0 0 ${sweep} ${endPt.x} ${endPt.y}`
    );
    lineToolAngleArc.setAttribute("display", "");
  }

  function updateLineToolLengthLabel(start, current) {
    if (!start || !current) {
      lineToolLengthLabel.setAttribute("display", "none");
      return;
    }
    const dx = current.x - start.x;
    const dy = current.y - start.y;
    const len = Math.hypot(dx, dy);
    if (!Number.isFinite(len) || len <= 1e-6) {
      lineToolLengthLabel.setAttribute("display", "none");
      return;
    }
    const vb = getViewBox();
    const pct = vb?.width ? (len / vb.width) * 100 : 0;

    const mid = { x: (start.x + current.x) / 2, y: (start.y + current.y) / 2 };
    const nLen = Math.hypot(dx, dy);
    const nx = nLen > 1e-9 ? (-dy / nLen) : 0;
    const ny = nLen > 1e-9 ? (dx / nLen) : 1;
    const offset = pointerToleranceInSvgUnits(12);
    const px = mid.x + nx * offset;
    const py = mid.y + ny * offset;

    const fontSize = Math.max(2, pointerToleranceInSvgUnits(12) * 0.25);
    lineToolLengthLabel.setAttribute("font-size", String(fontSize));
    lineToolLengthLabel.setAttribute("x", String(px));
    lineToolLengthLabel.setAttribute("y", String(py));
    lineToolLengthLabel.textContent = `${pct.toFixed(2)}%`;
    lineToolLengthLabel.setAttribute("display", "");
  }

  function updateLineToolAngleLabel(start, current) {
    if (!start || !current) {
      lineToolAngleLabel.setAttribute("display", "none");
      return;
    }

    const mid = { x: (start.x + current.x) / 2, y: (start.y + current.y) / 2 };
    const dx = mid.x - start.x;
    const dy = mid.y - start.y;
    const len = Math.hypot(dx, dy);
    if (!Number.isFinite(len) || len <= 1e-6) {
      lineToolAngleLabel.setAttribute("display", "none");
      return;
    }

    const theta = Math.atan2(dy, dx);
    const minR = pointerToleranceInSvgUnits(14);
    const maxR = pointerToleranceInSvgUnits(72);
    const r = Math.max(minR, Math.min(maxR, len * 0.7));
    const half = theta / 2;
    const outward = pointerToleranceInSvgUnits(10);
    const px = start.x + (r + outward) * Math.cos(half);
    const py = start.y + (r + outward) * Math.sin(half);

    const fontSize = Math.max(2, pointerToleranceInSvgUnits(12) * 0.25);
    lineToolAngleLabel.setAttribute("font-size", String(fontSize));
    lineToolAngleLabel.setAttribute("x", String(px));
    lineToolAngleLabel.setAttribute("y", String(py));
    lineToolAngleLabel.textContent = `${theta.toFixed(4)} rad`;
    lineToolAngleLabel.setAttribute("display", "");
  }

  function updateLineToolPreview(rootPoint) {
    if (!lineToolState.active || !lineToolState.startRoot || !rootPoint) return false;
    const style = currentStyleDefaults();
    setLineToolOverlayStyle(style);

    lineToolPreviewLine.setAttribute("x1", String(lineToolState.startRoot.x));
    lineToolPreviewLine.setAttribute("y1", String(lineToolState.startRoot.y));
    lineToolPreviewLine.setAttribute("x2", String(rootPoint.x));
    lineToolPreviewLine.setAttribute("y2", String(rootPoint.y));
    lineToolPreviewLine.setAttribute("display", "");

    const r = Math.max(2, pointerToleranceInSvgUnits(4));
    lineToolPreviewEnd.setAttribute("r", String(r));
    lineToolPreviewEnd.setAttribute("cx", String(rootPoint.x));
    lineToolPreviewEnd.setAttribute("cy", String(rootPoint.y));
    lineToolPreviewEnd.setAttribute("display", "");

    updateLineToolAngleArc(lineToolState.startRoot, rootPoint);
    updateLineToolLengthLabel(lineToolState.startRoot, rootPoint);
    updateLineToolAngleLabel(lineToolState.startRoot, rootPoint);
    return true;
  }

  function getSvgNaturalDimensions() {
    const viewBox = svgRoot.viewBox?.baseVal;
    const parsedWidth = Number(svgRoot.getAttribute("width"));
    const parsedHeight = Number(svgRoot.getAttribute("height"));
    const vbX = viewBox && Number.isFinite(viewBox.x) ? viewBox.x : 0;
    const vbY = viewBox && Number.isFinite(viewBox.y) ? viewBox.y : 0;
    const vbWidth = viewBox && Number.isFinite(viewBox.width) && viewBox.width > 0
      ? viewBox.width
      : Number.isFinite(parsedWidth) ? parsedWidth : 0;
    const vbHeight = viewBox && Number.isFinite(viewBox.height) && viewBox.height > 0
      ? viewBox.height
      : Number.isFinite(parsedHeight) ? parsedHeight : 0;
    const vbMaxX = vbX + (vbWidth || 0);
    const vbMaxY = vbY + (vbHeight || 0);

    let bboxWidth = 0;
    let bboxHeight = 0;
    let bboxX = vbX;
    let bboxY = vbY;
    if (typeof svgRoot.getBBox === "function") {
      try {
        const bbox = svgRoot.getBBox();
        if (Number.isFinite(bbox.x)) bboxX = Math.min(bboxX, bbox.x);
        if (Number.isFinite(bbox.y)) bboxY = Math.min(bboxY, bbox.y);
        if (Number.isFinite(bbox.width)) bboxWidth = bbox.width;
        if (Number.isFinite(bbox.height)) bboxHeight = bbox.height;
      } catch {
        // SVG cannot provide bbox; ignore.
      }
    }
    const bboxMaxX = bboxWidth > 0 ? bboxX + bboxWidth : vbMaxX;
    const bboxMaxY = bboxHeight > 0 ? bboxY + bboxHeight : vbMaxY;

    const left = Math.min(vbX, bboxX);
    const top = Math.min(vbY, bboxY);
    const right = Math.max(vbMaxX, bboxMaxX);
    const bottom = Math.max(vbMaxY, bboxMaxY);

    const hostRect = svgViewportHost.getBoundingClientRect();
    const fallbackWidth = Math.max(1, Math.round(hostRect.width));
    const fallbackHeight = Math.max(1, Math.round(hostRect.height));

    return {
      naturalWidth: Math.max(1, right > left ? right - left : fallbackWidth),
      naturalHeight: Math.max(1, bottom > top ? bottom - top : fallbackHeight),
    };
  }

  function getSvgViewBox() {
    const vb = svgRoot.viewBox?.baseVal;
    if (vb && Number.isFinite(vb.width) && Number.isFinite(vb.height) && vb.width > 0 && vb.height > 0) {
      return { x: vb.x, y: vb.y, width: vb.width, height: vb.height };
    }
    const parts = String(svgRoot.getAttribute("viewBox") || "")
      .trim()
      .split(/\s+/)
      .map((n) => Number.parseFloat(n));
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n)) && parts[2] > 0 && parts[3] > 0) {
      return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
    }
    const w = Number.parseFloat(svgRoot.getAttribute("width")) || 800;
    const h = Number.parseFloat(svgRoot.getAttribute("height")) || 600;
    return { x: 0, y: 0, width: Math.max(1, w), height: Math.max(1, h) };
  }

  function updateSvgSizeToFitWidth() {
    const vb = getSvgViewBox();
    const viewportWidthPx = svgViewport.clientWidth || Math.round(svgViewportHost.getBoundingClientRect().width) || 0;
    if (!viewportWidthPx || !vb.width || !vb.height) return;
    const heightPx = Math.max(1, Math.round(viewportWidthPx * (vb.height / vb.width)));
    svgRoot.style.width = "100%";
    svgRoot.style.height = `${heightPx}px`;
    svgRoot.style.minHeight = "0";
    svgRoot.setAttribute("preserveAspectRatio", "xMinYMin meet");
  }

  function setupRulerCanvas(canvas, cssWidth, cssHeight) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(cssWidth));
    const h = Math.max(1, Math.floor(cssHeight));
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  function chooseRulerMinorStep(pxPerUnit) {
    const targetPx = 8;
    const steps = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
    for (const step of steps) {
      if (step * pxPerUnit >= targetPx) return step;
    }
    return steps[steps.length - 1];
  }

  function formatRulerLabel(value, minorStep) {
    if (Number.isInteger(minorStep)) return String(Math.round(value));
    const rounded = Number(value.toFixed(2));
    return String(rounded);
  }

  function drawSvgTopRuler() {
    const vb = getSvgViewBox();
    const cssWidth = Math.max(1, Math.floor(svgViewportHost.getBoundingClientRect().width));
    const cssHeight = SVG_RULER_THICKNESS;
    const ctx = setupRulerCanvas(svgTopRuler, cssWidth, cssHeight);
    if (!ctx) return;

    const svgRect = svgRoot.getBoundingClientRect();
    const pxPerUnit = svgRect.width > 0 ? (svgRect.width / vb.width) : 1;
    const startUser = vb.x + (svgViewport.scrollLeft / pxPerUnit);
    const visibleUser = (svgViewport.clientWidth || svgRect.width || cssWidth) / pxPerUnit;
    const endUser = startUser + visibleUser;

    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.fillStyle = "#f4f4f4";
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    const baselineY = cssHeight - 0.5;
    ctx.strokeStyle = "rgba(0,0,0,0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, baselineY);
    ctx.lineTo(cssWidth, baselineY);
    ctx.stroke();

    ctx.font = "10px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillStyle = "rgba(0,0,0,0.68)";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";

    const minor = chooseRulerMinorStep(pxPerUnit);
    const majorEvery = 5;
    const superEvery = 10;
    let labelEvery = superEvery;
    if (minor * pxPerUnit * labelEvery < 60) labelEvery *= 2;

    const startIdx = Math.floor(startUser / minor) - 1;
    const endIdx = Math.ceil(endUser / minor) + 1;

    for (let idx = startIdx; idx <= endIdx; idx++) {
      const value = idx * minor;
      const xPx = (value - startUser) * pxPerUnit;
      const x = Math.round(xPx) + 0.5;
      if (x < -1 || x > cssWidth + 1) continue;

      const isSuper = (idx % superEvery) === 0;
      const isMajor = (idx % majorEvery) === 0;
      const tickH = isSuper ? 12 : (isMajor ? 8 : 5);
      ctx.strokeStyle = isSuper ? "rgba(0,0,0,0.40)" : (isMajor ? "rgba(0,0,0,0.30)" : "rgba(0,0,0,0.18)");
      ctx.beginPath();
      ctx.moveTo(x, cssHeight);
      ctx.lineTo(x, cssHeight - tickH);
      ctx.stroke();

      if (idx % labelEvery === 0) {
        const textX = x + 2;
        if (textX < cssWidth - 10) ctx.fillText(formatRulerLabel(value, minor), textX, 2);
      }
    }
  }

  function drawSvgLeftRuler() {
    const vb = getSvgViewBox();
    const cssWidth = SVG_RULER_SIDE;
    const cssHeight = Math.max(1, Math.floor(svgViewportHost.getBoundingClientRect().height));
    const ctx = setupRulerCanvas(svgLeftRuler, cssWidth, cssHeight);
    if (!ctx) return;

    const svgRect = svgRoot.getBoundingClientRect();
    const pxPerUnit = svgRect.height > 0 ? (svgRect.height / vb.height) : 1;
    const startUser = vb.y + (svgViewport.scrollTop / pxPerUnit);
    const visibleUser = (svgViewport.clientHeight || svgRect.height || cssHeight) / pxPerUnit;
    const endUser = startUser + visibleUser;

    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.fillStyle = "#f4f4f4";
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    const baselineX = cssWidth - 0.5;
    ctx.strokeStyle = "rgba(0,0,0,0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(baselineX, 0);
    ctx.lineTo(baselineX, cssHeight);
    ctx.stroke();

    ctx.font = "10px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillStyle = "rgba(0,0,0,0.68)";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";

    const minor = chooseRulerMinorStep(pxPerUnit);
    const majorEvery = 5;
    const superEvery = 10;
    let labelEvery = superEvery;
    if (minor * pxPerUnit * labelEvery < 60) labelEvery *= 2;

    const startIdx = Math.floor(startUser / minor) - 1;
    const endIdx = Math.ceil(endUser / minor) + 1;

    for (let idx = startIdx; idx <= endIdx; idx++) {
      const value = idx * minor;
      const yPx = (value - startUser) * pxPerUnit;
      const y = Math.round(yPx) + 0.5;
      if (y < -1 || y > cssHeight + 1) continue;

      const isSuper = (idx % superEvery) === 0;
      const isMajor = (idx % majorEvery) === 0;
      const tickW = isSuper ? 12 : (isMajor ? 8 : 5);
      ctx.strokeStyle = isSuper ? "rgba(0,0,0,0.40)" : (isMajor ? "rgba(0,0,0,0.30)" : "rgba(0,0,0,0.18)");
      ctx.beginPath();
      ctx.moveTo(cssWidth, y);
      ctx.lineTo(cssWidth - tickW, y);
      ctx.stroke();

      if (idx % labelEvery === 0) {
        if (y > 10 && y < cssHeight - 10) ctx.fillText(formatRulerLabel(value, minor), 2, y);
      }
    }
  }

  function updateSvgRulers() {
    svgTopRuler.style.transform = "";
    updateSvgSizeToFitWidth();
    drawSvgTopRuler();
    drawSvgLeftRuler();
  }

  const svgRulerObserver = new ResizeObserver(updateSvgRulers);
  svgRulerObserver.observe(svgViewportHost);
  window.addEventListener("resize", updateSvgRulers);
  svgViewport.addEventListener("scroll", updateSvgRulers);
  updateSvgRulers();

  function setStatus(text) {
    status.textContent = text;
  }

  function setLayersPanelVisible(visible) {
    const show = Boolean(visible);
    if (show) {
      window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
        detail: { heading: "View Layers", force: true, toggle: false }
      }));
      setStatus("Layer tools moved to sub-toolbar");
    }
    return show;
  }

  function toggleLayersPanel() {
    window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
      detail: { heading: "View Layers", force: true, toggle: true }
    }));
    setStatus("Layer tools moved to sub-toolbar");
    return true;
  }

  function cropToSelection(padding = 8) {
    if (!selectedElement || selectedElement === svgRoot) {
      setStatus("Select an element first");
      return false;
    }
    try {
      const bbox = getElementBBoxInRoot(selectedElement);
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
      setStatus(`Cropped to selection (${Math.round(w)}x${Math.round(h)})`);
      window.dispatchEvent(new CustomEvent("nv-svg-editor-layout-changed", { detail: { width: w, height: h } }));
      updateSvgRulers();
      return true;
    } catch (err) {
      console.warn("Crop to selection failed:", err);
      setStatus("Crop failed");
      return false;
    }
  }

  function isSelectableElement(el) {
    if (!(el instanceof SVGElement)) return false;
    if (el === svgRoot || el === overlayLayer || el === selectionBox || el === marqueeBox) return false;
    if (el.closest(`[${SVG_UI_ATTR}]`)) return false;
    const tag = el.tagName.toLowerCase();
    if (["defs", "desc", "metadata", "title"].includes(tag)) return false;
    return true;
  }

  function getSelectableElements() {
    return Array.from(svgRoot.querySelectorAll("*")).filter(isSelectableElement);
  }

  function applySvgMatrix(matrix, x, y) {
    return {
      x: (matrix.a * x) + (matrix.c * y) + matrix.e,
      y: (matrix.b * x) + (matrix.d * y) + matrix.f
    };
  }

  function elementPointToRootPoint(el, x, y) {
    const elToScreen = el && typeof el.getScreenCTM === "function" ? el.getScreenCTM() : null;
    const rootToScreen = typeof svgRoot.getScreenCTM === "function" ? svgRoot.getScreenCTM() : null;
    if (!elToScreen || !rootToScreen || typeof rootToScreen.inverse !== "function") return { x, y };
    try {
      const screenToRoot = rootToScreen.inverse();
      const screen = applySvgMatrix(elToScreen, x, y);
      const root = applySvgMatrix(screenToRoot, screen.x, screen.y);
      if (Number.isFinite(root.x) && Number.isFinite(root.y)) return root;
    } catch {
      // ignore
    }
    return { x, y };
  }

  function rootPointToElementPoint(el, rootPoint) {
    const rootToScreen = typeof svgRoot.getScreenCTM === "function" ? svgRoot.getScreenCTM() : null;
    const elToScreen = el && typeof el.getScreenCTM === "function" ? el.getScreenCTM() : null;
    if (!rootToScreen || !elToScreen || typeof elToScreen.inverse !== "function") return rootPoint;
    try {
      const screenToEl = elToScreen.inverse();
      const screen = applySvgMatrix(rootToScreen, rootPoint.x, rootPoint.y);
      const pt = applySvgMatrix(screenToEl, screen.x, screen.y);
      if (Number.isFinite(pt.x) && Number.isFinite(pt.y)) return pt;
    } catch {
      // ignore
    }
    return rootPoint;
  }

  function findNearestSnapPointInRoot(targetRootPoint, tolerance, options = {}) {
    const tol = Number.isFinite(tolerance) ? Math.max(0, tolerance) : 0;
    if (!tol) return null;
    const ignorePoints = Array.isArray(options.ignorePoints) ? options.ignorePoints : [];

    const tol2 = tol * tol;
    let best = null;
    let bestD2 = tol2 + 1e-12;
    const els = getSelectableElements();
    for (const el of els) {
      if (!el) continue;
      if (options.ignoreElement && el === options.ignoreElement) continue;
      const tag = el.tagName.toLowerCase();

      const considerPoint = (rootPt) => {
        if (!rootPt) return;
        for (const ip of ignorePoints) {
          if (!ip) continue;
          const ddx = rootPt.x - ip.x;
          const ddy = rootPt.y - ip.y;
          if ((ddx * ddx + ddy * ddy) <= 1e-12) return;
        }
        const dx = rootPt.x - targetRootPoint.x;
        const dy = rootPt.y - targetRootPoint.y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= tol2 && d2 < bestD2) {
          bestD2 = d2;
          best = rootPt;
        }
      };

      if (tag === "line") {
        const x1 = getAttrNumber(el, "x1", 0);
        const y1 = getAttrNumber(el, "y1", 0);
        const x2 = getAttrNumber(el, "x2", 0);
        const y2 = getAttrNumber(el, "y2", 0);
        considerPoint(elementPointToRootPoint(el, x1, y1));
        considerPoint(elementPointToRootPoint(el, x2, y2));
        continue;
      }

      if (tag === "polygon" || tag === "polyline") {
        const pts = parsePoints(el.getAttribute("points") || "");
        if (pts.length > 2000) continue;
        for (const [x, y] of pts) considerPoint(elementPointToRootPoint(el, x, y));
        continue;
      }

      if (tag === "rect" || tag === "image" || tag === "use" || tag === "foreignobject") {
        const x = getAttrNumber(el, "x", 0);
        const y = getAttrNumber(el, "y", 0);
        const w = getAttrNumber(el, "width", 0);
        const h = getAttrNumber(el, "height", 0);
        considerPoint(elementPointToRootPoint(el, x, y));
        considerPoint(elementPointToRootPoint(el, x + w, y));
        considerPoint(elementPointToRootPoint(el, x, y + h));
        considerPoint(elementPointToRootPoint(el, x + w, y + h));
        continue;
      }

      if (tag === "circle" || tag === "ellipse") {
        const cx = getAttrNumber(el, "cx", 0);
        const cy = getAttrNumber(el, "cy", 0);
        considerPoint(elementPointToRootPoint(el, cx, cy));
      }
    }
    return best;
  }

  function snapAngleEndpointInRoot(anchorRoot, rawRoot, incrementRad = Math.PI / 12) {
    if (!anchorRoot || !rawRoot) return rawRoot;
    const dx = rawRoot.x - anchorRoot.x;
    const dy = rawRoot.y - anchorRoot.y;
    const r = Math.hypot(dx, dy);
    if (!Number.isFinite(r) || r <= 1e-9) return rawRoot;
    const inc = Number.isFinite(incrementRad) && incrementRad > 1e-9 ? incrementRad : Math.PI / 12;
    const theta = Math.atan2(dy, dx);
    const snappedTheta = Math.round(theta / inc) * inc;
    return { x: anchorRoot.x + r * Math.cos(snappedTheta), y: anchorRoot.y + r * Math.sin(snappedTheta) };
  }

  function getElementBBoxInRoot(el) {
    if (!el || typeof el.getBBox !== "function") return null;
    let bbox = null;
    try {
      bbox = el.getBBox();
    } catch {
      return null;
    }
    if (!bbox || !Number.isFinite(bbox.x) || !Number.isFinite(bbox.y)) return null;

    const elToScreen = typeof el.getScreenCTM === "function" ? el.getScreenCTM() : null;
    const rootToScreen = typeof svgRoot.getScreenCTM === "function" ? svgRoot.getScreenCTM() : null;
    if (!elToScreen || !rootToScreen || typeof rootToScreen.inverse !== "function") {
      return { x: bbox.x, y: bbox.y, width: bbox.width || 0, height: bbox.height || 0 };
    }

    let screenToRoot = null;
    try {
      screenToRoot = rootToScreen.inverse();
    } catch {
      return { x: bbox.x, y: bbox.y, width: bbox.width || 0, height: bbox.height || 0 };
    }

    const x1 = bbox.x;
    const y1 = bbox.y;
    const x2 = bbox.x + bbox.width;
    const y2 = bbox.y + bbox.height;
    const corners = [
      [x1, y1],
      [x2, y1],
      [x1, y2],
      [x2, y2],
    ];

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of corners) {
      const screen = applySvgMatrix(elToScreen, x, y);
      const root = applySvgMatrix(screenToRoot, screen.x, screen.y);
      if (!Number.isFinite(root.x) || !Number.isFinite(root.y)) continue;
      minX = Math.min(minX, root.x);
      minY = Math.min(minY, root.y);
      maxX = Math.max(maxX, root.x);
      maxY = Math.max(maxY, root.y);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      return { x: bbox.x, y: bbox.y, width: bbox.width || 0, height: bbox.height || 0 };
    }

    return { x: minX, y: minY, width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY) };
  }

  function getElementBBoxInSpace(el, spaceEl) {
    if (!el || typeof el.getBBox !== "function") return null;
    if (!spaceEl || typeof spaceEl.getScreenCTM !== "function") return getElementBBoxInRoot(el);

    let bbox = null;
    try {
      bbox = el.getBBox();
    } catch {
      return null;
    }
    if (!bbox || !Number.isFinite(bbox.x) || !Number.isFinite(bbox.y)) return null;

    const elToScreen = typeof el.getScreenCTM === "function" ? el.getScreenCTM() : null;
    const spaceToScreen = typeof spaceEl.getScreenCTM === "function" ? spaceEl.getScreenCTM() : null;
    if (!elToScreen || !spaceToScreen || typeof spaceToScreen.inverse !== "function") {
      return { x: bbox.x, y: bbox.y, width: bbox.width || 0, height: bbox.height || 0 };
    }

    let screenToSpace = null;
    try {
      screenToSpace = spaceToScreen.inverse();
    } catch {
      return { x: bbox.x, y: bbox.y, width: bbox.width || 0, height: bbox.height || 0 };
    }

    const x1 = bbox.x;
    const y1 = bbox.y;
    const x2 = bbox.x + bbox.width;
    const y2 = bbox.y + bbox.height;
    const corners = [
      [x1, y1],
      [x2, y1],
      [x1, y2],
      [x2, y2],
    ];

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of corners) {
      const screen = applySvgMatrix(elToScreen, x, y);
      const space = applySvgMatrix(screenToSpace, screen.x, screen.y);
      if (!Number.isFinite(space.x) || !Number.isFinite(space.y)) continue;
      minX = Math.min(minX, space.x);
      minY = Math.min(minY, space.y);
      maxX = Math.max(maxX, space.x);
      maxY = Math.max(maxY, space.y);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      return { x: bbox.x, y: bbox.y, width: bbox.width || 0, height: bbox.height || 0 };
    }

    return { x: minX, y: minY, width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY) };
  }

  function getSelectedUnionBBox() {
    if (!selectedElements.length) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const el of selectedElements) {
      try {
        const bbox = getElementBBoxInRoot(el);
        if (!bbox || !Number.isFinite(bbox.x) || !Number.isFinite(bbox.y)) continue;
        minX = Math.min(minX, bbox.x);
        minY = Math.min(minY, bbox.y);
        maxX = Math.max(maxX, bbox.x + bbox.width);
        maxY = Math.max(maxY, bbox.y + bbox.height);
      } catch {
        // Skip elements without measurable bbox.
      }
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      return null;
    }
    return { x: minX, y: minY, width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY) };
  }

  function hideTransformHandles() {
    lineStartHandle.setAttribute("display", "none");
    lineEndHandle.setAttribute("display", "none");
    Object.values(resizeHandles).forEach((handle) => handle.setAttribute("display", "none"));
  }

  function updateLineEndpointHandles(line) {
    const handleRadius = Math.max(1.5, pointerToleranceInSvgUnits(4));
    lineStartHandle.setAttribute("r", String(handleRadius));
    lineEndHandle.setAttribute("r", String(handleRadius));
    const x1 = getAttrNumber(line, "x1", 0);
    const y1 = getAttrNumber(line, "y1", 0);
    const x2 = getAttrNumber(line, "x2", 0);
    const y2 = getAttrNumber(line, "y2", 0);

    const lineToScreen = typeof line.getScreenCTM === "function" ? line.getScreenCTM() : null;
    const rootToScreen = typeof svgRoot.getScreenCTM === "function" ? svgRoot.getScreenCTM() : null;
    let p1 = { x: x1, y: y1 };
    let p2 = { x: x2, y: y2 };
    if (lineToScreen && rootToScreen && typeof rootToScreen.inverse === "function") {
      try {
        const screenToRoot = rootToScreen.inverse();
        const s1 = applySvgMatrix(lineToScreen, x1, y1);
        const s2 = applySvgMatrix(lineToScreen, x2, y2);
        p1 = applySvgMatrix(screenToRoot, s1.x, s1.y);
        p2 = applySvgMatrix(screenToRoot, s2.x, s2.y);
      } catch {
        // ignore
      }
    }

    lineStartHandle.setAttribute("cx", String(p1.x));
    lineStartHandle.setAttribute("cy", String(p1.y));
    lineStartHandle.setAttribute("display", "");
    lineEndHandle.setAttribute("cx", String(p2.x));
    lineEndHandle.setAttribute("cy", String(p2.y));
    lineEndHandle.setAttribute("display", "");
  }

  function setResizeHandle(handle, x, y) {
    handle.setAttribute("x", String(x - 4));
    handle.setAttribute("y", String(y - 4));
    handle.setAttribute("display", "");
  }

  function updateResizeHandles(bbox) {
    if (!bbox) return;
    setResizeHandle(resizeHandles.nw, bbox.x, bbox.y);
    setResizeHandle(resizeHandles.ne, bbox.x + bbox.width, bbox.y);
    setResizeHandle(resizeHandles.se, bbox.x + bbox.width, bbox.y + bbox.height);
    setResizeHandle(resizeHandles.sw, bbox.x, bbox.y + bbox.height);
  }

  function refreshTransformHandles() {
    hideTransformHandles();
    if (toolState.drawing) return;
    if (selectedElements.length !== 1) return;
    const el = selectedElements[0];
    if (!el) return;
    const tag = el.tagName.toLowerCase();
    if (tag === "line") {
      updateLineEndpointHandles(el);
      return;
    }
    try {
      const bbox = getElementBBoxInRoot(el);
      if (!bbox || !Number.isFinite(bbox.width) || !Number.isFinite(bbox.height)) return;
      updateResizeHandles(bbox);
    } catch {
      // element cannot be resized via bbox handles
    }
  }

  function refreshSelectionVisuals() {
    const legacySelectionFilter = "drop-shadow(0 0 2px #ff2f2f)";
    const selectable = getSelectableElements();
    selectable.forEach((el) => {
      if (!selectedElements.includes(el)) {
        el.removeAttribute("data-selected");
        if (el.style.filter === legacySelectionFilter) el.style.filter = "";
      }
    });

    selectedElements.forEach((el) => {
      el.setAttribute("data-selected", "true");
      if (el.style.filter === legacySelectionFilter) el.style.filter = "";
    });

    selectedElement = selectedElements[0] || null;
    window.selectedSVGElement = selectedElement;

    const bbox = getSelectedUnionBBox();
    if (bbox && selectedElements.length > 0) {
      selectionBox.setAttribute("x", String(bbox.x - 3));
      selectionBox.setAttribute("y", String(bbox.y - 3));
      selectionBox.setAttribute("width", String(bbox.width + 6));
      selectionBox.setAttribute("height", String(bbox.height + 6));
      selectionBox.setAttribute("display", "");
    } else {
      selectionBox.setAttribute("display", "none");
    }
    refreshTransformHandles();
  }

  let selectionChangeRaf = 0;
  function notifySelectionChanged() {
    if (selectionChangeRaf) return;
    selectionChangeRaf = window.requestAnimationFrame(() => {
      selectionChangeRaf = 0;
      nodeEditor.onSelectionChanged?.(selectedElements);
      window.dispatchEvent(new CustomEvent("nv-svg-editor-selection-changed", {
        detail: {
          selectedElements: [...selectedElements],
          primary: selectedElement,
        }
      }));
    });
  }

  function clearSelection() {
    selectedElements = [];
    lineHandleDragState = null;
    resizeState = null;
    rotateState = null;
    refreshSelectionVisuals();
    notifySelectionChanged();
  }

  function setSelection(elements = [], options = {}) {
    const unique = [];
    elements.forEach((el) => {
      if (isSelectableElement(el) && !unique.includes(el)) unique.push(el);
    });
    if (options.append) {
      const merged = [...selectedElements];
      unique.forEach((el) => {
        if (!merged.includes(el)) merged.push(el);
      });
      selectedElements = merged;
    } else {
      selectedElements = unique;
    }
    if (options.primary && selectedElements.includes(options.primary)) {
      selectedElements = [options.primary, ...selectedElements.filter((el) => el !== options.primary)];
    }
    refreshSelectionVisuals();
    notifySelectionChanged();
  }

  function toggleSelection(el) {
    if (!isSelectableElement(el)) return;
    if (selectedElements.includes(el)) {
      selectedElements = selectedElements.filter((x) => x !== el);
    } else {
      selectedElements = [el, ...selectedElements];
    }
    refreshSelectionVisuals();
    notifySelectionChanged();
  }

  function selectElement(el) {
    if (!el) {
      clearSelection();
      return;
    }
    setSelection([el], { primary: el });
  }

  function appendElement(el) {
    layersMgr.appendToActiveLayer(el);
    setSelection([el], { primary: el });
  }

  function translateElement(el, dx, dy) {
    const tag = el.tagName.toLowerCase();
    if (tag === "rect" || tag === "image" || tag === "use" || tag === "foreignobject") {
      setAttrNumber(el, "x", getAttrNumber(el, "x", 0) + dx);
      setAttrNumber(el, "y", getAttrNumber(el, "y", 0) + dy);
      return;
    }
    if (tag === "text") {
      setAttrNumber(el, "x", getAttrNumber(el, "x", 0) + dx);
      setAttrNumber(el, "y", getAttrNumber(el, "y", 0) + dy);
      return;
    }
    if (tag === "circle" || tag === "ellipse") {
      setAttrNumber(el, "cx", getAttrNumber(el, "cx", 0) + dx);
      setAttrNumber(el, "cy", getAttrNumber(el, "cy", 0) + dy);
      return;
    }
    if (tag === "line") {
      setAttrNumber(el, "x1", getAttrNumber(el, "x1", 0) + dx);
      setAttrNumber(el, "y1", getAttrNumber(el, "y1", 0) + dy);
      setAttrNumber(el, "x2", getAttrNumber(el, "x2", 0) + dx);
      setAttrNumber(el, "y2", getAttrNumber(el, "y2", 0) + dy);
      return;
    }
    if (tag === "polygon" || tag === "polyline") {
      const moved = parsePoints(el.getAttribute("points") || "").map(([x, y]) => [x + dx, y + dy]);
      el.setAttribute("points", formatPoints(moved));
      return;
    }
    const prev = (el.getAttribute("transform") || "").trim();
    const translate = `translate(${dx} ${dy})`;
    // Prepend translate so movement happens in parent/SVG coordinates (not scaled by existing transforms).
    el.setAttribute("transform", prev ? `${translate} ${prev}` : translate);
  }

  function moveSelectionBy(dx, dy) {
    if (!selectedElements.length) return false;
    selectedElements.forEach((el) => translateElement(el, dx, dy));
    refreshSelectionVisuals();
    return true;
  }

  function rotatePointAroundCenter(point, center, angleRadians) {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const cos = Math.cos(angleRadians);
    const sin = Math.sin(angleRadians);
    return {
      x: center.x + (dx * cos - dy * sin),
      y: center.y + (dx * sin + dy * cos)
    };
  }

  function setTransformFromBase(el, baseTransform, operation) {
    const base = String(baseTransform || "").trim();
    el.setAttribute("transform", base ? `${base} ${operation}` : operation);
  }

  function deleteSelection() {
    if (!selectedElements.length) return false;
    selectedElements.forEach((el) => el.remove());
    clearSelection();
    setStatus("Selection deleted");
    return true;
  }

  function duplicateSelection(offsetX = 20, offsetY = 20) {
    if (!selectedElements.length) return [];
    const clones = selectedElements.map((el) => {
      const clone = el.cloneNode(true);
      el.parentNode?.appendChild(clone);
      translateElement(clone, offsetX, offsetY);
      return clone;
    });
    setSelection(clones, { primary: clones[0] || null });
    setStatus("Selection duplicated");
    return clones;
  }

  function copySelection() {
    if (!selectedElements.length) return false;
    svgClipboard = selectedElements.map((el) => el.cloneNode(true));
    setStatus("Selection copied");
    return true;
  }

  function pasteSelection(offsetX = 20, offsetY = 20) {
    if (!svgClipboard.length) return [];
    const active = getActiveLayer() || svgRoot;
    const clones = svgClipboard.map((template) => {
      const clone = template.cloneNode(true);
      active.appendChild(clone);
      translateElement(clone, offsetX, offsetY);
      return clone;
    });
    setSelection(clones, { primary: clones[0] || null });
    setStatus("Selection pasted");
    return clones;
  }

  function alignSelection(mode = "left") {
    if (selectedElements.length < 2) return false;
    const boxes = selectedElements
      .map((el) => ({ el, bbox: getElementBBoxInRoot(el) }))
      .filter((b) => b.bbox && Number.isFinite(b.bbox.x) && Number.isFinite(b.bbox.y));
    if (boxes.length < 2) return false;
    const minX = Math.min(...boxes.map((b) => b.bbox.x));
    const maxX = Math.max(...boxes.map((b) => b.bbox.x + b.bbox.width));
    const centerX = (minX + maxX) / 2;
    boxes.forEach(({ el, bbox }) => {
      let dx = 0;
      if (mode === "left") dx = minX - bbox.x;
      if (mode === "right") dx = maxX - (bbox.x + bbox.width);
      if (mode === "center") dx = centerX - (bbox.x + bbox.width / 2);
      if (dx) translateElement(el, dx, 0);
    });
    refreshSelectionVisuals();
    setStatus(`Aligned ${selectedElements.length} element(s) ${mode}`);
    return true;
  }

  function arrangeSelection(mode = "front") {
    if (!selectedElements.length) return false;
    if (mode === "front") {
      selectedElements.forEach((el) => el.parentNode?.appendChild(el));
    } else if (mode === "back") {
      [...selectedElements].reverse().forEach((el) => {
        if (!el.parentNode) return;
        el.parentNode.insertBefore(el, el.parentNode.firstChild);
      });
    }
    setStatus(mode === "front" ? "Brought selection to front" : "Sent selection to back");
    refreshSelectionVisuals();
    return true;
  }

  function groupSelection() {
    if (selectedElements.length < 2) return null;
    const group = createSvgEl("g");
    const firstParent = selectedElements[0].parentNode || svgRoot;
    firstParent.appendChild(group);
    selectedElements.forEach((el) => group.appendChild(el));
    setSelection([group], { primary: group });
    setStatus("Grouped selection");
    return group;
  }

  function ungroupSelection() {
    if (selectedElements.length !== 1) return false;
    const group = selectedElements[0];
    if (!group || group.tagName.toLowerCase() !== "g" || group === overlayLayer) return false;
    const parent = group.parentNode;
    if (!parent) return false;
    const children = Array.from(group.children);
    children.forEach((child) => parent.insertBefore(child, group));
    group.remove();
    setSelection(children, { primary: children[0] || null });
    setStatus("Ungrouped selection");
    return true;
  }

  function currentStyleDefaults() {
    return {
      fill: styleState.fill || "#80c0ff",
      stroke: styleState.stroke || "#000000",
      strokeWidth: styleState.strokeWidth || "0.1"
    };
  }

  function applyCurrentStyleToSelection() {
    if (!selectedElements.length) {
      setStatus("No selected element");
      return false;
    }
    selectedElements.forEach((el) => {
      el.setAttribute("fill", styleState.fill);
      el.setAttribute("stroke", styleState.stroke);
      el.setAttribute("stroke-width", styleState.strokeWidth || "0.1");
    });
    setStatus("Applied style");
    return true;
  }

  function resizeCanvas(width, height) {
    const w = Math.max(1, Number.parseFloat(width) || 1);
    const h = Math.max(1, Number.parseFloat(height) || 1);
    svgRoot.setAttribute("width", String(w));
    svgRoot.setAttribute("height", String(h));
    svgRoot.setAttribute("viewBox", `0 0 ${w} ${h}`);
    setStatus(`Canvas resized to ${w}x${h}`);
    window.dispatchEvent(new CustomEvent("nv-svg-editor-layout-changed", { detail: { width: w, height: h } }));
    updateSvgRulers();
    return { width: w, height: h };
  }

  function getCanvasSize() {
    const vb = (svgRoot.getAttribute("viewBox") || "").trim().split(/\s+/).map((n) => Number.parseFloat(n));
    const width = Number.isFinite(vb[2]) ? vb[2] : Number.parseFloat(svgRoot.getAttribute("width")) || 800;
    const height = Number.isFinite(vb[3]) ? vb[3] : Number.parseFloat(svgRoot.getAttribute("height")) || 600;
    return { width, height };
  }

  function getViewBox() {
    const vb = (svgRoot.getAttribute("viewBox") || "").trim().split(/\s+/).map((n) => Number.parseFloat(n));
    const fallbackW = Number.parseFloat(svgRoot.getAttribute("width")) || 800;
    const fallbackH = Number.parseFloat(svgRoot.getAttribute("height")) || 600;
    const x = Number.isFinite(vb[0]) ? vb[0] : 0;
    const y = Number.isFinite(vb[1]) ? vb[1] : 0;
    const w = Number.isFinite(vb[2]) ? vb[2] : fallbackW;
    const h = Number.isFinite(vb[3]) ? vb[3] : fallbackH;
    return { x, y, width: Math.max(1, w || 1), height: Math.max(1, h || 1) };
  }

  function setViewBox({ x = 0, y = 0, width = 1, height = 1 } = {}) {
    const w = Math.max(1, Number.parseFloat(width) || 1);
    const h = Math.max(1, Number.parseFloat(height) || 1);
    svgRoot.setAttribute("viewBox", `${Number(x) || 0} ${Number(y) || 0} ${w} ${h}`);
    svgRoot.setAttribute("width", String(w));
    svgRoot.setAttribute("height", String(h));
    window.dispatchEvent(new CustomEvent("nv-svg-editor-layout-changed", { detail: { width: w, height: h } }));
    updateSvgRulers();
  }

  function applyTransformToLayers(transformFragment = "") {
    const fragment = String(transformFragment || "").trim();
    if (!fragment) return;
    const layers = layersMgr.getLayers?.() || [];
    layers.forEach((layer) => {
      const existing = String(layer.getAttribute("transform") || "").trim();
      layer.setAttribute("transform", existing ? `${fragment} ${existing}` : fragment);
    });
  }

  function cropEdges({ left = 0, top = 0, right = 0, bottom = 0 } = {}) {
    const { x, y, width, height } = getViewBox();
    const cropLeft = Math.max(0, Number.parseFloat(left) || 0);
    const cropTop = Math.max(0, Number.parseFloat(top) || 0);
    const cropRight = Math.max(0, Number.parseFloat(right) || 0);
    const cropBottom = Math.max(0, Number.parseFloat(bottom) || 0);
    if (cropLeft + cropRight >= width || cropTop + cropBottom >= height) {
      setStatus("Crop exceeds canvas bounds");
      return false;
    }
    const next = {
      x: x + cropLeft,
      y: y + cropTop,
      width: width - cropLeft - cropRight,
      height: height - cropTop - cropBottom,
    };
    setViewBox(next);
    setStatus(`Cropped edges to ${Math.round(next.width)}x${Math.round(next.height)}`);
    refreshSelectionVisuals?.();
    return true;
  }

  function rotateCanvas90(direction = "cw") {
    const { x, y, width, height } = getViewBox();
    const dir = direction === "ccw" ? "ccw" : "cw";
    const next = { x, y, width: height, height: width };
    if (dir === "ccw") {
      applyTransformToLayers(`translate(${x} ${y + width}) rotate(-90) translate(${-x} ${-y})`);
    } else {
      applyTransformToLayers(`translate(${x + height} ${y}) rotate(90) translate(${-x} ${-y})`);
    }
    setViewBox(next);
    setStatus(`Rotated ${dir === "ccw" ? "90° CCW" : "90° CW"}`);
    refreshSelectionVisuals?.();
    return true;
  }

  function flipCanvas(axis = "h") {
    const { x, y, width, height } = getViewBox();
    const ax = axis === "v" ? "v" : "h";
    if (ax === "v") {
      applyTransformToLayers(`translate(0 ${y + height}) scale(1 -1) translate(0 ${-y})`);
      setStatus("Flipped vertically");
    } else {
      applyTransformToLayers(`translate(${x + width} 0) scale(-1 1) translate(${-x} 0)`);
      setStatus("Flipped horizontally");
    }
    window.dispatchEvent(new CustomEvent("nv-svg-editor-layout-changed", { detail: { width, height } }));
    updateSvgRulers();
    refreshSelectionVisuals?.();
    return true;
  }

  function getLayers() {
    return layersMgr.getLayers();
  }

  function getActiveLayer() {
    return layersMgr.getActiveLayer();
  }

  function setActiveLayer(layerId) {
    if (!layerId) return false;
    layersMgr.setActiveLayer(layerId);
    return true;
  }

  function createLayer(name = null) {
    const layer = layersMgr.createLayer(name);
    setStatus(`Layer created: ${layer.getAttribute("data-layer-name") || layer.id}`);
    return layer;
  }

  function renameActiveLayer(name) {
    const layer = getActiveLayer();
    if (!layer) return false;
    const next = String(name || "").trim();
    if (!next) return false;
    layer.setAttribute("data-layer-name", next);
    layersMgr.renderPanel();
    setStatus(`Renamed active layer to "${next}"`);
    return true;
  }

  function deleteActiveLayer() {
    const layer = getActiveLayer();
    if (!layer) return false;
    const ok = layersMgr.removeLayer(layer.id);
    setStatus(ok ? "Deleted active layer" : "Cannot delete the only layer");
    return ok;
  }

  function stepActiveLayer(direction = 1) {
    const layers = getLayers();
    const active = getActiveLayer();
    if (!layers.length || !active) return null;
    const idx = layers.findIndex((layer) => layer.id === active.id);
    if (idx < 0) return null;
    const nextIndex = (idx + direction + layers.length) % layers.length;
    const nextLayer = layers[nextIndex];
    setActiveLayer(nextLayer.id);
    setStatus(`Active layer: ${nextLayer.getAttribute("data-layer-name") || nextLayer.id}`);
    return nextLayer;
  }

  function moveActiveLayer(direction = 1) {
    const active = getActiveLayer();
    if (!active) return false;
    layersMgr.moveLayer(active.id, direction);
    setStatus(direction < 0 ? "Moved active layer up" : "Moved active layer down");
    return true;
  }

  function setActiveLayerVisible(visible) {
    const active = getActiveLayer();
    if (!active) return false;
    layersMgr.setLayerVisible(active.id, Boolean(visible));
    setStatus(Boolean(visible) ? "Active layer shown" : "Active layer hidden");
    return true;
  }

  function toggleActiveLayerVisible() {
    const active = getActiveLayer();
    if (!active) return false;
    const currentlyVisible = active.style.display !== "none";
    return setActiveLayerVisible(!currentlyVisible);
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
      el = createSvgEl("polygon", { points: "90,20 145,60 125,120 55,120 35,60", fill: style.fill, stroke: style.stroke, "stroke-width": style.strokeWidth });
    } else if (kind === "triangle") {
      el = createSvgEl("polygon", { points: "90,20 155,125 25,125", fill: style.fill, stroke: style.stroke, "stroke-width": style.strokeWidth });
    } else if (kind === "star") {
      el = createSvgEl("polygon", { points: "100,20 118,72 173,72 128,104 145,158 100,126 55,158 72,104 27,72 82,72", fill: style.fill, stroke: style.stroke, "stroke-width": style.strokeWidth });
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
    if (toolState.mode === "line" && mode !== "line") {
      finishLineTool();
    }
    if (toolState.mode === "bezier" && mode !== "bezier") {
      bezierController.reset();
    }
    toolState.mode = mode;
    toolState.drawing = false;
    toolState.tempShape = null;
    toolState.startPoint = null;
    toolState.bezierStep = 0;
    toolState.bezierPoints = [];
    const cursor = mode === "select" ? "default" : "crosshair";
    svgRoot.style.cursor = cursor;
    try {
      wrapper.focus({ preventScroll: true });
    } catch {
      try {
        wrapper.focus();
      } catch {
        // ignore
      }
    }
    setStatus(`Tool: ${mode}`);
  }

  function intersectsRect(a, b) {
    return a.x <= b.x + b.width &&
      a.x + a.width >= b.x &&
      a.y <= b.y + b.height &&
      a.y + a.height >= b.y;
  }

  function pointerToleranceInSvgUnits(px = 8) {
    const ctm = typeof svgRoot.getScreenCTM === "function" ? svgRoot.getScreenCTM() : null;
    if (!ctm) return px;
    const sx = Math.hypot(ctm.a, ctm.b);
    const sy = Math.hypot(ctm.c, ctm.d);
    const avg = (sx + sy) / 2;
    if (!Number.isFinite(avg) || avg <= 1e-9) return px;
    return px / avg;
  }

  function isSvgGraphicsElement(el) {
    if (!el) return false;
    if (typeof SVGGraphicsElement !== "undefined") {
      return el instanceof SVGGraphicsElement;
    }
    return el instanceof SVGElement && typeof el.getScreenCTM === "function";
  }

  function clientToElementPoint(element, clientX, clientY) {
    const ctm = element && typeof element.getScreenCTM === "function" ? element.getScreenCTM() : null;
    if (!ctm || typeof ctm.inverse !== "function") {
      return toSvgPoint(svgRoot, clientX, clientY);
    }
    try {
      const inv = ctm.inverse();
      const pt = typeof DOMPoint === "function"
        ? new DOMPoint(clientX, clientY).matrixTransform(inv)
        : { x: 0, y: 0 };
      if (Number.isFinite(pt.x) && Number.isFinite(pt.y)) return { x: pt.x, y: pt.y };
    } catch {
      // ignore
    }
    return toSvgPoint(svgRoot, clientX, clientY);
  }

  function getDragSpaceForElement(el) {
    const parent = el?.parentNode;
    if (isSvgGraphicsElement(parent)) return parent;
    return svgRoot;
  }

  function getDragBaseForElement(el) {
    const baseTransform = String(el.getAttribute("transform") || "").trim();
    if (baseTransform) {
      return { kind: "transform", baseTransform };
    }

    const tag = el.tagName.toLowerCase();
    if (tag === "rect" || tag === "image" || tag === "use" || tag === "foreignobject") {
      return { kind: "xy", x: getAttrNumber(el, "x", 0), y: getAttrNumber(el, "y", 0) };
    }
    if (tag === "text") {
      return { kind: "xy", x: getAttrNumber(el, "x", 0), y: getAttrNumber(el, "y", 0) };
    }
    if (tag === "circle" || tag === "ellipse") {
      return { kind: "cxy", cx: getAttrNumber(el, "cx", 0), cy: getAttrNumber(el, "cy", 0) };
    }
    if (tag === "line") {
      return {
        kind: "line",
        x1: getAttrNumber(el, "x1", 0),
        y1: getAttrNumber(el, "y1", 0),
        x2: getAttrNumber(el, "x2", 0),
        y2: getAttrNumber(el, "y2", 0),
      };
    }
    if (tag === "polygon" || tag === "polyline") {
      return { kind: "points", points: parsePoints(el.getAttribute("points") || "") };
    }

    return { kind: "transform", baseTransform: "" };
  }

  function applyDragDeltaToElement(el, base, dx, dy) {
    if (!el || !base) return;
    if (base.kind === "xy") {
      setAttrNumber(el, "x", base.x + dx);
      setAttrNumber(el, "y", base.y + dy);
      return;
    }
    if (base.kind === "cxy") {
      setAttrNumber(el, "cx", base.cx + dx);
      setAttrNumber(el, "cy", base.cy + dy);
      return;
    }
    if (base.kind === "line") {
      setAttrNumber(el, "x1", base.x1 + dx);
      setAttrNumber(el, "y1", base.y1 + dy);
      setAttrNumber(el, "x2", base.x2 + dx);
      setAttrNumber(el, "y2", base.y2 + dy);
      return;
    }
    if (base.kind === "points") {
      const moved = (base.points || []).map(([x, y]) => [x + dx, y + dy]);
      el.setAttribute("points", formatPoints(moved));
      return;
    }

    const translate = `translate(${dx} ${dy})`;
    const baseTransform = String(base.baseTransform || "").trim();
    // Prepend translate so movement is in parent coordinates (not scaled/rotated by baseTransform).
    el.setAttribute("transform", baseTransform ? `${translate} ${baseTransform}` : translate);
  }

  function buildDragState(pointerId, clientX, clientY) {
    const startClient = { x: clientX, y: clientY };
    const items = selectedElements
      .filter(Boolean)
      .map((el) => ({
        el,
        space: getDragSpaceForElement(el),
        base: getDragBaseForElement(el),
      }));
    const spaceStarts = new Map();
    for (const item of items) {
      if (!spaceStarts.has(item.space)) {
        spaceStarts.set(item.space, clientToElementPoint(item.space, startClient.x, startClient.y));
      }
    }
    return {
      pointerId,
      startClient,
      items,
      spaceStarts,
    };
  }

  function updateDragFromClient(drag, clientX, clientY) {
    if (!drag || !drag.items?.length) return false;

    const nextClient = { x: clientX, y: clientY };
    const deltasBySpace = new Map();
    for (const item of drag.items) {
      if (deltasBySpace.has(item.space)) continue;
      const startPoint = drag.spaceStarts.get(item.space);
      if (!startPoint) continue;
      const curPoint = clientToElementPoint(item.space, nextClient.x, nextClient.y);
      deltasBySpace.set(item.space, { dx: curPoint.x - startPoint.x, dy: curPoint.y - startPoint.y });
    }

    let moved = false;
    for (const item of drag.items) {
      const delta = deltasBySpace.get(item.space);
      if (!delta) continue;
      if (delta.dx || delta.dy) {
        applyDragDeltaToElement(item.el, item.base, delta.dx, delta.dy);
        moved = true;
      } else {
        // Ensure exact snap-back when pointer returns to start.
        applyDragDeltaToElement(item.el, item.base, 0, 0);
      }
    }

    if (moved) refreshSelectionVisuals();
    return moved;
  }

  function findNearestLineAtPoint(point, tolerance) {
    let hit = null;
    let bestDistance = Infinity;
    getSelectableElements().forEach((el) => {
      if (el.tagName.toLowerCase() !== "line") return;
      const a = { x: getAttrNumber(el, "x1", 0), y: getAttrNumber(el, "y1", 0) };
      const b = { x: getAttrNumber(el, "x2", 0), y: getAttrNumber(el, "y2", 0) };
      const d = distancePointToSegment(point, a, b);
      if (d <= tolerance && d < bestDistance) {
        bestDistance = d;
        hit = el;
      }
    });
    return hit;
  }

  function setMarqueeBox(start, current) {
    const x = Math.min(start.x, current.x);
    const y = Math.min(start.y, current.y);
    const width = Math.abs(current.x - start.x);
    const height = Math.abs(current.y - start.y);
    marqueeBox.setAttribute("x", String(x));
    marqueeBox.setAttribute("y", String(y));
    marqueeBox.setAttribute("width", String(width));
    marqueeBox.setAttribute("height", String(height));
    marqueeBox.setAttribute("display", "");
    return { x, y, width, height };
  }

  function startLineHandleDrag(which, pointerId) {
    if (selectedElements.length !== 1) return;
    const line = selectedElements[0];
    if (!line || line.tagName.toLowerCase() !== "line") return;
    lineHandleDragState = {
      pointerId,
      line,
      which,
      base: {
        x1: getAttrNumber(line, "x1", 0),
        y1: getAttrNumber(line, "y1", 0),
        x2: getAttrNumber(line, "x2", 0),
        y2: getAttrNumber(line, "y2", 0),
      }
    };
    try {
      svgRoot.setPointerCapture(pointerId);
    } catch {
      // Ignore unsupported pointer capture errors.
    }
  }

  function startResizeInteraction(corner, pointerId) {
    if (selectedElements.length !== 1) return;
    const el = selectedElements[0];
    if (!el || el.tagName.toLowerCase() === "line") return;
    try {
      const space = getDragSpaceForElement(el);
      const bbox = getElementBBoxInSpace(el, space);
      if (!bbox || bbox.width <= 0 || bbox.height <= 0) return;
      resizeState = {
        pointerId,
        element: el,
        corner,
        bbox,
        space,
        baseTransform: el.getAttribute("transform") || ""
      };
      try {
        svgRoot.setPointerCapture(pointerId);
      } catch {
        // Ignore unsupported pointer capture errors.
      }
    } catch {
      // Ignore elements without measurable bbox.
    }
  }

  function startRotateInteraction(target, pointerId, point) {
    if (!target) return false;
    try {
      const bbox = getElementBBoxInRoot(target);
      if (!bbox || !Number.isFinite(bbox.x) || !Number.isFinite(bbox.y)) return false;
      const cx = bbox.x + bbox.width / 2;
      const cy = bbox.y + bbox.height / 2;
      const startAngle = Math.atan2(point.y - cy, point.x - cx);
      const tag = target.tagName.toLowerCase();
      rotateState = {
        pointerId,
        element: target,
        cx,
        cy,
        startAngle,
        baseTransform: target.getAttribute("transform") || "",
        baseLine: tag === "line"
          ? {
            p1: { x: getAttrNumber(target, "x1", 0), y: getAttrNumber(target, "y1", 0) },
            p2: { x: getAttrNumber(target, "x2", 0), y: getAttrNumber(target, "y2", 0) }
          }
          : null
      };
      try {
        svgRoot.setPointerCapture(pointerId);
      } catch {
        // Ignore unsupported pointer capture errors.
      }
      setStatus("Rotating selection");
      return true;
    } catch {
      return false;
    }
  }

  lineStartHandle.addEventListener("pointerdown", (e) => {
    if (toolState.mode !== "select") return;
    e.preventDefault();
    e.stopPropagation();
    startLineHandleDrag("start", e.pointerId);
  });

  lineEndHandle.addEventListener("pointerdown", (e) => {
    if (toolState.mode !== "select") return;
    e.preventDefault();
    e.stopPropagation();
    startLineHandleDrag("end", e.pointerId);
  });

  Object.entries(resizeHandles).forEach(([corner, handle]) => {
    handle.addEventListener("pointerdown", (e) => {
      if (toolState.mode !== "select") return;
      e.preventDefault();
      e.stopPropagation();
      startResizeInteraction(corner, e.pointerId);
    });
  });

  wrapper.addEventListener("keydown", (e) => {
    const key = String(e.key || "");
    const meta = e.ctrlKey || e.metaKey;
    if (meta && key.toLowerCase() === "z") {
      const res = e.shiftKey ? history.redo() : history.undo();
      if (res?.element) setSelection([res.element], { primary: res.element });
      else if (res?.removed) clearSelection();
      e.preventDefault();
      return;
    }
    if (nodeEditor.onKeyDown?.(e)) return;
    if (toolState.mode === "line") {
      if (key === "Escape") {
        if (lineToolState.active) {
          cancelLineToolAndDeletePlaced();
        } else {
          clearLineToolState();
        }
        setMode("select");
        e.preventDefault();
        return;
      }
      if (key === "Enter" && lineToolState.active) {
        finishLineTool();
        e.preventDefault();
        return;
      }
    }
    if (toolState.mode === "bezier") {
      if (bezierController.onKeyDown(e)) {
        if (!bezierController.isActive()) setMode("select");
        e.preventDefault();
        return;
      }
    }
    if (toolState.mode !== "select") return;
    if (key === "Delete" || key === "Backspace") {
      if (deleteSelection()) e.preventDefault();
      return;
    }
    if (key.toLowerCase() === "d" && (e.ctrlKey || e.metaKey)) {
      duplicateSelection();
      e.preventDefault();
      return;
    }
    if (key.startsWith("Arrow")) {
      const step = e.shiftKey ? 10 : 1;
      if (key === "ArrowLeft") moveSelectionBy(-step, 0);
      if (key === "ArrowRight") moveSelectionBy(step, 0);
      if (key === "ArrowUp") moveSelectionBy(0, -step);
      if (key === "ArrowDown") moveSelectionBy(0, step);
      e.preventDefault();
    }
  });

  svgRoot.addEventListener("pointerdown", (e) => {
    syncModeFromToolbarState();
    const p = toSvgPoint(svgRoot, e.clientX, e.clientY);
    wrapper.focus();
    if (nodeEditor.isActive?.() && nodeEditor.onPointerDown?.(e, e.target, p)) return;

    if (toolState.mode === "select") {
      let target = e.target instanceof SVGElement ? e.target : null;
      if (!target || !isSelectableElement(target)) {
        target = findNearestLineAtPoint(p, pointerToleranceInSvgUnits(8));
      }
      if (target && isSelectableElement(target)) {
        if (e.shiftKey) {
          if (!selectedElements.includes(target) || selectedElements.length !== 1) {
            setSelection([target], { primary: target });
          }
          if (startRotateInteraction(target, e.pointerId, p)) {
            e.preventDefault();
            return;
          }
        } else if (!selectedElements.includes(target)) {
          setSelection([target], { primary: target });
        } else if (selectedElements.length > 1) {
          setSelection([target], { primary: target });
        }

        if (e.detail >= 2 && target.tagName.toLowerCase() === "path") {
          nodeEditor.enter(target);
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        dragState = buildDragState(e.pointerId, e.clientX, e.clientY);
        try {
          svgRoot.setPointerCapture(e.pointerId);
        } catch {
          // Ignore unsupported pointer capture errors.
        }
        e.preventDefault();
        return;
      }

      marqueeState = {
        pointerId: e.pointerId,
        start: p,
        current: p,
        baseSelection: e.shiftKey ? [...selectedElements] : []
      };
      if (!e.shiftKey) clearSelection();
      setMarqueeBox(p, p);
      try {
        svgRoot.setPointerCapture(e.pointerId);
      } catch {
        // Ignore unsupported pointer capture errors.
      }
      e.preventDefault();
      return;
    }

    if (toolState.mode === "line") {
      if (lineToolState.active && e.detail >= 2) {
        finishLineTool();
        e.preventDefault();
        e.stopPropagation();
        return;
      }

	      const layer = lineToolState.layer || getActiveLayer() || svgRoot;
	      let rootPoint = p;
	      if (lineToolState.active && e.shiftKey && lineToolState.startRoot) {
	        const tol = pointerToleranceInSvgUnits(10);
	        const snapped = findNearestSnapPointInRoot(p, tol);
	        rootPoint = snapped || snapAngleEndpointInRoot(lineToolState.startRoot, p, Math.PI / 12);
	      }
	      const spacePoint = rootPointToElementPoint(layer, rootPoint);

	      if (!lineToolState.active) {
	        clearSelection();
	        lineToolState.active = true;
	        lineToolState.layer = layer;
	        lineToolState.startRoot = rootPoint;
	        lineToolState.startSpace = spacePoint;
	        lineToolState.pointsSpace = [[spacePoint.x, spacePoint.y]];
	        lineToolState.placedLines = [];
	        updateLineToolPreview(rootPoint);
	        setStatus("Line tool: click next point, Enter to finish, Esc to cancel");
	        e.preventDefault();
	        e.stopPropagation();
	        return;
	      }

      if (lineToolState.startSpace) {
        const dx = spacePoint.x - lineToolState.startSpace.x;
        const dy = spacePoint.y - lineToolState.startSpace.y;
        const segLen = Math.hypot(dx, dy);
        if (Number.isFinite(segLen) && segLen > 1e-6) {
          const style = currentStyleDefaults();
          const seg = createSvgEl("line", {
            x1: lineToolState.startSpace.x,
            y1: lineToolState.startSpace.y,
            x2: spacePoint.x,
            y2: spacePoint.y,
            stroke: style.stroke,
            "stroke-width": style.strokeWidth,
          });
          try {
            (lineToolState.layer || layer).appendChild(seg);
            lineToolState.placedLines.push(seg);
          } catch {
            // ignore
          }
	          lineToolState.startRoot = rootPoint;
	          lineToolState.startSpace = spacePoint;
	          lineToolState.pointsSpace.push([spacePoint.x, spacePoint.y]);
	          updateLineToolPreview(rootPoint);
	        }
	      }
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (toolState.mode === "bezier") {
      const rootPoint = p;
      if (bezierController.isActive() && e.detail >= 2) {
        bezierController.finish();
        setMode("select");
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      clearSelection();
      bezierController.onPointerDown(e, rootPoint);
      e.preventDefault();
      e.stopPropagation();
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
      try {
        svgRoot.setPointerCapture(e.pointerId);
      } catch {
        // Ignore unsupported pointer capture errors.
      }
      e.preventDefault();
      e.stopPropagation();
      return;
    }
  });

  svgRoot.addEventListener("pointermove", (e) => {
    const p = toSvgPoint(svgRoot, e.clientX, e.clientY);
    if (nodeEditor.onPointerMove?.(e)) return;

    if (lineHandleDragState && lineHandleDragState.pointerId === e.pointerId) {
      const line = lineHandleDragState.line;
      const which = lineHandleDragState.which;
      const base = lineHandleDragState.base || {
        x1: getAttrNumber(line, "x1", 0),
        y1: getAttrNumber(line, "y1", 0),
        x2: getAttrNumber(line, "x2", 0),
        y2: getAttrNumber(line, "y2", 0),
      };
      const fixed = which === "start"
        ? { x: base.x2, y: base.y2 }
        : { x: base.x1, y: base.y1 };

      const fixedRoot = elementPointToRootPoint(line, fixed.x, fixed.y);
      const movingBase = which === "start"
        ? { x: base.x1, y: base.y1 }
        : { x: base.x2, y: base.y2 };
      const movingBaseRoot = elementPointToRootPoint(line, movingBase.x, movingBase.y);

      let nextRoot = p;
      if (e.shiftKey) {
        const tol = pointerToleranceInSvgUnits(10);
        const snapped = findNearestSnapPointInRoot(p, tol, { ignorePoints: [movingBaseRoot] });
        nextRoot = snapped || snapAngleEndpointInRoot(fixedRoot, p, Math.PI / 12);
      }
      const next = rootPointToElementPoint(line, nextRoot);

      if (which === "start") {
        line.setAttribute("x1", String(next.x));
        line.setAttribute("y1", String(next.y));
      } else {
        line.setAttribute("x2", String(next.x));
        line.setAttribute("y2", String(next.y));
      }
      refreshSelectionVisuals();
      e.preventDefault();
      return;
    }

    if (resizeState && resizeState.pointerId === e.pointerId) {
      const { bbox, corner, element, baseTransform, space } = resizeState;
      const sp = clientToElementPoint(space || svgRoot, e.clientX, e.clientY);
      const minSize = 0.05;
      const anchor = {
        x: corner.includes("w") ? bbox.x + bbox.width : bbox.x,
        y: corner.includes("n") ? bbox.y + bbox.height : bbox.y
      };
      const denomX = Math.max(1e-6, bbox.width);
      const denomY = Math.max(1e-6, bbox.height);
      const rawScaleX = corner.includes("w")
        ? (anchor.x - sp.x) / denomX
        : (sp.x - anchor.x) / denomX;
      const rawScaleY = corner.includes("n")
        ? (anchor.y - sp.y) / denomY
        : (sp.y - anchor.y) / denomY;
      let sx = rawScaleX;
      let sy = rawScaleY;
      if (e.shiftKey) {
        const cornerPoint = {
          x: corner.includes("w") ? bbox.x : bbox.x + bbox.width,
          y: corner.includes("n") ? bbox.y : bbox.y + bbox.height,
        };
        const c = { x: cornerPoint.x - anchor.x, y: cornerPoint.y - anchor.y };
        const c2 = c.x * c.x + c.y * c.y;
        if (c2 > 1e-12) {
          const v = { x: sp.x - anchor.x, y: sp.y - anchor.y };
          const s = (v.x * c.x + v.y * c.y) / c2;
          sx = s;
          sy = s;
        }
      }
      sx = Math.max(minSize, sx);
      sy = Math.max(minSize, sy);
      setTransformFromBase(
        element,
        baseTransform,
        `translate(${anchor.x} ${anchor.y}) scale(${sx} ${sy}) translate(${-anchor.x} ${-anchor.y})`
      );
      refreshSelectionVisuals();
      e.preventDefault();
      return;
    }

    if (rotateState && rotateState.pointerId === e.pointerId) {
      const angle = Math.atan2(p.y - rotateState.cy, p.x - rotateState.cx) - rotateState.startAngle;
      const angleDeg = (angle * 180) / Math.PI;
      if (rotateState.baseLine) {
        const p1 = rotatePointAroundCenter(rotateState.baseLine.p1, { x: rotateState.cx, y: rotateState.cy }, angle);
        const p2 = rotatePointAroundCenter(rotateState.baseLine.p2, { x: rotateState.cx, y: rotateState.cy }, angle);
        rotateState.element.setAttribute("x1", String(p1.x));
        rotateState.element.setAttribute("y1", String(p1.y));
        rotateState.element.setAttribute("x2", String(p2.x));
        rotateState.element.setAttribute("y2", String(p2.y));
      } else {
        setTransformFromBase(
          rotateState.element,
          rotateState.baseTransform,
          `rotate(${angleDeg} ${rotateState.cx} ${rotateState.cy})`
        );
      }
      refreshSelectionVisuals();
      e.preventDefault();
      return;
    }

	    if (toolState.mode === "select") {
	      if (dragState && dragState.pointerId === e.pointerId) {
	        updateDragFromClient(dragState, e.clientX, e.clientY);
	        e.preventDefault();
	        return;
	      }

      if (marqueeState && marqueeState.pointerId === e.pointerId) {
        marqueeState.current = p;
        const rect = setMarqueeBox(marqueeState.start, marqueeState.current);
        const hits = getSelectableElements().filter((el) => {
          try {
            const bbox = getElementBBoxInRoot(el);
            return bbox ? intersectsRect(rect, bbox) : false;
          } catch {
            return false;
          }
        });
        if (marqueeState.baseSelection.length) {
          setSelection([...marqueeState.baseSelection, ...hits]);
        } else {
          setSelection(hits);
        }
        e.preventDefault();
        return;
      }
	    }

    if (toolState.mode === "line" && lineToolState.active) {
      let next = p;
      if (e.shiftKey && lineToolState.startRoot) {
        const tol = pointerToleranceInSvgUnits(10);
        const snapped = findNearestSnapPointInRoot(p, tol);
        next = snapped || snapAngleEndpointInRoot(lineToolState.startRoot, p, Math.PI / 12);
      }
      updateLineToolPreview(next);
      e.preventDefault();
      return;
    }

    if (toolState.mode === "bezier" && bezierController.isActive()) {
      let target = p;
      const model = bezierController.state?.model;
      const last = model?.nodes?.[model.nodes.length - 1];
      if (e.shiftKey && last) {
        const tol = pointerToleranceInSvgUnits(10);
        const snapped = findNearestSnapPointInRoot(p, tol);
        target = snapped || snapAngleEndpointInRoot(last, p, Math.PI / 12);
      }
      bezierController.onPointerMove(e, target);
      e.preventDefault();
      return;
    }

    if (!toolState.drawing || !toolState.tempShape) return;
    if (toolState.mode === "freehand") {
      const d = toolState.tempShape.getAttribute("d") || "";
      toolState.tempShape.setAttribute("d", `${d} L ${p.x} ${p.y}`);
    }
    e.preventDefault();
  });

  svgRoot.addEventListener("pointerup", (e) => {
    if (nodeEditor.onPointerUp?.(e)) return;
    if (lineHandleDragState && lineHandleDragState.pointerId === e.pointerId) {
      lineHandleDragState = null;
      try {
        svgRoot.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore unsupported pointer capture errors.
      }
      return;
    }
    if (resizeState && resizeState.pointerId === e.pointerId) {
      resizeState = null;
      try {
        svgRoot.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore unsupported pointer capture errors.
      }
      return;
    }
    if (rotateState && rotateState.pointerId === e.pointerId) {
      rotateState = null;
      try {
        svgRoot.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore unsupported pointer capture errors.
      }
      return;
    }
    if (toolState.mode === "bezier" && bezierController.isActive()) {
      let endRoot = toSvgPoint(svgRoot, e.clientX, e.clientY);
      const model = bezierController.state?.model;
      const last = model?.nodes?.[model.nodes.length - 1];
      if (e.shiftKey && last) {
        const tol = pointerToleranceInSvgUnits(10);
        const snapped = findNearestSnapPointInRoot(endRoot, tol);
        endRoot = snapped || snapAngleEndpointInRoot(last, endRoot, Math.PI / 12);
      }
      bezierController.onPointerUp(e, endRoot);
      return;
    }

    if (toolState.mode === "select") {
      if (dragState && dragState.pointerId === e.pointerId) {
        dragState = null;
      }
      if (marqueeState && marqueeState.pointerId === e.pointerId) {
        marqueeState = null;
        marqueeBox.setAttribute("display", "none");
      }
      try {
        svgRoot.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore unsupported pointer capture errors.
      }
      return;
    }
    if (!toolState.drawing) return;

    toolState.drawing = false;
    toolState.tempShape = null;
    toolState.startPoint = null;
    try {
      svgRoot.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore unsupported pointer capture errors.
    }
  });

  // Nodevision hooks
  window.getEditorHTML = () => {
    const clone = svgRoot.cloneNode(true);
    clone.querySelectorAll(`[${SVG_UI_ATTR}]`).forEach((el) => el.remove());
    clone.querySelectorAll("[data-selected]").forEach((el) => el.removeAttribute("data-selected"));
    clone.querySelectorAll("[style]").forEach((el) => {
      if (el.style?.filter === "drop-shadow(0 0 2px #ff2f2f)") {
        el.style.filter = "";
        if (!el.getAttribute("style")) el.removeAttribute("style");
      }
    });
    return new XMLSerializer().serializeToString(clone);
  };

  window.setEditorHTML = (svgString) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    const fresh = doc.documentElement;

    Array.from(svgRoot.attributes).forEach((attr) => {
      svgRoot.removeAttribute(attr.name);
    });
    Array.from(fresh.attributes).forEach((attr) => {
      svgRoot.setAttribute(attr.name, attr.value);
    });

    while (svgRoot.firstChild) {
      svgRoot.removeChild(svgRoot.firstChild);
    }
    Array.from(fresh.childNodes).forEach((node) => {
      svgRoot.appendChild(node.cloneNode(true));
    });
    svgRoot.appendChild(overlayLayer);

    svgRoot.id = "svg-editor";
    svgRoot.setAttribute("xmlns", SVG_NS);
    ensureSvgSizeAttrs(svgRoot);
    clearSelection();
    updateSvgRulers();
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
      return Boolean(layersPanelHost && layersPanelHost.isConnected);
    },
    getCanvasSize,
    resizeCanvas,
    canCrop() {
      return Boolean(selectedElement && selectedElement !== svgRoot);
    },
    cropEdges,
    rotate90CW() {
      return rotateCanvas90("cw");
    },
    rotate90CCW() {
      return rotateCanvas90("ccw");
    },
    flipHorizontal() {
      return flipCanvas("h");
    },
    flipVertical() {
      return flipCanvas("v");
    },
    applyCurrentStyleToSelection,
    setFillColor(value) {
      styleState.fill = String(value || styleState.fill || "#80c0ff");
      if (selectedElement) selectedElement.setAttribute("fill", styleState.fill);
    },
    setStrokeColor(value) {
      styleState.stroke = String(value || styleState.stroke || "#000000");
      if (selectedElement) selectedElement.setAttribute("stroke", styleState.stroke);
    },
    setStrokeWidth(value) {
      const next = String(value || styleState.strokeWidth || "2").trim();
      if (!next) return;
      styleState.strokeWidth = next;
      if (selectedElement) selectedElement.setAttribute("stroke-width", next);
    },
    cropToSelection(padding = 8) {
      return cropToSelection(padding);
    },
    getCurrentStyleDefaults() {
      return { ...styleState };
    },
    getLayers,
    getActiveLayer,
    setActiveLayer,
    createLayer,
    renameActiveLayer,
    deleteActiveLayer,
    stepActiveLayer,
    moveActiveLayer,
    setActiveLayerVisible,
    toggleActiveLayerVisible,
    clearSelection,
    setSelection,
    getSelectedElements() {
      return [...selectedElements];
    },
    getSelectedElement() {
      return selectedElement;
    },
    moveSelectionBy,
    deleteSelection,
    duplicateSelection,
    copySelection,
    pasteSelection,
    alignSelection,
    arrangeSelection,
    groupSelection,
    ungroupSelection,
    selectAll() {
      setSelection(getSelectableElements());
      setStatus(`Selected ${selectedElements.length} element(s)`);
    }
  };
  window.toggleSVGLayersPanel = toggleLayersPanel;

  try {
    const editorCell = container?.closest?.(".panel-cell");
    if (editorCell) {
      const { layersCell } = ensureSvgEditingSplit({ editorCell }) || {};
      if (layersCell) {
        const prevActiveCell = window.activeCell;
        window.activeCell = layersCell;
        layersCell.dataset.id = "SVGLayersPanel";
        layersCell.dataset.panelClass = "InfoPanel";
        await loadPanelIntoCell("SVGLayersPanel", { id: "SVGLayersPanel", displayName: "SVG Layers" });
        window.activeCell = editorCell;
        window.highlightActiveCell?.(editorCell);
        window.activeCell = editorCell;
        if (prevActiveCell && prevActiveCell !== editorCell) {
          // Leave focus on the editor; don't steal active cell for the layers panel.
          window.activeCell = editorCell;
        }
      }
    }
  } catch (err) {
    console.warn("SVG editor: failed to auto-open layers panel:", err);
  }

  setMode(window.NodevisionState?.svgDrawTool || "select");
  console.log("SVG editor loaded for:", filePath);
}
