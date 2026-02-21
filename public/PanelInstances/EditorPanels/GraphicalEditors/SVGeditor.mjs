// Nodevision/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditor.mjs
// Rich in-panel SVG editor with layers, drawing tools, fill/stroke controls, and crop/resize.

import { createElementLayers } from "./ElementLayers.mjs";

const SVG_NS = "http://www.w3.org/2000/svg";
const SVG_UI_ATTR = "data-nv-editor-ui";

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

function parsePoints(points = "") {
  return String(points)
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(",").map((n) => Number.parseFloat(n)))
    .filter((pair) => pair.length === 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]));
}

function formatPoints(points = []) {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

function getAttrNumber(el, name, fallback = 0) {
  const value = Number.parseFloat(el.getAttribute(name));
  return Number.isFinite(value) ? value : fallback;
}

function setAttrNumber(el, name, value) {
  el.setAttribute(name, String(value));
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
  wrapper.tabIndex = 0;
  container.appendChild(wrapper);

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

  const svgWrapper = document.createElement("div");
  Object.assign(svgWrapper.style, {
    flex: "1",
    overflow: "auto",
    background: "#fff",
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
  layersPanelHost.style.display = "none";

  const layersMgr = createElementLayers(svgRoot, layersPanelHost);
  const styleState = {
    fill: "#80c0ff",
    stroke: "#000000",
    strokeWidth: "2"
  };

  const toolState = {
    mode: "select",
    drawing: false,
    startPoint: null,
    tempShape: null,
    bezierStep: 0,
    bezierPoints: []
  };

  let selectedElement = null;
  let selectedElements = [];
  let svgClipboard = [];
  let dragState = null;
  let marqueeState = null;

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
  overlayLayer.appendChild(selectionBox);
  overlayLayer.appendChild(marqueeBox);
  svgRoot.appendChild(overlayLayer);

  function setStatus(text) {
    status.textContent = text;
  }

  function setLayersPanelVisible(visible) {
    const show = Boolean(visible);
    if (show) {
      window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
        detail: { heading: "ViewLayers", force: true, toggle: false }
      }));
      setStatus("Layer tools moved to sub-toolbar");
    }
    return false;
  }

  function toggleLayersPanel() {
    window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
      detail: { heading: "ViewLayers", force: true, toggle: true }
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
      setStatus(`Cropped to selection (${Math.round(w)}x${Math.round(h)})`);
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

  function getSelectedUnionBBox() {
    if (!selectedElements.length) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const el of selectedElements) {
      try {
        const bbox = el.getBBox();
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

  function refreshSelectionVisuals() {
    const selectable = getSelectableElements();
    selectable.forEach((el) => {
      if (!selectedElements.includes(el)) {
        el.removeAttribute("data-selected");
        if (el.style.filter === "drop-shadow(0 0 2px #ff2f2f)") {
          el.style.filter = "";
        }
      }
    });

    selectedElements.forEach((el) => {
      el.setAttribute("data-selected", "true");
      el.style.filter = "drop-shadow(0 0 2px #ff2f2f)";
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
  }

  function clearSelection() {
    selectedElements = [];
    refreshSelectionVisuals();
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
  }

  function toggleSelection(el) {
    if (!isSelectableElement(el)) return;
    if (selectedElements.includes(el)) {
      selectedElements = selectedElements.filter((x) => x !== el);
    } else {
      selectedElements = [el, ...selectedElements];
    }
    refreshSelectionVisuals();
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
    el.setAttribute("transform", prev ? `${prev} ${translate}` : translate);
  }

  function moveSelectionBy(dx, dy) {
    if (!selectedElements.length) return false;
    selectedElements.forEach((el) => translateElement(el, dx, dy));
    refreshSelectionVisuals();
    return true;
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
    const boxes = selectedElements.map((el) => ({ el, bbox: el.getBBox() }));
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
      strokeWidth: styleState.strokeWidth || "2"
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
      el.setAttribute("stroke-width", styleState.strokeWidth || "2");
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
    return { width: w, height: h };
  }

  function getCanvasSize() {
    const vb = (svgRoot.getAttribute("viewBox") || "").trim().split(/\s+/).map((n) => Number.parseFloat(n));
    const width = Number.isFinite(vb[2]) ? vb[2] : Number.parseFloat(svgRoot.getAttribute("width")) || 800;
    const height = Number.isFinite(vb[3]) ? vb[3] : Number.parseFloat(svgRoot.getAttribute("height")) || 600;
    return { width, height };
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

  function intersectsRect(a, b) {
    return a.x <= b.x + b.width &&
      a.x + a.width >= b.x &&
      a.y <= b.y + b.height &&
      a.y + a.height >= b.y;
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

  wrapper.addEventListener("keydown", (e) => {
    if (toolState.mode !== "select") return;
    const key = String(e.key || "");
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
    const p = toSvgPoint(svgRoot, e.clientX, e.clientY);
    wrapper.focus();

    if (toolState.mode === "select") {
      const target = e.target instanceof SVGElement ? e.target : null;
      if (target && isSelectableElement(target)) {
        if (e.shiftKey) {
          toggleSelection(target);
          if (!selectedElements.includes(target)) {
            e.preventDefault();
            return;
          }
        } else if (!selectedElements.includes(target)) {
          setSelection([target], { primary: target });
        } else if (selectedElements.length > 1) {
          setSelection([target], { primary: target });
        }

        dragState = { pointerId: e.pointerId, last: p };
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
    if (toolState.mode === "select") {
      const p = toSvgPoint(svgRoot, e.clientX, e.clientY);

      if (dragState && dragState.pointerId === e.pointerId) {
        const dx = p.x - dragState.last.x;
        const dy = p.y - dragState.last.y;
        if (dx || dy) moveSelectionBy(dx, dy);
        dragState.last = p;
        e.preventDefault();
        return;
      }

      if (marqueeState && marqueeState.pointerId === e.pointerId) {
        marqueeState.current = p;
        const rect = setMarqueeBox(marqueeState.start, marqueeState.current);
        const hits = getSelectableElements().filter((el) => {
          try {
            return intersectsRect(rect, el.getBBox());
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

  svgRoot.addEventListener("pointerup", (e) => {
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
      return false;
    },
    getCanvasSize,
    resizeCanvas,
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

  setMode("select");
  console.log("SVG editor loaded for:", filePath);
}
