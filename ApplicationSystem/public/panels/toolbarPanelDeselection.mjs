// Nodevision/ApplicationSystem/public/panels/toolbarPanelDeselection.mjs
// This module makes blank toolbar space an explicit panel deselection target while preserving all interactive toolbar controls. Capture-phase handling prevents a toolbar inside a panel from immediately reactivating that panel on the same click.
const toolbars = '#global-toolbar, #sub-toolbar, .toolbar, .panel-toolbar, [role="toolbar"]';
const controls = 'button, a, input, select, textarea, label, [role="button"], [role="menuitem"], [contenteditable="true"], [tabindex]:not([tabindex="-1"]), .toolbar-main-button, .toolbar-dropdown-button, .toolbar-dropdown-panel';
export function installToolbarPanelDeselection(clearSelection) {
  const click = event => {
    if (event.button !== 0 || event.defaultPrevented) return;
    const target = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
    const toolbar = target?.closest(toolbars);
    if (!toolbar) return;
    const control = target.closest(controls);
    if (control && control !== toolbar && toolbar.contains(control)) return;
    clearSelection();
    event.stopImmediatePropagation();
  };
  window.addEventListener('click', click, true);
  return () => window.removeEventListener('click', click, true);
}
