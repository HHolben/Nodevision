// Nodevision/ApplicationSystem/public/VectorDrawing/BindVectorInteraction.mjs
// This binding owns pointer capture and keyboard cleanup for a shared vector controller. Host adapters supply coordinate conversion and activation so document and image surfaces use identical event semantics.
import { createVectorInteraction } from './VectorInteraction.mjs';
export function bindVectorInteraction({ surface, keyboardHost, getTool, toPoint, preview, commit, status, begin = () => {}, cancelOnDeactivate = () => true }) {
  const controller = createVectorInteraction({ preview, commit, status });
  const doc = surface.ownerDocument, win = doc.defaultView;
  let captured = null;
  const listeners = [];
  function listen(target, name, handler, capture = true) { target.addEventListener(name, handler, capture); listeners.push(() => target.removeEventListener(name, handler, capture)); }
  function release() {
    const id = captured; captured = null;
    if (id !== null) { try { surface.releasePointerCapture(id); } catch { /* Detached surfaces may already have released capture. */ } }
  }
  function cancel() { controller.cancel(); release(); }
  function consume(event) { event.preventDefault(); event.stopImmediatePropagation(); }
  function sync() { const tool = getTool(); controller.setTool(tool); return tool; }
  listen(surface, 'pointerdown', event => {
    const tool = sync();
    if (!tool || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || controller.pointerId !== null) return;
    if (!controller.active) begin(event);
    const point = toPoint(event); if (!point) return;
    keyboardHost.focus({ preventScroll: true });
    controller.down(point, event);
    if (controller.pointerId !== null) {
      captured = event.pointerId;
      try { surface.setPointerCapture(captured); } catch { /* Synthetic events may not support capture. */ }
    }
    consume(event);
  });
  listen(surface, 'pointermove', event => {
    if (!sync() || !controller.active) return;
    const point = toPoint(event); if (point) controller.move(point, event);
    consume(event);
  });
  listen(surface, 'pointerup', event => {
    if (controller.pointerId !== event.pointerId) return;
    const point = toPoint(event);
    if (point) controller.up(point, event); else controller.cancel();
    release();
    consume(event);
  });
  listen(surface, 'dblclick', event => { if (['line', 'polygon'].includes(sync())) { controller.finish(); consume(event); } });
  listen(surface, 'pointercancel', cancel);
  listen(surface, 'lostpointercapture', () => { if (captured !== null) cancel(); });
  listen(keyboardHost, 'keydown', event => {
    if (event.target.closest?.('input,textarea,select,[contenteditable=true]')) return;
    if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) { cancel(); return; }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && controller.key(event.key)) { release(); consume(event); }
  });
  // Toolbar focus is allowed; switching to another panel cancels only the unfinished gesture.
  listen(doc, 'pointerdown', event => {
    if (!controller.active || keyboardHost.contains(event.target)) return;
    const panel = event.target.closest?.('.panel, .panel-cell, .nv-panel-tab-content');
    if (panel && !panel.contains(keyboardHost)) cancel();
  });
  const deactivate = () => { if (cancelOnDeactivate()) cancel(); };
  listen(win, 'activePanelChanged', deactivate);
  listen(win, 'blur', deactivate);
  return { controller, cancel, dispose() { cancel(); for (const remove of listeners) remove(); } };
}
