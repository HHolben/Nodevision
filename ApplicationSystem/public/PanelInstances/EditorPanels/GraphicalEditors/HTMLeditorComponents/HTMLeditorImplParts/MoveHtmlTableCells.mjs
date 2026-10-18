// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/MoveHtmlTableCells.mjs
// This module moves explicitly selected HTML table cell contents with a pointer gesture. It validates the destination grid before changing the DOM and records each completed move as one undoable edit.
import { getSelectedTableCells, setSelectedTableCells, focusTableCell } from "/ToolbarCallbacks/insert/tableTools.mjs";
import { buildTableGrid } from "/ToolbarCallbacks/insert/tableToolsParts/ReadCellSpan.mjs";
import { presentHtmlClass } from "../HtmlPresentation.mjs";
import { setStatus } from "/StatusBar.mjs";

export function moveHtmlTableCells(root, cells, anchor, destination) {
  const table = anchor.closest("table");
  if (destination?.closest("table") !== table) return false;
  const model = buildTableGrid(table), from = model.origins.get(anchor), to = model.origins.get(destination);
  if (!from || !to || from === to) return false;
  const targets = cells.map(cell => {
    const origin = model.origins.get(cell);
    if (!origin) return null;
    const row = origin.rowIndex + to.rowIndex - from.rowIndex;
    const col = origin.colIndex + to.colIndex - from.colIndex;
    const target = model.grid[row]?.[col];
    return target && target.rowIndex === row && target.colIndex === col &&
      target.rowSpan === origin.rowSpan && target.colSpan === origin.colSpan ? target.cell : null;
  });
  if (targets.some(cell => !cell) || new Set(targets).size !== cells.length) {
    setStatus("Cells not moved", "The destination must fit inside this table and have matching merged cells.");
    return false;
  }
  const history = root.__nvProgrammaticHistory;
  if (!history?.captureCommand) return false;
  history.captureCommand(() => {
    // Snapshot node lists before detaching to support overlapping source/destination.
    const contents = cells.map(cell => Array.from(cell.childNodes));
    cells.forEach(cell => cell.replaceChildren());
    targets.forEach((cell, index) => cell.replaceChildren(...contents[index]));
    setSelectedTableCells(targets, {anchorCell:targets[0],activeCell:targets[targets.length - 1]});
  });
  root.dispatchEvent(new Event("input", {bubbles:true}));
  return true;
}

export function registerHtmlTableCellMoving(root) {
  let drag = null;
  const suppressClick = () => {
    root.__nvSuppressNextTableClickSelection = true;
    setTimeout(() => { root.__nvSuppressNextTableClickSelection = false; }, 0);
  };
  const end = event => {
    if (!drag || (event.pointerId !== undefined && event.pointerId !== drag.id)) return;
    const state = drag; drag = null;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointercancel", end);
    window.removeEventListener("keydown", key, true);
    window.removeEventListener("blur", cancel);
    presentHtmlClass(root, "nv-table-cell-moving", false);
    if (event.type === "pointerup") {
      if (state.moved) {
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("td, th");
        moveHtmlTableCells(root, state.cells, state.anchor, target);
      } else {
        focusTableCell(state.anchor);
      }
      suppressClick();
    }
  };
  const cancel = () => end({type:"cancel"});
  const key = event => { if (event.key === "Escape") { event.preventDefault(); cancel(); } };
  const move = event => {
    if (!drag || event.pointerId !== drag.id) return;
    if (Math.hypot(event.clientX-drag.x,event.clientY-drag.y) < 5 && !drag.moved) return;
    drag.moved = true;
    presentHtmlClass(root, "nv-table-cell-moving", true);
    event.preventDefault();
  };
  const down = event => {
    if (event.button !== 0 || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.target.closest?.("input, textarea, button, select, a")) return;
    const anchor = event.target.closest?.("td, th"), cells = getSelectedTableCells();
    if (!window.__nvHtmlTableSelectionMode || !cells.includes(anchor)) return;
    const selection = window.getSelection();
    // A genuine native text selection must never become a cell drag.
    if (selection?.rangeCount) {
      const range = selection.getRangeAt(0);
      const element = range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer;
      if (element.closest?.("td, th")) return;
    }
    drag = {anchor,cells,id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};
    event.preventDefault();
    event.stopImmediatePropagation();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("keydown", key, true);
    window.addEventListener("blur", cancel);
  };
  root.addEventListener("pointerdown", down);
  return () => { cancel(); root.removeEventListener("pointerdown", down); };
}
