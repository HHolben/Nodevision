// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateTranslateElementHandler.mjs
// This module implements create Translate Element Handler behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { setAttrNumber, getAttrNumber, parsePoints, formatPoints } from "../svgDom.mjs";

// Create Translate Element Handler operations.
export function createTranslateElementHandler(owner) {
  return function (el, dx, dy) {
    const tag = el.tagName.toLowerCase();
    if (tag === "rect" || tag === "image" || tag === "use" || tag === "foreignobject") {
      setAttrNumber(el, "x", getAttrNumber(el, "x", 0) + dx);
      setAttrNumber(el, "y", getAttrNumber(el, "y", 0) + dy);
      owner.svgSession.translateStoredRotationOriginLocal(el, dx, dy);
      return;
    }
    if (tag === "text") {
      setAttrNumber(el, "x", getAttrNumber(el, "x", 0) + dx);
      setAttrNumber(el, "y", getAttrNumber(el, "y", 0) + dy);
      owner.svgSession.translateStoredRotationOriginLocal(el, dx, dy);
      return;
    }
    if (tag === "circle" || tag === "ellipse") {
      setAttrNumber(el, "cx", getAttrNumber(el, "cx", 0) + dx);
      setAttrNumber(el, "cy", getAttrNumber(el, "cy", 0) + dy);
      owner.svgSession.translateStoredRotationOriginLocal(el, dx, dy);
      return;
    }
    if (tag === "line") {
      setAttrNumber(el, "x1", getAttrNumber(el, "x1", 0) + dx);
      setAttrNumber(el, "y1", getAttrNumber(el, "y1", 0) + dy);
      setAttrNumber(el, "x2", getAttrNumber(el, "x2", 0) + dx);
      setAttrNumber(el, "y2", getAttrNumber(el, "y2", 0) + dy);
      owner.svgSession.translateStoredRotationOriginLocal(el, dx, dy);
      return;
    }
    if (tag === "polygon" || tag === "polyline") {
      const moved = parsePoints(el.getAttribute("points") || "").map(([x, y]) => [x + dx, y + dy]);
      el.setAttribute("points", formatPoints(moved));
      owner.svgSession.translateStoredRotationOriginLocal(el, dx, dy);
      return;
    }
    const prev = (el.getAttribute("transform") || "").trim();
    const translate = `translate(${dx} ${dy})`;
    // Prepend translate so movement happens in parent/SVG coordinates (not scaled by existing transforms).
    el.setAttribute("transform", prev ? `${translate} ${prev}` : translate);
  };
}

export function createBeginSelectionGrabCommandHandler(owner) {
  return function (source = "keyboard") {
    if (owner.svgSession.selectionGrabState) return true;
    if (owner.svgSession.pendingRotateCommand) owner.svgSession.commitPendingRotationCommand({
      silent: true
    });
    if (!owner.svgSession.selectedElements.length) {
      owner.svgSession.setStatus("Grab: select an object first");
      return false;
    }
    if (owner.svgSession.nodeEditor.isActive?.()) owner.svgSession.nodeEditor.exit?.();
    const anchorRoot = owner.svgSession.getSelectionGrabAnchorRoot();
    const items = owner.svgSession.buildSelectionGrabItems(owner.svgSession.selectedElements);
    if (!anchorRoot || !items.length) {
      owner.svgSession.setStatus("Grab: selection cannot be measured");
      return false;
    }
    owner.svgSession.selectionGrabState = {
      source,
      anchorRoot,
      currentRoot: {
        ...anchorRoot
      },
      pointerRoot: {
        ...anchorRoot
      },
      axis: null,
      axisDirectionSign: 1,
      buffer: "",
      applied: false,
      items,
      beforeSvgText: owner.svgSession.serializeSvgForSave()
    };
    owner.svgSession.updateSelectionGrabStatus("Grab selection: move cursor, X/Y locks axis, type percent, click or Enter releases, Esc cancels");
    return true;
  };
}

export function createApplySelectionGrabPercentBufferHandler(owner) {
  return function () {
    const grab = owner.svgSession.selectionGrabState;
    if (!grab || grab.axis !== "x" && grab.axis !== "y") return false;
    const value = owner.svgSession.parseLineToolNumber(grab.buffer);
    if (value === null) {
      delete grab.fixedRoot;
      if (grab.pointerRoot || owner.svgSession.lastPointerRoot) owner.svgSession.applySelectionGrabTargetRoot(grab.pointerRoot || owner.svgSession.lastPointerRoot);else owner.svgSession.restoreSelectionGrabBase(grab);
      owner.svgSession.updateSelectionGrabStatus();
      return true;
    }
    const distance = owner.svgSession.axisPercentToRootDistance(grab.axis, Math.abs(value));
    if (!Number.isFinite(distance)) return false;
    const sign = grab.axisDirectionSign < 0 ? -1 : 1;
    const targetRoot = grab.axis === "x" ? {
      x: grab.anchorRoot.x + distance * sign,
      y: grab.anchorRoot.y
    } : {
      x: grab.anchorRoot.x,
      y: grab.anchorRoot.y + distance * sign
    };
    const pointerRoot = grab.pointerRoot ? {
      ...grab.pointerRoot
    } : null;
    grab.fixedRoot = {
      ...targetRoot
    };
    owner.svgSession.applySelectionGrabTargetRoot(targetRoot);
    if (pointerRoot) grab.pointerRoot = pointerRoot;
    owner.svgSession.updateSelectionGrabStatus("Grab selection moved " + grab.axis.toUpperCase() + " by " + owner.svgSession.formatLineToolAngleNumber(Math.abs(value)) + "%");
    return true;
  };
}
