// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateHandleLineToolKeyCommandHandler.mjs
// This module implements create Handle Line Tool Key Command Handler behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { LINE_TOOL_AXIS_TYPES } from "./CreateBlankSvgRoot.mjs";

// Create Handle Line Tool Key Command Handler operations.
export function createHandleLineToolKeyCommandHandler(owner) {
  return function (e) {
    const key = String(e.key || "");
    const lower = key.toLowerCase();
    if (key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return false;
    if (owner.svgSession.lineToolState.commandBuffer === "p" && LINE_TOOL_AXIS_TYPES.has(lower)) {
      owner.svgSession.clearLineToolPendingCommand();
      return owner.svgSession.setLineToolPositionAxisConstraint(lower);
    }
    if (owner.svgSession.lineToolState.commandBuffer === "p") {
      owner.svgSession.clearLineToolPendingCommand();
      owner.svgSession.promptLineToolPosition();
      return true;
    }
    if (lower === "p") {
      owner.svgSession.clearLineToolPendingCommand();
      owner.svgSession.lineToolState.commandBuffer = "p";
      owner.svgSession.lineToolState.commandTimer = window.setTimeout(() => {
        if (owner.svgSession.lineToolState.commandBuffer !== "p") return;
        owner.svgSession.clearLineToolPendingCommand();
        owner.svgSession.promptLineToolPosition();
      }, 350);
      owner.svgSession.setStatus("Line command: p position, px X axis, py Y axis, pz Z axis");
      return true;
    }
    if (LINE_TOOL_AXIS_TYPES.has(lower)) {
      owner.svgSession.clearLineToolPendingCommand();
      return owner.svgSession.setLineToolAxisConstraint(lower, null, {
        toggle: true
      });
    }
    if (lower === "r") {
      owner.svgSession.clearLineToolPendingCommand();
      return owner.svgSession.startLineToolAngleInput();
    }
    if (lower === "g") {
      owner.svgSession.clearLineToolPendingCommand();
      return owner.svgSession.startLineToolGrab();
    }
    return false;
  };
}

export function createGetSvgNaturalDimensionsHandler(owner) {
  return function () {
    const viewBox = owner.svgSession.svgRoot.viewBox?.baseVal;
    const parsedWidth = Number(owner.svgSession.svgRoot.getAttribute("width"));
    const parsedHeight = Number(owner.svgSession.svgRoot.getAttribute("height"));
    const vbX = viewBox && Number.isFinite(viewBox.x) ? viewBox.x : 0;
    const vbY = viewBox && Number.isFinite(viewBox.y) ? viewBox.y : 0;
    const vbWidth = viewBox && Number.isFinite(viewBox.width) && viewBox.width > 0 ? viewBox.width : Number.isFinite(parsedWidth) ? parsedWidth : 0;
    const vbHeight = viewBox && Number.isFinite(viewBox.height) && viewBox.height > 0 ? viewBox.height : Number.isFinite(parsedHeight) ? parsedHeight : 0;
    const vbMaxX = vbX + (vbWidth || 0);
    const vbMaxY = vbY + (vbHeight || 0);
    let bboxWidth = 0;
    let bboxHeight = 0;
    let bboxX = vbX;
    let bboxY = vbY;
    if (typeof owner.svgSession.svgRoot.getBBox === "function") {
      try {
        const bbox = owner.svgSession.svgRoot.getBBox();
        if (Number.isFinite(bbox.x)) bboxX = Math.min(bboxX, bbox.x);
        if (Number.isFinite(bbox.y)) bboxY = Math.min(bboxY, bbox.y);
        if (Number.isFinite(bbox.width)) bboxWidth = bbox.width;
        if (Number.isFinite(bbox.height)) bboxHeight = bbox.height;
      } catch {
        // SVG cannot provide bbox; ignore.
      }
    }
    const bboxMaxX = bboxWidth > 0 ? bboxX + bboxWidth : vbMaxX;
    const bboxMaxY = bboxHeight > 0 ? bboxY + bboxHeight : vbMaxY;
    const left = Math.min(vbX, bboxX);
    const top = Math.min(vbY, bboxY);
    const right = Math.max(vbMaxX, bboxMaxX);
    const bottom = Math.max(vbMaxY, bboxMaxY);
    const hostRect = owner.svgSession.svgViewportHost.getBoundingClientRect();
    const fallbackWidth = Math.max(1, Math.round(hostRect.width));
    const fallbackHeight = Math.max(1, Math.round(hostRect.height));
    return {
      naturalWidth: Math.max(1, right > left ? right - left : fallbackWidth),
      naturalHeight: Math.max(1, bottom > top ? bottom - top : fallbackHeight)
    };
  };
}

export function createGetSvgViewBoxHandler(owner) {
  return function () {
    const vb = owner.svgSession.svgRoot.viewBox?.baseVal;
    if (vb && Number.isFinite(vb.width) && Number.isFinite(vb.height) && vb.width > 0 && vb.height > 0) {
      return {
        x: vb.x,
        y: vb.y,
        width: vb.width,
        height: vb.height
      };
    }
    const parts = String(owner.svgSession.svgRoot.getAttribute("viewBox") || "").trim().split(/\s+/).map(n => Number.parseFloat(n));
    if (parts.length === 4 && parts.every(n => Number.isFinite(n)) && parts[2] > 0 && parts[3] > 0) {
      return {
        x: parts[0],
        y: parts[1],
        width: parts[2],
        height: parts[3]
      };
    }
    const w = Number.parseFloat(owner.svgSession.svgRoot.getAttribute("width")) || 800;
    const h = Number.parseFloat(owner.svgSession.svgRoot.getAttribute("height")) || 600;
    return {
      x: 0,
      y: 0,
      width: Math.max(1, w),
      height: Math.max(1, h)
    };
  };
}
