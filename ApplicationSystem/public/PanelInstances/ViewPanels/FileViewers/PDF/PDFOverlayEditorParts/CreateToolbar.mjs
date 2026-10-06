// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/PDF/PDFOverlayEditorParts/CreateToolbar.mjs
// This module implements create toolbar operations for PDFOverlayEditor, preserving the existing document and instance ownership contracts.

import { makeButton, createSvgEl, saveAnnotations, setStatus, notebookUrl, DEFAULT_FALLBACK_WIDTH, DEFAULT_FALLBACK_HEIGHT } from "./SVG_NS.mjs";
import { setMode } from "./DuplicateSelection.mjs";
import { setActivePage, appendAnnotation } from "./FetchAnnotationText.mjs";
import { PDF_LISTEN_TEXT_LAYER_CSS, resetPdfListenText } from "../PDFListenTextLayer.mjs";
import { createPageShell } from "./CreatePageShell.mjs";
import { renderPdfPage } from "./HandleOverlayPointerMove.mjs";

export function createToolbar(workspace) {
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
    workspace.zoomBy?.(1 / 1.1);
  }, "Zoom out");
  const zoomIn = makeButton("+", () => {
    workspace.zoomBy?.(1.1);
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

export function installStyles(container) {
  const style = document.createElement("style");
  style.textContent = `
    .nv-pdf-workspace[data-tool="select"] .nv-pdf-overlay { cursor: default; }
    .nv-pdf-workspace[data-tool="line"] .nv-pdf-overlay,
    .nv-pdf-workspace[data-tool="freehand"] .nv-pdf-overlay { cursor: crosshair; }
    .nv-pdf-annotation-selected { filter: drop-shadow(0 0 2px #1f5fbf); }
    .nv-pdf-overlay text { user-select: none; }
    .nv-pdf-workspace[data-editable="false"] .nv-pdf-overlay { pointer-events: none; }
    ${PDF_LISTEN_TEXT_LAYER_CSS}
    .nv-pdf-fallback-object, .nv-pdf-fallback-frame { pointer-events: auto; }
  `;
  container.appendChild(style);
}

export async function renderWithPdfJs(workspace, pdfjs) {
  const pdfData = await fetch(notebookUrl(workspace.filePath), { cache: "no-store" }).then((res) => {
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.arrayBuffer();
  });

  const task = pdfjs.getDocument({ data: pdfData });
  workspace.pdfDocument = await task.promise;
  workspace.pageCountLabel.textContent = `${workspace.pdfDocument.numPages} page${workspace.pdfDocument.numPages === 1 ? "" : "s"}`;
  workspace.pagesHost.innerHTML = "";
  workspace.pages = [];
  resetPdfListenText(workspace);

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

export function renderFallbackPdfObject(workspace, reason) {
  workspace.pdfDocument = null;
  workspace.pagesHost.innerHTML = "";
  workspace.pages = [];
  resetPdfListenText(workspace);
  workspace.pageCountLabel.textContent = "Fallback";

  const page = createPageShell(workspace, 1, DEFAULT_FALLBACK_WIDTH, DEFAULT_FALLBACK_HEIGHT);
  page.canvas.remove();
  const fallbackUrl = notebookUrl(workspace.filePath);
  const object = document.createElement(workspace.editable ? "object" : "iframe");
  object.className = workspace.editable ? "nv-pdf-fallback-object" : "nv-pdf-fallback-frame";
  if (workspace.editable) {
    object.type = "application/pdf";
    object.data = fallbackUrl;
  } else {
    object.src = fallbackUrl;
    object.title = "PDF Viewer";
  }
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
