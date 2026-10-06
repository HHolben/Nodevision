// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ImageViewport.mjs
// This shared raster viewport keeps the original decoded image as its rendering source. Native zoom uses one image pixel per CSS pixel, and screen-direction panning remains stable under arbitrary rotation.
import { registerPanelZoomCapabilities } from '../../../panels/panelZoomCapabilities.mjs';
import { imageViewMatrix, screenToImageDelta, imageViewBounds } from './ImageViewportGeometry.mjs';
export function mountImageViewport(host, img) {
  host._dispose?.();
  const priorScope = host.getAttribute('data-nv-panel-zoom-scope'), priorTabIndex = host.getAttribute('tabindex');
  host.innerHTML = ''; host.tabIndex = 0;
  host.dataset.nvPanelZoomScope = 'local';
  Object.assign(host.style, { position: 'relative', overflow: 'hidden', display: 'block' });
  const state = { angle: 0, zoom: 1, x: 0, y: 0, fit: true };
  Object.assign(img.style, { position: 'absolute', left: '50%', top: '50%', maxWidth: 'none', maxHeight: 'none',
    width: 'auto', height: 'auto', transformOrigin: 'center', imageRendering: img.style.imageRendering || 'auto', userSelect: 'none' });
  img.draggable = false;
  const controls = document.createElement('div');
  Object.assign(controls.style, { position: 'absolute', right: '0', top: '0', zIndex: '2', display: 'flex', flexWrap: 'wrap' });
  function render() {
    if (!img.naturalWidth) return;
    if (state.fit) {
      const bounds = imageViewBounds(img.naturalWidth, img.naturalHeight, state.angle);
      state.zoom = Math.min(1, host.clientWidth / bounds.width, host.clientHeight / bounds.height);
    }
    // Translation is image-local, so all input paths use the inverse view matrix.
    img.style.width = `${img.naturalWidth}px`; img.style.height = `${img.naturalHeight}px`;
    img.style.transform = `translate(-50%, -50%) rotate(${state.angle}deg) scale(${state.zoom}) translate(${state.x}px, ${state.y}px)`;
    img.title = `${img.naturalWidth} × ${img.naturalHeight}; ${Math.round(state.zoom * 100)}% (image pixels per CSS pixel)`;
  }
  function command({ action, factor = 1, zoom, panX, panY, dx = 0, dy = 0 }) {
    if (action === 'pan') { const delta = screenToImageDelta(imageViewMatrix(state.angle, state.zoom), dx, dy); state.x += delta.x; state.y += delta.y; render(); return true; }
    if (action === 'fit') { state.fit = true; state.x = state.y = 0; }
    else if (action === 'reset') { state.fit = false; state.zoom = 1; state.x = state.y = 0; }
    else { state.fit = false; state.zoom = Math.max(.01, Math.min(32, (zoom ?? state.zoom * factor))); }
    if (Number.isFinite(panX) && Number.isFinite(panY)) {
      const delta = screenToImageDelta(imageViewMatrix(state.angle, state.zoom), panX, panY);
      state.x = delta.x; state.y = delta.y;
    }
    render(); return true;
  }
  for (const [label, action] of [['Fit', () => command({ action: 'fit' })], ['100%', () => command({ action: 'reset' })],
    ['Rotate left', () => { state.angle -= 90; render(); }], ['Rotate right', () => { state.angle += 90; render(); }]]) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
    button.onclick = () => { action(); host.focus({ preventScroll: true }); }; controls.appendChild(button);
  }
  const keydown = event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.target.closest?.('input,textarea,button,[contenteditable=true]')) return;
    const vector = { ArrowLeft: [-1,0], ArrowRight: [1,0], ArrowUp: [0,-1], ArrowDown: [0,1] }[event.key];
    if (!vector) return;
    const step = event.shiftKey ? 100 : 20, delta = screenToImageDelta(imageViewMatrix(state.angle, state.zoom), vector[0] * step, vector[1] * step);
    state.x += delta.x; state.y += delta.y; render(); event.preventDefault(); event.stopPropagation();
  };
  host.append(img, controls); host.addEventListener('keydown', keydown);
  img.addEventListener('load', render);
  const resize = new ResizeObserver(render); resize.observe(host);
  const unregister = registerPanelZoomCapabilities(host, { metadata: { geometric: { actions: ['zoom', 'set', 'reset', 'fit', 'pan'], unit: 'image pixels per CSS pixel' } }, semantic: false, fisheye: false, geometric: command, getState() {
    const m = imageViewMatrix(state.angle, state.zoom);
    return { zoom: state.zoom, panX: m.a * state.x + m.c * state.y, panY: m.b * state.x + m.d * state.y };
  } });
  host.__nvImageViewport = { state, render, command, image: img, controls };
  host._dispose = () => {
    resize.disconnect(); unregister(); host.removeEventListener('keydown', keydown); img.removeEventListener('load', render);
    if (host.__nvImageViewport?.image !== img) return;
    delete host.__nvImageViewport;
    if (priorScope === null) host.removeAttribute('data-nv-panel-zoom-scope'); else host.setAttribute('data-nv-panel-zoom-scope', priorScope);
    if (priorTabIndex === null) host.removeAttribute('tabindex'); else host.setAttribute('tabindex', priorTabIndex);
  };
  if (img.complete) render();
  return host.__nvImageViewport;
}
