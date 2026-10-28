// Nodevision/scripts/structure-browser.mjs
// Exercises editable structures, scoped selection, history, serialization and reopening.
const checks = [];
const ok = (value, label) => { if (!value) throw Error(label); checks.push(label); };
try {
  window.NodevisionState = {};
  const fetchOriginal = window.fetch.bind(window);
  let source = '<!doctype html><html><head><title>Structures</title></head><body><p>Public <b>private note</b> after</p></body></html>';
  window.fetch = (url, options) => String(url) === '/Notebook/Pages/structures.html' ? Promise.resolve(new Response(source)) : fetchOriginal(url, options);
  const { renderEditor } = await import('/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditor.mjs');
  const { default: sensitive } = await import('/ToolbarCallbacks/insert/insertSensitive.mjs');
  const { default: collapsible } = await import('/ToolbarCallbacks/insert/insertCollapsible.mjs');
  const toolbar = await (await fetch('/ToolbarJSONfiles/insertToolbar.json')).json();
  ok(toolbar.some(item => item.heading === 'Structure' && item.parentHeading === 'Insert' && item.preventDropdown && item.modes.includes('HTMLediting')), 'Insert opens Structure subtoolbar in HTML mode');
  for (const key of ['insertSensitive', 'InsertCollapsible']) ok(toolbar.some(item => item.callbackKey === key && item.parentHeading === 'Structure' && item.modes.includes('HTMLediting')), key + ' belongs to Structure');
  const cell = document.getElementById('editor');
  cell.className = 'panel-cell'; cell.dataset.id = 'GraphicalEditor'; window.activeCell = cell;
  let cleanup = await renderEditor('Pages/structures.html', cell);
  let context = cell.__nvHtmlEditorContext, root = context.getEditorElement();
  const other = document.createElement('div'); other.id = 'wysiwyg'; other.contentEditable = 'true'; other.textContent = 'Other editor'; document.body.prepend(other);
  function select(node) {
    context.activate(); root.focus();
    const range = document.createRange(); range.selectNode(node);
    getSelection().removeAllRanges(); getSelection().addRange(range); context.selection.capture();
    getSelection().removeAllRanges(); // Toolbar focus must retain the owning editor's range.
  }
  select(root.querySelector('b'));
  ok(sensitive(), 'Insert sensitive selection');
  ok(root.querySelector('.nodevision-sensitive b')?.textContent === 'private note', 'Selected rich text preserved');
  ok(other.textContent === 'Other editor', 'Inactive editor untouched');
  ok(getComputedStyle(root.querySelector('.nodevision-sensitive')).display !== 'none', 'Sensitive content visible on screen');
  root.__nvProgrammaticHistory.undo();
  ok(!root.querySelector('.nodevision-sensitive') && !root.querySelector('style[data-nodevision-sensitive-print-style]'), 'Undo removes field and print rule together');
  root.__nvProgrammaticHistory.redo();
  ok(root.querySelector('.nodevision-sensitive b'), 'Redo restores sensitive rich content');
  select(root.querySelector('.nodevision-sensitive'));
  ok(collapsible(), 'Insert collapsible around content');
  ok(root.querySelector('details[open] > div .nodevision-sensitive'), 'Collapsible starts expanded with editable content');
  root.__nvProgrammaticHistory.undo();
  ok(!root.querySelector('details') && root.querySelector('.nodevision-sensitive'), 'Undo collapsible preserves sensitive field');
  root.__nvProgrammaticHistory.redo();
  ok(root.querySelector('details'), 'Redo restores collapsible');
  root.querySelector('summary').click();
  ok(!root.querySelector('details').open, 'Summary collapses container');
  root.querySelector('summary').click();
  ok(root.querySelector('details').open, 'Summary expands container');
  source = context.getHTML();
  ok(source.includes('@media print') && source.includes('<details') && source.includes('<summary>'), 'Serialized document retains print rule and native collapsible');
  cleanup?.(); cell.replaceChildren();
  cleanup = await renderEditor('Pages/structures.html', cell);
  context = cell.__nvHtmlEditorContext; root = context.getEditorElement();
  ok(root.querySelector('details .nodevision-sensitive b')?.textContent === 'private note', 'Reopened document retains nested structure and formatted notes');
  root.querySelector('summary').click();
  ok(!root.querySelector('details').open, 'Reopened collapsible remains interactive');
  root.querySelector('summary').click();
  window.structureResult = { checks };
} catch (error) { window.structureResult = { error: error.stack, checks }; }
