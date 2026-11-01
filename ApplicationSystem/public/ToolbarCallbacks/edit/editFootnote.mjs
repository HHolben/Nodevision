// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/editFootnote.mjs
// This callback routes the edit footnote action to the active HTML document reference controller.
import { activeFootnoteCommand } from "/References/ActiveFootnoteCommand.mjs";
export default function editFootnote() { return activeFootnoteCommand("edit"); }
