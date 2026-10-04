// Nodevision/ApplicationSystem/public/PanelInstances/Common/HtmlProperties/PropertiesUndoFence.mjs
// This module contains the known mixed-history hazard for Properties by blocking native and legacy undo after a real Properties edit while allowing revision-checked Properties history controls.
export function fencePropertiesUndo(context) {
  const root = context.editorElement;
  if (root.__nvProgrammaticHistory?.owned) return;
  if (root.__nvPropertiesUndoBlocked) return;
  root.__nvPropertiesUndoBlocked = true;
  const report = () => window.dispatchEvent(new CustomEvent('nv-html-properties-history-blocked', {
    detail: { context, message: 'Native undo is paused after a Properties edit. Use Properties Undo before typing again, or save and reopen this document.' },
  }));
  const key = event => {
    if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
      event.preventDefault(); event.stopImmediatePropagation(); report();
    }
  };
  const before = event => { if (/^history(Undo|Redo)$/.test(event.inputType)) { event.preventDefault(); event.stopImmediatePropagation(); report(); } };
  root.addEventListener('keydown', key, true); root.addEventListener('beforeinput', before, true);
  context.__nvPropertiesUndoCleanup = () => {
    root.removeEventListener('keydown', key, true); root.removeEventListener('beforeinput', before, true);
    root.__nvPropertiesUndoBlocked = false; context.__nvPropertiesUndoCleanup = null;
  };
}
