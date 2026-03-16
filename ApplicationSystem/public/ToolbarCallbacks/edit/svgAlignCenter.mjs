// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/svgAlignCenter.mjs
// This file defines browser-side svg Align Center logic for the Nodevision UI. It renders interface components and handles user interactions.
export default function svgAlignCenter() {
  window.SVGEditorContext?.alignSelection?.("center");
}
