// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/htmlTableStyleToolbar.mjs
// This widget exposes contextual table and cell appearance controls in the HTML Styles subtoolbar and applies each committed value as an undoable edit.
import { tableStyleFields, htmlTableStyleContext, readHtmlTableStyle, applyHtmlTableStyle } from '../ToolbarCallbacks/edit/htmlTableStyles.mjs';

export function initToolbarWidget(host) {
  if (!host || host.dataset.nvHtmlTableStylesBound) return;
  host.dataset.nvHtmlTableStylesBound = 'true';
  const mount = host.querySelector('#nv-html-table-style-toolbar') || host;
  const form = document.createElement('div');
  Object.assign(form.style, {display:'flex',gap:'10px',alignItems:'center',flexWrap:'wrap'});
  const scopeLabel = document.createElement('label'); scopeLabel.textContent = 'Apply cell styles to ';
  const scope = document.createElement('select'); scope.dataset.field = 'scope';
  scope.add(new Option('Whole table','table')); scope.add(new Option('Selected / current cells','selection'));
  scopeLabel.append(scope); form.append(scopeLabel);
  const controls = new Map();
  for (const field of tableStyleFields) {
    const label = document.createElement('label'); label.textContent = field.label + ' ';
    const input = document.createElement(field.options ? 'select' : 'input');
    input.dataset.field = field.key;
    if (field.options) {
      input.add(new Option('Mixed / other',''));
      for (const value of field.options) input.add(new Option(value,value));
    } else {
      input.type = field.number ? 'number' : 'text';
      if (field.number) { input.min = '0'; input.step = 'any'; }
      input.placeholder = field.placeholder || 'Mixed';
      input.style.width = field.number ? '65px' : '150px';
    }
    input.title = field.group === 'table' ? 'Applies to the whole table' : 'Applies to the cell scope chosen above';
    label.append(input); form.append(label); controls.set(field.key,input);
  }
  const status = document.createElement('span'); status.setAttribute('role','status');
  form.append(status); mount.replaceChildren(form);
  let context = null;
  const refresh = () => {
    context = htmlTableStyleContext(scope.value);
    for (const field of tableStyleFields) {
      const input = controls.get(field.key);
      input.disabled = !context;
      const value = context ? readHtmlTableStyle(context,field) : '';
      input.value = field.options && !field.options.includes(value) ? '' : value;
    }
    status.textContent = context ? '' : 'Select a table cell to style it.';
  };
  scope.addEventListener('change', refresh);
  form.addEventListener('change', event => {
    const key = event.target.dataset.field;
    if (!controls.has(key)) return;
    try {
      if (!context) throw Error('Select a table cell to style it.');
      if (applyHtmlTableStyle(key,event.target.value,scope.value,context.table)) status.textContent = 'Style applied.';
    } catch (error) { status.textContent = error.message; }
  });
  // Refresh existing controls when returning to the editor; do not rebuild a
  // focused color/number field or discard partially entered values.
  const selectionChanged = () => {
    if (!host.isConnected) { document.removeEventListener('selectionchange',selectionChanged); return; }
    if (!host.contains(document.activeElement)) refresh();
  };
  document.addEventListener('selectionchange',selectionChanged);
  refresh();
}
