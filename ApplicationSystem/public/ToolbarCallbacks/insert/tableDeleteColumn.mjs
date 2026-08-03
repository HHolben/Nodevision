// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/tableDeleteColumn.mjs
// This toolbar callback deletes the table column that contains the current selection.
import { deleteCurrentTableColumn } from "./tableTools.mjs";

export default function tableDeleteColumn() {
  deleteCurrentTableColumn();
}
