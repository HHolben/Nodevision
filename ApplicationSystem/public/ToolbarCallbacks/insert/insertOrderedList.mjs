// Nodevision/public/ToolbarCallbacks/insert/insertOrderedList.mjs
// Toolbar callback to insert an ordered list (<ol>) into the active editor panel

export default function insertOrderedList() {
  const wysiwyg = document.querySelector("#wysiwyg[contenteditable='true']");

  if (!wysiwyg) {
    console.warn("insertOrderedList: No active HTML WYSIWYG editor found.");
    return;
  }

  wysiwyg.focus();

  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) {
    console.warn("insertOrderedList: No selection range available.");
    return;
  }

  const range = sel.getRangeAt(0);

  // If we're already inside a list item, add a new <li> after it
  const startNode =
    range.startContainer.nodeType === Node.TEXT_NODE
      ? range.startContainer.parentNode
      : range.startContainer;

  const existingLi = startNode.closest?.("li");
  if (existingLi && existingLi.parentElement?.tagName === "OL") {
    const newLi = document.createElement("li");
    newLi.textContent = "List item";
    existingLi.after(newLi);

    // Move caret into new <li>
    sel.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(newLi);
    newRange.collapse(true);
    sel.addRange(newRange);
    return;
  }

  const selectedText = range.toString();

  // Create ordered list
  const ol = document.createElement("ol");

  const lines = selectedText
    ? selectedText.split(/\r?\n/).filter(l => l.trim())
    : ["List item"];

  for (const line of lines) {
    const li = document.createElement("li");
    li.textContent = line;
    ol.appendChild(li);
  }

  // Replace selection
  range.deleteContents();
  range.insertNode(ol);

  // Place caret at end of last list item
  const lastLi = ol.lastElementChild;
  sel.removeAllRanges();
  const newRange = document.createRange();
  newRange.selectNodeContents(lastLi);
  newRange.collapse(false);
  sel.addRange(newRange);
}
