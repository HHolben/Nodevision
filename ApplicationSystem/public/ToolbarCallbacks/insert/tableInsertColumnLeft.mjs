// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/tableInsertColumnLeft.mjs
// This toolbar callback inserts a table column to the left of the current table selection.
import { insertTableColumn } from "./tableTools.mjs";

export default function tableInsertColumnLeft() {
  insertTableColumn("left");
}
