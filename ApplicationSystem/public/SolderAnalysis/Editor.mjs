// Session adapter for Nodevision's vector gestures, Bezier pen and editable node model.
import { bindVectorInteraction } from '../VectorDrawing/BindVectorInteraction.mjs';
import { renderVectorPreview } from '../VectorDrawing/VectorSvgRenderer.mjs';
import { createBezierToolController } from '../PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/BezierToolController.mjs';
import { moveNode } from '../PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/BezierModel.mjs';
import { regionPath, labelsFor } from './Measurement.mjs';
import { colors } from './Document.mjs';
const ns = 'http://www.w3.org/2000/svg';
export function svgNode(tag, attributes = {}) {
  const node = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}
export function mountEditor(host, api) {
  const svg = svgNode('svg', { tabindex: 0, 'aria-label': 'Solder joint annotation workspace' });
  Object.assign(svg.style, { display: 'block', touchAction: 'none', userSelect: 'none', background: '#222', maxWidth: 'none' }); host.append(svg);
  const image = svgNode('image'), artwork = svgNode('g'), handles = svgNode('g'), draft = svgNode('g'), overlay = svgNode('path', { fill: 'none', stroke: 'white' });
  svg.append(image, artwork, handles, draft, overlay);
  draft.style.pointerEvents = 'none'; overlay.style.pointerEvents = 'none';
  let tool = 'freehand', zoom = 1, drag = null, redrawId = null, previewFrame = 0, touchEnabled = true;
  svg.style.cursor = 'crosshair';
  const layer = () => api.state().layers.find(l => l.id === api.activeLayer());
  const enabled = () => layer()?.visible && !layer()?.locked && api.state().width;
  const toPoint = event => { const matrix = svg.getScreenCTM(); return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : null; };
  function commit(model) { if (new Set(model.nodes.map(n => `${n.x},${n.y}`)).size < 3) { api.status('A closed path needs three distinct vertices.'); return; } const region = { model: { ...model, closed: true } };
    if (redrawId) { api.replace(redrawId, region); redrawId = null; } else api.add(region); paint(); }
  const bezier = createBezierToolController({
    svgRoot: svg, overlayPath: overlay, getActiveLayer: () => draft,
    currentStyleDefaults: () => ({ stroke: colors[api.activeLayer()], strokeWidth: 1 / zoom }),
    pointerToleranceInSvgUnits: px => px / zoom, findNearestSnapPointInRoot: () => null,
    snapAngleEndpointInRoot: (_a, b) => b, setStatus: api.status,
    setSelection() {
      if (bezier && !bezier.state.active && bezier.state.model) {
        const model = structuredClone(bezier.state.model); bezier.state.pathEl?.remove();
        if (model.nodes.length >= 3) commit(model); else api.status('A closed path needs at least three vertices.');
      }
    }
  });
  // Intercept a click near the first polygon vertex using the shared controller's completion command.
  const closeFirst = event => {
    if (tool !== 'polygon' || event.button !== 0 || !binding.controller.active) return;
    const p = toPoint(event), first = binding.controller.points[0];
    if (binding.controller.points.length >= 3 && Math.hypot(p.x - first.x, p.y - first.y) * zoom <= 8) {
      binding.controller.finish(true); event.preventDefault(); event.stopImmediatePropagation();
    }
  };
  svg.addEventListener('pointerdown', closeFirst, true);
  const binding = bindVectorInteraction({ surface: svg, keyboardHost: api.keyboardHost,
    preciseFreehand: true, allowTouch: () => touchEnabled,
    getTool: () => enabled() && ['polygon', 'freehand'].includes(tool) ? tool : null,
    toPoint, preview: (g, points) => {
      if (!g && !points?.length) { cancelAnimationFrame(previewFrame); previewFrame = 0; draft.replaceChildren(); return; }
      if (tool === 'freehand') {
        if (!previewFrame) previewFrame = requestAnimationFrame(() => {
          previewFrame = 0; draft.style.color = colors[api.activeLayer()];
          renderVectorPreview(draft, { kind: 'freehand', points: binding.controller.points });
        });
      } else { draft.style.color = colors[api.activeLayer()]; renderVectorPreview(draft, g, points); }
    },
    commit: g => commit({ nodes: g.points.map(p => ({ ...p, inHandle: null, outHandle: null, type: 'corner' })) }), status: api.status
  });
  function cancel() {
    redrawId = null; binding.cancel(); if (bezier.isActive()) bezier.cancel();
    if (drag?.before) api.restore(drag.before); drag = null;
  }
  function paint() {
    const state = api.state(); if (!state.width) return;
    svg.setAttribute('viewBox', `0 0 ${state.width} ${state.height}`);
    svg.setAttribute('width', state.width * zoom); svg.setAttribute('height', state.height * zoom);
    if (image.getAttribute('href') !== state.source.dataUrl) image.setAttribute('href', state.source.dataUrl); image.setAttribute('width', state.width); image.setAttribute('height', state.height);
    artwork.replaceChildren(); handles.replaceChildren(); const labels = labelsFor(state.regions);
    for (const r of state.regions) {
      const l = state.layers.find(l => l.id === r.type); if (!l?.visible) continue;
      const path = svgNode('path', { d: regionPath(r), fill: 'none', stroke: colors[r.type], 'stroke-width': api.selected() === r.id ? 2 : 1, 'vector-effect': 'non-scaling-stroke', 'data-region-id': r.id });
      path.style.pointerEvents = tool === 'select' && !l.locked ? 'stroke' : 'none'; artwork.append(path);
      path.addEventListener('pointerdown', e => startDrag(e, r, null));
      const first = r.model?.nodes[0] || { x: r.points[0][0], y: r.points[0][1] };
      const text = svgNode('text', { x: first.x, y: first.y, fill: colors[r.type], stroke: '#111', 'stroke-width': 3 / zoom, 'paint-order': 'stroke', 'font-size': 14 / zoom });
      text.textContent = labels[r.id]; text.style.pointerEvents = 'none'; artwork.append(text);
      if (tool === 'select' && api.selected() === r.id && !l.locked) {
        const nodes = r.model?.nodes || r.points.map(([x, y]) => ({ x, y }));
        nodes.forEach((n, index) => {
          for (const kind of ['anchor', 'inHandle', 'outHandle']) {
            const p = kind === 'anchor' ? n : n[kind]; if (!p) continue;
            if (kind !== 'anchor') handles.append(svgNode('line', { x1: n.x, y1: n.y, x2: p.x, y2: p.y, stroke: '#fff', 'stroke-width': 1 / zoom }));
            const handle = svgNode('circle', { cx: p.x, cy: p.y, r: (kind === 'anchor' ? 4 : 3) / zoom, fill: kind === 'anchor' ? '#fff' : '#ffd000', stroke: '#111', 'stroke-width': 1 / zoom, 'data-vertex': index, 'data-handle': kind });
            handle.addEventListener('pointerdown', e => startDrag(e, r, { index, kind })); handles.append(handle);
          }
        });
      }
    }
  }
  function startDrag(event, region, vertex) {
    if (drag || (event.pointerType === 'touch' && (!touchEnabled || event.isPrimary === false)) || event.button !== 0 || tool !== 'select') return;
    event.preventDefault(); event.stopPropagation(); api.select(region.id);
    drag = { id: region.id, vertex, start: toPoint(event), before: structuredClone(api.state()), pointerId: event.pointerId };
    try { svg.setPointerCapture(event.pointerId); } catch { /* Synthetic or released pointer. */ } api.keyboardHost.focus(); paint();
  }
  function down(event) {
    if (drag || (event.pointerType === 'touch' && (!touchEnabled || event.isPrimary === false))) return;
    if (event.button === 1 || tool === 'pan') {
      event.preventDefault(); drag = { pan: true, x: event.clientX, y: event.clientY, left: host.scrollLeft, top: host.scrollTop, pointerId: event.pointerId }; try { svg.setPointerCapture(event.pointerId); } catch { /* Synthetic or released pointer. */ } return;
    }
    if (tool === 'bezier' && enabled() && event.button === 0) { api.keyboardHost.focus(); bezier.onPointerDown(event, toPoint(event)); event.preventDefault(); }
  }
  function move(event) {
    if (drag) {
      if (event.pointerId !== drag.pointerId) return;
      if (drag.pan) { host.scrollLeft = drag.left - event.clientX + drag.x; host.scrollTop = drag.top - event.clientY + drag.y; return; }
      const p = toPoint(event), dx = p.x - drag.start.x, dy = p.y - drag.start.y;
      const source = drag.before.regions.find(r => r.id === drag.id), r = api.state().regions.find(r => r.id === drag.id);
      Object.assign(r, structuredClone(source));
      if (r.model) {
        if (!drag.vertex) r.model.nodes.forEach(n => moveNode(n, dx, dy));
        else { const n = r.model.nodes[drag.vertex.index]; if (drag.vertex.kind === 'anchor') moveNode(n, dx, dy); else { n[drag.vertex.kind].x += dx; n[drag.vertex.kind].y += dy; } }
      } else r.points = r.points.map(([x, y], i) => !drag.vertex || i === drag.vertex.index ? [x + dx, y + dy] : [x, y]);
      api.pending(); paint(); return;
    }
    if (tool === 'bezier' && bezier.isActive()) bezier.onPointerMove(event, toPoint(event));
  }
  function up(event) {
    if (drag) { if (event.pointerId !== drag.pointerId) return; move(event); const before = drag.before; drag = null; if (before) api.edited(before); try { svg.releasePointerCapture(event.pointerId); } catch {} return; }
    if (tool === 'bezier' && bezier.isActive()) bezier.onPointerUp(event, toPoint(event));
  }
  function key(event) {
    if (event.target.closest('input,select,textarea')) return;
    if (event.key === 'Escape') { cancel(); paint(); }
    if (tool === 'bezier' && bezier.isActive() && bezier.onKeyDown(event)) { event.preventDefault(); event.stopPropagation(); }
  }
  const wheel = event => { if (!event.ctrlKey) return; if (binding.controller.active || drag) { event.preventDefault(); return; } event.preventDefault(); setZoom(zoom * (event.deltaY > 0 ? .9 : 1.1)); };
  function setZoom(value) { zoom = Math.max(.02, Math.min(32, value)); paint(); }
  svg.addEventListener('pointerdown', down); svg.addEventListener('pointermove', move); svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', event => { if (drag?.pointerId === event.pointerId) cancel(); }); svg.addEventListener('lostpointercapture', () => { if (drag) { cancel(); paint(); } }); host.addEventListener('wheel', wheel, { passive: false }); api.keyboardHost.addEventListener('keydown', key);
  return { paint, cancel, setTouchEnabled(value) { cancel(); touchEnabled = value; },
    redraw(id) { cancel(); redrawId = id; }, get hasDraft() { return binding.controller.active || bezier.isActive() || !!drag; }, setZoom, get zoom() { return zoom; }, setTool(value) { cancel(); tool = value; svg.style.cursor = value === 'pan' ? 'grab' : value === 'select' ? 'default' : 'crosshair'; paint(); },
    fit() { const s = api.state(); setZoom(Math.min((host.clientWidth - 20) / s.width, (host.clientHeight - 20) / s.height)); },
    dispose() { cancel(); binding.dispose(); host.removeEventListener('wheel', wheel); api.keyboardHost.removeEventListener('keydown', key); svg.remove(); }
  };
}
