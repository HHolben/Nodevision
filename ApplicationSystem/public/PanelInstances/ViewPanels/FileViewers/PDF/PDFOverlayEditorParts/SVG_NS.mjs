// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/PDF/PDFOverlayEditorParts/SVG_NS.mjs
// This module implements svg_ns operations for PDFOverlayEditor, preserving the existing document and instance ownership contracts.

import { updateToolbarState } from "/panels/createToolbar.mjs";

export const SVG_NS = "http://www.w3.org/2000/svg";

export const NOTEBOOK_BASE = "/Notebook";

export const UI_ATTR = "data-nv-pdf-ui";

export const ANNOTATION_ATTR = "data-nodevision-pdf-annotations";

export const DEFAULT_FALLBACK_WIDTH = 1000;

export const DEFAULT_FALLBACK_HEIGHT = 1414;

export function normalizeNotebookPath(value = "") {
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

export function encodePathSegments(pathValue = "") {
  return normalizeNotebookPath(pathValue)
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

export function notebookUrl(pathValue = "") {
  return `${NOTEBOOK_BASE}/${encodePathSegments(pathValue)}`;
}

export function annotationPathForPdf(pdfPath = "") {
  return `${normalizeNotebookPath(pdfPath)}.annotations.svg`;
}

export function createSvgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

export function toSvgPoint(svgRoot, clientX, clientY) {
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

export function setStatus(workspace, message) {
  if (workspace.statusEl) workspace.statusEl.textContent = message;
}

export function setDirty(workspace, dirty = true) {
  workspace.dirty = Boolean(dirty);
  if (!workspace.editable) return;
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.fileIsDirty = workspace.dirty;
  updateToolbarState({ fileIsDirty: workspace.dirty });
}

export function styleButton(btn, active = false) {
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

export function makeButton(label, onClick, title = label) {
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

export function serializeAnnotationDocument(workspace) {
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

export async function saveAnnotations(workspace) {
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
