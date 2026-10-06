// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/PDF/PDFOverlayEditorParts/FetchAnnotationText.mjs
// This module implements fetch annotation text operations for PDFOverlayEditor, preserving the existing document and instance ownership contracts.

import { annotationPathForPdf, notebookUrl, setDirty, UI_ATTR } from "./SVG_NS.mjs";
import { installSvgContext } from "./InstallSvgContext.mjs";
import { ensureSelectionBox } from "./CreatePageShell.mjs";

export async function fetchAnnotationText(workspace) {
  const sidecarPath = annotationPathForPdf(workspace.filePath);
  const url = `${notebookUrl(sidecarPath)}?t=${Date.now()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return "";
  return res.text();
}

export function parseAnnotationGroups(text = "") {
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

export function loadAnnotationsIntoPages(workspace, groups) {
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

export async function loadPdfJs() {
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

export function setActivePage(workspace, page) {
  if (!page) return;
  workspace.activePage = page;
  workspace.activeSvg = page.overlaySvg;
  workspace.activeAnnotationLayer = page.annotationLayer;
  if (workspace.editable) installSvgContext(workspace);
}

export function currentStyle(workspace) {
  return {
    fill: workspace.styleState.fill,
    stroke: workspace.styleState.stroke,
    strokeWidth: workspace.styleState.strokeWidth,
  };
}

export function appendAnnotation(workspace, node, page = workspace.activePage) {
  if (!page || !node) return null;
  if (workspace.activePage !== page) setActivePage(workspace, page);
  page.annotationLayer.appendChild(node);
  if (workspace.editable) ensureSelectionBox(workspace);
  selectElement(workspace, node);
  setDirty(workspace, true);
  return node;
}

export function clearSelection(workspace) {
  if (workspace.selectedElement) {
    workspace.selectedElement.removeAttribute?.("data-selected");
    workspace.selectedElement.classList?.remove("nv-pdf-annotation-selected");
  }
  workspace.selectedElement = null;
  if (workspace.selectionBox) workspace.selectionBox.setAttribute("display", "none");
}

export function updateSelectionBox(workspace) {
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

export function selectElement(workspace, element) {
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

export function getSelectableTarget(workspace, target) {
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

export function setTransformWithDelta(element, baseTransform, dx, dy) {
  const translate = `translate(${dx} ${dy})`;
  const base = String(baseTransform || "").trim();
  element.setAttribute("transform", base ? `${translate} ${base}` : translate);
}

export function deleteSelection(workspace) {
  const el = workspace.selectedElement;
  if (!el) return false;
  el.remove();
  clearSelection(workspace);
  setDirty(workspace, true);
  return true;
}
