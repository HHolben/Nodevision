// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/handwritingToText.mjs
// This file opens the Handwriting OCR panel and inserts recognized text into the active editor so that handwritten input can be converted into editable content.

function findActiveEditorElement() {
  const panel = document.querySelector(
    ".editor-panel.active, .active-editor, [data-editor-active='true'], #editor-root"
  );

  const pickFromRoot = (root) => {
    if (!root || !root.querySelector) return null;
    const textarea = root.querySelector("textarea, input[type='text']");
    const editable = root.querySelector("[contenteditable='true']");
    return textarea || editable || null;
  };

  // Prefer the active editor panel to avoid grabbing incidental inputs (e.g., floating panels).
  const fromPanel = pickFromRoot(panel);
  if (fromPanel) return fromPanel;

  // HTML editor convention.
  const wysiwyg = document.querySelector("#wysiwyg[contenteditable='true']");
  if (wysiwyg) return wysiwyg;

  // Last-resort: look inside any editor panel (but never the whole document).
  const anyPanel = document.querySelector(".editor-panel, #editor-root");
  return pickFromRoot(anyPanel);
}

function isRangeInside(el, range) {
  if (!el || !range) return false;
  const start = range.startContainer;
  const end = range.endContainer;
  return (start instanceof Node && el.contains(start)) && (end instanceof Node && el.contains(end));
}

function captureSelection(editorEl) {
  if (!editorEl) return { editorEl: null, textareaSel: null, contentRange: null };

  if (editorEl.tagName === "TEXTAREA" || editorEl.tagName === "INPUT") {
    const start = Number.isFinite(editorEl.selectionStart) ? editorEl.selectionStart : null;
    const end = Number.isFinite(editorEl.selectionEnd) ? editorEl.selectionEnd : null;
    return {
      editorEl,
      textareaSel: (start === null || end === null) ? null : { start, end },
      contentRange: null,
    };
  }

  if (editorEl.isContentEditable) {
    const sel = window.getSelection?.();
    const range = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    return {
      editorEl,
      textareaSel: null,
      contentRange: isRangeInside(editorEl, range) ? range : null,
    };
  }

  return { editorEl: null, textareaSel: null, contentRange: null };
}

function insertTextIntoEditor(target, text, snapshot) {
  const editorEl = (snapshot?.editorEl && snapshot.editorEl.isConnected) ? snapshot.editorEl : target;
  if (!editorEl) return false;

  const t = String(text ?? "");
  if (!t) return true;

  if (editorEl.tagName === "TEXTAREA" || editorEl.tagName === "INPUT") {
    editorEl.focus();
    const selStart = Number.isFinite(editorEl.selectionStart) ? editorEl.selectionStart : null;
    const selEnd = Number.isFinite(editorEl.selectionEnd) ? editorEl.selectionEnd : null;
    const start = (selStart !== null && selEnd !== null) ? selStart : snapshot?.textareaSel?.start;
    const end = (selStart !== null && selEnd !== null) ? selEnd : snapshot?.textareaSel?.end;
    const s = Number.isFinite(start) ? start : editorEl.value.length;
    const e = Number.isFinite(end) ? end : editorEl.value.length;

    editorEl.value = editorEl.value.slice(0, s) + t + editorEl.value.slice(e);
    const pos = s + t.length;
    editorEl.setSelectionRange(pos, pos);
    editorEl.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  if (editorEl.isContentEditable) {
    editorEl.focus();

    const sel = window.getSelection?.();
    const current = (sel && sel.rangeCount) ? sel.getRangeAt(0) : null;
    const range = isRangeInside(editorEl, current)
      ? current
      : (snapshot?.contentRange && isRangeInside(editorEl, snapshot.contentRange) ? snapshot.contentRange : null);

    if (sel && range) {
      try {
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (_) {
        // ignore
      }
    }

    try {
      document.execCommand?.("insertText", false, t);
      return true;
    } catch (_) {
      // Fallback: insert as a text node at current selection
      const activeSel = window.getSelection?.();
      if (!activeSel || !activeSel.rangeCount) return false;
      const r = activeSel.getRangeAt(0);
      r.deleteContents();
      const node = document.createTextNode(t);
      r.insertNode(node);
      r.setStartAfter(node);
      r.setEndAfter(node);
      activeSel.removeAllRanges();
      activeSel.addRange(r);
      return true;
    }
  }

  return false;
}

export default async function handwritingToText() {
  const editorEl = findActiveEditorElement();
  const snapshot = captureSelection(editorEl);

  try {
    const mod = await import("/PanelInstances/InfoPanels/HandwritingOcrPanel.mjs");
    const open = mod?.openHandwritingOcrPanel;
    if (typeof open !== "function") {
      console.warn("handwritingToText: HandwritingOcrPanel did not export openHandwritingOcrPanel.");
      return;
    }

    open({
      onInsertText: (text) => {
        const inserted = insertTextIntoEditor(findActiveEditorElement(), text, snapshot);
        if (!inserted) {
          console.warn("handwritingToText: No supported editor found to insert text.");
        }
      },
    });
  } catch (err) {
    console.warn("handwritingToText: Failed to load HandwritingOcrPanel:", err);
    alert(`Failed to open Handwriting → Text panel: ${err?.message || err}`);
  }
}
