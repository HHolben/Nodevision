// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/PDF/PDFOverlayEditor.mjs
// Native Nodevision PDF workspace. PDF pages render to canvases when PDF.js is available, and annotations live in SVG overlays that can be edited with SVG-editor-compatible toolbar hooks.

import { updateToolbarState } from "/panels/createToolbar.mjs";

const SVG_NS = "http://www.w3.org/2000/svg";
const NOTEBOOK_BASE = "/Notebook";
const PDFJS_CDN_VERSION = "4.10.38";
const UI_ATTR = "data-nv-pdf-ui";
const ANNOTATION_ATTR = "data-nodevision-pdf-annotations";
const DEFAULT_FALLBACK_WIDTH = 1000;
const DEFAULT_FALLBACK_HEIGHT = 1414;

function normalizeNotebookPath(value = "") {
  let cleaned = String(value || "").trim();
  if (!cleaned) return "";

  try {
    if (/^https?:\/\//i.test(cleaned)) {
      cleaned = new URL(cleaned).pathname;
    }
  } catch {
    // Keep raw path-like value.
  }

  return cleaned
    .replace(/\\/g, "/")
    .replace(/[?#].*$/, "")
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/+/, "")
    .replace(/^Notebook\/+/i, "")
    .replace(/\/+/g, "/");
}

function encodePathSegments(pathValue = "") {
  return normalizeNotebookPath(pathValue)
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function notebookUrl(pathValue = "") {
  return `${NOTEBOOK_BASE}/${encodePathSegments(pathValue)}`;
}

function annotationPathForPdf(pdfPath = "") {
  return `${normalizeNotebookPath(pdfPath)}.annotations.svg`;
}

function createSvgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

function toSvgPoint(svgRoot, clientX, clientY) {
  if (svgRoot && typeof svgRoot.createSVGPoint === "function") {
    const pt = svgRoot.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = typeof svgRoot.getScreenCTM === "function" ? svgRoot.getScreenCTM() : null;
    try {
      return ctm ? pt.matrixTransform(ctm.inverse()) : { x: 0, y: 0 };
    } catch {
      return { x: 0, y: 0 };
    }
  }

  const rect = svgRoot?.getBoundingClientRect?.();
  return rect ? { x: clientX - rect.left, y: clientY - rect.top } : { x: 0, y: 0 };
}

function setStatus(workspace, message) {
  if (workspace.statusEl) workspace.statusEl.textContent = message;
}

function setDirty(workspace, dirty = true) {
  workspace.dirty = Boolean(dirty);
  if (!workspace.editable) return;
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.fileIsDirty = workspace.dirty;
  updateToolbarState({ fileIsDirty: workspace.dirty });
}

function styleButton(btn, active = false) {
  Object.assign(btn.style, {
    border: "1px solid " + (active ? "#1f5fbf" : "#a8b0bb"),
    borderRadius: "4px",
    background: active ? "#e8f0ff" : "#ffffff",
    color: "#172033",
    minHeight: "28px",
    padding: "0 9px",
    font: "12px/1.2 system-ui, -apple-system, Segoe UI, sans-serif",
    cursor: "pointer",
  });
}

function makeButton(label, onClick, title = label) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  btn.title = title;
  styleButton(btn);
  btn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick?.();
  });
  return btn;
}

function serializeAnnotationDocument(workspace) {
  const root = createSvgEl("svg", {
    xmlns: SVG_NS,
    [ANNOTATION_ATTR]: "1",
    "data-source-pdf": normalizeNotebookPath(workspace.filePath),
  });

  workspace.pages.forEach((page) => {
    const group = createSvgEl("g", {
      "data-page": String(page.pageNumber),
      "data-width": String(page.baseWidth || DEFAULT_FALLBACK_WIDTH),
      "data-height": String(page.baseHeight || DEFAULT_FALLBACK_HEIGHT),
    });
    Array.from(page.annotationLayer.childNodes).forEach((node) => {
      if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.TEXT_NODE) return;
      if (node.nodeType === Node.ELEMENT_NODE && node.hasAttribute?.(UI_ATTR)) return;
      const clone = node.cloneNode(true);
      if (clone.nodeType === Node.ELEMENT_NODE) {
        clone.removeAttribute?.("data-selected");
        clone.classList?.remove("nv-pdf-annotation-selected");
      }
      group.appendChild(clone);
    });
    root.appendChild(group);
  });

  return new XMLSerializer().serializeToString(root);
}

async function saveAnnotations(workspace) {
  const sidecarPath = annotationPathForPdf(workspace.filePath);
  const content = serializeAnnotationDocument(workspace);
  const res = await fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: sidecarPath,
      sourcePath: sidecarPath,
      content,
      encoding: "utf8",
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `${res.status} ${res.statusText}`);
  }

  setDirty(workspace, false);
  setStatus(workspace, `Saved annotations: ${sidecarPath}`);
  window.dispatchEvent(new CustomEvent("nodevision-file-saved", { detail: { filePath: sidecarPath } }));
  return true;
}

