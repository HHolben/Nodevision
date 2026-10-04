// Nodevision/ApplicationSystem/public/PanelInstances/Common/HtmlProperties/PropertiesController.mjs
// This module binds the minimal Properties panel to existing HTML selection owners, pins asynchronous edits to their destination, and cancels previews when ownership changes.
import { createPropertiesSurface } from './PropertiesSurface.mjs';
import { activeHtmlPropertiesContext, htmlPropertiesContexts, subscribeHtmlPropertiesContext } from './HtmlPropertiesContexts.mjs';
import { prepareHtmlCssDocument, discoverHtmlProperties } from './HtmlCssDocument.mjs';
import { beginPropertiesEdit } from './PropertiesEdit.mjs';

export function mountHtmlProperties(host) {
  const ui = createPropertiesSurface(host);
  let context = null, element = null, targets = [], edit = null, last = null, unsubscribe = null, serial = 0, disposed = false, busy = false, restoring = false;
  const message = text => { ui.status.textContent = text; };
  function cancel() { const current = edit; edit = null; if (current) { restoring = true; try { current.cancel(); } finally { restoring = false; element = context?.selection.getElement(); } } }
  function controls() {
    const chosen = ui.destination.value !== '' && element && element !== context?.editorElement;
    for (const name of ['preview', 'apply', 'save']) ui.buttons[name].disabled = !chosen || busy;
    ui.buttons.cancel.disabled = !edit || busy;
    const history = ui.destination.value === 'inline' ? context?.editorElement.__nvProgrammaticHistory : null;
    ui.buttons.undo.disabled = busy || (history?.owned ? !history.canUndo() : !last?.changed);
    ui.buttons.redo.disabled = busy || (history?.owned ? !history.canRedo() : !last?.changed);
    ui.property.disabled = ui.destination.disabled = ui.value.disabled = busy;
  }
  async function refresh() {
    const token = ++serial, owner = context, selected = element;
    ui.identity.textContent = owner && selected ? `${owner.filePath} · ${selected.localName}${selected.id ? '#' + selected.id : ''}${[...selected.classList].map(c => '.' + c).join('')}` : 'Select an HTML element in a graphical editor.';
    ui.destinations([]); targets = []; controls();
    if (!owner || !selected || selected === owner.editorElement) { ui.effective.textContent = ''; ui.authored.textContent = ''; ui.value.value = ''; message('Select an HTML element.'); return; }
    try {
      await Promise.all(htmlPropertiesContexts().map(prepareHtmlCssDocument));
      const result = await discoverHtmlProperties(owner, selected, ui.property.value);
      if (disposed || token !== serial) return;
      targets = result.targets; ui.destinations(targets);
      ui.effective.textContent = 'Effective: ' + result.effective;
      ui.authored.textContent = 'Inline authored: ' + (result.inline || 'none') + (result.priority ? ' !important' : '') + (result.inherited ? ' · color may be inherited' : '');
      ui.picker.element.hidden = ui.property.value !== 'color';
      message(result.sourceWarning || 'Choose an explicit destination. Preview does not save.'); controls();
    } catch (error) { if (token === serial) message(error.message); }
  }
  function selectionChanged() {
    if (restoring) return;
    const next = context?.selection.getElement() || null;
    if (next === element) return;
    const bookmark = context?.selection.bookmark();
    try { cancel(); restoring = true; if (bookmark) context.selection.restore(bookmark, { focus: false }); }
    catch (error) { message(error.message); } finally { restoring = false; }
    element = context?.selection.getElement() || next; last = null; void refresh();
  }
  function bind(owner) {
    if (owner === context) return;
    unsubscribe?.(); unsubscribe = null;
    try { cancel(); } catch (error) { message(error.message); }
    context = owner; element = owner?.selection.getElement() || null; last = null;
    unsubscribe = owner?.selection.subscribe(selectionChanged); void refresh();
  }
  const offOwner = subscribeHtmlPropertiesContext(bind);
  const blockMessage = event => { if (event.detail.context === context) message(event.detail.message); };
  window.addEventListener('nv-html-properties-history-blocked', blockMessage);
  async function invoke(name) {
    if (busy || disposed) return;
    busy = true; controls();
    try {
      if (name === 'cancel') { cancel(); await refresh(); return; }
      if (name === 'refresh') { cancel(); await refresh(); return; }
      if (name === 'undo' || name === 'redo') { restoring = true; try { if (ui.destination.value === 'inline' && context?.editorElement.__nvProgrammaticHistory?.owned) context.editorElement.__nvProgrammaticHistory[name](); else last?.undo(name); } finally { restoring = false; element = context?.selection.getElement(); } message('Properties ' + name + ' completed.'); return; }
      const owner = context, selected = element, token = serial, target = ui.destination.value === 'inline' ? null : targets[Number(ui.destination.value)];
      if (!owner || !selected || !ui.destination.value) throw new Error('Choose an element and destination');
      if (name === 'save') {
        if (edit) throw new Error('Apply or cancel the preview before saving');
        await (target?.entry?.source ? target.entry.source.save() : owner.save()); message('Saved ' + (target?.entry?.path || owner.filePath)); return;
      }
      if (!edit) {
        const next = await beginPropertiesEdit(owner, selected, ui.property.value, target);
        if (disposed || token !== serial || owner !== context) { next.cancel(); return; } edit = next;
      }
      edit.preview(ui.value.value);
      ui.effective.textContent = 'Effective preview: ' + getComputedStyle(selected).getPropertyValue(ui.property.value);
      if (name === 'apply') {
        const destination = ui.destination.value;
        const operation = await edit.apply(); edit = null;
        if (disposed || owner !== context || token !== serial) return;
        last = operation;
        await refresh();
        if (disposed || owner !== context || selected !== element) return;
        ui.destination.value = destination; ui.destination.dispatchEvent(new Event('change'));
        message(operation.changed ? `Applied to ${target?.entry?.path || owner.filePath}; save this destination when ready.` : 'No authored change.');
      } else message('Preview active. Apply or cancel before typing or saving.');
    } catch (error) { try { cancel(); } catch {} message(error.message); }
    finally { busy = false; controls(); }
  }
  ui.destination.addEventListener('change', () => {
    try { cancel(); } catch (error) { message(error.message); }
    const target = targets[Number(ui.destination.value)];
    ui.value.value = ui.destination.value === 'inline' ? element?.style.getPropertyValue(ui.property.value) || '' : target?.declaration?.value || '';
    ui.picker.setValue(ui.value.value); controls();
  });
  ui.property.addEventListener('change', () => { try { cancel(); } finally { void refresh(); } });
  for (const [name, button] of Object.entries(ui.buttons)) button.addEventListener('click', () => void invoke(name));
  const saveKey = event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); event.stopPropagation(); void invoke('save'); } };
  host.addEventListener('keydown', saveKey);
  bind(activeHtmlPropertiesContext());
  return { ui, refresh, invoke,
    dispose() { if (disposed) return; disposed = true; serial++; unsubscribe?.(); offOwner(); try { cancel(); } catch {} window.removeEventListener('nv-html-properties-history-blocked', blockMessage); host.removeEventListener('keydown', saveKey); },
  };
}
