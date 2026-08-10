// Nodevision/ApplicationSystem/public/Sessions/HTMLDraftFocusEditorLock.mjs
// This module enforces the locked drafting rules for the HTML Draft Focus Session while allowing highlight-first bold and strikethrough formatting.

const BLOCKED_KEYS = new Set([
  "Backspace",
  "Delete",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

function selectionWithin(editor) {
  const selection = window.getSelection?.();
  if (!selection?.rangeCount) return false;
  const range = selection.getRangeAt(0);
  return editor.contains(range.commonAncestorContainer);
}

export function moveCaretToEnd(editor) {
  editor.focus();
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

export function installHTMLDraftFocusLock(editor, options = {}) {
  const cleanup = [];
  const block = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const beforeInput = (event) => {
    const type = String(event.inputType || "");
    if (/delete|history|paste|drop|yank/i.test(type)) return block(event);
    if (/insertText|insertParagraph|insertLineBreak/i.test(type)) {
      if (!selectionWithin(editor)) moveCaretToEnd(editor);
      const selection = window.getSelection?.();
      if (selection?.rangeCount && !selection.getRangeAt(0).collapsed) moveCaretToEnd(editor);
    }
  };
  const keydown = (event) => {
    const key = event.key;
    const commandKey = event.ctrlKey || event.metaKey;
    if (BLOCKED_KEYS.has(key)) return block(event);
    if (commandKey && ["a", "c", "v", "x", "z", "y"].includes(String(key).toLowerCase())) return block(event);
    if (!commandKey && !event.altKey && (key.length === 1 || key === "Enter")) {
      const selection = window.getSelection?.();
      if (!selection?.rangeCount || !selection.getRangeAt(0).collapsed || !selectionWithin(editor)) {
        moveCaretToEnd(editor);
      }
    }
  };
  const add = (target, name, handler, capture = false) => {
    target.addEventListener(name, handler, capture);
    cleanup.push(() => target.removeEventListener(name, handler, capture));
  };
  add(editor, "beforeinput", beforeInput);
  add(editor, "keydown", keydown);
  add(editor, "paste", block);
  add(editor, "drop", block);
  add(document, "copy", block, true);
  add(document, "cut", block, true);
  add(document, "paste", block, true);
  add(document, "selectionchange", () => options.onSelectionChange?.());
  return () => cleanup.splice(0).forEach((fn) => fn());
}

export function applyFocusInlineCommand(editor, command) {
  if (!selectionWithin(editor)) return false;
  const selection = window.getSelection?.();
  if (!selection?.rangeCount || selection.getRangeAt(0).collapsed) return false;
  editor.focus();
  const ok = document.execCommand(command, false, null);
  moveCaretToEnd(editor);
  return ok;
}

