// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateSetSvgCanvasZoomHandler.mjs
// This module implements create Set Svg Canvas Zoom Handler behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { toSvgPoint } from "../svgDom.mjs";
import { SVG_RULER_THICKNESS, SVG_RULER_SIDE } from "./CreateBlankSvgRoot.mjs";

// Create Set Svg Canvas Zoom Handler operations.
export function createSetSvgCanvasZoomHandler(owner) {
  return function (nextZoom, options = {}) {
    const zoom = owner.svgSession.clampSvgCanvasZoom(nextZoom);
    if (Math.abs(zoom - owner.svgSession.svgCanvasZoom) <= 0.0001) return false;
    const anchor = owner.svgSession.getSvgZoomAnchorClientPoint(options);
    const anchorUser = toSvgPoint(owner.svgSession.svgRoot, anchor.clientX, anchor.clientY);
    owner.svgSession.svgCanvasZoom = zoom;
    owner.svgSession.updateSvgRulers();
    const vb = owner.svgSession.getSvgViewBox();
    const viewportRect = owner.svgSession.svgViewport.getBoundingClientRect?.();
    const svgRect = owner.svgSession.svgRoot.getBoundingClientRect?.();
    if (viewportRect && svgRect && svgRect.width > 0 && svgRect.height > 0) {
      const localX = anchor.clientX - viewportRect.left;
      const localY = anchor.clientY - viewportRect.top;
      const pxPerUnitX = svgRect.width / vb.width;
      const pxPerUnitY = svgRect.height / vb.height;
      owner.svgSession.svgViewport.scrollLeft = Math.max(0, (anchorUser.x - vb.x) * pxPerUnitX - localX);
      owner.svgSession.svgViewport.scrollTop = Math.max(0, (anchorUser.y - vb.y) * pxPerUnitY - localY);
    }
    owner.svgSession.updateSvgRulers();
    owner.svgSession.setStatus("Zoom: " + owner.svgSession.svgCanvasZoomLabel());
    return true;
  };
}

export function createDrawSvgTopRulerHandler(owner) {
  return function () {
    const vb = owner.svgSession.getSvgViewBox();
    const cssWidth = Math.max(1, Math.floor(owner.svgSession.svgViewportHost.getBoundingClientRect().width));
    const cssHeight = SVG_RULER_THICKNESS;
    const ctx = owner.svgSession.setupRulerCanvas(owner.svgSession.svgTopRuler, cssWidth, cssHeight);
    if (!ctx) return;
    const svgRect = owner.svgSession.svgRoot.getBoundingClientRect();
    const pxPerUnit = svgRect.width > 0 ? svgRect.width / vb.width : 1;
    const startUser = vb.x + owner.svgSession.svgViewport.scrollLeft / pxPerUnit;
    const visibleUser = (owner.svgSession.svgViewport.clientWidth || svgRect.width || cssWidth) / pxPerUnit;
    const endUser = startUser + visibleUser;
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.fillStyle = "#f4f4f4";
    ctx.fillRect(0, 0, cssWidth, cssHeight);
    const baselineY = cssHeight - 0.5;
    ctx.strokeStyle = "rgba(0,0,0,0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, baselineY);
    ctx.lineTo(cssWidth, baselineY);
    ctx.stroke();
    ctx.font = "10px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillStyle = "rgba(0,0,0,0.68)";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    const minor = owner.svgSession.chooseRulerMinorStep(pxPerUnit);
    const majorEvery = 5;
    const superEvery = 10;
    let labelEvery = superEvery;
    if (minor * pxPerUnit * labelEvery < 60) labelEvery *= 2;
    const startIdx = Math.floor(startUser / minor) - 1;
    const endIdx = Math.ceil(endUser / minor) + 1;
    for (let idx = startIdx; idx <= endIdx; idx++) {
      const value = idx * minor;
      const xPx = (value - startUser) * pxPerUnit;
      const x = Math.round(xPx) + 0.5;
      if (x < -1 || x > cssWidth + 1) continue;
      const isSuper = idx % superEvery === 0;
      const isMajor = idx % majorEvery === 0;
      const tickH = isSuper ? 12 : isMajor ? 8 : 5;
      ctx.strokeStyle = isSuper ? "rgba(0,0,0,0.40)" : isMajor ? "rgba(0,0,0,0.30)" : "rgba(0,0,0,0.18)";
      ctx.beginPath();
      ctx.moveTo(x, cssHeight);
      ctx.lineTo(x, cssHeight - tickH);
      ctx.stroke();
      if (idx % labelEvery === 0) {
        const textX = x + 2;
        if (textX < cssWidth - 10) ctx.fillText(owner.svgSession.formatRulerLabel(value, minor), textX, 2);
      }
    }
  };
}

export function createDrawSvgLeftRulerHandler(owner) {
  return function () {
    const vb = owner.svgSession.getSvgViewBox();
    const cssWidth = SVG_RULER_SIDE;
    const cssHeight = Math.max(1, Math.floor(owner.svgSession.svgViewportHost.getBoundingClientRect().height));
    const ctx = owner.svgSession.setupRulerCanvas(owner.svgSession.svgLeftRuler, cssWidth, cssHeight);
    if (!ctx) return;
    const svgRect = owner.svgSession.svgRoot.getBoundingClientRect();
    const pxPerUnit = svgRect.height > 0 ? svgRect.height / vb.height : 1;
    const startUser = vb.y + owner.svgSession.svgViewport.scrollTop / pxPerUnit;
    const visibleUser = (owner.svgSession.svgViewport.clientHeight || svgRect.height || cssHeight) / pxPerUnit;
    const endUser = startUser + visibleUser;
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.fillStyle = "#f4f4f4";
    ctx.fillRect(0, 0, cssWidth, cssHeight);
    const baselineX = cssWidth - 0.5;
    ctx.strokeStyle = "rgba(0,0,0,0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(baselineX, 0);
    ctx.lineTo(baselineX, cssHeight);
    ctx.stroke();
    ctx.font = "10px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillStyle = "rgba(0,0,0,0.68)";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    const minor = owner.svgSession.chooseRulerMinorStep(pxPerUnit);
    const majorEvery = 5;
    const superEvery = 10;
    let labelEvery = superEvery;
    if (minor * pxPerUnit * labelEvery < 60) labelEvery *= 2;
    const startIdx = Math.floor(startUser / minor) - 1;
    const endIdx = Math.ceil(endUser / minor) + 1;
    for (let idx = startIdx; idx <= endIdx; idx++) {
      const value = idx * minor;
      const yPx = (value - startUser) * pxPerUnit;
      const y = Math.round(yPx) + 0.5;
      if (y < -1 || y > cssHeight + 1) continue;
      const isSuper = idx % superEvery === 0;
      const isMajor = idx % majorEvery === 0;
      const tickW = isSuper ? 12 : isMajor ? 8 : 5;
      ctx.strokeStyle = isSuper ? "rgba(0,0,0,0.40)" : isMajor ? "rgba(0,0,0,0.30)" : "rgba(0,0,0,0.18)";
      ctx.beginPath();
      ctx.moveTo(cssWidth, y);
      ctx.lineTo(cssWidth - tickW, y);
      ctx.stroke();
      if (idx % labelEvery === 0) {
        if (y > 10 && y < cssHeight - 10) ctx.fillText(owner.svgSession.formatRulerLabel(value, minor), 2, y);
      }
    }
  };
}