async function fetchAnnotationText(workspace) {
  const sidecarPath = annotationPathForPdf(workspace.filePath);
  const url = `${notebookUrl(sidecarPath)}?t=${Date.now()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return "";
  return res.text();
}

function parseAnnotationGroups(text = "") {
  if (!String(text || "").trim()) return new Map();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "image/svg+xml");
  if (doc.querySelector("parsererror")) return new Map();
  const root = doc.documentElement;
  if (!root || root.localName?.toLowerCase() !== "svg") return new Map();

  const groups = new Map();
  root.querySelectorAll("g[data-page]").forEach((group) => {
    const pageNumber = Number.parseInt(group.getAttribute("data-page") || "0", 10);
    if (!Number.isFinite(pageNumber) || pageNumber <= 0) return;
    groups.set(pageNumber, Array.from(group.childNodes).map((node) => node.cloneNode(true)));
  });
  return groups;
}

function loadAnnotationsIntoPages(workspace, groups) {
  workspace.pages.forEach((page) => {
    const nodes = groups.get(page.pageNumber) || [];
    nodes.forEach((node) => {
      const imported = document.importNode(node, true);
      if (imported.nodeType === Node.ELEMENT_NODE) {
        imported.removeAttribute?.("data-selected");
        imported.classList?.remove("nv-pdf-annotation-selected");
      }
      page.annotationLayer.appendChild(imported);
    });
  });
}

async function loadPdfJs() {
  const cdnBase = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_CDN_VERSION}`;
  const candidates = [
    {
      module: "/vendor/pdfjs/build/pdf.mjs",
      worker: "/vendor/pdfjs/build/pdf.worker.mjs",
      label: "local PDF.js",
    },
    {
      module: "/vendor/pdfjs/legacy/build/pdf.mjs",
      worker: "/vendor/pdfjs/legacy/build/pdf.worker.mjs",
      label: "local legacy PDF.js",
    },
    {
      module: `${cdnBase}/build/pdf.mjs`,
      worker: `${cdnBase}/build/pdf.worker.mjs`,
      label: "PDF.js CDN fallback",
    },
  ];

  for (const candidate of candidates) {
    try {
      const pdfjs = await import(candidate.module);
      pdfjs.GlobalWorkerOptions.workerSrc = candidate.worker;
      return { pdfjs, label: candidate.label };
    } catch (err) {
      console.warn("[PDFOverlayEditor] Failed to load", candidate.label, err);
    }
  }

  return { pdfjs: null, label: "" };
}

function setActivePage(workspace, page) {
  if (!page) return;
  workspace.activePage = page;
  workspace.activeSvg = page.overlaySvg;
  workspace.activeAnnotationLayer = page.annotationLayer;
  if (workspace.editable) installSvgContext(workspace);
}

function currentStyle(workspace) {
  return {
    fill: workspace.styleState.fill,
    stroke: workspace.styleState.stroke,
    strokeWidth: workspace.styleState.strokeWidth,
  };
}

function appendAnnotation(workspace, node, page = workspace.activePage) {
  if (!page || !node) return null;
  if (workspace.activePage !== page) setActivePage(workspace, page);
  page.annotationLayer.appendChild(node);
  if (workspace.editable) ensureSelectionBox(workspace);
  selectElement(workspace, node);
  setDirty(workspace, true);
  return node;
}

function clearSelection(workspace) {
  if (workspace.selectedElement) {
    workspace.selectedElement.removeAttribute?.("data-selected");
    workspace.selectedElement.classList?.remove("nv-pdf-annotation-selected");
  }
  workspace.selectedElement = null;
  if (workspace.selectionBox) workspace.selectionBox.setAttribute("display", "none");
}

function updateSelectionBox(workspace) {
  const el = workspace.selectedElement;
  const box = workspace.selectionBox;
  if (!el || !box || !workspace.activeSvg) return;
  try {
    const bb = el.getBBox();
    box.setAttribute("x", String(bb.x - 4));
    box.setAttribute("y", String(bb.y - 4));
    box.setAttribute("width", String(bb.width + 8));
    box.setAttribute("height", String(bb.height + 8));
    box.setAttribute("display", "");
  } catch {
    box.setAttribute("display", "none");
  }
}

function selectElement(workspace, element) {
  if (!element || element === workspace.activeSvg || element.hasAttribute?.(UI_ATTR)) {
    clearSelection(workspace);
    return null;
  }
  if (workspace.selectedElement && workspace.selectedElement !== element) {
    workspace.selectedElement.removeAttribute?.("data-selected");
    workspace.selectedElement.classList?.remove("nv-pdf-annotation-selected");
  }
  workspace.selectedElement = element;
  element.setAttribute?.("data-selected", "true");
  element.classList?.add("nv-pdf-annotation-selected");
  updateSelectionBox(workspace);
  return element;
}

