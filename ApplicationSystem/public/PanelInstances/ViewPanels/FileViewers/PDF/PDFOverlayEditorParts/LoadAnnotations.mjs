// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/PDF/PDFOverlayEditorParts/LoadAnnotations.mjs
// This module implements load annotations operations for PDFOverlayEditor, preserving the existing document and instance ownership contracts.

import { fetchAnnotationText, parseAnnotationGroups, loadAnnotationsIntoPages, loadPdfJs } from "./FetchAnnotationText.mjs";
import { setStatus, annotationPathForPdf, normalizeNotebookPath, setDirty } from "./SVG_NS.mjs";
import { resetPdfListenText } from "../PDFListenTextLayer.mjs";
import { installStyles, createToolbar, renderFallbackPdfObject, renderWithPdfJs } from "./CreateToolbar.mjs";
import { installEditorHooks, installSvgContext } from "./InstallSvgContext.mjs";
import { installKeyboard, rerenderPages } from "./HandleOverlayPointerMove.mjs";
import { setMode } from "./DuplicateSelection.mjs";
import { installPdfZoom } from "../PDFZoom.mjs";

export async function loadAnnotations(workspace) {
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
    __nvPdfListenText: "",
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
  root.dataset.editable = editable ? "true" : "false";
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
  root.__nvPdfWorkspace = workspace;
  resetPdfListenText(workspace);
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
  container.__nvPdfWorkspace = workspace;
  window.__nvActivePdfWorkspace = workspace;

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

  const unregisterZoom = installPdfZoom(workspace, rerenderPages);
  container.__nvActiveEditorCleanup = () => {
    unregisterZoom();
    if (window.__nvActivePdfWorkspace === workspace) window.__nvActivePdfWorkspace = null;
    if (container.__nvPdfWorkspace === workspace) container.__nvPdfWorkspace = null;
    if (window.__nvPdfEditorActivePath === normalizedPath) {
      window.__nvPdfEditorActivePath = null;
      window.currentSavePDFAnnotations = undefined;
    }
  };

  return workspace;
}
