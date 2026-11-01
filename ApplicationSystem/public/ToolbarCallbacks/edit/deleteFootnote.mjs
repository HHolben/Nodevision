// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/deleteFootnote.mjs
// This callback routes the remove footnote action to the active HTML document reference controller.
import { activeFootnoteCommand } from "/References/ActiveFootnoteCommand.mjs";
export default function deleteFootnote() { return activeFootnoteCommand("remove"); }
