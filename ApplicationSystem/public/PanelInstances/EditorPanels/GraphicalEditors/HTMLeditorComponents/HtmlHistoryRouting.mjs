// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlHistoryRouting.mjs
// This module routes HTML history requests to their editor owner and contains scripted browser history commands for documents with participating editors without maintaining shared history state.
const documents = new WeakMap();
export function installHtmlHistoryRouting(root, history) {
  const doc = root.ownerDocument;
  let registry = documents.get(doc);
  if (!registry) {
    const original = doc.execCommand;
    registry = { roots: new Map(), original };
    registry.owner = () => {
      const focused = doc.activeElement;
      const host = [...registry.roots.keys()].find(root => root === focused || root.contains(focused));
      if (host) return host;
      if (focused?.matches('input, textarea') || focused?.isContentEditable) return null;
      const view = doc.defaultView;
      if (!['HTMLediting', 'EPUBediting'].includes(view.NodevisionState?.currentMode)) return null;
      const active = view.__nvActiveHtmlEditorContext?.editorElement;
      return registry.roots.has(active) ? active : null;
    };
    registry.dispatch = command => {
      const owner = registry.owner();
      if (owner?.__nvPropertiesUndoBlocked) return false;
      return registry.roots.get(owner)?.[command]() || false;
    };
    registry.wrapper = function(command, ...args) {
      const name = String(command).toLowerCase();
      if ((name === 'undo' || name === 'redo') && registry.owner()) return registry.dispatch(name);
      const anchor = doc.getSelection()?.anchorNode;
      const host = [...registry.roots.keys()].find(root => root.contains(anchor));
      const action = () => original.call(this, command, ...args);
      if (host && !doc.activeElement?.matches('input, textarea')) return registry.roots.get(host).captureCommand(action);
      return action();
    };
    registry.desktop = command => {
      if (!['undo', 'redo'].includes(command)) return false;
      if (!registry.owner()) return false;
      registry.dispatch(command); return true;
    };
    doc.defaultView.__nvDispatchHtmlHistory = registry.desktop;
    doc.execCommand = registry.wrapper;
    documents.set(doc, registry);
  }
  registry.roots.set(root, history);
  const key = event => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || !['z', 'y'].includes(event.key.toLowerCase())) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (root.__nvPropertiesUndoBlocked) return;
    history[event.shiftKey || event.key.toLowerCase() === 'y' ? 'redo' : 'undo']();
  };
  const before = event => {
    if (!/^history(Undo|Redo)$/.test(event.inputType)) return;
    if (!event.cancelable) return;
    event.preventDefault(); event.stopImmediatePropagation();
    registry.dispatch(event.inputType === 'historyRedo' ? 'redo' : 'undo');
  };
  root.addEventListener('keydown', key, true);
  root.addEventListener('beforeinput', before, true);
  return () => {
    root.removeEventListener('keydown', key, true); root.removeEventListener('beforeinput', before, true);
    registry.roots.delete(root);
    if (!registry.roots.size) {
      if (doc.execCommand === registry.wrapper) doc.execCommand = registry.original;
      if (doc.defaultView.__nvDispatchHtmlHistory === registry.desktop) delete doc.defaultView.__nvDispatchHtmlHistory;
      documents.delete(doc);
    }
  };
}
