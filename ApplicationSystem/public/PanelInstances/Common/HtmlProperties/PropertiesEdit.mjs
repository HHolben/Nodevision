// Nodevision/ApplicationSystem/public/PanelInstances/Common/HtmlProperties/PropertiesEdit.mjs
// This module pins one Properties operation to an editor element and explicit CSS destination, coordinating previews, reversible transactions and conflict checks without changing the selected document.
import { patchCssDeclaration } from './CssSourceIndex.mjs';
import { fencePropertiesUndo } from './PropertiesUndoFence.mjs';
import { inlineCssTarget } from './InlineCssTarget.mjs';

export async function beginPropertiesEdit(context, element, property, target = null) {
  if (!['color', 'margin-left'].includes(property)) throw new Error('Unsupported Properties field');
  if (!element || element === context.editorElement || !context.editorElement.contains(element)) throw new Error('Select an element inside the HTML body');
  if (target?.reason) throw new Error(target.reason);
  const source = target?.entry?.source;
  if (target && !source) throw new Error('This source is read-only');
  if (source) await source.checkDisk();
  if (!context.editorElement.contains(element)) throw new Error('The selected element changed while loading its source');
  context.editorElement.__nvProgrammaticHistory?.flush?.();
  const initial = source?.text, revision = source?.revision ?? context.revision;
  if (source && initial !== target.index.source) throw new Error('CSS target is stale. Refresh Properties.');
  const priority = element.style.getPropertyPriority(property);
  const inline = inlineCssTarget(element.getAttribute('style'), property);
  if (!source && inline.reason) throw new Error(inline.reason);
  const tx = source ? source.begin() : context.transactions.begin('Properties ' + property, revision);
  let settled = false;
  const previouslyBlocked = context.editorElement.__nvPropertiesUndoBlocked;
  const blockInput = event => { if (!settled) { event.preventDefault(); event.stopImmediatePropagation(); } };
  if (!source) { context.editorElement.__nvPropertiesUndoBlocked = true; context.editorElement.addEventListener('beforeinput', blockInput, true); }
  const finish = () => {
    settled = true; context.editorElement.removeEventListener('beforeinput', blockInput, true);
    if (!source) context.editorElement.__nvPropertiesUndoBlocked = previouslyBlocked;
  };
  return {
    context, source,
    preview(value) {
      if (settled) throw new Error('This Properties edit is finished');
      const text = value.trim();
      if (!text || !CSS.supports(property, text) || /[;{}!]|\/\*/.test(text)) throw new Error('Enter one valid CSS value without !important');
      if (source) tx.preview(patchCssDeclaration(target.index, target.rule.id, property, text, initial));
      else {
        const current = element.style.getPropertyValue(property);
        const probe = element.ownerDocument.createElement('span'); probe.style.setProperty(property, text, priority);
        if (current !== probe.style.getPropertyValue(property)) tx.preview(() => element.setAttribute('style', inline.patch(text)));
      }
    },
    async apply() {
      if (settled) throw new Error('This Properties edit is finished');
      if (source) { await source.checkDisk(); source.assertWritable(); }
      const changed = tx.commit(); finish();
      if (changed && !source) fencePropertiesUndo(context);
      let expected = source?.revision ?? context.revision;
      let undone = false;
      return { changed, source, context,
        undo(direction = 'undo') {
          if (!source && context.editorElement.__nvProgrammaticHistory?.owned) return context.editorElement.__nvProgrammaticHistory[direction]();
          if (!changed || (direction === 'undo' ? undone : !undone)) return false;
          const owner = source || context;
          if (owner.revision !== expected) throw new Error('The document changed after this Properties operation; reopen it before using mixed history.');
          source?.assertWritable();
          const history = source?.history || context.editorElement.__nvProgrammaticHistory;
          const result = history[direction](); expected = owner.revision; undone = direction === 'undo'; return result;
        },
        save: () => source ? source.save() : context.save(),
      };
    },
    cancel() { if (settled) return false; finish(); return tx.cancel({ focus: false }); },
  };
}
