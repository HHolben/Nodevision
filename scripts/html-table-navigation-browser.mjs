// Nodevision/scripts/html-table-navigation-browser.mjs
// This fixture exercises real HTML editor selection and history with native browser keys for loaded and newly inserted tables.
const ok = (value, message) => { if (!value) throw Error(message); };
try {
  window.NodevisionState = {};
  const originalFetch = window.fetch.bind(window);
  window.fetch = (url, options) => String(url).startsWith('/Notebook/')
    ? Promise.resolve(new Response('<p>fixture</p>')) : originalFetch(url, options);
  const { renderEditor } = await import('/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditor.mjs');
  const tools = await import('/ToolbarCallbacks/insert/tableTools.mjs');
  const host = document.getElementById('editor');
  await renderEditor('navigation.html', host);
  const context = host.__nvHtmlEditorContext, root = context.editorElement;
  const cases = [
    {name:'caret left', key:'ArrowLeft', start:5, end:5, expected:4},
    {name:'caret right', key:'ArrowRight', start:5, end:5, expected:6},
    {name:'range left', key:'ArrowLeft', start:2, end:7, expected:2},
    {name:'range right', key:'ArrowRight', start:2, end:7, expected:7},
    {name:'all text', key:'ArrowRight', start:0, end:10, expected:10},
    {name:'shift right', key:'ArrowRight', modifiers:8, start:5, end:5, expected:6, anchor:5},
    {name:'shift left', key:'ArrowLeft', modifiers:8, start:5, end:5, expected:4, anchor:5},
    {name:'ctrl right', key:'ArrowRight', modifiers:2, start:0, end:0, word:true},
    {name:'start boundary', key:'ArrowLeft', start:0, end:0},
    {name:'end boundary', key:'ArrowRight', start:10, end:10},
    {name:'nested formatting', key:'ArrowRight', start:2, end:2, expected:3, nested:true},
    {name:'stale cell state', key:'ArrowRight', start:5, end:5, expected:6, stale:true},
    {name:'cell left', key:'ArrowLeft', object:true, target:0},
    {name:'cell right', key:'ArrowRight', object:true, target:2},
    {name:'multi cell', key:'ArrowRight', object:true, multi:true, target:2},
    {name:'left edge', key:'ArrowLeft', object:true, edge:0, target:0},
    {name:'right edge', key:'ArrowRight', object:true, edge:2, target:2},
    {name:'vertical unchanged', key:'ArrowDown', start:5, end:5, vertical:true},
  ];
  window.navigationCases = ['existing','inserted'].flatMap(source => cases.map(test => ({...test,source})));
  let table, cell, node, before, historyCount, cells, prevented;
  window.cellDragTest = {
    async checkStyles(source) {
      await window.navigationTest.prepare(source === 'existing' ? 0 : cases.length);
      const {testTableStyles} = await import('/scripts/html-table-style-browser.mjs');
      await testTableStyles({context,root,tools});
    },
    async prepare(source) {
      await window.navigationTest.prepare(source === 'existing' ? 0 : cases.length);
      table.style.width = '450px';
      for (const td of table.querySelectorAll('td')) {
        td.style.width = '150px'; td.style.height = '55px';
      }
      const point = td => { const r = td.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; };
      return {start:point(cells[0]), end:point(cells[1]), edge:point(cells[2])};
    },
    check(single = false) {
      const selected = tools.getSelectedTableCells();
      ok(selected.length === (single ? 1 : 2), 'native drag selects whole cells');
      ok(selected[0] === cells[0], 'drag anchor retained');
      ok(window.__nvHtmlTableSelectionMode === 'cells', 'explicit cell mode');
      ok(!getSelection().rangeCount, 'cell drag clears native text range');
      ok(!window.__nvHtmlTableDragSelecting, 'drag finishes');
    },
    async prepareMove(source) {
      const points = await this.prepare(source);
      cells[0].innerHTML = '<b>left</b>';
      cells[1].innerHTML = '<i>middle</i>';
      cells[2].textContent = 'right';
      await new Promise(resolve => setTimeout(resolve,20));
      getSelection().removeAllRanges();
      tools.setSelectedTableCells(cells.slice(0,2),{activeCell:cells[1]});
      this.beforeMove = context.getHTML();
      this.historyCount = root.__nvProgrammaticHistory.inspect().undoEntries;
      this.movedNode = cells[0].firstChild;
      return points;
    },
    checkMove(cancelled = false) {
      const history = root.__nvProgrammaticHistory;
      if (cancelled) {
        ok(context.getHTML() === this.beforeMove, 'cancelled move preserves content');
        ok(history.inspect().undoEntries === this.historyCount, 'cancelled move preserves history');
        return;
      }
      ok(cells[0].textContent === '' && cells[1].textContent === 'left' && cells[2].textContent === 'middle', 'overlapping move contents');
      ok(cells[1].firstChild === this.movedNode, 'move retains formatting node identity');
      ok(tools.getSelectedTableCells().length === 2, 'destination remains selected');
      ok(history.inspect().undoEntries === this.historyCount+1, 'one undo entry per move');
      const after = context.getHTML();
      history.undo(); ok(context.getHTML() === this.beforeMove, 'move undo restores source and overwritten destination');
      history.redo(); ok(context.getHTML() === after, 'move redo restores destination');
    },
    async prepareText(source) {
      await this.prepare(source);
      const text = cells[1].firstChild;
      const point = offset => {
        const range = document.createRange(); range.setStart(text,offset); range.setEnd(text,offset+1);
        const rect = range.getBoundingClientRect(); return {x:rect.left+.5,y:rect.top+rect.height/2};
      };
      return {start:point(1),end:point(7)};
    },
    checkText() {
      ok(getSelection().toString().length > 2, 'ordinary drag selects text within cell');
      ok(!tools.getSelectedTableCells().length, 'text drag never selects cell objects');
      ok(cells[1].contains(getSelection().anchorNode) && cells[1].contains(getSelection().focusNode), 'text range stays within cell');
    },
    async checkToolbar() {
      const select = (await import('/ToolbarCallbacks/insert/tableSelectCell.mjs')).default;
      ok(select(), 'Select Cell toolbar callback succeeds');
      ok(tools.getSelectedTableCells().length === 1, 'toolbar selects one cell object');
    },
    checkAlt() {
      ok(tools.getSelectedTableCells().length === 1, 'Alt click selects one whole cell');
      ok(window.__nvHtmlTableSelectionMode === 'cells', 'Alt click sets cell mode');
    },
    checkArrow() {
      ok(tools.getSelectedTableCells()[0] === cells[2], 'arrow navigates from dragged group');
    }
  };
  window.navigationTest = {
    async prepare(index) {
      const test = window.navigationCases[index];
      context.setHTML('<!doctype html><html><body><p>before</p>' + (test.source === 'existing'
        ? '<table><tr><td>left</td><td>alpha beta</td><td>right</td></tr><tr><td>a</td><td>b</td><td>c</td></tr></table>' : '') + '<p>after</p></body></html>');
      context.activate(); root.focus();
      if (test.source === 'inserted') {
        getSelection().removeAllRanges();
        tools.insertTableAtCaret(2,3);
      }
      table = root.querySelector('table'); cells = [...table.rows[0].cells];
      cell = cells[test.edge ?? 1];
      cell.innerHTML = test.nested ? '<b><i>alpha beta</i></b>' : 'alpha beta';
      node = test.nested ? cell.querySelector('i').firstChild : cell.firstChild;
      tools.clearTableCellSelection();
      const selection = getSelection(); selection.removeAllRanges();
      if (!test.object) {
        const range = document.createRange();
        range.setStart(node,test.start); range.setEnd(node,test.end); selection.addRange(range);
      }
      tools.setActiveTableCell(cell);
      await new Promise(resolve => setTimeout(resolve,30));
      if (test.object || test.stale) tools.setSelectedTableCells(test.multi ? cells.slice(0,2) : [cell], {activeCell:cell});
      before = context.getHTML(); historyCount = root.__nvProgrammaticHistory.inspect().undoEntries;
      prevented = false;
      root.addEventListener('keydown', event => { prevented = event.defaultPrevented; }, {once:true});
    },
    check(index) {
      const test = window.navigationCases[index], selection = getSelection();
      const label = test.source + ': ' + test.name;
      ok(root.querySelector('table') === table, label + ' preserves DOM');
      ok(context.getHTML() === before, label + ' preserves content');
      ok(root.__nvProgrammaticHistory.inspect().undoEntries === historyCount, label + ' preserves history');
      if (test.object) {
        ok(tools.getSelectedTableCells()[0] === cells[test.target], label + ' selects neighbor or stays at edge: ' + JSON.stringify({selected:tools.getSelectedTableCells().map(c=>c.cellIndex), mode:window.__nvHtmlTableSelectionMode, ranges:selection.rangeCount, prevented, active:window.__nvHtmlTableActiveCell?.cellIndex}));
        ok(window.__nvHtmlTableSelectionMode === 'cells', label + ' retains object selection');
      } else if (test.vertical) {
        ok(window.__nvHtmlTableActiveCell === table.rows[1].cells[1], label);
      } else {
        ok(!prevented, label + ' allows browser default');
        ok(!tools.getSelectedTableCells().length, label + ' never selects a cell object');
        if (test.expected !== undefined) {
          ok(selection.focusNode === node && selection.focusOffset === test.expected, label + ' caret position');
          ok(selection.anchorOffset === (test.anchor ?? test.expected), label + ' selection anchor');
        }
        if (test.word) ok(selection.focusNode === node && selection.focusOffset > 1, label + ' word movement');
      }
    }
  };
  document.getElementById('result').textContent = 'PASS: navigation fixture ready';
} catch (error) {
  document.getElementById('result').textContent = 'FAIL: ' + error.stack;
}
