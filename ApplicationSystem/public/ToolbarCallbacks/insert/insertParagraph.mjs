// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertParagraph.mjs
// This file defines browser-side insert Paragraph logic for the Nodevision UI. It renders interface components and handles user interactions.

export default function insertParagraph() {
  // Find the active HTML WYSIWYG editor
  const wysiwyg = document.querySelector("#wysiwyg[contenteditable='true']");

  if (!wysiwyg) {
    console.warn("insertParagraph: No active HTML WYSIWYG editor found.");
    return;
  }

  wysiwyg.focus();

  const sel = window.getSelection();
  if (!sel.rangeCount) {
    console.warn("insertParagraph: No selection range available.");
    return;
  }

  const range = sel.getRangeAt(0);
  const selectedText = range.toString();

  // Create <p> element
  const p = document.createElement("p");
  p.textContent = selectedText || "Paragraph";

  // Replace current selection
  range.deleteContents();
  range.insertNode(p);

  // Move cursor after the new <p>
  const spacer = document.createTextNode("\u00A0");
  p.after(spacer);
  sel.collapse(spacer, 1);
}
