// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/returnFromFootnote.mjs
// This callback routes the returnToReference footnote action to the active HTML document reference controller.
import { activeFootnoteCommand } from "/References/ActiveFootnoteCommand.mjs";
export default function returnFromFootnote() { return activeFootnoteCommand("returnToReference"); }
