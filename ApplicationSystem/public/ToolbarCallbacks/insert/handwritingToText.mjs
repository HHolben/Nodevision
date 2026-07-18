// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/handwritingToText.mjs
// Opens the handwriting OCR control panel and streams recognized text into the active editor.

import {
  ensureHandwritingOcrModeLayout,
} from "/panels/workspace.mjs";

const PANEL_ID = "HandwritingOcrPanel";

function findActiveEditorElement() {
  const htmlEditor = window.HTMLWysiwygTools?.getEditorElement?.();
  if (htmlEditor?.isContentEditable && htmlEditor.isConnected) return htmlEditor;

  const panel = document.querySelector(
    ".editor-panel.active, .active-editor, [data-editor-active=true], #editor-root"
  );

  const pickFromRoot = (root) => {
    if (!root || !root.querySelector) return null;
    const textarea = root.querySelector("textarea, input[type=text]");
    const editable = root.querySelector("[contenteditable=true]");
    return textarea || editable || null;
  };

  const fromPanel = pickFromRoot(panel);
  if (fromPanel) return fromPanel;

  const wysiwyg = document.querySelector("#wysiwyg[contenteditable=true]");
  if (wysiwyg) return wysiwyg;

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
  if (editorEl && (editorEl.tagName === "TEXTAREA" || editorEl.tagName === "INPUT")) {
    const start = Number.isFinite(editorEl.selectionStart) ? editorEl.selectionStart : editorEl.value.length;
    const end = Number.isFinite(editorEl.selectionEnd) ? editorEl.selectionEnd : start;
    return { editorEl, textareaSel: { start, end }, contentRange: null, monaco: null };
  }

  if (editorEl?.isContentEditable) {
    const htmlTools = window.HTMLWysiwygTools || null;
    if (htmlTools?.getEditorElement?.() === editorEl && editorEl.isConnected) htmlTools.restoreSavedSelection?.();
    const sel = window.getSelection?.();
    const range = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    return {
      editorEl,
      textareaSel: null,
      contentRange: isRangeInside(editorEl, range) ? range : null,
      monaco: null,
      htmlTools: htmlTools?.getEditorElement?.() === editorEl ? htmlTools : null,
    };
  }

  const monacoEditor = window.monacoEditor;
  if (monacoEditor?.getModel && monacoEditor?.getSelection) {
    return {
      editorEl: null,
      textareaSel: null,
      contentRange: null,
      monaco: { editor: monacoEditor, range: monacoEditor.getSelection() },
    };
  }

  return { editorEl: null, textareaSel: null, contentRange: null, monaco: null };
}

function dispatchInput(el) {
  el?.dispatchEvent?.(new Event("input", { bubbles: true }));
}

function moveCaretAfterNode(node) {
  const sel = window.getSelection?.();
  if (!sel || !node?.parentNode) return;
  const range = document.createRange();
  range.setStartAfter(node);
  range.setEndAfter(node);
  sel.removeAllRanges();
  sel.addRange(range);
}

function insertionRangeForEditable(editorEl, snapshot) {
  const sel = window.getSelection?.();
  const current = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
  if (isRangeInside(editorEl, current)) return current.cloneRange();
  if (snapshot?.contentRange && isRangeInside(editorEl, snapshot.contentRange)) {
    return snapshot.contentRange.cloneRange();
  }
  const range = document.createRange();
  range.selectNodeContents(editorEl);
  range.collapse(false);
  return range;
}

function applyMonacoLive(monacoState, text) {
  const editor = monacoState?.editor;
  const model = editor?.getModel?.();
  const monacoApi = window.monaco;
  if (!editor || !model || !monacoApi?.Range) return false;

  const t = String(text ?? "");
  const range = monacoState.range || editor.getSelection();
  const start = range.getStartPosition?.() || {
    lineNumber: range.startLineNumber,
    column: range.startColumn,
  };

  editor.executeEdits("handwriting-ocr", [{ range, text: t, forceMoveMarkers: true }]);
  const end = model.getPositionAt(model.getOffsetAt(start) + t.length);
  monacoState.range = new monacoApi.Range(start.lineNumber, start.column, end.lineNumber, end.column);

  if (monacoApi.Selection && editor.setSelection) {
    editor.setSelection(new monacoApi.Selection(end.lineNumber, end.column, end.lineNumber, end.column));
  } else {
    editor.setPosition?.(end);
  }
  return true;
}

