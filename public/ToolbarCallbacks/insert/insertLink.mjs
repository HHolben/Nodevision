// Nodevision/public/ToolbarCallbacks/insert/insertLink.mjs
// This toolbar callback inserts an <a> hyperlink element into HTML editors
// with contentEditable areas.

export default function insertLink() {
  // Find the active HTML WYSIWYG editor
  const wysiwyg = document.querySelector("#wysiwyg[contenteditable='true']");

  if (!wysiwyg) {
    console.warn("insertLink: No active HTML WYSIWYG editor found.");
    return;
  }

  wysiwyg.focus();

  const sel = window.getSelection();
  if (!sel.rangeCount) {
    console.warn("insertLink: No selection range available.");
    return;
  }

  // Ask user for a URL
  const url = prompt("Enter the URL for the link:");
  if (!url) return; // User cancelled or left blank

  // Ask user for optional link text
  let linkText = prompt(
    "Enter the text for the link (leave blank to use selection):"
  );

  const range = sel.getRangeAt(0);
  const selectedText = range.toString();

  // Use selected text if user did not provide custom text
  if (!linkText) {
    linkText = selectedText || url;
  }

  // Create <a> element
  const a = document.createElement("a");
  a.href = url;
  a.textContent = linkText;

  // Replace current selection with the link
  range.deleteContents();
  range.insertNode(a);

  // Move cursor after the new link
  const spacer = document.createTextNode("\u00A0");
  a.after(spacer);
  sel.collapse(spacer, 1);
}