function getSelectableTarget(workspace, target) {
  let node = target instanceof SVGElement ? target : null;
  while (node && node !== workspace.activeSvg) {
    if (node.hasAttribute?.(UI_ATTR)) return null;
    if (node.parentNode === workspace.activeAnnotationLayer || node.getAttribute?.("data-nv-textbox") === "true") {
      return node;
    }
    node = node.parentNode instanceof SVGElement ? node.parentNode : null;
  }
  return null;
}

function setTransformWithDelta(element, baseTransform, dx, dy) {
  const translate = `translate(${dx} ${dy})`;
  const base = String(baseTransform || "").trim();
  element.setAttribute("transform", base ? `${translate} ${base}` : translate);
}

function deleteSelection(workspace) {
  const el = workspace.selectedElement;
  if (!el) return false;
  el.remove();
  clearSelection(workspace);
  setDirty(workspace, true);
  return true;
}

function duplicateSelection(workspace) {
  const el = workspace.selectedElement;
  if (!el || !workspace.activePage) return null;
  const clone = el.cloneNode(true);
  clone.removeAttribute("data-selected");
  clone.classList?.remove("nv-pdf-annotation-selected");
  const base = clone.getAttribute("transform") || "";
  clone.setAttribute("transform", `translate(18 18) ${base}`.trim());
  return appendAnnotation(workspace, clone);
}

function copySelection(workspace) {
  if (!workspace.selectedElement) return false;
  workspace.clipboard = workspace.selectedElement.cloneNode(true);
  return true;
}

function pasteSelection(workspace, dx = 20, dy = 20) {
  if (!workspace.clipboard || !workspace.activePage) return [];
  const clone = workspace.clipboard.cloneNode(true);
  clone.removeAttribute("data-selected");
  clone.classList?.remove("nv-pdf-annotation-selected");
  const base = clone.getAttribute("transform") || "";
  clone.setAttribute("transform", ("translate(" + (Number(dx) || 0) + " " + (Number(dy) || 0) + ") " + base).trim());
  appendAnnotation(workspace, clone);
  return [clone];
}

function arrangeSelection(workspace, direction) {
  const el = workspace.selectedElement;
  const layer = workspace.activeAnnotationLayer;
  if (!el || !layer || el.parentNode !== layer) return false;
  if (direction === "front") {
    layer.appendChild(el);
  } else if (direction === "back") {
    layer.insertBefore(el, layer.firstChild);
  } else {
    return false;
  }
  updateSelectionBox(workspace);
  setDirty(workspace, true);
  return true;
}

function applyCurrentStyleToSelection(workspace) {
  const el = workspace.selectedElement;
  if (!el) return false;
  const style = currentStyle(workspace);
  if (el.localName?.toLowerCase() !== "g") {
    if (el.localName?.toLowerCase() !== "line" && el.localName?.toLowerCase() !== "path") {
      el.setAttribute("fill", style.fill);
    }
    el.setAttribute("stroke", style.stroke);
    el.setAttribute("stroke-width", style.strokeWidth);
  } else {
    el.querySelectorAll("rect,circle,ellipse,polygon,path,line").forEach((child) => {
      if (child.localName !== "line" && child.localName !== "path") child.setAttribute("fill", style.fill);
      child.setAttribute("stroke", style.stroke);
      child.setAttribute("stroke-width", style.strokeWidth);
    });
    el.querySelectorAll("text").forEach((child) => child.setAttribute("fill", style.stroke));
  }
  setDirty(workspace, true);
  return true;
}

function insertShape(workspace, kind) {
  const page = workspace.activePage || workspace.pages[0];
  if (!page) return null;
  setActivePage(workspace, page);

  const style = currentStyle(workspace);
  const x = Math.max(20, Math.round((page.baseWidth || DEFAULT_FALLBACK_WIDTH) * 0.12));
  const y = Math.max(20, Math.round((page.baseHeight || DEFAULT_FALLBACK_HEIGHT) * 0.12));
  let el = null;

  if (kind === "rect") {
    el = createSvgEl("rect", { x, y, width: 150, height: 90, fill: style.fill, stroke: style.stroke, "stroke-width": style.strokeWidth });
  } else if (kind === "circle") {
    el = createSvgEl("circle", { cx: x + 60, cy: y + 60, r: 60, fill: style.fill, stroke: style.stroke, "stroke-width": style.strokeWidth });
  } else if (kind === "ellipse") {
    el = createSvgEl("ellipse", { cx: x + 80, cy: y + 45, rx: 80, ry: 45, fill: style.fill, stroke: style.stroke, "stroke-width": style.strokeWidth });
  } else if (kind === "triangle") {
    el = createSvgEl("polygon", { points: `${x + 75},${y} ${x + 150},${y + 120} ${x},${y + 120}`, fill: style.fill, stroke: style.stroke, "stroke-width": style.strokeWidth });
  } else if (kind === "polygon") {
    el = createSvgEl("polygon", { points: `${x + 75},${y} ${x + 140},${y + 45} ${x + 115},${y + 120} ${x + 35},${y + 120} ${x + 10},${y + 45}`, fill: style.fill, stroke: style.stroke, "stroke-width": style.strokeWidth });
  } else if (kind === "star") {
    el = createSvgEl("polygon", { points: `${x + 80},${y} ${x + 99},${y + 55} ${x + 157},${y + 55} ${x + 110},${y + 88} ${x + 128},${y + 145} ${x + 80},${y + 110} ${x + 32},${y + 145} ${x + 50},${y + 88} ${x + 3},${y + 55} ${x + 61},${y + 55}`, fill: style.fill, stroke: style.stroke, "stroke-width": style.strokeWidth });
  } else if (kind === "line") {
    el = createSvgEl("line", { x1: x, y1: y, x2: x + 160, y2: y + 80, stroke: style.stroke, "stroke-width": style.strokeWidth, fill: "none" });
  } else if (kind === "path-bezier") {
    el = createSvgEl("path", { d: "M " + x + " " + (y + 80) + " C " + (x + 50) + " " + (y - 20) + " " + (x + 120) + " " + (y + 160) + " " + (x + 180) + " " + (y + 60), fill: "none", stroke: style.stroke, "stroke-width": style.strokeWidth });
  }

  return appendAnnotation(workspace, el, page);
}

