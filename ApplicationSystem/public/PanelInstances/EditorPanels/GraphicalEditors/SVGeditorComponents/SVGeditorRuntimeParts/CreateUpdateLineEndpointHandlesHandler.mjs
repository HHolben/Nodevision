// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateUpdateLineEndpointHandlesHandler.mjs
// This module implements create Update Line Endpoint Handles Handler behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { getAttrNumber } from "../svgDom.mjs";
import { getImageHref } from "../internalPng.mjs";

// Create Update Line Endpoint Handles Handler operations.
export function createUpdateLineEndpointHandlesHandler(owner) {
  return function (line) {
    const handleRadius = Math.max(1.5, owner.svgSession.pointerToleranceInSvgUnits(4));
    owner.svgSession.lineStartHandle.setAttribute("r", String(handleRadius));
    owner.svgSession.lineEndHandle.setAttribute("r", String(handleRadius));
    const x1 = getAttrNumber(line, "x1", 0);
    const y1 = getAttrNumber(line, "y1", 0);
    const x2 = getAttrNumber(line, "x2", 0);
    const y2 = getAttrNumber(line, "y2", 0);
    const lineToScreen = typeof line.getScreenCTM === "function" ? line.getScreenCTM() : null;
    const rootToScreen = typeof owner.svgSession.svgRoot.getScreenCTM === "function" ? owner.svgSession.svgRoot.getScreenCTM() : null;
    let p1 = {
      x: x1,
      y: y1
    };
    let p2 = {
      x: x2,
      y: y2
    };
    if (lineToScreen && rootToScreen && typeof rootToScreen.inverse === "function") {
      try {
        const screenToRoot = rootToScreen.inverse();
        const s1 = owner.svgSession.applySvgMatrix(lineToScreen, x1, y1);
        const s2 = owner.svgSession.applySvgMatrix(lineToScreen, x2, y2);
        p1 = owner.svgSession.applySvgMatrix(screenToRoot, s1.x, s1.y);
        p2 = owner.svgSession.applySvgMatrix(screenToRoot, s2.x, s2.y);
      } catch {
        // ignore
      }
    }
    owner.svgSession.lineStartHandle.setAttribute("cx", String(p1.x));
    owner.svgSession.lineStartHandle.setAttribute("cy", String(p1.y));
    owner.svgSession.lineStartHandle.setAttribute("display", "");
    owner.svgSession.lineEndHandle.setAttribute("cx", String(p2.x));
    owner.svgSession.lineEndHandle.setAttribute("cy", String(p2.y));
    owner.svgSession.lineEndHandle.setAttribute("display", "");
    const selectedStart = owner.svgSession.isSelectedLineVertexValid() && owner.svgSession.selectedLineVertex.line === line && owner.svgSession.selectedLineVertex.which === "start";
    const selectedEnd = owner.svgSession.isSelectedLineVertexValid() && owner.svgSession.selectedLineVertex.line === line && owner.svgSession.selectedLineVertex.which === "end";
    owner.svgSession.lineStartHandle.setAttribute("fill", selectedStart ? "#2f80ff" : "#ffffff");
    owner.svgSession.lineEndHandle.setAttribute("fill", selectedEnd ? "#2f80ff" : "#ffffff");
  };
}

export function createSelectedSvgImageContextHandler(owner) {
  return function () {
    if (!owner.svgSession.isSvgImageElement(owner.svgSession.selectedElement)) return null;
    const href = getImageHref(owner.svgSession.selectedElement);
    let linkedNotebookPath = "";
    if (href && !href.startsWith("data:") && !/^(https?:)?\/\//i.test(href)) {
      const isNotebookPath = /^\/?Notebook\//i.test(href);
      linkedNotebookPath = owner.svgSession.normalizeNotebookPathInput(href.startsWith("/") || isNotebookPath ? href : [owner.svgSession.dirname(owner.filePath), href].filter(Boolean).join("/"));
    } else if (href) {
      try {
        const url = new URL(href, window.location.origin);
        if (url.origin === window.location.origin && url.pathname.startsWith("/Notebook/")) {
          linkedNotebookPath = owner.svgSession.normalizeNotebookPathInput(url.pathname);
        }
      } catch {
        // external image
      }
    }
    return {
      element: owner.svgSession.selectedElement,
      href,
      linkedNotebookPath
    };
  };
}

export function createClearSelectionHandler(owner) {
  return function () {
    owner.svgSession.recordLineProbe("clearSelection:start", {
      selectedCount: owner.svgSession.selectedElements.length
    });
    if (owner.svgSession.selectionGrabState) owner.svgSession.commitSelectionGrabCommand({
      silent: true
    });
    if (owner.svgSession.pendingRotateCommand) owner.svgSession.commitPendingRotationCommand({
      silent: true
    });
    owner.svgSession.clearMaskEditState({
      silent: true
    });
    owner.svgSession.selectedElements = [];
    owner.svgSession.clearSelectedLineVertex();
    owner.svgSession.lineHandleDragState = null;
    owner.svgSession.resizeState = null;
    owner.svgSession.rotateState = null;
    owner.svgSession.refreshSelectionVisuals();
    owner.svgSession.recordLineProbe("clearSelection:after-refreshSelectionVisuals");
    owner.svgSession.notifySelectionChanged();
    owner.svgSession.recordLineProbe("clearSelection:end");
  };
}

export function createSetSelectionHandler(owner) {
  return function (elements = [], options = {}) {
    owner.svgSession.recordLineProbe("setSelection:start", {
      inputCount: elements.length,
      append: Boolean(options.append)
    });
    if (owner.svgSession.selectionGrabState) owner.svgSession.commitSelectionGrabCommand({
      silent: true
    });
    if (owner.svgSession.pendingRotateCommand) owner.svgSession.commitPendingRotationCommand({
      silent: true
    });
    const unique = [...new Set(elements)].filter(el => owner.svgSession.isSelectableElement(el, options));
    owner.svgSession.selectedElements = options.append ? [...new Set([...owner.svgSession.selectedElements, ...unique])] : unique;
    if (options.primary && owner.svgSession.selectedElements.includes(options.primary)) {
      owner.svgSession.selectedElements = [options.primary, ...owner.svgSession.selectedElements.filter(el => el !== options.primary)];
    }
    if (owner.svgSession.maskEditState && !options.keepMaskEditState && !owner.svgSession.selectionInsideMaskEditState(owner.svgSession.selectedElements)) {
      owner.svgSession.clearMaskEditState({
        silent: true
      });
    }
    if (!owner.svgSession.isSelectedLineVertexValid()) owner.svgSession.clearSelectedLineVertex();
    owner.svgSession.refreshSelectionVisuals();
    owner.svgSession.notifySelectionChanged();
    owner.svgSession.recordLineProbe("setSelection:end", {
      selectedCount: owner.svgSession.selectedElements.length
    });
  };
}
