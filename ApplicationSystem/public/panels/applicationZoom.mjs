// Nodevision/ApplicationSystem/public/panels/applicationZoom.mjs
// This module provides independent reading reflow and geometric magnification for the complete application shell when no panel owns zoom. Runtime wrappers supply scrollable magnified bounds while authored documents and panel-specific zoom states remain untouched.
import { registerPanelZoomCapabilities } from './panelZoomCapabilities.mjs';
import { getActivePanelElement } from './panelZoomPanParts/ownership.mjs';
let installation = null;
let disposing = false;

export function getApplicationZoomOwner() {
  if (disposing) return null;
  const shell = document.getElementById('app-shell');
  if (!shell?.isConnected || !shell.getClientRects().length) return null;
  if (installation?.shell === shell) return shell;
  disposeApplicationZoom();
  const viewport = document.createElement('div'), extent = document.createElement('div');
  viewport.dataset.nvApplicationZoomViewport = 'true';
  viewport.style.cssText = 'position:fixed;inset:0;overflow:auto;scrollbar-gutter:stable';
  extent.style.position = 'relative';
  const keys = ['width', 'height', 'position', 'left', 'top', 'flex', 'zoom', 'transform', 'transformOrigin'];
  const original = Object.fromEntries(keys.map(key => [key, shell.style[key]]));
  shell.replaceWith(viewport); viewport.append(extent); extent.append(shell);
  Object.assign(shell.style, { position: 'absolute', left: '0', top: '0', flex: 'none', transformOrigin: '0 0' });
  let geometric = 1, semantic = 1;
  // Reserve vertical scrollbar space and keep layout dimensions stable as magnified overflow changes.
  const layout = { width: viewport.clientWidth, height: window.innerHeight };
  const render = () => {
    shell.style.width = `${layout.width / semantic}px`;
    shell.style.height = `${layout.height / semantic}px`;
    shell.style.zoom = String(semantic);
    shell.style.transform = `scale(${geometric})`;
    extent.style.width = `${layout.width * geometric}px`;
    extent.style.height = `${layout.height * geometric}px`;
  };
  const command = (mode, input) => {
    const current = mode === 'geometric' ? geometric : semantic;
    const next = input.action === 'reset' ? 1 : input.zoom ?? current * (input.factor || 1);
    if (!Number.isFinite(next) || next <= 0) return false;
    const x = input.clientX ?? viewport.clientWidth / 2, y = input.clientY ?? viewport.clientHeight / 2;
    const point = { x: (viewport.scrollLeft + x) / geometric, y: (viewport.scrollTop + y) / geometric };
    if (mode === 'geometric') geometric = Math.max(.25, Math.min(4, next));
    else semantic = Math.max(.5, Math.min(3, next));
    render();
    if (input.action === 'reset' && mode === 'geometric') { viewport.scrollLeft = 0; viewport.scrollTop = 0; }
    else if (mode === 'geometric') { viewport.scrollLeft = point.x * geometric - x; viewport.scrollTop = point.y * geometric - y; }
    return true;
  };
  installation = { shell, dispose() {} }; // Capability notifications may synchronously query the new owner.
  const release = registerPanelZoomCapabilities(shell, {
    metadata: {
      geometric: { actions: ['zoom', 'set', 'reset'], unit: 'application magnification' },
      semantic: { actions: ['zoom', 'set', 'reset'], unit: 'application reading scale', continuous: true },
    },
    geometric: input => command('geometric', input), semantic: input => command('semantic', input), fisheye: false,
    getState: mode => ({ zoom: mode === 'semantic' ? semantic : geometric }),
  });
  const resize = () => { layout.width = viewport.clientWidth; layout.height = window.innerHeight; render(); };
  window.addEventListener('resize', resize);
  installation = { shell, dispose() {
    release(); window.removeEventListener('resize', resize); viewport.replaceWith(shell);
    for (const key of keys) shell.style[key] = original[key];
  } };
  render();
  return shell;
}
export function getActiveZoomTarget() { return getActivePanelElement() || getApplicationZoomOwner(); }
export function disposeApplicationZoom() {
  disposing = true;
  try { installation?.dispose(); installation = null; }
  finally { disposing = false; }
}
