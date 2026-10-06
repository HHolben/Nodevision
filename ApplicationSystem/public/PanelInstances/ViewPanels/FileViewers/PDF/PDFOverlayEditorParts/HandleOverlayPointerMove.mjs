// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/PDF/PDFOverlayEditorParts/HandleOverlayPointerMove.mjs
// This module implements handle overlay pointer move operations for PDFOverlayEditor, preserving the existing document and instance ownership contracts.

import { toSvgPoint, setDirty } from "./SVG_NS.mjs";
import { setTransformWithDelta, updateSelectionBox, selectElement, getSelectableTarget, deleteSelection } from "./FetchAnnotationText.mjs";
import { duplicateSelection } from "./DuplicateSelection.mjs";
import { renderPdfTextLayer, resetPdfListenText } from "../PDFListenTextLayer.mjs";

export function handleOverlayPointerMove(workspace, event) {
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

export function handleOverlayPointerUp(workspace, event) {
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

export function findTextNode(element) {
  if (!element) return null;
  if (element.localName?.toLowerCase() === "text") return element;
  return element.querySelector?.("text") || null;
}

export function handleOverlayDoubleClick(workspace, event) {
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

export function installKeyboard(workspace) {
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

export function renderPageSize(page, workspace) {
  const width = Math.round(page.baseWidth * workspace.scale);
  const height = Math.round(page.baseHeight * workspace.scale);
  page.wrap.style.width = width + "px";
  page.wrap.style.minHeight = height + "px";
  if (page.canvas) {
    page.canvas.style.width = width + "px";
    page.canvas.style.height = height + "px";
  }
  if (page.textLayer) {
    page.textLayer.style.width = width + "px";
    page.textLayer.style.height = height + "px";
  }
  if (page.fallbackObject) {
    page.fallbackObject.style.width = width + "px";
    page.fallbackObject.style.height = height + "px";
  }
  page.overlaySvg.style.width = width + "px";
  page.overlaySvg.style.height = height + "px";
}

export async function renderPdfPage(workspace, page) {
  if (!page.pdfPage) return;
  const viewport = page.pdfPage.getViewport({ scale: workspace.scale });
  const dpr = window.devicePixelRatio || 1;
  const canvas = page.canvas;
  canvas.width = Math.max(1, Math.floor(viewport.width * dpr));
  canvas.height = Math.max(1, Math.floor(viewport.height * dpr));
  canvas.style.width = Math.round(viewport.width) + "px";
  canvas.style.height = Math.round(viewport.height) + "px";
  page.wrap.style.width = Math.round(viewport.width) + "px";
  page.wrap.style.minHeight = Math.round(viewport.height) + "px";
  if (page.textLayer) {
    page.textLayer.style.width = Math.round(viewport.width) + "px";
    page.textLayer.style.height = Math.round(viewport.height) + "px";
  }
  page.overlaySvg.style.width = Math.round(viewport.width) + "px";
  page.overlaySvg.style.height = Math.round(viewport.height) + "px";

  const context = canvas.getContext("2d");
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  await page.pdfPage.render({ canvasContext: context, viewport }).promise;
  await renderPdfTextLayer(workspace, page, viewport);
}

export async function rerenderPages(workspace) {
  workspace.zoomLabel.textContent = `${Math.round(workspace.scale * 100)}%`;
  if (workspace.pdfDocument) {
    resetPdfListenText(workspace);
    for (const page of workspace.pages) {
      await renderPdfPage(workspace, page);
    }
  } else {
    workspace.pages.forEach((page) => renderPageSize(page, workspace));
  }
  updateSelectionBox(workspace);
}
