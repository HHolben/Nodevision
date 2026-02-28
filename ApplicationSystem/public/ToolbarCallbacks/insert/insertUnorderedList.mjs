// Nodevision/public/ToolbarCallbacks/insert/insertUnorderedList.mjs
// Toolbar callback to insert an unordered list (<ul>) into the active editor panel

export default function insertUnorderedList() {
  const wysiwyg = document.querySelector("#wysiwyg[contenteditable='true']");

  if (!wysiwyg) {
    console.warn("insertUnorderedList: No active HTML WYSIWYG editor found.");
    return;
  }

  wysiwyg.focus();

  const sel = window.getSelection();
  if (!sel.rangeCount) {
    console.warn("insertUnorderedList: No selection range available.");
    return;
  }

  const range = sel.getRangeAt(0);
  const selectedText = range.toString().trim();

  // Create list structure
  const ul = document.createElement("ul");
  const li = document.createElement("li");

  li.textContent = selectedText || "List item";
  ul.appendChild(li);

  // Replace selection with list
  range.deleteContents();
  range.insertNode(ul);

  // Move cursor inside <li>
  sel.removeAllRanges();
  const newRange = document.createRange();
  newRange.selectNodeContents(li);
  newRange.collapse(false);
  sel.addRange(newRange);
}