function setMode(workspace, mode) {
  const next = ["select", "line", "freehand"].includes(mode) ? mode : "select";
  workspace.mode = next;
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.svgDrawTool = next;
  if (workspace.root) workspace.root.dataset.tool = next;
  setStatus(workspace, `PDF annotation tool: ${next}`);
}

function installSvgContext(workspace) {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.currentMode = workspace.editable ? "SVG Editing" : "PDF Viewing";
  if (workspace.editable) {
    updateToolbarState({
      currentMode: "SVG Editing",
      fileIsDirty: workspace.dirty,
      selectedFile: workspace.filePath,
    });
  }

  const ctx = {
    svgRoot: workspace.activeSvg,
    setMode: (mode) => setMode(workspace, mode),
    insertShape: (kind) => insertShape(workspace, kind),
    layers: {
      appendToActiveLayer(node) {
        return appendAnnotation(workspace, node);
      },
    },
    getCurrentStyleDefaults() {
      return currentStyle(workspace);
    },
    applyCurrentStyleToSelection: () => applyCurrentStyleToSelection(workspace),
    setFillColor(value) {
      workspace.styleState.fill = String(value || workspace.styleState.fill);
      if (workspace.selectedElement) workspace.selectedElement.setAttribute("fill", workspace.styleState.fill);
      setDirty(workspace, true);
    },
    setStrokeColor(value) {
      workspace.styleState.stroke = String(value || workspace.styleState.stroke);
      if (workspace.selectedElement) workspace.selectedElement.setAttribute("stroke", workspace.styleState.stroke);
      setDirty(workspace, true);
    },
    setStrokeWidth(value) {
      workspace.styleState.strokeWidth = String(value || workspace.styleState.strokeWidth);
      if (workspace.selectedElement) workspace.selectedElement.setAttribute("stroke-width", workspace.styleState.strokeWidth);
      setDirty(workspace, true);
    },
    clearSelection: () => clearSelection(workspace),
    deleteSelection: () => deleteSelection(workspace),
    duplicateSelection: () => duplicateSelection(workspace),
    copySelection: () => copySelection(workspace),
    pasteSelection: (dx = 20, dy = 20) => pasteSelection(workspace, dx, dy),
    arrangeSelection: (direction) => arrangeSelection(workspace, direction),
    alignSelection: () => false,
    groupSelection: () => false,
    ungroupSelection: () => false,
    moveSelectionBy(dx = 0, dy = 0) {
      const el = workspace.selectedElement;
      if (!el) return false;
      const base = el.getAttribute("transform") || "";
      el.setAttribute("transform", ("translate(" + (Number(dx) || 0) + " " + (Number(dy) || 0) + ") " + base).trim());
      updateSelectionBox(workspace);
      setDirty(workspace, true);
      return true;
    },
    getSelectedElement: () => workspace.selectedElement,
    getSelectedElements: () => workspace.selectedElement ? [workspace.selectedElement] : [],
    setSelection(elements = []) {
      return selectElement(workspace, elements[0] || null);
    },
    selectAll() {
      const first = workspace.activeAnnotationLayer?.querySelector?.(":scope > *:not([" + UI_ATTR + "])");
      if (first) selectElement(workspace, first);
    },
  };

  window.SVGEditorContext = ctx;
  window.selectSVGElement = (element) => selectElement(workspace, element);
}

function installEditorHooks(workspace) {
  if (!workspace.editable) return;
  window.__nvPdfEditorActivePath = workspace.filePath;
  window.saveWYSIWYGFile = async () => saveAnnotations(workspace);
  window.currentSavePDFAnnotations = async () => saveAnnotations(workspace);
}

