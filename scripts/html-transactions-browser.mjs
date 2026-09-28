// Regression checks for the body transaction seam in real, retained HTML editors.
export async function checkHtmlTransactions({ context, container, renderEditor, ok }) {
  context.setHTML('<!doctype html><html><head><title>Transactions</title></head><body><p id="text">alpha</p><table><tbody><tr><td>A</td></tr></tbody></table></body></html>');
  const root = context.editorElement;
  const selection = context.selection;
  const history = root.__nvProgrammaticHistory;
  const events = [];
  const unsubscribe = context.transactions.subscribe(event => events.push(event));
  const range = document.createRange();
  range.setStart(root.querySelector('#text').firstChild, 2);
  range.collapse(true);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  selection.capture();
  const beforeRevision = context.revision;
  const beforeSource = context.getHTML();
  const control = document.createElement('button');
  document.body.append(control);
  control.focus();
  ok(selection.getElement().id === 'text' && selection.getRange().startOffset === 2, 'toolbar focus retains the owning caret and element');
  ok(context.revision === beforeRevision && !history.canUndo(), 'selection alone creates no revision/history');

  let transaction = context.transactions.begin('Preview');
  transaction.preview(() => root.querySelector('#text').style.color = 'red');
  let refused = false;
  try { context.getHTML(); } catch { refused = true; }
  ok(refused, 'save cannot persist an uncommitted preview');
  transaction.cancel();
  ok(context.getHTML() === beforeSource && !history.canUndo() && !events.length, 'cancel restores exact body without history or commit: ' + JSON.stringify({beforeSource, after: context.getHTML(), undo: history.canUndo(), events}));
  ok(selection.getRange().startOffset === 2, 'cancel restores caret after replacing the body');
  ok(!context.transactions.run('No change', () => {}) && !events.length, 'no-op transaction is silent');

  context.setInlineStyle(root.querySelector('#text'), 'color', 'red');
  ok(events.length === 1 && context.revision === beforeRevision + 1, 'one style edit commits one revision');
  ok(context.isDirty && history.canUndo(), 'style uses existing programmatic history');
  history.undo();
  ok(context.getHTML() === beforeSource, 'style undo restores authored source');
  history.redo();
  ok(root.querySelector('#text').style.color === 'red', 'style redo works');

  transaction = context.transactions.begin('Gesture');
  for (let i = 1; i <= 20; i++) transaction.preview(() => root.querySelector('#text').style.marginLeft = i + 'px');
  const eventCount = events.length;
  transaction.commit();
  ok(events.length === eventCount + 1, 'many previews publish one commit');
  history.undo();
  ok(!root.querySelector('#text').style.marginLeft && root.querySelector('#text').style.color === 'red', 'one undo reverts whole gesture');

  const { recordTableEditorMutation } = await import('/ToolbarCallbacks/insert/TableProgrammaticHistory.mjs');
  const beforeTable = root.innerHTML;
  root.querySelector('td').textContent = 'B';
  recordTableEditorMutation(root, beforeTable);
  history.undo();
  ok(root.querySelector('td').textContent === 'A', 'table bridge shares body history');
  context.activate();
  selection.selectElement(root.querySelector('#text'));
  window.HTMLWysiwygTools.insertTextAtSelection(' inserted ');
  ok(root.textContent.includes(' inserted '), 'insertion uses owning transaction');
  history.undo();
  ok(!root.textContent.includes(' inserted '), 'insertion undo uses same history');

  const staleRevision = context.revision;
  root.dispatchEvent(new Event('input', { bubbles: true }));
  refused = false;
  try { context.transactions.begin('Stale', staleRevision); } catch { refused = true; }
  ok(refused, 'stale revision is rejected');
  transaction = context.transactions.begin('Interrupted');
  root.querySelector('#text').textContent = 'new native input';
  root.dispatchEvent(new Event('input', { bubbles: true }));
  refused = false;
  try { transaction.cancel(); } catch { refused = true; }
  ok(refused && root.textContent.includes('new native input'), 'stale cancellation never overwrites newer input');

  const secondContainer = document.createElement('div');
  document.body.append(secondContainer);
  const cleanupSecond = await renderEditor('second.html', secondContainer);
  const second = secondContainer.__nvHtmlEditorContext;
  const secondSource = second.getHTML();
  ok(!second.selection.restore(selection.bookmark()), 'bookmarks reject another editor');
  context.setInlineStyle(root.querySelector('#text'), 'color', 'blue');
  ok(second.getHTML() === secondSource && !second.isDirty && !window.NodevisionState.fileIsDirty, 'pinned edit does not dirty or retarget another editor');
  context.activate();
  ok(window.HTMLWysiwygTools.getEditorElement() === root && window.NodevisionState.fileIsDirty, 'activation restores owning tools and dirty state');
  ok(window.setEditorHTML === context.setHTML, 'activation restores owning source replacement hook');
  second.activate();
  await context.save();
  ok(window.__nvActiveHtmlEditorContext === second && !second.isDirty, 'saving inactive editor retains active owner');
  cleanupSecond();
  refused = false;
  try { second.transactions.begin(); } catch { refused = true; }
  ok(refused && !second.selection.getRange(), 'disposed context rejects new edits and stale selection');
  context.activate();
  unsubscribe();
  control.remove();
  secondContainer.remove();
}
