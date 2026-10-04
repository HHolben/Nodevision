// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateSvgLayerContext.mjs
// This module implements create Svg Layer Context behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

// Create Svg Layer Context operations.
export function createSvgLayerContext(owner) {
  return () => ({
    setStrokeColor(value) {
      return owner.svgSession.runSvgSnapshotOperation("set-stroke-color", () => {
        owner.svgSession.styleState.stroke = String(value || owner.svgSession.styleState.stroke || "#000000");
        window.NodevisionState = window.NodevisionState || {};
        window.NodevisionState.svgLastEditedPaint = "stroke";
        if (owner.svgSession.selectedElement) owner.svgSession.selectedElement.setAttribute("stroke", owner.svgSession.styleState.stroke);
        return true;
      });
    },
    setStrokeWidth(value) {
      return owner.svgSession.runSvgSnapshotOperation("set-stroke-width", () => {
        const next = String(value || owner.svgSession.styleState.strokeWidth || "2").trim();
        if (!next) return false;
        owner.svgSession.styleState.strokeWidth = next;
        if (owner.svgSession.selectedElement) owner.svgSession.selectedElement.setAttribute("stroke-width", next);
        return true;
      });
    },
    cropToSelection(padding = 8) {
      return owner.svgSession.cropToSelection(padding);
    },
    getCurrentStyleDefaults() {
      return {
        ...owner.svgSession.styleState
      };
    },
    getLayers: owner.svgSession.getLayers,
    getActiveLayer: owner.svgSession.getActiveLayer,
    setActiveLayer: owner.svgSession.setActiveLayer,
    createLayer(name = null) {
      return owner.svgSession.runSvgSnapshotOperation("create-layer", () => owner.svgSession.createLayer(name));
    },
    renameActiveLayer(name) {
      return owner.svgSession.runSvgSnapshotOperation("rename-layer", () => owner.svgSession.renameActiveLayer(name));
    },
    deleteActiveLayer() {
      return owner.svgSession.runSvgSnapshotOperation("delete-layer", () => owner.svgSession.deleteActiveLayer());
    },
    stepActiveLayer: owner.svgSession.stepActiveLayer,
    moveActiveLayer(direction = 1) {
      return owner.svgSession.runSvgSnapshotOperation("move-layer", () => owner.svgSession.moveActiveLayer(direction));
    },
    setActiveLayerVisible(visible) {
      return owner.svgSession.runSvgSnapshotOperation("layer-visibility", () => owner.svgSession.setActiveLayerVisible(visible));
    },
    toggleActiveLayerVisible() {
      return owner.svgSession.runSvgSnapshotOperation("layer-visibility", () => owner.svgSession.toggleActiveLayerVisible());
    },
    clearSelection: owner.svgSession.clearSelection,
    setSelection: owner.svgSession.setSelection,
    toggleSelection: owner.svgSession.toggleSelection,
    lockSelection(locked = true) {
      return owner.svgSession.runSvgSnapshotOperation(locked ? "lock-selection" : "unlock-selection", () => owner.svgSession.setSelectionLocked(locked));
    },
    toggleSelectionLocked() {
      return owner.svgSession.runSvgSnapshotOperation("toggle-selection-lock", () => owner.svgSession.toggleSelectionLocked());
    },
    soloSelection() {
      return owner.svgSession.runSvgSnapshotOperation("solo-selection", () => owner.svgSession.soloSelection());
    },
    selectSelectionContents: owner.svgSession.selectSelectionContents,
    getSelectedElements() {
      return [...owner.svgSession.selectedElements];
    },
    getSelectedElement() {
      return owner.svgSession.selectedElement;
    },
    getSelectedBounds() {
      return owner.svgSession.getSelectedUnionBBox();
    },
    setSelectedBounds(bounds = {}) {
      if (!owner.svgSession.selectedElements.length) return false;
      const current = owner.svgSession.getSelectedUnionBBox();
      if (!current || current.width <= 0 || current.height <= 0) return false;
      const nextX = Number.isFinite(Number(bounds.x)) ? Number(bounds.x) : current.x;
      const nextY = Number.isFinite(Number(bounds.y)) ? Number(bounds.y) : current.y;
      const nextWidth = Number.isFinite(Number(bounds.width)) ? Math.max(0.05, Number(bounds.width)) : current.width;
      const nextHeight = Number.isFinite(Number(bounds.height)) ? Math.max(0.05, Number(bounds.height)) : current.height;
      const sx = nextWidth / current.width;
      const sy = nextHeight / current.height;
      owner.svgSession.selectedElements.forEach(el => {
        const baseTransform = el.getAttribute("transform") || "";
        const space = owner.svgSession.getDragSpaceForElement(el);
        const origin = space && space !== owner.svgSession.svgRoot ? owner.svgSession.rootPointToElementPoint(space, {
          x: current.x,
          y: current.y
        }) : {
          x: current.x,
          y: current.y
        };
        const nextOrigin = space && space !== owner.svgSession.svgRoot ? owner.svgSession.rootPointToElementPoint(space, {
          x: nextX,
          y: nextY
        }) : {
          x: nextX,
          y: nextY
        };
        owner.svgSession.setParentSpaceTransformFromBase(el, baseTransform, `translate(${nextOrigin.x} ${nextOrigin.y}) scale(${sx} ${sy}) translate(${-origin.x} ${-origin.y})`);
      });
      owner.svgSession.refreshSelectionAfterMutation("panel-edit");
      return true;
    }
  });
}
