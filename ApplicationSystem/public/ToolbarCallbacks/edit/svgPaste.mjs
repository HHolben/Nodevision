// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/svgPaste.mjs
// This file defines browser-side svg Paste logic for the Nodevision UI. It renders interface components and handles user interactions.
export default function svgPaste() {
  window.SVGEditorContext?.pasteSelection?.(20, 20);
}
