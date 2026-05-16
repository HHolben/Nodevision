// Nodevision/ApplicationSystem/public/ToolbarCallbacks/draw/PencilSketching.mjs
// This file defines browser-side Pencil Sketching logic for the Nodevision UI. It renders interface components and handles user interactions.

export default function PencilSketching() {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.svgDrawTool = "sketch";
  window.SVGEditorContext?.setMode?.("sketch");
  window.dispatchEvent(
    new CustomEvent("nv-show-subtoolbar", {
      detail: { heading: "Pencil Sketching", force: true, toggle: true },
    }),
  );
}
