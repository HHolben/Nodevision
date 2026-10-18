// Nodevision/scripts/html-table-style-browser.mjs
// These browser checks exercise the table style widget against the real HTML editor, including scope, selection retention, serialization and history.
export async function testTableStyles({context,root,tools}) {
  const ok = (value,message) => { if (!value) throw Error(message); };
  const {initToolbarWidget} = await import('/ToolbarJSONfiles/htmlTableStyleToolbar.mjs');
  const {applyHtmlTableStyle} = await import('/ToolbarCallbacks/edit/htmlTableStyles.mjs');
  const table = root.querySelector('table'), cells = [...table.rows[0].cells];
  tools.setActiveTableCell(cells[1]);
  const host = document.createElement('div'); document.body.append(host); initToolbarWidget(host);
  const field = key => host.querySelector(`[data-field="${key}"]`);
  const set = (key,value) => { field(key).value = value; field(key).dispatchEvent(new Event('change',{bubbles:true})); };
  const history = root.__nvProgrammaticHistory;
  const before = context.getHTML(), count = history.inspect().undoEntries;
  const selection = getSelection(), anchor = selection.anchorNode, offset = selection.anchorOffset;
  set('width','80%');
  ok(table.style.width === '80%', 'table width applied');
  ok(root.querySelector('table') === table, 'styling preserves table DOM');
  ok(selection.anchorNode === anchor && selection.anchorOffset === offset, 'styling preserves caret');
  ok(history.inspect().undoEntries === count+1, 'style edit creates one history entry');
  const after = context.getHTML(); history.undo(); ok(context.getHTML() === before, 'style undo');
  history.redo(); ok(context.getHTML() === after, 'style redo');
  set('scope','selection'); set('backgroundColor','#ffeeaa');
  ok(cells[1].style.backgroundColor === 'rgb(255, 238, 170)', 'current cell color');
  ok(!cells[0].style.backgroundColor, 'other cells remain unchanged');
  getSelection().removeAllRanges(); tools.setSelectedTableCells(cells.slice(0,2));
  const untouchedPadding = cells[2].style.padding;
  set('scope','selection'); set('padding','12');
  ok(cells[0].style.padding === '12px' && cells[1].style.padding === '12px' && cells[2].style.padding === untouchedPadding, 'multi-cell style scope');
  ok(tools.getSelectedTableCells().length === 2, 'styling retains cell selection');
  set('scope','table');
  for (const [key,value] of Object.entries({borderStyle:'dashed',borderWidth:'2',borderColor:'#123456',color:'#334455',textAlign:'center',verticalAlign:'top',tableLayout:'fixed',borderCollapse:'separate',borderSpacing:'4',tableAlign:'center'})) set(key,value);
  ok([...table.querySelectorAll('td')].every(cell => cell.style.borderStyle === 'dashed' && cell.style.textAlign === 'center'), 'whole-table cell styles');
  ok(table.style.borderSpacing === '4px' && table.style.marginLeft === 'auto' && table.style.marginRight === 'auto', 'table spacing and alignment');
  const valid = context.getHTML(), validCount = history.inspect().undoEntries;
  set('width','invalid-width'); set('padding','-2');
  ok(context.getHTML() === valid && history.inspect().undoEntries === validCount, 'invalid values leave document and history unchanged');
  ok(host.querySelector('[role="status"]').textContent.includes('non-negative'), 'invalid input explains error');
  const other = document.createElement('table');
  let rejected = false;
  try { applyHtmlTableStyle('width','50%','table',other); } catch { rejected = true; }
  ok(rejected, 'stale target is rejected');
  host.remove();
  context.setHTML(valid); context.activate();
  ok(root.querySelector('table').style.width === '80%' && root.querySelector('td').style.borderStyle === 'dashed', 'styles survive document reload');
}
