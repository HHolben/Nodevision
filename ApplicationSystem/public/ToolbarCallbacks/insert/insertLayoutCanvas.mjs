// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertLayoutCanvas.mjs
// This file defines browser-side insert Layout Canvas logic for the Nodevision UI. It renders interface components and handles user interactions.
export default function insertLayoutCanvas() {
  const tools = window.HTMLWysiwygTools;
  if (!tools || typeof tools.insertLayoutCanvas !== 'function') {
    console.warn('insertLayoutCanvas: HTML layout tools unavailable.');
    return;
  }
  tools.insertLayoutCanvas();
}
