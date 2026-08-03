// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/tableDeleteRow.mjs
// This toolbar callback deletes the table row that contains the current selection.
import { deleteCurrentTableRow } from "./tableTools.mjs";

export default function tableDeleteRow() {
  deleteCurrentTableRow();
}
