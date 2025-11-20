//Nodevision/public/ToolbarCallbacks/insert/insertH1.mjs
//This is a a toolbar callback which can be used by text editors (such as the graphical html editor) to insert <h1> tags in editor panels

export default function insertH1() {

  // Try to locate an active editor panel
  const panel = document.querySelector(
    ".editor-panel.active, .active-editor, [data-editor-active='true'], #editor-root"
  );
  if (!panel) {
    console.warn("insertH1: No active editor panel found.");
    return;
  }

  // ---- TEXTAREA SUPPORT ----
  const textarea = panel.querySelector("textarea");
  if (textarea) {
    return insertIntoTextarea(textarea, "<h1>h1</h1>");
  }

  // ---- CONTENTEDITABLE SUPPORT ----
  const editable = panel.querySelector("[contenteditable='true']");
  if (editable) {
    return insertIntoContentEditable(editable, "<h1>", "</h1>");
  }

  console.warn("insertH1: No supported editor found inside active panel.");
}

/* ------------------------------------------------------------------ */
/* TEXTAREA EDITORS */
/* ------------------------------------------------------------------ */

function insertIntoTextarea(el, startTag, endTag) {
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

/* ------------------------------------------------------------------ */
/* CONTENTEDITABLE EDITORS (HTMLeditor) */
/* ------------------------------------------------------------------ */

function insertIntoContentEditable(el, startTag, endTag) {
  el.focus();

  const sel = window.getSelection();
  if (!sel.rangeCount) return;

  const range = sel.getRangeAt(0);
  const selectedText = range.toString();

  // Create an <h1> element directly
  const h1 = document.createElement("h1");
  h1.innerHTML = selectedText || "Heading";

  // Insert into range
  range.deleteContents();
  range.insertNode(h1);

  // Move cursor after the new H1
  const after = document.createTextNode("\u00A0"); // Add a space so caret can move after
  h1.after(after);
  sel.collapse(after, 1);
}

