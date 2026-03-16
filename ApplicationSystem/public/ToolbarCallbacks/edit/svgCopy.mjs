// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/svgCopy.mjs
// This file defines browser-side svg Copy logic for the Nodevision UI. It renders interface components and handles user interactions.
export default function svgCopy() {
  window.SVGEditorContext?.copySelection?.();
}
