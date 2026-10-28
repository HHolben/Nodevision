// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/structureInsertTools.mjs
// Inserts editable structures into the active HTML document as one undoable change.
export function insertStructure(kind) {
  const root = window.HTMLWysiwygTools?.getEditorElement?.() ||
    window.__nvActiveHtmlEditorContext?.getEditorElement?.();
  if (!root?.isConnected || !root.__nvHtmlTransactions) return false;
  const doc = root.ownerDocument;
  const selection = root.__nvHtmlSelection;
  selection.capture();
  const range = selection.getRange() || doc.createRange();
  if (!root.contains(range.commonAncestorContainer)) {
    range.selectNodeContents(root);
    range.collapse(false);
  }
  return root.__nvHtmlTransactions.run(`Insert ${kind}`, () => {
    // Clone before deleting so removed nodes remain detached for history replay.
    const content = range.cloneContents();
    range.deleteContents();
    const blockContent = content.querySelector('p,div,section,details,ul,ol,table,blockquote,h1,h2,h3');
    const element = doc.createElement(kind === 'sensitive' ? (blockContent ? 'div' : 'span') : 'details');
    let field = element;
    if (kind === 'sensitive') {
      element.className = 'nodevision-sensitive sensitive';
      element.dataset.nodevisionSensitive = 'true';
      element.title = 'Hidden when printed';
      element.style.cssText = 'border:1px solid #d49620;background:#fff4ce;color:#4f3500;padding:.12em .4em;';
      if (!root.querySelector('style[data-nodevision-sensitive-print-style]')) {
        const style = doc.createElement('style');
        style.dataset.nodevisionSensitivePrintStyle = 'true';
        style.textContent = '@media print { .nodevision-sensitive, .sensitive { display: none !important; } }';
        root.prepend(style);
      }
    } else {
      element.open = true;
      const summary = doc.createElement('summary');
      summary.textContent = 'Collapsible section';
      field = doc.createElement('div');
      element.append(summary, field);
    }
    if (content.hasChildNodes()) field.append(content);
    else field.textContent = kind === 'sensitive' ? 'Sensitive text' : 'Content goes here';
    range.insertNode(element);
    root.focus();
    const caret = doc.createRange();
    caret.selectNodeContents(field);
    const native = doc.getSelection();
    native.removeAllRanges();
    native.addRange(caret);
    selection.capture();
  });
}
