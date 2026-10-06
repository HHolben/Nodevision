// Nodevision/ApplicationSystem/public/panels/panelZoomPanParts/shortcuts.mjs
// This module routes modified gestures to one visible active capability owner and reserves unsupported modes against local fallthrough.
import { bindPanelActivationMemory, getActivePanelElement, getPanelElementFromElement } from './ownership.mjs';
import { executePanelZoom, getPanelZoomOwner, getPanelZoomCapabilities } from '../panelZoomCapabilities.mjs';
import { panelZoomModeForEvent, panelZoomCommandForEvent } from '../panelZoomInput.mjs';
const semanticWheel = new WeakMap();
export function routePanelZoomEvent(event, { target = event.target, clientX, clientY, resolveMode = panelZoomModeForEvent } = {}) {
  if (event.defaultPrevented) return false;
  const active = getActivePanelElement();
  if (!active?.isConnected || active.closest('[hidden], [aria-hidden="true"]') || !active.getClientRects().length) return false;
  let panel = getPanelElementFromElement(target);
  if (!panel && target?.closest?.('[data-nv-zoom-toolbar]')) panel = active;
  if (panel !== active) return false;
  const command = panelZoomCommandForEvent(event, active.clientHeight);
  if (!command) return false;
  const mode = resolveMode(event, active);
  // An embedded registered owner is a boundary even if its command is unsupported.
  const embedded = target?.closest?.('[data-nv-zoom-capabilities]');
  const owner = embedded && active.contains(embedded) ? embedded : getPanelZoomOwner(active);
  if (!owner) return false;
  if (clientX !== undefined) command.clientX = clientX;
  if (clientY !== undefined) command.clientY = clientY;
  let accumulated = false;
  if (mode === 'semantic' && event.type === 'wheel' && getPanelZoomCapabilities(owner).semantic) {
    const now = performance.now(), prior = semanticWheel.get(owner), delta = command.delta;
    const total = prior && now - prior.time < 250 && Math.sign(prior.delta) === Math.sign(delta) ? prior.delta + delta : delta;
    accumulated = Math.abs(total) < 60;
    semanticWheel.set(owner, { time: now, delta: accumulated ? total : 0 });
  }
  const handled = accumulated || executePanelZoom(owner, mode, command);
  // Stop local native listeners from interpreting a reserved mode as geometric zoom.
  event.stopImmediatePropagation();
  if (handled || mode !== 'geometric') event.preventDefault();
  return handled;
}
export function installPanelZoomShortcuts({ resolveMode = panelZoomModeForEvent } = {}) {
  if (typeof window === 'undefined') return null;
  bindPanelActivationMemory();
  if (window.__nvPanelZoomShortcutsInstalled) return window.__nvPanelZoomShortcutsInstalled;
  const route = event => routePanelZoomEvent(event, { resolveMode });
  window.addEventListener('wheel', route, { capture: true, passive: false });
  window.addEventListener('keydown', route, true);
  return window.__nvPanelZoomShortcutsInstalled = { dispose() {
    window.removeEventListener('wheel', route, true);
    window.removeEventListener('keydown', route, true);
    window.__nvPanelZoomShortcutsInstalled = null;
  } };
}