function createLiveTextSink(snapshot) {
  const editorEl = snapshot?.editorEl || null;
  const htmlTools = snapshot?.htmlTools || null;
  let liveText = "";
  let liveNode = null;
  let textStart = snapshot?.textareaSel?.start ?? null;

  function monacoStartPosition(monacoState) {
    const range = monacoState?.range || monacoState?.editor?.getSelection?.();
    if (!range) return null;
    return range.getStartPosition?.() || {
      lineNumber: range.startLineNumber,
      column: range.startColumn,
    };
  }

  function syncMonacoText(monacoState, text) {
    const editor = monacoState?.editor;
    const model = editor?.getModel?.();
    const monacoApi = window.monaco;
    const start = monacoStartPosition(monacoState);
    if (!editor || !model || !monacoApi?.Range || !start) return false;
    const t = String(text ?? "");
    const end = model.getPositionAt(model.getOffsetAt(start) + t.length);
    monacoState.range = new monacoApi.Range(start.lineNumber, start.column, end.lineNumber, end.column);
    liveText = t;
    return true;
  }

  function getMonacoText(monacoState) {
    const editor = monacoState?.editor;
    const model = editor?.getModel?.();
    const start = monacoStartPosition(monacoState);
    if (!editor || !model || !start) return liveText;
    const startOffset = model.getOffsetAt(start);
    const selection = editor.getSelection?.();
    const selectionStart = selection?.getStartPosition?.() || (selection ? {
      lineNumber: selection.startLineNumber,
      column: selection.startColumn,
    } : null);
    const selectionOffset = selectionStart ? model.getOffsetAt(selectionStart) : null;
    const fallbackEnd = startOffset + liveText.length;
    const endOffset = Number.isFinite(selectionOffset) && selectionOffset > startOffset
      ? selectionOffset
      : fallbackEnd;
    return model.getValue().slice(startOffset, Math.max(startOffset, endOffset));
  }


  function editableTextBeforeRange(range) {
    if (!editorEl?.isContentEditable || !range) return "";
    try {
      const before = document.createRange();
      before.selectNodeContents(editorEl);
      before.setEnd(range.startContainer, range.startOffset);
      return before.toString();
    } catch (_) {
      return "";
    }
  }

  function getContext() {
    if (editorEl && (editorEl.tagName === "TEXTAREA" || editorEl.tagName === "INPUT")) {
      const start = Number.isFinite(textStart) ? textStart : editorEl.value.length;
      return {
        before: editorEl.value.slice(0, Math.max(0, start)),
        current: liveText,
        after: editorEl.value.slice(Math.max(0, start + liveText.length)),
      };
    }

    if (editorEl?.isContentEditable) {
      if (liveNode?.parentNode) {
        try {
          const range = document.createRange();
          range.selectNodeContents(editorEl);
          range.setEndBefore(liveNode);
          return { before: range.toString(), current: liveText, after: "" };
        } catch (_) {
          return { before: "", current: liveText, after: "" };
        }
      }
      const sel = window.getSelection?.();
      const current = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
      const range = isRangeInside(editorEl, current) ? current : snapshot?.contentRange;
      return { before: editableTextBeforeRange(range), current: liveText, after: "" };
    }

    if (snapshot?.monaco) {
      const editor = snapshot.monaco.editor;
      const model = editor?.getModel?.();
      const start = monacoStartPosition(snapshot.monaco);
      if (model && start) {
        return { before: model.getValue().slice(0, model.getOffsetAt(start)), current: liveText, after: "" };
      }
    }

    return { before: "", current: liveText, after: "" };
  }

  function getText() {
    if (editorEl && (editorEl.tagName === "TEXTAREA" || editorEl.tagName === "INPUT")) {
      const start = Number.isFinite(textStart) ? textStart : 0;
      const selectionStart = Number.isFinite(editorEl.selectionStart) ? editorEl.selectionStart : null;
      const selectionEnd = Number.isFinite(editorEl.selectionEnd) ? editorEl.selectionEnd : null;
      if (selectionStart !== null && selectionEnd !== null && selectionEnd > selectionStart) {
        return editorEl.value.slice(selectionStart, selectionEnd);
      }
      const fallbackEnd = start + liveText.length;
      const end = selectionStart !== null && selectionStart > start ? selectionStart : fallbackEnd;
      return editorEl.value.slice(start, Math.max(start, Math.min(editorEl.value.length, end)));
    }

    if (editorEl?.isContentEditable) {
      if (liveNode?.parentNode) return liveNode.nodeValue || "";
      const sel = window.getSelection?.();
      if (sel && sel.rangeCount) {
        const range = sel.getRangeAt(0);
        if (!range.collapsed && isRangeInside(editorEl, range)) return sel.toString();
      }
      return liveText;
    }

    if (snapshot?.monaco) return getMonacoText(snapshot.monaco);
    return liveText;
  }

  function syncText(text) {
    const t = String(text ?? "");
    liveText = t;
    if (snapshot?.monaco) syncMonacoText(snapshot.monaco, t);
    if (editorEl?.isContentEditable && liveNode?.parentNode && liveNode.nodeValue !== t) {
      liveNode.nodeValue = t;
      dispatchInput(editorEl);
    }
    return true;
  }

  function acceptCorrection(text) {
    const t = String(text ?? "");
    const current = getText();
    if (current !== t) return apply(t);
    return syncText(t);
  }


  function apply(text, options = {}) {
    const t = String(text ?? "");
    const shouldFocus = options.focus !== false;

    if (editorEl && (editorEl.tagName === "TEXTAREA" || editorEl.tagName === "INPUT")) {
      const start = Number.isFinite(textStart) ? textStart : editorEl.value.length;
      const end = start + liveText.length;
      if (shouldFocus) editorEl.focus();
      editorEl.value = editorEl.value.slice(0, start) + t + editorEl.value.slice(end);
      liveText = t;
      const pos = start + t.length;
      if (shouldFocus) editorEl.setSelectionRange?.(pos, pos);
      dispatchInput(editorEl);
      return true;
    }

    if (editorEl?.isContentEditable) {
      if (shouldFocus) editorEl.focus();
      if (liveNode?.parentNode) {
        if (!t) {
          const parent = liveNode.parentNode;
          liveNode.remove();
          liveNode = null;
          liveText = "";
          dispatchInput(parent.closest?.("[contenteditable=true]") || editorEl);
          return true;
        }
        liveNode.nodeValue = t;
        liveText = t;
        if (shouldFocus) moveCaretAfterNode(liveNode);
        dispatchInput(editorEl);
        return true;
      }

      if (!t) return true;
      if (shouldFocus && htmlTools?.getEditorElement?.() === editorEl && editorEl.isConnected) htmlTools.restoreSavedSelection?.();
      const range = insertionRangeForEditable(editorEl, snapshot);
      range.deleteContents();
      liveNode = document.createTextNode(t);
      range.insertNode(liveNode);
      liveText = t;
      if (shouldFocus) moveCaretAfterNode(liveNode);
      dispatchInput(editorEl);
      return true;
    }

    if (snapshot?.monaco) {
      const ok = applyMonacoLive(snapshot.monaco, t);
      if (ok) liveText = t;
      return ok;
    }

    return false;
  }

  return { apply, getText, getContext, syncText, acceptCorrection };
}

