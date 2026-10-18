// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/htmlTableStyles.mjs
// This module defines HTML table styling controls and applies validated changes through the active editor's existing DOM history without rebuilding tables or replacing native selections.
import { getActiveTableCell, getSelectedTableCells } from '../insert/tableTools.mjs';
import { getTableEditorRoot, getActiveGridTableContext } from '../insert/tableToolsParts/IsEditableTableRoot.mjs';

export const tableStyleFields = [
  {key:'width', label:'Width', group:'table', property:'width', placeholder:'auto, 100%, 400px'},
  {key:'tableLayout', label:'Layout', group:'table', property:'table-layout', options:['auto','fixed']},
  {key:'borderCollapse', label:'Borders', group:'table', property:'border-collapse', options:['collapse','separate']},
  {key:'borderSpacing', label:'Spacing (px)', group:'table', property:'border-spacing', number:true},
  {key:'tableAlign', label:'Table alignment', group:'table', options:['left','center','right']},
  {key:'backgroundColor', label:'Background', group:'cells', property:'background-color', placeholder:'#ffffff or transparent'},
  {key:'color', label:'Text color', group:'cells', property:'color', placeholder:'#222222'},
  {key:'borderColor', label:'Border color', group:'cells', property:'border-color', placeholder:'#444444'},
  {key:'borderStyle', label:'Border style', group:'cells', property:'border-style', options:['none','solid','dashed','dotted','double']},
  {key:'borderWidth', label:'Border width (px)', group:'cells', property:'border-width', number:true},
  {key:'padding', label:'Padding (px)', group:'cells', property:'padding', number:true},
  {key:'textAlign', label:'Text alignment', group:'cells', property:'text-align', options:['left','center','right','justify']},
  {key:'verticalAlign', label:'Vertical alignment', group:'cells', property:'vertical-align', options:['top','middle','bottom']},
];

export function htmlTableStyleContext(scope = 'table') {
  if (getActiveGridTableContext()) return null;
  const root = getTableEditorRoot(), active = getActiveTableCell(), table = active?.closest('table');
  if (!root?.contains(table) || !root.__nvProgrammaticHistory) return null;
  const selected = getSelectedTableCells(table);
  const cells = scope === 'selection' ? (selected.length ? selected : [active])
    : Array.from(table.querySelectorAll('td, th')).filter(cell => cell.closest('table') === table);
  return {root,table,cells};
}

export function readHtmlTableStyle(context, field) {
  const targets = field.group === 'table' ? [context.table] : context.cells;
  const values = targets.map(target => {
    if (field.key === 'tableAlign') {
      const {marginLeft:left, marginRight:right} = target.style;
      return left === 'auto' ? (right === 'auto' ? 'center' : 'right') : 'left';
    }
    const value = getComputedStyle(target).getPropertyValue(field.property).trim();
    if (!field.number) return value;
    const parts = value.split(/\s+/);
    return parts.every(part => part === parts[0]) && /^\d+(\.\d+)?px$/.test(parts[0]) ? String(parseFloat(parts[0])) : '';
  });
  return values.every(value => value === values[0]) ? values[0] : '';
}

export function applyHtmlTableStyle(key, rawValue, scope = 'table', expectedTable = null) {
  const context = htmlTableStyleContext(scope);
  if (!context || (expectedTable && context.table !== expectedTable)) throw Error('Select a cell in the table you want to style.');
  const field = tableStyleFields.find(item => item.key === key);
  if (!field) throw Error('Unknown table style.');
  let value = String(rawValue).trim();
  if (!value) return false;
  if (field.options && !field.options.includes(value)) throw Error('Choose a listed value.');
  if (field.number) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) throw Error('Enter a non-negative number.');
    value = `${number}px`;
  }
  if (field.property && !CSS.supports(field.property, value)) throw Error(`Enter a valid ${field.label.toLowerCase()}.`);
  const targets = field.group === 'table' ? [context.table] : context.cells;
  context.root.__nvProgrammaticHistory.captureCommand(() => {
    for (const target of targets) {
      if (field.key === 'tableAlign') {
        target.style.marginLeft = value === 'left' ? '0px' : 'auto';
        target.style.marginRight = value === 'right' ? '0px' : 'auto';
      } else target.style.setProperty(field.property, value);
    }
  });
  context.root.dispatchEvent(new Event('input', {bubbles:true}));
  return true;
}
