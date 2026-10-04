// Exercise the real graphical HTML entry point and save hook against semantic fixtures.
import { sourceFixture, documentSignature } from './html-source-fixtures.mjs';
import { checkHtmlTransactions } from './html-transactions-browser.mjs';
import { auditPreservation } from './html-preservation-audit.mjs';
import { auditResources } from './html-resource-audit.mjs';
const output = document.getElementById('result');
const ok = (value, message) => { if (!value) throw new Error(message); };
const errors = [];
window.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
try {
  window.NodevisionState = {};
  const nativeFetch = window.fetch.bind(window);
  const saves = [];
  window.fetch = async (url, options = {}) => {
    const path = String(url);
    if (path.startsWith('/Notebook/')) return new Response(sourceFixture);
    if (path === '/api/save') {
      saves.push(JSON.parse(options.body));
      return Response.json({ success: true });
    }
    if (path.includes('recent') || path.includes('Recent')) return Response.json({ entries: [] });
    return nativeFetch(url, options);
  };
  const { renderEditor } = await import('/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditor.mjs');
  const container = document.getElementById('editor');
  const cleanup = await renderEditor('source.html', container);
  const context = container.__nvHtmlEditorContext;
  ok(context, 'active HTML context was mounted');
  const actual = context.getHTML();
  ok(documentSignature(actual) === documentSignature(sourceFixture), 'no-op preserves the complete parsed document semantics');
  ok(!window.__authoredScriptExecuted, 'authored scripts stay inert in editor');
  ok(!document.querySelector('base'), 'authored base does not retarget application URLs');
  const root = context.getEditorElement();
  root.querySelector('#editable').firstChild.textContent = 'changed ';
  const expected = sourceFixture.replace('alpha ', 'changed ');
  ok(documentSignature(context.getHTML()) === documentSignature(expected), 'one text edit retains all unrelated source semantics');
  await context.save();
  ok(saves.length === 1 && saves[0].path === 'source.html' && saves[0].sourcePath === 'source.html', 'save uses owning file');
  ok(documentSignature(saves[0].content) === documentSignature(expected), 'save request retains source semantics');
  await auditPreservation(context, ok);
  await auditResources(context, renderEditor, ok);
  await checkHtmlTransactions({ context, container, renderEditor, ok });
  cleanup?.();
  ok(!errors.length, errors.join('\n'));
  output.textContent = 'PASS: HTML source preservation, active save, selection, transactions, and retained editors';
} catch (error) {
  output.textContent = 'FAIL: ' + error.stack;
}
