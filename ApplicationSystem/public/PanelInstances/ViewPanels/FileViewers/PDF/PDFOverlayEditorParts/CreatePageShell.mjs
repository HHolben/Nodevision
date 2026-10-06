// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/PDF/PDFOverlayEditorParts/CreatePageShell.mjs
// This module implements create page shell operations for PDFOverlayEditor, preserving the existing document and instance ownership contracts.

import { PDF_LISTEN_TEXT_LAYER_CLASS } from "../PDFListenTextLayer.mjs";
import { createSvgEl, UI_ATTR, toSvgPoint } from "./SVG_NS.mjs";
import { setActivePage, getSelectableTarget, selectElement, clearSelection, currentStyle, appendAnnotation } from "./FetchAnnotationText.mjs";
import { handleOverlayPointerMove, handleOverlayPointerUp, handleOverlayDoubleClick } from "./HandleOverlayPointerMove.mjs";

export function createPageShell(workspace, pageNumber, baseWidth, baseHeight) {
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

  const textLayer = document.createElement("div");
  textLayer.className = PDF_LISTEN_TEXT_LAYER_CLASS;
  Object.assign(textLayer.style, {
    position: "absolute",
    inset: "0",
    width: Math.round(baseWidth * workspace.scale) + "px",
    height: Math.round(baseHeight * workspace.scale) + "px",
    overflow: "hidden",
    pointerEvents: "none",
    userSelect: "none",
    zIndex: "1",
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
    zIndex: "2",
  });

  const annotationLayer = createSvgEl("g", { "data-nv-pdf-annotation-layer": "true" });
  overlaySvg.appendChild(annotationLayer);

  pageWrap.append(canvas, textLayer, overlaySvg);
  workspace.pagesHost.appendChild(pageWrap);

  const page = {
    pageNumber,
    baseWidth,
    baseHeight,
    wrap: pageWrap,
    canvas,
    textLayer,
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

export function ensureSelectionBox(workspace) {
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

export function handleOverlayPointerDown(workspace, event) {
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
