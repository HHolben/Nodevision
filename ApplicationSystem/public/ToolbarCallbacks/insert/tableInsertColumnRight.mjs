// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/tableInsertColumnRight.mjs
// This toolbar callback inserts a table column to the right of the current table selection.
import { insertTableColumn } from "./tableTools.mjs";

export default function tableInsertColumnRight() {
  insertTableColumn("right");
}