async function removeLegacyHandwritingPanelRows() {
  const cleanups = [];
  document.querySelectorAll(".panel-row--handwriting-control").forEach((row) => {
    row.querySelectorAll(".panel-cell").forEach((cell) => {
      if (typeof cell.cleanup === "function") {
        try {
          const result = cell.cleanup();
          if (result?.then) cleanups.push(result.catch((err) => console.warn("Handwriting panel cleanup failed:", err)));
        } catch (err) {
          console.warn("Handwriting panel cleanup failed:", err);
        }
      }
    });
    row.remove();
  });
  if (cleanups.length) await Promise.all(cleanups);
}

function findHandwritingPanelCell(result = null) {
  return result?.cellsById?.get?.(PANEL_ID) || document.querySelector(
    ".panel-cell[data-id=\"" + PANEL_ID + "\"], .panel-cell[data-panel-id=\"" + PANEL_ID + "\"]"
  );
}

function findEditorCellForElement(editorEl) {
  const fromEditor = editorEl?.closest?.(".panel-cell");
  if (fromEditor) return fromEditor;

  const activeCell = window.activeCell?.closest?.(".panel-cell");
  if (activeCell?.dataset?.panelClass === "EditorPanel" || activeCell?.dataset?.id === "GraphicalEditor") {
    return activeCell;
  }

  return document.querySelector(
    `.panel-cell[data-id="GraphicalEditor"], .panel-cell[data-panel-id="GraphicalEditor"]`
  );
}

export default async function handwritingToText() {
  const editorEl = findActiveEditorElement();
  const snapshot = captureSelection(editorEl);
  const sink = createLiveTextSink(snapshot);
  const workspace = document.getElementById("workspace");
  if (!workspace) {
    alert("Workspace is not ready yet.");
    return;
  }

  const editorCell = findEditorCellForElement(editorEl);
  if (!editorCell) {
    alert("Open an editor before using handwriting OCR.");
    return;
  }

  await removeLegacyHandwritingPanelRows();

  const result = await ensureHandwritingOcrModeLayout({
    editorCell,
    panelVars: {
      liveInsert: true,
      onLiveText: (text) => {
        if (!sink.apply(text, { focus: false })) console.warn("handwritingToText: No supported editor found for live text.");
      },
      onInsertText: (text) => {
        if (!sink.apply(text)) console.warn("handwritingToText: No supported editor found to insert text.");
      },
      getCorrectionText: () => sink.getText(),
      getRecognitionContext: () => sink.getContext(),
      onAcceptCorrectionText: (text) => {
        if (!sink.acceptCorrection(text)) console.warn("handwritingToText: No supported editor found to accept correction.");
      },
    },
  });

  const cell = findHandwritingPanelCell(result);
  if (!cell) {
    alert("Could not create the Handwriting control panel.");
    return;
  }

  cell.style.display = "flex";
  window.activeCell = cell;
  window.activePanel = PANEL_ID;
  window.activePanelClass = "ControlPanel";
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.activePanelType = "ControlPanel";
  window.highlightActiveCell?.(cell);
}
