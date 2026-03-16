// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/svgAlignLeft.mjs
// This file defines browser-side svg Align Left logic for the Nodevision UI. It renders interface components and handles user interactions.
export default function svgAlignLeft() {
  window.SVGEditorContext?.alignSelection?.("left");
}
