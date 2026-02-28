// Nodevision/public/ToolbarCallbacks/insert/insertLayoutCanvas.mjs
// Insert a movable layout canvas into the active HTML WYSIWYG document.
export default function insertLayoutCanvas() {
  const tools = window.HTMLWysiwygTools;
  if (!tools || typeof tools.insertLayoutCanvas !== 'function') {
    console.warn('insertLayoutCanvas: HTML layout tools unavailable.');
    return;
  }
  tools.insertLayoutCanvas();
}
