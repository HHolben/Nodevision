// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/InstallSvgSelectionHandles.mjs
// This module implements install Svg Selection Handles behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createUpdateLineEndpointHandlesHandler } from "./CreateUpdateLineEndpointHandlesHandler.mjs";

// Install Svg Selection Handles operations.
export function installSvgSelectionHandles(scope) {
  scope.svgSession.extrudePreviewPointFrom = function (rootPoint) {
    const cursor = scope.svgSession.lastPointerRoot;
    if (cursor && Number.isFinite(cursor.x) && Number.isFinite(cursor.y)) {
      const minDistance = Math.max(1, scope.svgSession.pointerToleranceInSvgUnits(4));
      if (Math.hypot(cursor.x - rootPoint.x, cursor.y - rootPoint.y) > minDistance) {
        return {
          x: cursor.x,
          y: cursor.y
        };
      }
    }
    const offset = Math.max(12, scope.svgSession.pointerToleranceInSvgUnits(36));
    return {
      x: rootPoint.x + offset,
      y: rootPoint.y
    };
  };
  scope.svgSession.startLineToolExtrudeFromSelection = function () {
    const lineRootPoint = scope.svgSession.getSelectedLineVertexRoot();
    const context = lineRootPoint ? {
      rootPoint: lineRootPoint,
      layer: scope.svgSession.getSelectedLineVertexLayer()
    } : scope.svgSession.getPathNodeExtrudeContext();
    if (!context?.rootPoint) {
      scope.svgSession.setStatus("Extrude: select one line endpoint or path node first");
      return false;
    }
    const rootPoint = context.rootPoint;
    const floatingPoint = scope.svgSession.extrudePreviewPointFrom(rootPoint);
    scope.svgSession.setMode("line");
    scope.svgSession.beginLineToolAt(rootPoint, context.layer);
    scope.svgSession.lineToolState.lastPlacedRoot = rootPoint;
    scope.svgSession.lineToolState.cursorRoot = floatingPoint;
    scope.svgSession.clearSelectedLineVertex();
    scope.svgSession.updateLineToolPreview(floatingPoint);
    scope.svgSession.setStatus("Extrude vertex: click to place connected vertex, X/Y/Z lock axis, type distance, Enter places");
    return true;
  };
  scope.svgSession.hideTransformHandles = function () {
    scope.svgSession.lineStartHandle.setAttribute("display", "none");
    scope.svgSession.lineEndHandle.setAttribute("display", "none");
    Object.values(scope.svgSession.resizeHandles).forEach(handle => handle.setAttribute("display", "none"));
  };
  scope.svgSession.updateLineEndpointHandles = createUpdateLineEndpointHandlesHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.setResizeHandle = function (handle, x, y) {
    handle.setAttribute("x", String(x - 4));
    handle.setAttribute("y", String(y - 4));
    handle.setAttribute("display", "");
  };
  scope.svgSession.updateResizeHandles = function (bbox) {
    if (!bbox) return;
    scope.svgSession.setResizeHandle(scope.svgSession.resizeHandles.nw, bbox.x, bbox.y);
    scope.svgSession.setResizeHandle(scope.svgSession.resizeHandles.ne, bbox.x + bbox.width, bbox.y);
    scope.svgSession.setResizeHandle(scope.svgSession.resizeHandles.se, bbox.x + bbox.width, bbox.y + bbox.height);
    scope.svgSession.setResizeHandle(scope.svgSession.resizeHandles.sw, bbox.x, bbox.y + bbox.height);
  };
  scope.svgSession.refreshTransformHandles = function (selectionBBox = null) {
    scope.svgSession.hideTransformHandles();
    if (scope.svgSession.toolState.drawing || !scope.svgSession.selectedElements.length) return;
    if (scope.svgSession.selectedElements.length === 1) {
      const el = scope.svgSession.selectedElements[0];
      if (!el) return;
      const tag = el.tagName.toLowerCase();
      if (tag === "line") {
        scope.svgSession.updateLineEndpointHandles(el);
        return;
      }
    }
    try {
      const bbox = selectionBBox || scope.svgSession.getSelectedUnionBBox();
      if (!bbox || !Number.isFinite(bbox.width) || !Number.isFinite(bbox.height)) return;
      scope.svgSession.updateResizeHandles(bbox);
    } catch {
      // Selection cannot be resized via bbox handles.
    }
  };
  scope.svgSession.applySelectionBoxBounds = function (bbox) {
    if (bbox && scope.svgSession.selectedElements.length > 0) {
      scope.svgSession.selectionBox.setAttribute("x", String(bbox.x - 3));
      scope.svgSession.selectionBox.setAttribute("y", String(bbox.y - 3));
      scope.svgSession.selectionBox.setAttribute("width", String(bbox.width + 6));
      scope.svgSession.selectionBox.setAttribute("height", String(bbox.height + 6));
      scope.svgSession.selectionBox.setAttribute("display", "");
    } else {
      scope.svgSession.selectionBox.setAttribute("display", "none");
    }
  };
  scope.svgSession.refreshSelectionGeometryVisuals = function () {
    if (!scope.svgSession.isCurrentRender()) return null;
    scope.svgSession.selectedElements = scope.svgSession.selectedElements.filter(el => scope.svgSession.svgRoot.contains(el));
    scope.svgSession.chrome.sync();
    scope.svgSession.recordLineProbe("selection-geometry-visuals:start", {
      selectedCount: scope.svgSession.selectedElements.length
    });
    scope.svgSession.selectedElement = scope.svgSession.selectedElements[0] || null;
    window.selectedSVGElement = scope.svgSession.selectedElement;
    const bbox = scope.svgSession.getSelectedUnionBBox();
    scope.svgSession.applySelectionBoxBounds(bbox);
    scope.svgSession.refreshTransformHandles(bbox);
    scope.svgSession.updateRotationOriginMarker();
    scope.svgSession.recordLineProbe("selection-geometry-visuals:end", {
      hasBounds: Boolean(bbox),
      selectedCount: scope.svgSession.selectedElements.length
    });
    return bbox;
  };
  scope.svgSession.refreshSelectionStateVisuals = function () {
    scope.svgSession.selectionMarkers.update(scope.svgSession.selectedElements);
    scope.svgSession.refreshSelectionGeometryVisuals();
  };
}
