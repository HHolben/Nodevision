//Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertH2.mjs
//This is a a toolbar callback which can be used by text editors (such as the graphical html editor) to insert <h2> tags in editor panels
import { insertBlock } from "./utils/insertHelpers.mjs";

export default function insertH2() {
  const panel = document.querySelector(
    ".editor-panel.active, .active-editor, [data-editor-active='true'], #editor-root"
  );
  if (!panel) {
    console.warn("insertH2: No active editor panel found.");
    return;
  }

  const textarea = panel.querySelector("textarea, input[type='text']");
  const editable = panel.querySelector("[contenteditable='true']");

  const editorEl = textarea || editable;
  if (!editorEl) {
    console.warn("insertH2: No supported editor found inside active panel.");
    return;
  }

  insertBlock(editorEl, "h2");
}
