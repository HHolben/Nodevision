// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CircuitEditorComponents/HtmlReferencedCircuitIntegration.mjs
// This module hydrates referenced .cir elements in the HTML editor with read-only canvas previews.

import { loadCircuitFileStrict } from "./CircuitFileFormat.mjs";
import { drawCircuitDocumentToCanvas, renderCircuitErrorToCanvas } from "./CircuitCanvasRenderer.mjs";
import { loadCircuitComponentLibraries } from "../../../../Resources/ResourceRegistryClient.mjs";
import {
  CIRCUIT_CANVAS_CLASS,
  CIRCUIT_REFERENCE_CLASS,
  CIRCUIT_REFERENCE_SELECTOR,
  findCircuitReferenceElement,
  normalizeCircuitNotebookPath,
  readCircuitReferenceFromElement,
} from "./CircuitReferenceElement.mjs";

const elementState = new WeakMap();
let componentLibrariesPromise = null;

function referencedCircuitElements(root) {
  const elements = [];
  const rootCircuit = findCircuitReferenceElement(root);
  if (rootCircuit === root) elements.push(root);
  elements.push(...Array.from(root?.querySelectorAll?.(CIRCUIT_REFERENCE_SELECTOR) || []));
  return [...new Set(elements)];
}

function ensureCanvas(element) {
  let canvas = element.querySelector?.(`canvas.${CIRCUIT_CANVAS_CLASS}`) || element.querySelector?.("canvas");
  if (!canvas) {
    canvas = element.ownerDocument.createElement("canvas");
    element.appendChild(canvas);
  }
  canvas.classList.add(CIRCUIT_CANVAS_CLASS);
  return canvas;
}

function loadComponentLibraries() {
  if (!componentLibrariesPromise) {
    componentLibrariesPromise = loadCircuitComponentLibraries().catch((err) => {
      console.warn("Circuit reference component resource load failed:", err);
      return [];
    });
  }
  return componentLibrariesPromise;
}

function sameCircuitPath(a = "", b = "") {
  return normalizeCircuitNotebookPath(a).toLowerCase() === normalizeCircuitNotebookPath(b).toLowerCase();
}

async function renderReferencedCircuit(element, sourcePath) {
  const canvas = ensureCanvas(element);
  const reference = readCircuitReferenceFromElement(element, { sourcePath });
  if (!reference?.valid) {
    renderCircuitErrorToCanvas(canvas, reference?.error || "Invalid circuit reference.");
    return;
  }

  try {
    const [document, componentResources] = await Promise.all([
      loadCircuitFileStrict(reference.linkedNotebookPath),
      loadComponentLibraries(),
    ]);
    drawCircuitDocumentToCanvas(canvas, document, { componentResources });
  } catch (err) {
    renderCircuitErrorToCanvas(canvas, err?.message || "Circuit unavailable.");
  }
}

function circuitSizeKey(element) {
  const rect = element?.getBoundingClientRect?.();
  const width = Math.round(rect?.width || 0);
  const height = Math.round(rect?.height || 0);
  return width > 0 && height > 0 ? `${width}x${height}` : "";
}

function commitCircuitPresentationSize(element) {
  const key = circuitSizeKey(element);
  if (!key) return false;
  const [width, height] = key.split("x");
  const nextWidth = `${width}px`;
  const nextHeight = `${height}px`;
  const changed = element.style.width !== nextWidth || element.style.height !== nextHeight;
  element.style.width = nextWidth;
  element.style.height = nextHeight;
  return changed;
}

export function hydrateReferencedCircuitElement(element, { sourcePath = "", onPresentationChange = null } = {}) {
  if (!element) return () => {};
  elementState.get(element)?.cleanup?.();
  element.classList.add(CIRCUIT_REFERENCE_CLASS);
  element.setAttribute("contenteditable", "false");
  const canvas = ensureCanvas(element);
  canvas.setAttribute("aria-hidden", "true");

  let disposed = false;
  let frame = 0;
  let pointerStartSize = "";
  const onPointerUp = () => {
    window.removeEventListener("pointerup", onPointerUp, true);
    window.removeEventListener("pointercancel", onPointerUp, true);
    const nextSize = circuitSizeKey(element);
    if (!nextSize || nextSize === pointerStartSize) return;
    if (commitCircuitPresentationSize(element) && typeof onPresentationChange === "function") {
      onPresentationChange(element);
    }
  };
  const onPointerDown = () => {
    pointerStartSize = circuitSizeKey(element);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("pointercancel", onPointerUp, true);
  };
  element.addEventListener("pointerdown", onPointerDown);
  element.addEventListener("pointerup", onPointerUp);

  const schedule = () => {
    if (disposed || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!disposed) renderReferencedCircuit(element, sourcePath);
    });
  };

  let observer = null;
  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(schedule);
    observer.observe(element);
  }
  schedule();

  const cleanup = () => {
    disposed = true;
    if (frame) cancelAnimationFrame(frame);
    observer?.disconnect?.();
    window.removeEventListener("pointerup", onPointerUp, true);
    window.removeEventListener("pointercancel", onPointerUp, true);
    element.removeEventListener("pointerdown", onPointerDown);
    element.removeEventListener("pointerup", onPointerUp);
  };
  elementState.set(element, { cleanup, sourcePath });
  return cleanup;
}

export function refreshReferencedCircuits(root, { sourcePath = "", onPresentationChange = null } = {}) {
  referencedCircuitElements(root).forEach((element) => hydrateReferencedCircuitElement(element, { sourcePath, onPresentationChange }));
}

function cleanupReferencedCircuitElement(element) {
  elementState.get(element)?.cleanup?.();
  elementState.delete(element);
}

function cleanupReferencedCircuitTree(node) {
  referencedCircuitElements(node).forEach(cleanupReferencedCircuitElement);
}

export function installReferencedCircuitRendering(root, { sourcePath = "", onPresentationChange = null } = {}) {
  refreshReferencedCircuits(root, { sourcePath, onPresentationChange });

  const mutationObserver = new MutationObserver((records) => {
    records.forEach((record) => {
      record.removedNodes.forEach(cleanupReferencedCircuitTree);
      record.addedNodes.forEach((node) => refreshReferencedCircuits(node, { sourcePath, onPresentationChange }));
    });
  });
  mutationObserver.observe(root, { childList: true, subtree: true });

  const onSaved = (event) => {
    const changedPath = event?.detail?.filePath || event?.detail?.path || "";
    if (!changedPath) return;
    referencedCircuitElements(root).forEach((element) => {
      const reference = readCircuitReferenceFromElement(element, { sourcePath });
      if (reference?.linkedNotebookPath && sameCircuitPath(reference.linkedNotebookPath, changedPath)) {
        hydrateReferencedCircuitElement(element, { sourcePath, onPresentationChange });
      }
    });
  };
  window.addEventListener("nodevision-file-saved", onSaved);

  return () => {
    mutationObserver.disconnect();
    window.removeEventListener("nodevision-file-saved", onSaved);
    cleanupReferencedCircuitTree(root);
  };
}
