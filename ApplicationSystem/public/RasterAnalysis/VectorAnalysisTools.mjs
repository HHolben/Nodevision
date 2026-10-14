// Nodevision/ApplicationSystem/public/RasterAnalysis/VectorAnalysisTools.mjs
// This adapter keeps transient vector annotations in native image coordinates and exposes analytic dimensions and closed regions to the existing pixel analysis pipeline. Its history is local to annotations and never enters raster editing history.
import { findActivePathVertex, isPathVertexVisible } from '../VectorDrawing/ActivePathVertexSnap.mjs';
import { vectorTools, geometryMeasurements } from '../VectorDrawing/VectorGeometry.mjs';
import { createVectorElement, renderVectorPreview } from '../VectorDrawing/VectorSvgRenderer.mjs';
import { bindVectorInteraction } from '../VectorDrawing/BindVectorInteraction.mjs';
export function installVectorAnalysisTools({ host, svg, bar, status, analysis, size, beforeStart, useRegion, isVisible = () => true }) {
  const doc = svg.ownerDocument, ns = 'http://www.w3.org/2000/svg';
  const artwork = doc.createElementNS(ns, 'g'), draft = doc.createElementNS(ns, 'g');
  svg.append(artwork, draft); draft.style.pointerEvents = 'none';
  const annotations = [], undone = [], buttons = new Map();
  analysis.annotations = annotations;
  let mode = null, selected = -1, selecting = false;
  function button(label, action) {
    const node = doc.createElement('button'); node.type = 'button'; node.textContent = label;
    node.title = label; node.onclick = action; bar.append(node); return node;
  }
  function describe(geometry) {
    const values = geometryMeasurements(geometry);
    analysis.selectedGeometry = geometry; analysis.measurements = values;
    status.textContent = `${geometry.kind}: ` + Object.entries(values).map(([key, value]) => `${key} ${Number(value.toFixed(3))} ${key === 'area' ? 'px²' : key === 'angleDegrees' ? '°' : 'px'}`).join('; ');
  }
  function paint() {
    artwork.replaceChildren();
    annotations.forEach((geometry, index) => {
      const node = createVectorElement(geometry, { 'vector-effect': 'non-scaling-stroke', 'stroke-width': index === selected ? 3 : 1.5 }, doc);
      node.style.pointerEvents = !mode && selecting ? 'visibleStroke' : 'none';
      node.addEventListener('pointerdown', event => { if (mode) return; event.stopPropagation(); selected = index; describe(geometry); paint(); });
      artwork.append(node);
    });
  }
  function setMode(value, select = false) {
    binding.cancel(); mode = value; selecting = select;
    svg.style.pointerEvents = value ? 'auto' : 'none'; svg.style.cursor = value ? 'crosshair' : '';
    for (const [kind, node] of buttons) node.setAttribute('aria-pressed', String(kind === value));
    paint();
  }
  const binding = bindVectorInteraction({
    surface: svg, keyboardHost: host, getTool: () => mode,
    toPoint(event) {
      const matrix = svg.getScreenCTM(); if (!matrix) return null;
      const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      const { width, height } = size();
      if (!binding.controller.active && (p.x < 0 || p.y < 0 || p.x > width || p.y > height)) return null;
      return { x: Math.max(0, Math.min(width, p.x)), y: Math.max(0, Math.min(height, p.y)) };
    },
    snapVertex: (point, points) => findActivePathVertex(points, point, svg.getScreenCTM(), () => isVisible() && isPathVertexVisible(draft)),
    preview: (geometry, points) => renderVectorPreview(draft, geometry, points),
    commit(geometry) { annotations.push(geometry); undone.length = 0; selected = annotations.length - 1; describe(geometry); paint(); analysis.changed?.(); },
    status: text => { status.textContent = text; }
  });
  for (const kind of [...vectorTools, 'freehand']) {
    const node = button(kind[0].toUpperCase() + kind.slice(1), () => {
      if (!size().width) { status.textContent = 'Wait for the image to load.'; return; }
      beforeStart(); setMode(kind); host.focus({ preventScroll: true });
      status.textContent = kind === 'arc' ? 'Arc: click center, start, then end; Shift reverses direction.' : ['line', 'polygon'].includes(kind) ? 'Click vertices; Enter or double-click finishes.' : `${kind}: drag to draw.`;
    });
    node.setAttribute('aria-pressed', 'false'); buttons.set(kind, node);
  }
  button('Select annotation', () => { beforeStart(); setMode(null, true); status.textContent = 'Click an annotation outline to inspect its measurements.'; });
  const undo = () => { binding.cancel(); if (annotations.length) undone.push(annotations.pop()); selected = annotations.length - 1; refresh(); };
  const redo = () => { binding.cancel(); if (undone.length) annotations.push(undone.pop()); selected = annotations.length - 1; refresh(); };
  function refresh() {
    paint();
    analysis.changed?.();
    if (annotations[selected]) describe(annotations[selected]);
    else { delete analysis.selectedGeometry; delete analysis.measurements; status.textContent = 'No annotation selected.'; }
  }
  button('Undo annotation', undo); button('Redo annotation', redo);
  button('Analyze annotation', () => {
    const geometry = annotations[selected];
    if (!geometry || (['line', 'arc', 'freehand'].includes(geometry.kind) && !geometry.closed)) { status.textContent = 'Select a closed annotation to analyze its pixels.'; return; }
    beforeStart(); setMode(null, true); useRegion(geometry);
  });
  const key = event => {
    if (!isVisible() || (!mode && !selecting) || (!event.ctrlKey && !event.metaKey) || event.target.closest?.('input,textarea,[contenteditable=true]')) return;
    if (event.key.toLowerCase() === 'z') { event.shiftKey ? redo() : undo(); event.preventDefault(); event.stopImmediatePropagation(); }
  };
  host.addEventListener('keydown', key, true);
  return { cancel() { setMode(null); }, clear() { setMode(null); annotations.length = undone.length = 0; selected = -1; refresh(); },
    restore(saved) { annotations.splice(0, annotations.length, ...structuredClone(saved)); undone.length = 0; selected = annotations.length - 1; refresh(); },
    dispose() { binding.dispose(); host.removeEventListener('keydown', key, true); artwork.remove(); draft.remove(); } };
}
