// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/handwritingToText.mjs
// Opens the handwriting OCR control panel and streams recognized text into the active editor.

import {
  loadPanelIntoCell,
  rebuildLayoutDividersForContainer,
  renderLayout,
} from "/panels/workspace.mjs";

const PANEL_ID = "HandwritingOcrPanel";

function findActiveEditorElement() {
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
    const sel = window.getSelection?.();
    const range = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    return {
      editorEl,
      textareaSel: null,
      contentRange: isRangeInside(editorEl, range) ? range : null,
      monaco: null,
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
  let liveText = "";
  let liveNode = null;
  let textStart = snapshot?.textareaSel?.start ?? null;

  function apply(text) {
    const t = String(text ?? "");

    if (editorEl && (editorEl.tagName === "TEXTAREA" || editorEl.tagName === "INPUT")) {
      const start = Number.isFinite(textStart) ? textStart : editorEl.value.length;
      const end = start + liveText.length;
      editorEl.focus();
      editorEl.value = editorEl.value.slice(0, start) + t + editorEl.value.slice(end);
      liveText = t;
      const pos = start + t.length;
      editorEl.setSelectionRange?.(pos, pos);
      dispatchInput(editorEl);
      return true;
    }

    if (editorEl?.isContentEditable) {
      editorEl.focus();
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
        moveCaretAfterNode(liveNode);
        dispatchInput(editorEl);
        return true;
      }

      if (!t) return true;
      const range = insertionRangeForEditable(editorEl, snapshot);
      range.deleteContents();
      liveNode = document.createTextNode(t);
      range.insertNode(liveNode);
      liveText = t;
      moveCaretAfterNode(liveNode);
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

  return { apply };
}

function findHandwritingPanelCell() {
  return document.querySelector(
    `.panel-cell[data-id="${PANEL_ID}"], .panel-cell[data-panel-id="${PANEL_ID}"]`
  );
}

function isColumnLayoutContainer(container) {
  const direction = container?.dataset?.direction;
  if (direction) return direction === "column";
  const isVertical = container?.dataset?.isVertical;
  if (isVertical !== undefined) return isVertical === "1" || isVertical === "true";
  return true;
}

function ensureHandwritingPanelCell(workspace) {
  const existing = findHandwritingPanelCell();
  if (existing) {
    rebuildLayoutDividersForContainer(existing.parentElement, existing.parentElement?.dataset?.direction === "column");
    rebuildLayoutDividersForContainer(workspace, true);
    return existing;
  }

  const row = document.createElement("div");
  row.className = "panel-row panel-row--handwriting-control";
  Object.assign(row.style, {
    display: "flex",
    flexDirection: "row",
    overflow: "hidden",
    flex: "0 0 34%",
    minHeight: "160px",
    minWidth: "0",
    alignItems: "stretch",
  });
  row.dataset.direction = "row";
  row.dataset.isVertical = "0";
  workspace.appendChild(row);

  renderLayout({
    type: "cell",
    id: PANEL_ID,
    panelType: PANEL_ID,
    panelClass: "ControlPanel",
    displayName: "Handwriting",
    flex: "1 1 0",
    deferLoad: true,
  }, row);

  rebuildLayoutDividersForContainer(row, false);
  rebuildLayoutDividersForContainer(workspace, true);
  return findHandwritingPanelCell();
}


async function loadHandwritingPanel(cell, panelVars) {
  const previousActiveCell = window.activeCell;
  window.activeCell = cell;
  try {
    await loadPanelIntoCell(PANEL_ID, {
      id: PANEL_ID,
      displayName: "Handwriting",
      ...panelVars,
    });
  } finally {
    window.activeCell = previousActiveCell;
  }
}

export default async function handwritingToText() {
  const snapshot = captureSelection(findActiveEditorElement());
  const sink = createLiveTextSink(snapshot);
  const workspace = document.getElementById("workspace");
  if (!workspace) {
    alert("Workspace is not ready yet.");
    return;
  }

  const cell = ensureHandwritingPanelCell(workspace);
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

  await loadHandwritingPanel(cell, {
    liveInsert: true,
    onLiveText: (text) => {
      if (!sink.apply(text)) console.warn("handwritingToText: No supported editor found for live text.");
    },
    onInsertText: (text) => {
      if (!sink.apply(text)) console.warn("handwritingToText: No supported editor found to insert text.");
    },
  });

  window.activeCell = cell;
  window.activePanel = PANEL_ID;
  window.activePanelClass = "ControlPanel";
  window.NodevisionState.activePanelType = "ControlPanel";
  window.highlightActiveCell?.(cell);
}
