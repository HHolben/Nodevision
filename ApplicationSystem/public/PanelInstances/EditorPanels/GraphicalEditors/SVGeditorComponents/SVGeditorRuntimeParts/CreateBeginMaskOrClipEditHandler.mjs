// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateBeginMaskOrClipEditHandler.mjs
// This module implements create Begin Mask Or Clip Edit Handler behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

// Create Begin Mask Or Clip Edit Handler operations.
export function createBeginMaskOrClipEditHandler(owner) {
  return function (attr = "mask") {
    const normalizedAttr = attr === "clip-path" ? "clip-path" : "mask";
    const found = owner.svgSession.findSelectedMaskOrClipDefinition(normalizedAttr);
    if (!found?.definition) {
      owner.svgSession.setStatus(normalizedAttr === "clip-path" ? "Select artwork with a clipping path first" : "Select artwork with a mask first");
      return false;
    }
    const content = owner.svgSession.maskEditContentElements(found.definition);
    owner.svgSession.maskEditState = {
      kind: normalizedAttr,
      id: found.id || found.definition.id || "",
      definition: found.definition,
      artwork: found.artwork || owner.svgSession.maskEditState?.artwork || null
    };
    owner.svgSession.updateMaskEditIndicator();
    if (content.length) {
      owner.svgSession.setSelection(content, {
        primary: content[0],
        allowLocked: true,
        keepMaskEditState: true
      });
    } else {
      owner.svgSession.setSelection([found.definition], {
        primary: found.definition,
        allowLocked: true,
        keepMaskEditState: true
      });
    }
    const label = normalizedAttr === "clip-path" ? "clipping path" : "mask";
    owner.svgSession.setStatus(`Editing ${label} content: ${owner.svgSession.maskEditState.id || "unnamed"}`);
    return true;
  };
}

export function createCropEdgesHandler(owner) {
  return function ({
    left = 0,
    top = 0,
    right = 0,
    bottom = 0
  } = {}) {
    const {
      x,
      y,
      width,
      height
    } = owner.svgSession.getViewBox();
    const cropLeft = Math.max(0, Number.parseFloat(left) || 0);
    const cropTop = Math.max(0, Number.parseFloat(top) || 0);
    const cropRight = Math.max(0, Number.parseFloat(right) || 0);
    const cropBottom = Math.max(0, Number.parseFloat(bottom) || 0);
    if (cropLeft + cropRight >= width || cropTop + cropBottom >= height) {
      owner.svgSession.setStatus("Crop exceeds canvas bounds");
      return false;
    }
    const next = {
      x: x + cropLeft,
      y: y + cropTop,
      width: width - cropLeft - cropRight,
      height: height - cropTop - cropBottom
    };
    owner.svgSession.setViewBox(next);
    owner.svgSession.setStatus(`Cropped edges to ${Math.round(next.width)}x${Math.round(next.height)}`);
    owner.svgSession.refreshSelectionVisuals?.();
    return true;
  };
}

export function createRotateCanvas90Handler(owner) {
  return function (direction = "cw") {
    const {
      x,
      y,
      width,
      height
    } = owner.svgSession.getViewBox();
    const dir = direction === "ccw" ? "ccw" : "cw";
    const next = {
      x,
      y,
      width: height,
      height: width
    };
    if (dir === "ccw") {
      owner.svgSession.applyTransformToLayers(`translate(${x} ${y + width}) rotate(-90) translate(${-x} ${-y})`);
    } else {
      owner.svgSession.applyTransformToLayers(`translate(${x + height} ${y}) rotate(90) translate(${-x} ${-y})`);
    }
    owner.svgSession.setViewBox(next);
    owner.svgSession.setStatus(`Rotated ${dir === "ccw" ? "90° CCW" : "90° CW"}`);
    owner.svgSession.refreshSelectionVisuals?.();
    return true;
  };
}

export function createFlipCanvasHandler(owner) {
  return function (axis = "h") {
    const {
      x,
      y,
      width,
      height
    } = owner.svgSession.getViewBox();
    const ax = axis === "v" ? "v" : "h";
    if (ax === "v") {
      owner.svgSession.applyTransformToLayers(`translate(0 ${y + height}) scale(1 -1) translate(0 ${-y})`);
      owner.svgSession.setStatus("Flipped vertically");
    } else {
      owner.svgSession.applyTransformToLayers(`translate(${x + width} 0) scale(-1 1) translate(${-x} 0)`);
      owner.svgSession.setStatus("Flipped horizontally");
    }
    window.dispatchEvent(new CustomEvent("nv-svg-editor-layout-changed", {
      detail: {
        width,
        height
      }
    }));
    owner.svgSession.updateSvgRulers();
    owner.svgSession.refreshSelectionVisuals?.();
    return true;
  };
}