function createPageShell(workspace, pageNumber, baseWidth, baseHeight) {
  const pageWrap = document.createElement("section");
  pageWrap.className = "nv-pdf-page";
  pageWrap.dataset.page = String(pageNumber);
  Object.assign(pageWrap.style, {
    position: "relative",
    margin: "18px auto",
    background: "#ffffff",
    boxShadow: "0 2px 12px rgba(20, 28, 40, 0.18)",
    width: `${Math.round(baseWidth * workspace.scale)}px`,
    minHeight: `${Math.round(baseHeight * workspace.scale)}px`,
  });

  const canvas = document.createElement("canvas");
  canvas.className = "nv-pdf-canvas";
  Object.assign(canvas.style, {
    display: "block",
    width: `${Math.round(baseWidth * workspace.scale)}px`,
    height: `${Math.round(baseHeight * workspace.scale)}px`,
  });

  const overlaySvg = createSvgEl("svg", {
    class: "nv-pdf-overlay",
    width: String(baseWidth),
    height: String(baseHeight),
    viewBox: `0 0 ${baseWidth} ${baseHeight}`,
    "data-page": String(pageNumber),
  });
  Object.assign(overlaySvg.style, {
    position: "absolute",
    inset: "0",
    width: `${Math.round(baseWidth * workspace.scale)}px`,
    height: `${Math.round(baseHeight * workspace.scale)}px`,
    cursor: workspace.editable ? "crosshair" : "default",
  });

  const annotationLayer = createSvgEl("g", { "data-nv-pdf-annotation-layer": "true" });
  overlaySvg.appendChild(annotationLayer);

  pageWrap.append(canvas, overlaySvg);
  workspace.pagesHost.appendChild(pageWrap);

  const page = {
    pageNumber,
    baseWidth,
    baseHeight,
    wrap: pageWrap,
    canvas,
    overlaySvg,
    annotationLayer,
    pdfPage: null,
  };

  overlaySvg.addEventListener("pointerenter", () => setActivePage(workspace, page));
  overlaySvg.addEventListener("pointerdown", (event) => {
    setActivePage(workspace, page);
    handleOverlayPointerDown(workspace, event);
  });
  overlaySvg.addEventListener("pointermove", (event) => handleOverlayPointerMove(workspace, event));
  overlaySvg.addEventListener("pointerup", (event) => handleOverlayPointerUp(workspace, event));
  overlaySvg.addEventListener("pointercancel", (event) => handleOverlayPointerUp(workspace, event));
  overlaySvg.addEventListener("dblclick", (event) => handleOverlayDoubleClick(workspace, event));

  return page;
}

function ensureSelectionBox(workspace) {
  if (!workspace.activeSvg) return;
  if (workspace.selectionBox?.ownerSVGElement === workspace.activeSvg) return;
  workspace.selectionBox?.remove?.();
  workspace.selectionBox = createSvgEl("rect", {
    [UI_ATTR]: "selection-box",
    fill: "none",
    stroke: "#1f5fbf",
    "stroke-width": "1.5",
    "stroke-dasharray": "6 4",
    display: "none",
  });
  workspace.selectionBox.style.pointerEvents = "none";
  workspace.activeSvg.appendChild(workspace.selectionBox);
}

function handleOverlayPointerDown(workspace, event) {
  if (!workspace.editable || !workspace.activeSvg) return;
  ensureSelectionBox(workspace);
  const point = toSvgPoint(workspace.activeSvg, event.clientX, event.clientY);
  const target = getSelectableTarget(workspace, event.target);

  if (workspace.mode === "select") {
    if (target) {
      selectElement(workspace, target);
      workspace.dragState = {
        pointerId: event.pointerId,
        element: target,
        start: point,
        baseTransform: target.getAttribute("transform") || "",
      };
      try { workspace.activeSvg.setPointerCapture(event.pointerId); } catch {}
      event.preventDefault();
      return;
    }
    clearSelection(workspace);
    return;
  }

  const style = currentStyle(workspace);
  if (workspace.mode === "line") {
    const line = createSvgEl("line", {
      x1: point.x,
      y1: point.y,
      x2: point.x,
      y2: point.y,
      stroke: style.stroke,
      "stroke-width": style.strokeWidth,
      fill: "none",
    });
    appendAnnotation(workspace, line);
    workspace.drawState = { pointerId: event.pointerId, element: line, kind: "line" };
  } else if (workspace.mode === "freehand") {
    const path = createSvgEl("path", {
      d: `M ${point.x} ${point.y}`,
      fill: "none",
      stroke: style.stroke,
      "stroke-width": style.strokeWidth,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    });
    appendAnnotation(workspace, path);
    workspace.drawState = { pointerId: event.pointerId, element: path, kind: "freehand" };
  }

  if (workspace.drawState) {
    try { workspace.activeSvg.setPointerCapture(event.pointerId); } catch {}
    event.preventDefault();
  }
}

