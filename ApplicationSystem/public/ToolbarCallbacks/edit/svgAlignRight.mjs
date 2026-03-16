// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/svgAlignRight.mjs
// This file defines browser-side svg Align Right logic for the Nodevision UI. It renders interface components and handles user interactions.
export default function svgAlignRight() {
  window.SVGEditorContext?.alignSelection?.("right");
}
