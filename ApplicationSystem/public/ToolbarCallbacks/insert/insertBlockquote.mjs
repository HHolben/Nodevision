// Nodevision/public/ToolbarCallbacks/insert/insertBlockquote.mjs
// Inserts a <blockquote> (optionally with a <cite>) into HTML editors.

export default function insertBlockquote() {
  // Locate active WYSIWYG editor
  const wysiwyg = document.querySelector("#wysiwyg[contenteditable='true']");

  if (!wysiwyg) {
    console.warn("insertBlockquote: No active HTML WYSIWYG editor found.");
    return;
  }

  wysiwyg.focus();

  const sel = window.getSelection();
  if (!sel.rangeCount) {
    console.warn("insertBlockquote: No selection range available.");
    return;
  }

  const range = sel.getRangeAt(0);
  const selectedText = range.toString() || "Blockquote";

  // Ask user whether to include a citation
  const citation = prompt(
    "Optional: Enter a citation (author, source, etc.). Leave blank for no citation:"
  );

  // Build the <blockquote>
  const blockquote = document.createElement("blockquote");
  blockquote.textContent = selectedText;

  // Add <cite> only if user typed something
  if (citation && citation.trim() !== "") {
    const citeEl = document.createElement("cite");
    citeEl.textContent = citation.trim();
    blockquote.appendChild(document.createElement("br"));
    blockquote.appendChild(citeEl);
  }

  // Replace selection with the new blockquote
  range.deleteContents();
  range.insertNode(blockquote);

  // Add space after blockquote to place cursor
  const spacer = document.createTextNode("\u00A0");
  blockquote.after(spacer);
  sel.collapse(spacer, 1);
}