function handleOverlayPointerMove(workspace, event) {
  if (!workspace.editable || !workspace.activeSvg) return;
  const point = toSvgPoint(workspace.activeSvg, event.clientX, event.clientY);

  if (workspace.dragState?.pointerId === event.pointerId) {
    const dx = point.x - workspace.dragState.start.x;
    const dy = point.y - workspace.dragState.start.y;
    setTransformWithDelta(workspace.dragState.element, workspace.dragState.baseTransform, dx, dy);
    updateSelectionBox(workspace);
    setDirty(workspace, true);
    event.preventDefault();
    return;
  }

  if (workspace.drawState?.pointerId === event.pointerId) {
    const el = workspace.drawState.element;
    if (workspace.drawState.kind === "line") {
      el.setAttribute("x2", String(point.x));
      el.setAttribute("y2", String(point.y));
    } else if (workspace.drawState.kind === "freehand") {
      const d = el.getAttribute("d") || "";
      el.setAttribute("d", `${d} L ${point.x} ${point.y}`);
    }
    updateSelectionBox(workspace);
    setDirty(workspace, true);
    event.preventDefault();
  }
}

function handleOverlayPointerUp(workspace, event) {
  if (!workspace.editable || !workspace.activeSvg) return;
  if (workspace.dragState?.pointerId === event.pointerId) {
    workspace.dragState = null;
    try { workspace.activeSvg.releasePointerCapture(event.pointerId); } catch {}
    event.preventDefault();
    return;
  }
  if (workspace.drawState?.pointerId === event.pointerId) {
    selectElement(workspace, workspace.drawState.element);
    workspace.drawState = null;
    try { workspace.activeSvg.releasePointerCapture(event.pointerId); } catch {}
    event.preventDefault();
  }
}

function findTextNode(element) {
  if (!element) return null;
  if (element.localName?.toLowerCase() === "text") return element;
  return element.querySelector?.("text") || null;
}

function handleOverlayDoubleClick(workspace, event) {
  if (!workspace.editable) return;
  const target = getSelectableTarget(workspace, event.target);
  const textNode = findTextNode(target);
  if (!textNode) return;
  const next = window.prompt?.("Text", textNode.textContent || "");
  if (next === null || next === undefined) return;
  textNode.textContent = String(next);
  selectElement(workspace, target);
  setDirty(workspace, true);
  event.preventDefault();
}

function installKeyboard(workspace) {
  workspace.root.addEventListener("keydown", (event) => {
    if (!workspace.editable) return;
    const key = String(event.key || "");
    const meta = event.ctrlKey || event.metaKey;
    if ((key === "Delete" || key === "Backspace") && deleteSelection(workspace)) {
      event.preventDefault();
      return;
    }
    if (meta && key.toLowerCase() === "d") {
      duplicateSelection(workspace);
      event.preventDefault();
    }
  });
}

function renderPageSize(page, workspace) {
  const width = Math.round(page.baseWidth * workspace.scale);
  const height = Math.round(page.baseHeight * workspace.scale);
  page.wrap.style.width = width + "px";
  page.wrap.style.minHeight = height + "px";
  if (page.canvas) {
    page.canvas.style.width = width + "px";
    page.canvas.style.height = height + "px";
  }
  if (page.fallbackObject) {
    page.fallbackObject.style.width = width + "px";
    page.fallbackObject.style.height = height + "px";
  }
  page.overlaySvg.style.width = width + "px";
  page.overlaySvg.style.height = height + "px";
}

async function renderPdfPage(workspace, page) {
  if (!page.pdfPage) return;
  const viewport = page.pdfPage.getViewport({ scale: workspace.scale });
  const dpr = window.devicePixelRatio || 1;
  const canvas = page.canvas;
  canvas.width = Math.max(1, Math.floor(viewport.width * dpr));
  canvas.height = Math.max(1, Math.floor(viewport.height * dpr));
  canvas.style.width = `${Math.round(viewport.width)}px`;
  canvas.style.height = `${Math.round(viewport.height)}px`;
  page.wrap.style.width = `${Math.round(viewport.width)}px`;
  page.wrap.style.minHeight = `${Math.round(viewport.height)}px`;
  page.overlaySvg.style.width = `${Math.round(viewport.width)}px`;
  page.overlaySvg.style.height = `${Math.round(viewport.height)}px`;

  const context = canvas.getContext("2d");
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  await page.pdfPage.render({ canvasContext: context, viewport }).promise;
}

async function rerenderPages(workspace) {
  workspace.zoomLabel.textContent = `${Math.round(workspace.scale * 100)}%`;
  if (workspace.pdfDocument) {
    for (const page of workspace.pages) {
      await renderPdfPage(workspace, page);
    }
  } else {
    workspace.pages.forEach((page) => renderPageSize(page, workspace));
  }
  updateSelectionBox(workspace);
}

