// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertCalligraphyLetter.mjs
// This callback routes the calligraphy command to the active HTML or PHP graphical document editor.
export default function insertCalligraphyLetter() {
  if (window.NodevisionState?.currentMode === 'PHPediting') {
    alert('The PHP editor has a read-only rendered preview. Calligraphy conversion currently requires an editable HTML document; PHP source mapping is not available.');
    return false;
  }
  return window.HTMLWysiwygTools?.insertCalligraphyLetter?.();
}
