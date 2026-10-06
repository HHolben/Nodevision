// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/ClearSvgMarquee.mjs
// This module cancels transient marquee selection when pointer ownership, tool mode, or document content changes. It releases capture without committing a selection or modifying authored SVG nodes.

export function clearSvgMarquee(session, pointerId = null) {
  const state = session.marqueeState;
  if (pointerId !== null && state?.pointerId !== pointerId) return;
  session.marqueeState = null;
  session.marqueeBox?.setAttribute("display", "none");
  if (!state) return;
  session.quickMenu?.cancelLongPress();
  try {
    session.svgRoot.releasePointerCapture(state.pointerId);
  } catch {
    // Synthetic events and detached documents may not own pointer capture.
  }
}
