// Nodevision/scripts/csv-cursor-browser.mjs
// This module extends the existing CSV browser harness with real editor cursor transitions and delegated-pointer cost checks, including cancellation, nested cell content, and editor teardown.

export function checkCsvCursors({ cell, pointer, click, key, reset, container, equal, ok }) {
  const wrapper = container.querySelector('.nv-csv-table-wrap');
  const effective = target => getComputedStyle(target).cursor;
  const hover = (r, c, options = {}) => pointer('pointermove', r, c, options);
  const state = () => wrapper.dataset.nvCsvCursor;
  reset([['A','B','C'],['D','E','F'],['G','H','I']]);
  click(0, 0);
  hover(1, 1); equal(effective(cell(1,1)), 'cell', 'ordinary selectable cell');
  hover(0, 0); equal(effective(cell(0,0)), 'cell', 'selected single-cell center does not move');
  const edge = cell(0,0).getBoundingClientRect();
  hover(0,0,{clientX:edge.left+1}); equal(state(), 'selection-movable', 'single-cell edge is movable');
  pointer('pointerdown',0,0,{clientX:edge.left+1});
  equal(effective(cell(0,0)), 'grabbing', 'move cursor begins on pointer-down');
  pointer('pointermove',1,1); equal(effective(cell(1,1)), 'grabbing', 'move cursor survives leaving source');
  equal(effective(document.getElementById('toolbar-button')), 'grabbing', 'active cursor covers pointer capture outside grid');
  pointer('pointerup',1,1); equal(effective(cell(1,1)), 'cell', 'drop restores single-cell center cursor');
  ok(!document.documentElement.classList.contains('nv-csv-pointer-operation'), 'drop clears document override');

  // Editing is real contenteditable state; cell text alone is not a text affordance.
  click(1,1); hover(1,1); key('F2'); equal(effective(cell(1,1)), 'text', 'F2 enters text editing');
  key('Escape'); equal(effective(cell(1,1)), 'cell', 'Escape ends editing cursor');
  cell(1,1).dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));
  equal(effective(cell(1,1)), 'text', 'double-click editing cursor');
  key('Escape'); key('q'); equal(effective(cell(1,1)), 'text', 'typing starts text editing'); key('Escape');

  reset([['A','B','C'],['D','E','F'],['G','H','I']]);
  click(0,0); click(1,1,{shiftKey:true}); hover(0,0);
  equal(effective(cell(0,0)), 'grab', 'multi-cell range is movable');
  key('Shift',{shiftKey:true}); equal(effective(cell(0,0)), 'cell', 'Shift disables move affordance');
  window.dispatchEvent(new KeyboardEvent('keyup',{key:'Shift',shiftKey:false}));
  equal(effective(cell(0,0)), 'grab', 'releasing Shift restores move affordance');

  // Nested DOM shares a cell identity and never acquires its own cursor listener.
  const child = document.createElement('span'); child.textContent = cell(0,0).textContent;
  cell(0,0).replaceChildren(child);
  const rect = cell(0,0).getBoundingClientRect();
  child.dispatchEvent(new PointerEvent('pointerover',{bubbles:true,clientX:rect.left+15,clientY:rect.top+10}));
  equal(effective(child), 'grab', 'nested text inherits effective cursor');
  pointer('pointerdown',0,0); pointer('pointermove',1,1); pointer('pointercancel',1,1);
  equal(effective(cell(1,1)), 'grab', 'cancel restores current hover cursor');
  pointer('pointerdown',0,0); pointer('pointermove',1,1); key('Escape');
  equal(effective(cell(1,1)), 'grab', 'Escape aborts drag');
  pointer('pointerdown',0,0);
  wrapper.dispatchEvent(new PointerEvent('lostpointercapture',{bubbles:true,pointerId:1}));
  ok(!document.documentElement.classList.contains('nv-csv-pointer-operation'), 'lost capture resets active cursor');
  pointer('pointerdown',0,0); window.dispatchEvent(new Event('blur'));
  equal(state(), 'default', 'window blur clears transient state');

  click(2,2); hover(0,0); equal(effective(cell(0,0)), 'cell', 'changed selection clears stale grab');
  pointer('pointerdown',0,0); equal(state(), 'range-selecting', 'active selection is distinct from idle cell');
  pointer('pointermove',1,1); equal(effective(cell(1,1)), 'crosshair', 'range creation cursor');
  pointer('pointerup',1,1); equal(effective(cell(1,1)), 'grab', 'selection completion restores movable hover');

  // The existing contract accepts the last valid destination when release is outside.
  pointer('pointerdown',0,0); pointer('pointermove',1,1);
  wrapper.dispatchEvent(new PointerEvent('pointerleave',{pointerId:1}));
  equal(effective(document.body), 'grabbing', 'outside is not falsely marked as an invalid drop');
  const hitTest = document.elementFromPoint;
  document.elementFromPoint = () => null;
  window.dispatchEvent(new PointerEvent('pointermove',{pointerId:1,clientX:-20,clientY:-20,buttons:1}));
  equal(effective(document.body), 'grabbing', 'no hit target still retains a legal last destination');
  window.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,clientX:-20,clientY:-20}));
  document.elementFromPoint = hitTest;
  equal(window.__nvCsvEditor.getSelection().range.top,1,'outside release commits the last valid destination');
  ok(!document.documentElement.classList.contains('nv-csv-pointer-operation'), 'outside transition resets on completion');
  const resizeHandle = document.createElement('div'); resizeHandle.style.cursor = 'col-resize';
  container.appendChild(resizeHandle);
  equal(effective(resizeHandle), 'col-resize', 'surrounding resize handles retain precedence outside CSV'); resizeHandle.remove();

  // Stable hover has no repeated layout, grid queries, publications, or cursor writes.
  reset([['A','B'],['C','D']]); click(0,0);
  const bounds = cell(0,0).getBoundingClientRect(); hover(0,0,{clientX:bounds.left+1});
  const originalRect = Element.prototype.getBoundingClientRect;
  const originalQuery = Element.prototype.querySelectorAll;
  const originalSet = CSSStyleDeclaration.prototype.setProperty;
  let geometry = 0, scans = 0, writes = 0;
  const toolbarUpdates = window.toolbarUpdates;
  Element.prototype.getBoundingClientRect = function(...args) { geometry++; return originalRect.apply(this,args); };
  Element.prototype.querySelectorAll = function(...args) { scans++; return originalQuery.apply(this,args); };
  CSSStyleDeclaration.prototype.setProperty = function(...args) { writes++; return originalSet.apply(this,args); };
  try {
    for (let i=0;i<200;i++) cell(0,0).dispatchEvent(new PointerEvent('pointermove',{
      bubbles:true,pointerId:1,clientX:bounds.left+1,clientY:bounds.top+10,
    }));
    equal(geometry,0,'cached edge hover does not reread layout'); equal(scans,0,'hover never scans grid');
    equal(writes,0,'unchanged cursor produces no style writes'); equal(window.toolbarUpdates,toolbarUpdates,'hover never rebuilds toolbar');
  } finally {
    Element.prototype.getBoundingClientRect = originalRect;
    Element.prototype.querySelectorAll = originalQuery;
    CSSStyleDeclaration.prototype.setProperty = originalSet;
  }
  pointer('pointerdown',0,0,{clientX:bounds.left+1});
  document.getElementById('toolbar-button').focus();
  window.dispatchEvent(new CustomEvent('activePanelChanged',{detail:{cell:document.getElementById('toolbar-button')}}));
  equal(state(),'default','switching active panel cancels drag');
  equal(document.activeElement.id,'toolbar-button','canceling for a panel switch does not steal focus back');
  ok(!document.documentElement.classList.contains('nv-csv-pointer-operation'),'panel switch releases document cursor');
  hover(0,0,{clientX:bounds.left+1}); pointer('pointerdown',0,0,{clientX:bounds.left+1});
  container.__cleanupCSVTableToolbar();
  ok(!wrapper.dataset.nvCsvCursor && !document.documentElement.classList.contains('nv-csv-pointer-operation'),'editor teardown clears all cursor state');
}
