// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVRangeInteraction.mjs
// This module delegates CSV pointer, keyboard, and clipboard gestures to the editor context and keeps drag previews separate from document mutations.
import { csvRange, rangeContains } from "./CSVRangeModel.mjs";
export function bindCsvRangeInteraction(wrapper, table, editor, view) {
  const win = wrapper.ownerDocument.defaultView, doc = wrapper.ownerDocument;
  const listeners = [];
  let drag = null, editing = null;
  const on = (target, type, callback) => { target.addEventListener(type, callback); listeners.push(() => target.removeEventListener(type, callback)); };
  const cellFor = node => { const cell = node?.closest?.("td,th"); return cell?.closest("table") === table ? cell : null; };
  const position = cell => ({ row: Number(cell.dataset.row), col: Number(cell.dataset.col) });
  function finishEditing() {
    if (!editing) return;
    editing.contentEditable = "false";
    editing = null;
  }
  function edit(cell, replace = false) {
    finishEditing(); editing = cell; cell.contentEditable = "true"; cell.focus();
    if (replace) cell.textContent = "";
    const range = doc.createRange(); range.selectNodeContents(cell);
    if (!replace) range.collapse(false);
    const selection = win.getSelection(); selection.removeAllRanges(); selection.addRange(range);
  }
  function stop(event) {
    if (!drag || (event.pointerId != null && event.pointerId !== drag.id)) return;
    const completed = drag; drag = null;
    wrapper.classList.remove("nv-csv-moving"); view.paint(null, true);
    if (event.type === "pointerup" && completed.moved && completed.mode === "move") editor.move(completed.source, completed.destination);
    else if (event.type === "pointerup" && !completed.moved && completed.mode === "move") editor.select(completed.start);
    else editor.publish();
  }
  on(wrapper, "pointerdown", event => {
    const cell = cellFor(event.target);
    if (!cell || event.button !== 0 || event.isPrimary === false) return;
    if (editing === cell && !event.shiftKey) return;
    finishEditing(); event.preventDefault(); win.getSelection()?.removeAllRanges();
    const start = position(cell), selection = editor.getSelection();
    const multi = selection.range.top !== selection.range.bottom || selection.range.left !== selection.range.right;
    const bounds = cell.getBoundingClientRect();
    const edge = Math.min(event.clientX - bounds.left, bounds.right - event.clientX, event.clientY - bounds.top, bounds.bottom - event.clientY) <= 6;
    const move = !event.shiftKey && rangeContains(selection.range, start) && (multi || edge);
    drag = { id: event.pointerId, start, x: event.clientX, y: event.clientY, mode: move ? "move" : "select",
      source: selection.range, destination: { row: selection.range.top, col: selection.range.left }, moved: false };
    if (!move) editor.select(start, event.shiftKey);
  });
  on(win, "pointermove", event => {
    if (!drag || event.pointerId !== drag.id) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 4) return;
    const cell = cellFor(doc.elementFromPoint(event.clientX, event.clientY));
    if (!cell) return;
    const point = position(cell);
    if (drag.last?.row === point.row && drag.last?.col === point.col) return;
    drag.last = point; drag.moved = true; event.preventDefault();
    if (drag.mode === "select") editor.select(point, true, false);
    else {
      drag.destination = { row: Math.max(0, drag.source.top + point.row - drag.start.row), col: Math.max(0, drag.source.left + point.col - drag.start.col) };
      wrapper.classList.add("nv-csv-moving");
      view.paint({ top: drag.destination.row, left: drag.destination.col,
        bottom: drag.destination.row + drag.source.bottom - drag.source.top, right: drag.destination.col + drag.source.right - drag.source.left }, true);
    }
  });
  on(win, "pointerup", stop); on(win, "pointercancel", stop);
  on(win, "blur", () => { if (drag) stop({ type: "pointercancel" }); });
  on(wrapper, "dblclick", event => { const cell = cellFor(event.target); if (cell) { editor.select(position(cell)); edit(cell); } });
  on(wrapper, "focusout", () => finishEditing());
  on(wrapper, "input", event => { const cell = cellFor(event.target); if (cell) editor.input(position(cell), cell.textContent || ""); });
  function caretOffsetInCell(cell) {
    const selection = win.getSelection();
    if (!selection?.isCollapsed || !selection.rangeCount) return null;
    const range = selection.getRangeAt(0);
    if (!cell.contains(range.startContainer)) return null;
    const before = range.cloneRange(); before.selectNodeContents(cell); before.setEnd(range.startContainer, range.startOffset);
    return before.toString().length;
  }
  on(wrapper, "keydown", event => {
    if (event.defaultPrevented || event.isComposing) return;
    if ((event.ctrlKey || event.metaKey) && ["z", "y"].includes(event.key.toLowerCase())) {
      event.preventDefault(); finishEditing();
      if (event.key.toLowerCase() === "y" || event.shiftKey) editor.history.redo(); else editor.history.undo();
      return;
    }
    if (event.key === "Escape") { if (drag) stop({ type: "pointercancel" }); finishEditing(); editor.publish(); return; }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const cell = cellFor(event.target);
    if (!cell) return;
    if (event.key === "F2") { event.preventDefault(); edit(cell); return; }
    const delta = { ArrowLeft: [0,-1], ArrowRight: [0,1], ArrowUp: [-1,0], ArrowDown: [1,0], Enter: [event.shiftKey ? -1 : 1,0], Tab: [0,event.shiftKey ? -1 : 1] }[event.key];
    if (delta) {
      if (editing && event.shiftKey && event.key.startsWith("Arrow")) return;
      const offset = editing && caretOffsetInCell(cell);
      if (editing && ((event.key === "ArrowLeft" && offset > 0) || (event.key === "ArrowRight" && offset !== null && offset < cell.textContent.length))) return;
      finishEditing(); event.preventDefault();
      editor.navigate(delta, event.shiftKey && event.key.startsWith("Arrow"));
    } else if (!editing && ["Backspace", "Delete"].includes(event.key)) { event.preventDefault(); editor.clear(); }
    else if (!editing && event.key.length === 1) edit(cell, true);
  });
  // Native clipboard events support both Ctrl and Cmd and preserve text editing clipboard behavior.
  for (const type of ["copy", "cut", "paste"]) on(wrapper, type, event => {
    if (editing || !event.clipboardData) return;
    event.preventDefault();
    if (type === "paste") editor.paste(event.clipboardData.getData("text/plain"));
    else {
      const text = editor.copy();
      event.clipboardData.setData("text/plain", text);
      event.clipboardData.setData("text/tab-separated-values", text);
      if (type === "cut") editor.clear();
    }
  });
  on(wrapper, "beforeinput", event => {
    if (event.inputType === "historyUndo" || event.inputType === "historyRedo") {
      event.preventDefault(); finishEditing(); editor.history[event.inputType === "historyUndo" ? "undo" : "redo"]();
    }
  });
  return () => { finishEditing(); if (drag) stop({ type: "pointercancel" }); listeners.forEach(remove => remove()); };
}
