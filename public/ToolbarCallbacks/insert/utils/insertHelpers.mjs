// Utility functions for inserting text or elements into editors
// Supports both <textarea> and contentEditable editors

/**
 * Insert text or tags into a <textarea> or <input type="text">
 * @param {HTMLTextAreaElement|HTMLInputElement} el
 * @param {string} startTag
 * @param {string} endTag
 */
export function insertIntoTextarea(el, startTag, endTag) {
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const value = el.value;

  el.value =
    value.slice(0, start) +
    startTag +
    value.slice(start, end) +
    endTag +
    value.slice(end);

  const newPos = end + startTag.length + endTag.length;
  el.setSelectionRange(newPos, newPos);
  el.focus();
}

/**
 * Insert a block element (like <h1>) or inline tags into contentEditable editor
 * @param {HTMLElement} el - the contentEditable element
 * @param {string} tagName - block-level element tagName (e.g., 'h1', 'h2', 'p')
 * @param {string} defaultText - text to insert if nothing is selected
 */
export function insertIntoContentEditable(el, tagName = "h1", defaultText = "Heading") {
  el.focus();

  const sel = window.getSelection();
  if (!sel.rangeCount) return;

  const range = sel.getRangeAt(0);
  const selectedText = range.toString() || defaultText;

  const node = document.createElement(tagName);
  node.textContent = selectedText;

  range.deleteContents();
  range.insertNode(node);

  // Place cursor after the inserted node
  const after = document.createTextNode("\u00A0"); // space so caret can move
  node.after(after);
  sel.collapse(after, 1);
}

/**
 * Convenience function: insert <h1> or other block element depending on selection
 */
export function insertBlock(el, tagName = "h1") {
  if (!el) return;
  if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
    insertIntoTextarea(el, `<${tagName}>`, `</${tagName}>`);
  } else if (el.isContentEditable) {
    insertIntoContentEditable(el, tagName);
  } else {
    console.warn("insertBlock: Unsupported editor element", el);
  }
}
