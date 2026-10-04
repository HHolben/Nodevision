// Nodevision/ApplicationSystem/public/PanelInstances/Common/HtmlProperties/HtmlPropertiesContexts.mjs
// This module announces existing HTML editor contexts to owner-pinned tools without taking ownership of DOM selection or Notebook navigation.
const contexts = new Set(), listeners = new Set();
let active = null;
export function activateHtmlPropertiesContext(context) {
  contexts.add(context);
  if (active === context) return;
  active = context; listeners.forEach(listener => listener(active));
}
export function removeHtmlPropertiesContext(context) {
  contexts.delete(context);
  context.__nvPropertiesDocument?.dispose(); context.__nvPropertiesUndoCleanup?.();
  if (active === context) { active = null; listeners.forEach(listener => listener(null)); }
}
export function htmlPropertiesContexts() { return [...contexts]; }
export function activeHtmlPropertiesContext() { return active; }
export function subscribeHtmlPropertiesContext(listener) { listeners.add(listener); return () => listeners.delete(listener); }
