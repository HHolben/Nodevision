// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertFootnote.mjs
// This callback routes the insert footnote action to the active HTML document reference controller.
import { activeFootnoteCommand } from "/References/ActiveFootnoteCommand.mjs";
export default function insertFootnote() { return activeFootnoteCommand("insert"); }
