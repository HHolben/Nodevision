// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/PDF/PDFOverlayEditorParts/DuplicateSelection.mjs
// This module implements duplicate selection operations for PDFOverlayEditor, preserving the existing document and instance ownership contracts.

import { appendAnnotation, updateSelectionBox, currentStyle, setActivePage } from "./FetchAnnotationText.mjs";
import { setDirty, DEFAULT_FALLBACK_WIDTH, DEFAULT_FALLBACK_HEIGHT, createSvgEl, setStatus } from "./SVG_NS.mjs";

export function duplicateSelection(workspace) {
  const el = workspace.selectedElement;
  if (!el || !workspace.activePage) return null;
  const clone = el.cloneNode(true);
  clone.removeAttribute("data-selected");
  clone.classList?.remove("nv-pdf-annotation-selected");
  const base = clone.getAttribute("transform") || "";
  clone.setAttribute("transform", `translate(18 18) ${base}`.trim());
  return appendAnnotation(workspace, clone);
}

export function copySelection(workspace) {
  if (!workspace.selectedElement) return false;
  workspace.clipboard = workspace.selectedElement.cloneNode(true);
  return true;
}

export function pasteSelection(workspace, dx = 20, dy = 20) {
  if (!workspace.clipboard || !workspace.activePage) return [];
  const clone = workspace.clipboard.cloneNode(true);
  clone.removeAttribute("data-selected");
  clone.classList?.remove("nv-pdf-annotation-selected");
  const base = clone.getAttribute("transform") || "";
  clone.setAttribute("transform", ("translate(" + (Number(dx) || 0) + " " + (Number(dy) || 0) + ") " + base).trim());
  appendAnnotation(workspace, clone);
  return [clone];
}

export function arrangeSelection(workspace, direction) {
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

export function applyCurrentStyleToSelection(workspace) {
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

export function insertShape(workspace, kind) {
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

export function setMode(workspace, mode) {
  const next = ["select", "line", "freehand"].includes(mode) ? mode : "select";
  workspace.mode = next;
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.svgDrawTool = next;
  if (workspace.root) workspace.root.dataset.tool = next;
  setStatus(workspace, `PDF annotation tool: ${next}`);
}