function createToolbar(workspace) {
  const toolbar = document.createElement("div");
  toolbar.className = "nv-pdf-toolbar";
  Object.assign(toolbar.style, {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "42px",
    padding: "7px 10px",
    borderBottom: "1px solid #cfd5df",
    background: "#f6f8fb",
    boxSizing: "border-box",
    flexWrap: "wrap",
  });

  const title = document.createElement("div");
  title.textContent = workspace.editable ? "PDF Editor" : "PDF Viewer";
  Object.assign(title.style, {
    font: "600 13px/1.2 system-ui, -apple-system, Segoe UI, sans-serif",
    color: "#182033",
    marginRight: "8px",
  });

  const zoomOut = makeButton("-", () => {
    workspace.scale = Math.max(0.35, Number((workspace.scale - 0.1).toFixed(2)));
    rerenderPages(workspace);
  }, "Zoom out");
  const zoomIn = makeButton("+", () => {
    workspace.scale = Math.min(3, Number((workspace.scale + 0.1).toFixed(2)));
    rerenderPages(workspace);
  }, "Zoom in");
  workspace.zoomLabel = document.createElement("span");
  workspace.zoomLabel.textContent = `${Math.round(workspace.scale * 100)}%`;
  Object.assign(workspace.zoomLabel.style, {
    minWidth: "44px",
    textAlign: "center",
    font: "12px/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    color: "#314057",
  });

  toolbar.append(title, zoomOut, workspace.zoomLabel, zoomIn);

  if (workspace.editable) {
    const divider = document.createElement("div");
    Object.assign(divider.style, { width: "1px", height: "24px", background: "#cfd5df" });
    const selectBtn = makeButton("Select", () => setMode(workspace, "select"));
    const lineBtn = makeButton("Line", () => setMode(workspace, "line"));
    const drawBtn = makeButton("Draw", () => setMode(workspace, "freehand"));
    const textBtn = makeButton("Text Box", () => {
      const text = window.prompt?.("Text", "Text") || "";
      if (!text.trim()) return;
      const page = workspace.activePage || workspace.pages[0];
      setActivePage(workspace, page);
      const group = createSvgEl("g", { "data-nv-textbox": "true" });
      const rect = createSvgEl("rect", { x: "40", y: "40", width: "180", height: "48", rx: "4", ry: "4", fill: "#ffffff", stroke: "rgba(0,0,0,0.35)", "stroke-width": "1" });
      const textEl = createSvgEl("text", { x: "52", y: "70", "font-family": "Arial", "font-size": "18", fill: "#000000" });
      textEl.textContent = text;
      group.append(rect, textEl);
      appendAnnotation(workspace, group);
    });
    const saveBtn = makeButton("Save Annotations", () => {
      saveAnnotations(workspace).catch((err) => {
        console.error("Failed to save PDF annotations:", err);
        setStatus(workspace, `Save failed: ${err.message}`);
      });
    });

    toolbar.append(divider, selectBtn, lineBtn, drawBtn, textBtn, saveBtn);
  }

  workspace.statusEl = document.createElement("div");
  workspace.statusEl.textContent = "Loading PDF...";
  Object.assign(workspace.statusEl.style, {
    marginLeft: "auto",
    color: "#5d6878",
    font: "12px/1.2 system-ui, -apple-system, Segoe UI, sans-serif",
  });
  toolbar.appendChild(workspace.statusEl);
  return toolbar;
}

function installStyles(container) {
  const style = document.createElement("style");
  style.textContent = `
    .nv-pdf-workspace[data-tool="select"] .nv-pdf-overlay { cursor: default; }
    .nv-pdf-workspace[data-tool="line"] .nv-pdf-overlay,
    .nv-pdf-workspace[data-tool="freehand"] .nv-pdf-overlay { cursor: crosshair; }
    .nv-pdf-annotation-selected { filter: drop-shadow(0 0 2px #1f5fbf); }
    .nv-pdf-overlay text { user-select: none; }
    .nv-pdf-fallback-object { pointer-events: none; }
  `;
  container.appendChild(style);
}

async function renderWithPdfJs(workspace, pdfjs) {
  const pdfData = await fetch(notebookUrl(workspace.filePath), { cache: "no-store" }).then((res) => {
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.arrayBuffer();
  });

  const task = pdfjs.getDocument({ data: pdfData });
  workspace.pdfDocument = await task.promise;
  workspace.pageCountLabel.textContent = `${workspace.pdfDocument.numPages} page${workspace.pdfDocument.numPages === 1 ? "" : "s"}`;
  workspace.pagesHost.innerHTML = "";
  workspace.pages = [];

  for (let pageNumber = 1; pageNumber <= workspace.pdfDocument.numPages; pageNumber += 1) {
    const pdfPage = await workspace.pdfDocument.getPage(pageNumber);
    const viewport = pdfPage.getViewport({ scale: 1 });
    const page = createPageShell(workspace, pageNumber, viewport.width, viewport.height);
    page.pdfPage = pdfPage;
    workspace.pages.push(page);
    await renderPdfPage(workspace, page);
  }

  setActivePage(workspace, workspace.pages[0]);
}

