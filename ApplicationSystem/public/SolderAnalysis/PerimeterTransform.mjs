// Modal transforms use the SVG editor's scale math and numeric input semantics,
// while baking coordinates into the analysis model for measurement and reports.
import { pointerScaleFactor } from '../PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgScaleGeometry.mjs';
import { appendScaleFactorKey, parseScaleBuffer } from '../PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgScaleHotkeys.mjs';
export function installPerimeterTransform({ host, svg, api, toPoint, paint, busy }) {
  let active = null, last = null;
  const consume = e => { e.preventDefault(); e.stopImmediatePropagation(); };
  function finish(cancelled = false) {
    if (!active) return;
    const session = active; active = null;
    if (session.pointerId !== null) { try { svg.releasePointerCapture(session.pointerId); } catch {} }
    if (cancelled) api.restore(session.before);
    else api.edited(session.before);
    paint(); api.status(cancelled ? 'Transform cancelled.' : 'Perimeter transformed.');
  }
  function preview() {
    const s = active, region = api.state().regions.find(r => r.id === s.id);
    if (!region) { finish(true); return; }
    Object.assign(region, structuredClone(s.source));
    const typed = parseScaleBuffer(s.buffer);
    let dx = s.point.x - s.startRoot.x, dy = s.point.y - s.startRoot.y;
    if (s.mode === 'x') dy = 0;
    if (s.mode === 'y') dx = 0;
    if (s.kind === 'g' && typed !== null && s.mode !== 'uniform') {
      dx = s.mode === 'x' ? typed * api.state().width / 100 : 0;
      dy = s.mode === 'y' ? typed * api.state().height / 100 : 0;
    }
    const factor = typed ?? pointerScaleFactor(s, s.point);
    const angle = typed === null
      ? Math.atan2(s.point.y-s.centerRoot.y,s.point.x-s.centerRoot.x) - Math.atan2(s.startRoot.y-s.centerRoot.y,s.startRoot.x-s.centerRoot.x)
      : Math.abs(typed) * s.direction * (s.unit === 'deg' ? Math.PI/180 : 1);
    const cos = Math.cos(angle), sin = Math.sin(angle);
    function transform(p) {
      if (s.kind === 'g') { p.x += dx; p.y += dy; }
      else if (s.kind === 'r') {
        const x = p.x-s.centerRoot.x, y = p.y-s.centerRoot.y;
        p.x = s.centerRoot.x + x*cos-y*sin; p.y = s.centerRoot.y + x*sin+y*cos;
      } else {
        if (s.mode !== 'y') p.x = s.centerRoot.x + (p.x - s.centerRoot.x) * factor;
        if (s.mode !== 'x') p.y = s.centerRoot.y + (p.y - s.centerRoot.y) * factor;
      }
    }
    if (region.model) for (const n of region.model.nodes) { transform(n); if (n.inHandle) transform(n.inHandle); if (n.outHandle) transform(n.outHandle); }
    else region.points = region.points.map(([x,y]) => { const p={x,y};transform(p);return [p.x,p.y]; });
    api.pending(); paint();
  }
  function start(lower, dragInput = false) {
    if (busy()) return false;
    if (active) finish(true);
      const region = api.state().regions.find(r => r.id === api.selected());
      const layer = api.state().layers.find(l => l.id === region?.type);
      if (!region || !layer?.visible || layer.locked) return false;
      const path = [...svg.querySelectorAll('[data-region-id]')].find(p => p.dataset.regionId === region.id);
      if (!path) return false;
      const bounds = path.getBBox(), centerRoot = { x: bounds.x + bounds.width/2, y: bounds.y + bounds.height/2 };
      const startRoot = last || (lower !== 'g' ? { x: centerRoot.x + Math.max(bounds.width,bounds.height,1)/2, y:centerRoot.y } : centerRoot);
      active = { id: region.id, kind: lower, dragInput, pointerId: null, before: structuredClone(api.state()), source: structuredClone(region), centerRoot, startRoot, point: startRoot, mode: 'uniform', buffer: '', unit: 'rad', direction: 1, axisX: {x:1,y:0}, axisY: {x:0,y:1} };
      api.pending();
      api.status(lower === 'r' ? 'Rotate: move pointer or type radians; D switches to degrees. Click or Enter confirms; Escape cancels.' : lower === 's' ? 'Scale: move pointer or type factor; X/Y constrains axis. Click or Enter confirms; Escape cancels.' : 'Move: move pointer; X/Y constrains axis, then type image percent. Click or Enter confirms; Escape cancels.');

    if (dragInput) api.status(lower === 'r' ? 'Rotate: drag around the selected area’s center; release to confirm. Cancel Transform restores the original.' : lower === 's' ? 'Scale: drag from the boundary outward or inward; release to confirm. Cancel Transform restores the original.' : 'Move: drag on the image; release to confirm. Cancel Transform restores the original.');
    return true;
  }
  function key(e) {
    if (e.target.closest?.('input,textarea,select,[contenteditable="true"]')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const lower = e.key.toLowerCase();
    if (!active) {
      if (!['s','g','r'].includes(lower) || e.repeat || busy()) return;
      if (!start(lower)) return;
    } else if (e.key === 'Escape') finish(true);
    else if (e.key === 'Enter') finish();
    else if (active.kind === 'r') {
      if (e.key === 'Backspace') {
        if (active.buffer) { active.buffer = active.buffer.slice(0,-1); preview(); }
        else if (active.unit === 'deg') { active.unit = 'rad'; api.status('Rotate: radians.'); }
        else finish(true);
      } else if (!active.buffer && ['d','r'].includes(lower)) {
        active.unit = lower === 'd' ? 'deg' : 'rad';
        api.status(`Rotate: type ${active.unit === 'deg' ? 'degrees' : 'radians'}; Enter confirms, Escape cancels.`);
      } else if (e.key === '-' || e.key === '+') {
        active.direction = e.key === '-' ? -active.direction : 1; preview();
      } else if (e.key.length === 1 && '0123456789.'.includes(e.key) && appendScaleFactorKey(active,e.key).handled) preview();
      else return;
    }
    else if (['x','y'].includes(lower)) { active.mode = lower; preview(); }
    else if (e.key === 'Backspace') { active.buffer = active.buffer.slice(0,-1); preview(); }
    else if (lower === 'r' && active.kind === 's') { /* Baked paths have image-local axes. */ }
    else if ((active.kind === 's' || active.mode !== 'uniform') && appendScaleFactorKey(active,e.key).handled) preview();
    else return;
    consume(e);
  }
  function move(e) {
    if (active?.dragInput && active.pointerId !== e.pointerId) return;
    if (e.pointerType === 'touch' && !active?.dragInput) return;
    const point = toPoint(e); if (!point) return;
    last = point;
    if (!active) return;
    active.point = point; if (!active.buffer) preview(); consume(e);
  }
  function down(e) {
    if (!active || !svg.contains(e.target)) return;
    consume(e);
    if (active.dragInput) {
      if (active.pointerId !== null || e.button !== 0 || e.isPrimary === false) return;
      const point = toPoint(e); if (!point) return;
      if (active.kind !== 'g' && Math.hypot(point.x-active.centerRoot.x,point.y-active.centerRoot.y)<1e-6) { api.status('Start the transform away from the center of the selected area.'); return; }
      active.startRoot = point; active.point = point; active.pointerId = e.pointerId;
      try { svg.setPointerCapture(e.pointerId); } catch { /* Synthetic input. */ }
    } else if (e.button === 0 && e.pointerType !== 'touch') finish();
  }
  function up(e) {
    if (!active?.dragInput || active.pointerId !== e.pointerId) return;
    move(e); consume(e); finish();
  }
  function interrupted(e) {
    if (active?.pointerId === e.pointerId) { consume(e); finish(true); }
  }
  const blur = () => finish(true);
  host.addEventListener('keydown', key, true);
  host.addEventListener('pointermove', move, true);
  host.addEventListener('pointerdown', down, true);
  host.addEventListener('pointerup', up, true);
  host.addEventListener('pointercancel', interrupted, true);
  host.addEventListener('lostpointercapture', interrupted, true);
  host.ownerDocument.defaultView.addEventListener('blur', blur);
  return { start, get active() { return !!active; }, cancel: blur, dispose() {
    blur(); host.removeEventListener('keydown', key, true); host.removeEventListener('pointermove', move, true); host.removeEventListener('pointerdown', down, true);
    host.removeEventListener('pointerup', up, true); host.removeEventListener('pointercancel', interrupted, true); host.removeEventListener('lostpointercapture', interrupted, true);
    host.ownerDocument.defaultView.removeEventListener('blur', blur);
  } };
}
