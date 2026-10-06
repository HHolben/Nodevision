// Nodevision/ApplicationSystem/public/panels/panelZoomCapabilities.mjs
// This module registers independent geometric, semantic, and fisheye commands on panel instances. Unsupported commands return false and never substitute geometric scaling for another mode.
const registrations = new WeakMap();
const owners = new WeakMap();
let revision = 0;
for (const type of ['activePanelChanged', 'nv-panel-tab-activated']) {
  globalThis.window?.addEventListener?.(type, () => { revision++; });
}
export { panelZoomModeForEvent, ZoomIntent } from './panelZoomInput.mjs';
// Legacy callers may still import this function; implicit CSS support is retired.
export function setPanelGeometricFallback() {}
function notify(type, detail) {
  if (globalThis.window?.dispatchEvent && typeof CustomEvent === 'function') window.dispatchEvent(new CustomEvent(type, { detail }));
}
export const panelZoomModes = ['geometric', 'semantic', 'fisheye'];
export function registerPanelZoomCapabilities(panel, handlers) {
  const entry = { panel, handlers, states: Object.fromEntries(panelZoomModes.map(mode => [mode, {}])) };
  revision++; registrations.set(panel, entry); panel.setAttribute?.('data-nv-zoom-capabilities', 'true');
  notify('nv-panel-zoom-capabilities-changed', { panel });
  return () => { if (registrations.get(panel) === entry) { revision++; registrations.delete(panel); panel.removeAttribute?.('data-nv-zoom-capabilities'); notify('nv-panel-zoom-capabilities-changed', { panel }); } };
}
function available(panel) {
  // Non-DOM hosts remain usable in capability unit tests. Retained DOM tabs are not dispatch targets.
  return !panel?.nodeType || (panel.isConnected && !panel.closest('[hidden], [aria-hidden="true"]') && panel.getClientRects().length > 0);
}
export function getPanelZoomOwner(panel) { return registration(panel)?.panel || null; }
function registration(panel) {
  if (!panel) return null;
  if (registrations.has(panel)) return registrations.get(panel);
  if (!available(panel)) return null;
  const cached = owners.get(panel);
  if (cached?.revision === revision && (!cached.entry || (available(cached.entry.panel) && panel.contains?.(cached.entry.panel)))) return cached.entry;
  const boundary = '[data-nv-zoom-capabilities], .panel, .nv-panel-tab-content';
  const child = Array.from(panel.querySelectorAll?.('[data-nv-zoom-capabilities]') || []).find(node =>
    available(node) && (node.parentElement?.closest(boundary) === panel || node.parentElement?.closest(boundary) === null));
  const entry = child ? registrations.get(child) : null;
  owners.set(panel, { revision, entry });
  return entry;
}
export function getPanelZoomMetadata(panel, mode) { return registration(panel)?.handlers.metadata?.[mode] || null; }
export function getPanelZoomMode(panel) { return registration(panel)?.mode || 'geometric'; }
export function setPanelZoomMode(panel, mode) {
  const entry = registration(panel);
  if (!entry || typeof entry.handlers[mode] !== 'function') return false;
  entry.mode = mode;
  notify('nv-panel-zoom-capabilities-changed', { panel });
  return true;
}
export function getPanelZoomCapabilities(panel) {
  const entry = registration(panel);
  return Object.fromEntries(panelZoomModes.map(mode => [mode, typeof entry?.handlers[mode] === 'function']));
}
export function executePanelZoom(panel, mode, command = {}) {
  const entry = registration(panel), handler = entry?.handlers[mode];
  if (!available(panel) || (entry && !available(entry.panel))) return false;
  if (typeof handler !== 'function') return false;
  const actions = entry.handlers.metadata?.[mode]?.actions;
  const action = ['in', 'out'].includes(command.action) ? 'zoom' : command.action;
  if (actions && !actions.includes(action)) return false;
  const handled = handler(command, entry.states[mode]) !== false;
  if (handled) notify('nv-panel-zoom-pan-updated', { panel, mode });
  return handled;
}
export function getPanelZoomState(panel, mode = 'geometric') {
  return registration(panel)?.handlers.getState?.(mode) || null;
}
