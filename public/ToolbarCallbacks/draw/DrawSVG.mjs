// Nodevision/public/ToolbarCallbacks/draw/DrawSVG.mjs
// Show SVG draw controls via the shared Nodevision sub-toolbar mechanism.

export default function DrawSVG() {
  window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
    detail: { heading: "SVG Draw", force: true, toggle: true }
  }));
}
