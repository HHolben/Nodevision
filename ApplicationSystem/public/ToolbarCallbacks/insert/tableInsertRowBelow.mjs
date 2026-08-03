// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/tableInsertRowBelow.mjs
// This toolbar callback inserts a table row below the current table selection.
import { insertTableRow } from "./tableTools.mjs";

export default function tableInsertRowBelow() {
  insertTableRow("below");
}
