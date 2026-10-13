// Nodevision/ApplicationSystem/public/CursorFamilies/PanelActiveTool.mjs
// This registry associates semantic tool state with its owning panel. Pointer presentation is deliberately excluded, and detached panel registrations are released by their editor lifecycle.
import { getActivePanelElement } from '../panels/panelZoomPanParts/ownership.mjs';
const sources=new WeakMap();
export function activeToolPanel() {
  return typeof document==='undefined' ? null : getActivePanelElement();
}
export function registerPanelActiveTool(panel, source) {
  sources.set(panel,source);panel.setAttribute('data-nv-active-tool-source','');
  notifyActiveToolChanged(panel);
  return ()=>{if(sources.get(panel)!==source)return;sources.delete(panel);panel.removeAttribute('data-nv-active-tool-source');notifyActiveToolChanged(panel);};
}
export function resolvePanelActiveTool(panel=activeToolPanel()) {
  if(!panel)return null;
  if(sources.has(panel))return {panel,source:sources.get(panel)};
  const host=[...panel.querySelectorAll('[data-nv-active-tool-source]')].find(node=>!node.closest('[hidden],[aria-hidden="true"]'));
  return host && sources.has(host) ? {panel:host,source:sources.get(host)} : null;
}
export function notifyActiveToolChanged(panel) {
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('nv-active-tool-changed',{detail:{panel}}));
}
