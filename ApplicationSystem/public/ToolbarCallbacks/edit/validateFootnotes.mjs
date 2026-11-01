// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/validateFootnotes.mjs
// This callback routes the validate footnote action to the active HTML document reference controller.
import { activeFootnoteCommand } from "/References/ActiveFootnoteCommand.mjs";
export default function validateFootnotes() { return activeFootnoteCommand("validate"); }
