// Nodevision/ApplicationSystem/public/RasterAnalysis/AnalysisPolygonTool.mjs
// This adapter reuses the SVG editor's line placement handlers in a private analysis SVG. It supplies only drawing-session dependencies, so placing analysis vertices cannot activate editing, mutate Notebook content, or enter SVG history.
import { createBeginLineToolAtHandler, createPlaceLineToolVertexHandler } from '../PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateBeginLineToolAtHandler.mjs';
const ns = 'http://www.w3.org/2000/svg';
export function createAnalysisPolygonTool(svg, onFinish, setStatus) {
  const draft = document.createElementNS(ns, 'g'), preview = document.createElementNS(ns, 'polyline');
  preview.setAttribute('fill', 'none'); preview.setAttribute('stroke', 'currentColor');
  preview.setAttribute('vector-effect', 'non-scaling-stroke');
  draft.append(preview); svg.append(draft);
  const noop = () => {};
  const session = {
    svgRoot: draft, lineToolState: {}, recordLineProbe: noop, clearLineToolSnapCache: noop,
    clearLineToolVertexMarkers: noop, clearSelection: noop, addLineToolSnapPoint: noop,
    getActiveLayer: () => draft, rootPointToElementPoint: (_, point) => point,
    currentStyleDefaults: () => ({ stroke: 'currentColor', strokeWidth: 1 }), setStatus,
    addLineToolVertexMarker(point) {
      const marker = document.createElementNS(ns, 'circle');
      marker.setAttribute('cx', point.x); marker.setAttribute('cy', point.y); marker.setAttribute('r', 2);
      marker.setAttribute('fill', 'currentColor'); draft.append(marker);
    },
    updateLineToolPreview(point) {
      preview.setAttribute('points', [...(session.lineToolState.pointsSpace || []), [point.x, point.y]].map(p => p.join(',')).join(' '));
    }
  };
  const owner = { svgSession: session };
  session.beginLineToolAt = createBeginLineToolAtHandler(owner);
  const place = createPlaceLineToolVertexHandler(owner);
  function cancel() { draft.replaceChildren(preview); preview.removeAttribute('points'); session.lineToolState = {}; }
  function finish() {
    const points = session.lineToolState.pointsSpace || [];
    if (points.length < 3) { setStatus('Place at least three vertices.'); return false; }
    onFinish(points.map(p => [...p])); cancel(); return true;
  }
  return { place(point) { place(point); setStatus('Click vertices; click the first vertex or press Enter to close. Esc cancels.'); },
    move: point => session.lineToolState.active && session.updateLineToolPreview(point),
    get points() { return session.lineToolState.pointsSpace || []; }, finish, cancel, dispose() { draft.remove(); } };
}
