// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/tableSelectCell.mjs
// This toolbar callback exposes explicit whole-cell selection without confusing it with highlighted text and explains the supported pointer gestures.
import { getActiveTableCell, setSelectedTableCells } from "./tableTools.mjs";
import { setStatus } from "/StatusBar.mjs";

export default function tableSelectCell() {
  const cell = getActiveTableCell();
  if (!cell) return false;
  cell.closest("[contenteditable='true']")?.focus({preventScroll:true});
  window.getSelection()?.removeAllRanges();
  setSelectedTableCells([cell]);
  setStatus("Cell selected", "Drag selected cells to move their contents. Alt+drag selects a group; click a selected cell to edit its text.");
  return true;
}
