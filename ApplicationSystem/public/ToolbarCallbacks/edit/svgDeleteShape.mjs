// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/svgDeleteShape.mjs
// This file defines browser-side svg Delete Shape logic for the Nodevision UI. It renders interface components and handles user interactions.
export default function svgDeleteShape() {
  window.SVGEditorContext?.deleteSelection?.();
}
