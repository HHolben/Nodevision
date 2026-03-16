// Nodevision/ApplicationSystem/public/ToolbarCallbacks/draw/DrawSVG.mjs
// This file defines browser-side Draw SVG logic for the Nodevision UI. It renders interface components and handles user interactions.

export default function DrawSVG() {
  window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
    detail: { heading: "SVG Draw", force: true, toggle: true }
  }));
}
