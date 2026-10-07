// Nodevision/ApplicationSystem/public/panels/documentFrameZoom.mjs
// This module keeps document reflow and geometric magnification independent on an iframe without changing its authored DOM. Reflow changes the frame's CSS viewport and compensates its presentation scale, while geometric magnification transforms the resulting layout without changing that viewport.
import { registerPanelZoomCapabilities } from './panelZoomCapabilities.mjs';
import { installPanelZoomIframe } from './panelZoomIframe.mjs';

export function installDocumentFrameZoom(owner, iframe, { reflow = true } = {}) {
  let geometric = 1, reading = 1, disposed = false;
  let panX = 0, panY = 0, pointer = null;
  const rememberPointer = position => { pointer = { clientX: position.clientX, clientY: position.clientY }; };
  const paintCamera = () => { iframe.style.transform = `translate(${panX}px, ${panY}px) scale(${geometric})`; };
  const keys = ['width', 'height', 'zoom', 'transform', 'transformOrigin', 'boxSizing', 'flex'];
  const previous = Object.fromEntries(keys.map(key => [key, iframe.style[key]]));
  // Border-box owner measurements do not shrink when magnification creates scrollbars.
  const widthGap = owner.offsetWidth - iframe.offsetWidth;
  const heightGap = owner.offsetHeight - iframe.offsetHeight;
  const layout = () => {
    if (disposed || !owner.offsetWidth || !owner.offsetHeight) return;
    iframe.style.width = `${Math.max(1, owner.offsetWidth - widthGap) / reading}px`;
    iframe.style.height = `${Math.max(1, owner.offsetHeight - heightGap) / reading}px`;
    iframe.style.boxSizing = 'border-box';
    iframe.style.flex = 'none';
    iframe.style.zoom = String(reading);
    iframe.style.transformOrigin = '0 0';
    paintCamera();
  };
  function magnify(next, input) {
    if (input.action === 'reset') { geometric = next; panX = 0; panY = 0; paintCamera(); return; }
    const rect = iframe.getBoundingClientRect(), ownerRect = owner.getBoundingClientRect();
    if (!rect.width || !rect.height || !iframe.offsetWidth || !iframe.offsetHeight) return;
    const anchor = Number.isFinite(input.clientX) && Number.isFinite(input.clientY) ? input : pointer;
    const x = anchor?.clientX ?? ownerRect.left + ownerRect.width / 2;
    const y = anchor?.clientY ?? ownerRect.top + ownerRect.height / 2;
    const scaleX = rect.width / (iframe.offsetWidth * geometric) || 1;
    const scaleY = rect.height / (iframe.offsetHeight * geometric) || 1;
    const localX = (x - rect.left) / rect.width, localY = (y - rect.top) / rect.height;
    const ratio = next / geometric;
    panX += (x - rect.left) * (1 - ratio) / scaleX;
    panY += (y - rect.top) * (1 - ratio) / scaleY;
    geometric = next; paintCamera();
    // Native scrolling can clamp when transformed overflow shrinks. Compensate without reflow.
    const after = iframe.getBoundingClientRect();
    panX += (x - after.left - localX * after.width) / scaleX;
    panY += (y - after.top - localY * after.height) / scaleY;
    paintCamera();
  }
  function command(mode, input) {
    const current = mode === 'geometric' ? geometric : reading;
    let next;
    if (input.action === 'reset') next = 1;
    else if (input.action === 'set') next = input.zoom;
    else next = current * (input.factor ?? (input.action === 'out' ? 1 / 1.1 : input.action === 'in' ? 1.1 : NaN));
    if (!Number.isFinite(next) || next <= 0) return false;
    next = Math.max(mode === 'geometric' ? .1 : .5, Math.min(8, next));
    if (next === current && !(mode === 'geometric' && input.action === 'reset')) return true;
    if (mode === 'geometric') {
      // Measure the presentation rectangle for anchoring, never resize the document viewport.
      magnify(next, input);
    } else { reading = next; layout(); }
    return true;
  }
  layout();
  const resize = new ResizeObserver(layout);
  resize.observe(owner, { box: 'border-box' });
  const release = registerPanelZoomCapabilities(owner, {
    metadata: {
      geometric: { actions: ['zoom', 'set', 'reset'], unit: 'magnification' },
      semantic: reflow ? { actions: ['zoom', 'set', 'reset'], unit: 'reflow scale', continuous: true } : null
    },
    geometric: input => command('geometric', input),
    semantic: reflow ? input => command('semantic', input) : false,
    fisheye: false,
    getState: mode => mode === 'geometric' ? { zoom: geometric, pan: { x: panX, y: panY } } : mode === 'semantic' && reflow ? { zoom: reading } : null
  });
  owner.addEventListener('pointermove', rememberPointer, { passive: true });
  const unbridge = installPanelZoomIframe(iframe, { onPointer: rememberPointer });
  return () => {
    if (disposed) return;
    disposed = true; resize.disconnect(); unbridge(); release();
    owner.removeEventListener('pointermove', rememberPointer); pointer = null;
    for (const key of keys) iframe.style[key] = previous[key];
  };
}
