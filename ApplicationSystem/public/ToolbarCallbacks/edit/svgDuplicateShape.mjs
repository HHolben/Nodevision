// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/svgDuplicateShape.mjs
// This file defines browser-side svg Duplicate Shape logic for the Nodevision UI. It renders interface components and handles user interactions.
export default function svgDuplicateShape() {
  window.SVGEditorContext?.duplicateSelection?.(20, 20);
}
