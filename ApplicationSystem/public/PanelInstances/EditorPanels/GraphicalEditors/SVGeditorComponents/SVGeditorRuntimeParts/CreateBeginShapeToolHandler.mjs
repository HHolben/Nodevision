// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateBeginShapeToolHandler.mjs
// This module renders the legacy Line tool angle indicator. Shape creation now belongs to the shared vector interaction and geometry modules.

export function createUpdateLineToolAngleArcHandler(owner) {
  return function (start, current) {
    if (!start || !current) {
      owner.svgSession.lineToolAngleArc.setAttribute("display", "none");
      return;
    }
    const mid = {
      x: (start.x + current.x) / 2,
      y: (start.y + current.y) / 2
    };
    const dx = mid.x - start.x;
    const dy = mid.y - start.y;
    const len = Math.hypot(dx, dy);
    if (!Number.isFinite(len) || len <= 1e-6) {
      owner.svgSession.lineToolAngleArc.setAttribute("display", "none");
      return;
    }
    const minR = owner.svgSession.pointerToleranceInSvgUnits(14);
    const maxR = owner.svgSession.pointerToleranceInSvgUnits(72);
    const r = Math.max(minR, Math.min(maxR, len * 0.7));
    const theta = Math.atan2(dy, dx); // SVG coords: +y down -> positive theta is clockwise
    const startPt = {
      x: start.x + r,
      y: start.y
    };
    const endPt = {
      x: start.x + r * Math.cos(theta),
      y: start.y + r * Math.sin(theta)
    };
    const sweep = theta >= 0 ? 1 : 0;
    const dot = Math.max(0.001, owner.svgSession.pointerToleranceInSvgUnits(0.6));
    const gap = Math.max(dot * 2, owner.svgSession.pointerToleranceInSvgUnits(5));
    owner.svgSession.lineToolAngleArc.setAttribute("stroke-width", String(Math.max(0.001, owner.svgSession.pointerToleranceInSvgUnits(1.25))));
    owner.svgSession.lineToolAngleArc.setAttribute("stroke-dasharray", String(dot) + " " + String(gap));
    owner.svgSession.lineToolAngleArc.setAttribute("d", `M ${startPt.x} ${startPt.y} A ${r} ${r} 0 0 ${sweep} ${endPt.x} ${endPt.y}`);
    owner.svgSession.lineToolAngleArc.setAttribute("display", "");
  };
}
