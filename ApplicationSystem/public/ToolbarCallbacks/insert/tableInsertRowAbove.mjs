// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/tableInsertRowAbove.mjs
// This toolbar callback inserts a table row above the current table selection.
import { insertTableRow } from "./tableTools.mjs";

export default function tableInsertRowAbove() {
  insertTableRow("above");
}
