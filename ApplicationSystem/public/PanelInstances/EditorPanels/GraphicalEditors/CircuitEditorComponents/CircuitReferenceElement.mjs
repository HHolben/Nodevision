// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CircuitEditorComponents/CircuitReferenceElement.mjs
// This module defines durable HTML reference markup and path helpers for embedded circuit viewers.

import {
  getRelativeNotebookReference,
  normalizeNotebookRelativePath,
  resolveNotebookReference,
} from "../../../../utils/notebookPath.mjs";
import { serializeFallbackAttributes } from "../../../../utils/referenceFallbacks.mjs";

export const CIRCUIT_REFERENCE_CLASS = "nodevision-circuit-reference";
export const CIRCUIT_CANVAS_CLASS = "nodevision-circuit-canvas";
export const CIRCUIT_REFERENCE_SELECTOR = `.${CIRCUIT_REFERENCE_CLASS}, [data-nodevision-circuit-src]`;
export const DEFAULT_CIRCUIT_VIEW_SIZE = { width: 480, height: 320 };

export function escapeHtmlAttribute(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function normalizeCircuitNotebookPath(pathValue = "") {
  const relative = normalizeNotebookRelativePath(pathValue);
  return relative ? `Notebook/${relative}` : "";
}

export function normalizeCircuitDisplayDimension(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(4096, Math.max(120, parsed));
}

export function circuitReferenceSourceForHtml({ notebookPath = "", editorFilePath = "" } = {}) {
  const linked = normalizeCircuitNotebookPath(notebookPath);
  if (!linked) return "";
  return getRelativeNotebookReference({ sourcePath: editorFilePath, targetPath: linked });
}

export function buildCircuitReferenceMarkup({
  notebookPath = "",
  editorFilePath = "",
  width = DEFAULT_CIRCUIT_VIEW_SIZE.width,
  height = DEFAULT_CIRCUIT_VIEW_SIZE.height,
  title = "Circuit",
  fallbacks = [],
} = {}) {
  const linkedNotebookPath = normalizeCircuitNotebookPath(notebookPath);
  if (!linkedNotebookPath) throw new Error("Missing circuit Notebook path.");
  if (!linkedNotebookPath.toLowerCase().endsWith(".cir")) throw new Error("Referenced circuits must be .cir files.");

  const source = circuitReferenceSourceForHtml({ notebookPath: linkedNotebookPath, editorFilePath });
  const displayWidth = normalizeCircuitDisplayDimension(width, DEFAULT_CIRCUIT_VIEW_SIZE.width);
  const displayHeight = normalizeCircuitDisplayDimension(height, DEFAULT_CIRCUIT_VIEW_SIZE.height);
  const label = title || linkedNotebookPath.split("/").pop() || "Circuit";
  const fallbackAttrs = serializeFallbackAttributes(fallbacks, { primary: source });

  return `<div class="${CIRCUIT_REFERENCE_CLASS}" data-nodevision-resource-type="circuit" data-nodevision-circuit-mode="referenced" data-nodevision-circuit-src="${escapeHtmlAttribute(source)}"${fallbackAttrs} data-nv-linked-path="${escapeHtmlAttribute(linkedNotebookPath)}" contenteditable="false" role="img" aria-label="${escapeHtmlAttribute(label)}" style="width:${displayWidth}px;height:${displayHeight}px;"><canvas class="${CIRCUIT_CANVAS_CLASS}"></canvas></div>`;
}

export function isCircuitReferenceElement(element) {
  return Boolean(element?.matches?.(CIRCUIT_REFERENCE_SELECTOR));
}

export function findCircuitReferenceElement(target) {
  const element = target?.nodeType === 3 ? target.parentElement : target;
  return element?.closest?.(CIRCUIT_REFERENCE_SELECTOR) || null;
}

export function readCircuitReferenceFromElement(element, { sourcePath = "" } = {}) {
  const el = isCircuitReferenceElement(element) ? element : findCircuitReferenceElement(element);
  if (!el) return null;

  const source = String(el.getAttribute("data-nodevision-circuit-src") || "").trim();
  const linkedAttr = String(el.getAttribute("data-nv-linked-path") || "").trim();
  const resolved = source ? resolveNotebookReference({ sourcePath, reference: source }) : null;
  const linkedNotebookPath = normalizeCircuitNotebookPath(resolved || linkedAttr);
  const valid = Boolean(source && linkedNotebookPath && linkedNotebookPath.toLowerCase().endsWith(".cir"));

  return {
    element: el,
    isCircuitReference: true,
    mode: String(el.getAttribute("data-nodevision-circuit-mode") || "referenced"),
    source,
    linkedNotebookPath,
    notebookPath: linkedNotebookPath.replace(/^Notebook\//i, ""),
    valid,
    error: valid ? "" : "Missing or invalid .cir reference.",
  };
}
