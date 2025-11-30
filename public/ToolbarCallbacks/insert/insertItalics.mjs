// Nodevision/public/ToolbarCallbacks/insert/insertItalics.mjs
// This toolbar callback inserts an <i> element into HTML editors with contentEditable areas.

export default function insertItalics() {
  // Find the active HTML WYSIWYG editor
  const wysiwyg = document.querySelector("#wysiwyg[contenteditable='true']");

  if (!wysiwyg) {
    console.warn("insertItalics: No active HTML WYSIWYG editor found.");
    return;
  }

  wysiwyg.focus();

  const sel = window.getSelection();
  if (!sel.rangeCount) {
    console.warn("insertItalics: No selection range available.");
    return;
  }

  const range = sel.getRangeAt(0);
  const selectedText = range.toString();

  // Create <p> element
  const p = document.createElement("i");
  p.textContent = selectedText || "Italics";

  // Replace current selection
  range.deleteContents();
  range.insertNode(p);

  // Move cursor after the new <p>
  const spacer = document.createTextNode("\u00A0");
  p.after(spacer);
  sel.collapse(spacer, 1);
}
