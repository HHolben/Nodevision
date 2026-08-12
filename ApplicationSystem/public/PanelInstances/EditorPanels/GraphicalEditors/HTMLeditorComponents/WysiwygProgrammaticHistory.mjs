// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/WysiwygProgrammaticHistory.mjs
// This module provides a compact undo fallback for programmatic HTML editor changes so toolbar insertions remain reversible even when the browser does not place scripted contenteditable mutations on its native undo stack.

const DEFAULT_MAX_ENTRIES = 25;

function readHtml(root) {
  return root ? String(root.innerHTML || "") : "";
}

function dispatchEditorInput(root) {
  try {
    root?.dispatchEvent?.(new Event("input", { bubbles: true }));
  } catch {
    // Older browsers may not support Event options.
  }
}

function trimStack(stack, maxEntries) {
  while (stack.length > maxEntries) stack.shift();
}

function pushDistinct(stack, html, maxEntries) {
  if (!stack.length || stack[stack.length - 1] !== html) {
    stack.push(html);
    trimStack(stack, maxEntries);
  }
}

export function insertHtmlFragmentAtRange(root, html, range) {
  if (!root || !range) return false;
  const template = document.createElement("template");
  template.innerHTML = String(html || "");
  const fragment = template.content;
  const lastNode = fragment.lastChild;
  if (!lastNode) return false;

  range.deleteContents();
  range.insertNode(fragment);
  const nextRange = document.createRange();
  nextRange.setStartAfter(lastNode);
  nextRange.setEndAfter(lastNode);
  const selection = window.getSelection?.();
  if (selection) {
    selection.removeAllRanges();
    selection.addRange(nextRange);
  }
  root.focus?.();
  return true;
}

export function createWysiwygProgrammaticHistory(root, options = {}) {
  const maxEntries = Number.isFinite(options.maxEntries)
    ? Math.max(1, options.maxEntries)
    : DEFAULT_MAX_ENTRIES;
  const onRestore = typeof options.onRestore === "function" ? options.onRestore : null;
  const undoStack = [];
  const redoStack = [];

  const restore = (html, direction) => {
    if (!root) return false;
    root.innerHTML = String(html || "");
    onRestore?.({ direction, html: readHtml(root) });
    dispatchEditorInput(root);
    root.focus?.();
    return true;
  };

  return {
    record(beforeHtml) {
      if (!root) return false;
      const before = String(beforeHtml || "");
      if (before === readHtml(root)) return false;
      pushDistinct(undoStack, before, maxEntries);
      redoStack.length = 0;
      return true;
    },

    undo() {
      if (!undoStack.length) return false;
      const current = readHtml(root);
      const previous = undoStack.pop();
      pushDistinct(redoStack, current, maxEntries);
      return restore(previous, "undo");
    },

    redo() {
      if (!redoStack.length) return false;
      const current = readHtml(root);
      const next = redoStack.pop();
      pushDistinct(undoStack, current, maxEntries);
      return restore(next, "redo");
    },

    noteNativeUndo(beforeHtml) {
      const current = readHtml(root);
      if (current === beforeHtml) return false;
      if (undoStack[undoStack.length - 1] === current) {
        undoStack.pop();
        pushDistinct(redoStack, beforeHtml, maxEntries);
      }
      return true;
    },

    noteNativeRedo(beforeHtml) {
      const current = readHtml(root);
      if (current === beforeHtml) return false;
      if (redoStack[redoStack.length - 1] === current) {
        redoStack.pop();
        pushDistinct(undoStack, beforeHtml, maxEntries);
      }
      return true;
    },

    canUndo() {
      return undoStack.length > 0;
    },

    canRedo() {
      return redoStack.length > 0;
    },

    clear() {
      undoStack.length = 0;
      redoStack.length = 0;
    },
  };
}