function renderFallbackPdfObject(workspace, reason) {
  workspace.pdfDocument = null;
  workspace.pagesHost.innerHTML = "";
  workspace.pages = [];
  workspace.pageCountLabel.textContent = "Fallback";

  const page = createPageShell(workspace, 1, DEFAULT_FALLBACK_WIDTH, DEFAULT_FALLBACK_HEIGHT);
  page.canvas.remove();
  const object = document.createElement("object");
  object.className = "nv-pdf-fallback-object";
  object.type = "application/pdf";
  object.data = notebookUrl(workspace.filePath);
  Object.assign(object.style, {
    display: "block",
    width: `${Math.round(DEFAULT_FALLBACK_WIDTH * workspace.scale)}px`,
    height: `${Math.round(DEFAULT_FALLBACK_HEIGHT * workspace.scale)}px`,
    border: "0",
    background: "#fff",
  });
  page.fallbackObject = object;
  page.wrap.prepend(object);
  workspace.pages.push(page);
  setActivePage(workspace, page);
  setStatus(workspace, `PDF.js unavailable. Showing browser fallback with Nodevision annotations. ${reason || ""}`.trim());
}

async function loadAnnotations(workspace) {
  try {
    const text = await fetchAnnotationText(workspace);
    const groups = parseAnnotationGroups(text);
    loadAnnotationsIntoPages(workspace, groups);
    if (groups.size) setStatus(workspace, `Loaded annotations: ${annotationPathForPdf(workspace.filePath)}`);
  } catch (err) {
    console.warn("Failed to load PDF annotations:", err);
  }
}

export async function renderPdfWorkspace(filePath, container, options = {}) {
  const normalizedPath = normalizeNotebookPath(filePath);
  const editable = options.editable !== false;
  if (!container) throw new Error("PDF workspace container required");

  container.innerHTML = "";
  const workspace = {
    filePath: normalizedPath,
    editable,
    scale: options.initialScale || 1.15,
    pages: [],
    pdfDocument: null,
    activePage: null,
    activeSvg: null,
    activeAnnotationLayer: null,
    selectedElement: null,
    selectionBox: null,
    dragState: null,
    drawState: null,
    clipboard: null,
    dirty: false,
    mode: "select",
    styleState: {
      fill: "rgba(128, 192, 255, 0.24)",
      stroke: "#1f5fbf",
      strokeWidth: "2",
    },
  };

  const root = document.createElement("div");
  root.className = "nv-pdf-workspace";
  root.dataset.tool = "select";
  root.tabIndex = 0;
  Object.assign(root.style, {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    minHeight: "0",
    background: "#dfe4ec",
    overflow: "hidden",
  });
  workspace.root = root;
  installStyles(root);

  const toolbar = createToolbar(workspace);
  workspace.pageCountLabel = document.createElement("span");
  workspace.pageCountLabel.textContent = "";
  Object.assign(workspace.pageCountLabel.style, {
    font: "12px/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    color: "#314057",
  });
  toolbar.insertBefore(workspace.pageCountLabel, workspace.statusEl);

  const pagesHost = document.createElement("div");
  pagesHost.className = "nv-pdf-pages";
  Object.assign(pagesHost.style, {
    flex: "1",
    minHeight: "0",
    overflow: "auto",
    padding: "14px 28px 40px",
    boxSizing: "border-box",
  });
  workspace.pagesHost = pagesHost;

  root.append(toolbar, pagesHost);
  container.appendChild(root);

  if (editable) {
    window.NodevisionState = window.NodevisionState || {};
    window.NodevisionState.currentMode = "SVG Editing";
    window.NodevisionState.activePanelType = "GraphicalEditor";
    window.NodevisionState.selectedFile = normalizedPath;
    window.NodevisionState.activeEditorFilePath = normalizedPath;
    window.__nvActiveHtmlEditorContext = null;
    window.__nvWysiwygActivePath = null;
    window.__nvHtmlEditorActivePath = null;
    window.__nvSvgEditorActivePath = null;
    window.currentActiveFilePath = normalizedPath;
    window.filePath = normalizedPath;
    installEditorHooks(workspace);
    installKeyboard(workspace);
  }

  try {
    const { pdfjs, label } = await loadPdfJs();
    if (!pdfjs) {
      renderFallbackPdfObject(workspace, "Install pdfjs-dist locally for full canvas rendering.");
    } else {
      await renderWithPdfJs(workspace, pdfjs);
      setStatus(workspace, `Rendered with ${label}`);
    }
  } catch (err) {
    console.error("PDF render failed:", err);
    renderFallbackPdfObject(workspace, err?.message || "");
  }

  await loadAnnotations(workspace);
  setDirty(workspace, false);
  if (workspace.editable) {
    installSvgContext(workspace);
    setMode(workspace, window.NodevisionState?.svgDrawTool || "select");
  }

  container.__nvActiveEditorCleanup = () => {
    if (window.__nvPdfEditorActivePath === normalizedPath) {
      window.__nvPdfEditorActivePath = null;
      window.currentSavePDFAnnotations = undefined;
    }
  };

  return workspace;
}

export { annotationPathForPdf };
