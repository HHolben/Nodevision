// Nodevision/ApplicationSystem/public/References/ActiveFootnoteCommand.mjs
// This module routes scholarly reference toolbar actions only to the active graphical HTML document and reports invalid contexts without mutating another panel.
export function activeFootnoteCommand(command) {
  const context = window.__nvActiveHtmlEditorContext;
  const root = context?.editorElement;
  if (window.NodevisionState?.currentMode !== 'HTMLediting' || !root?.isConnected || !root.__nvReferences) {
    alert('Open an editable HTML document to use footnotes.'); return false;
  }
  try { return root.__nvReferences[command](); }
  catch (error) { alert(error.message); return false; }
}
