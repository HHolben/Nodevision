// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/openTableToolbar.mjs
// This toolbar callback opens the HTML table editing subtoolbar for table creation and modification controls.

export default function openTableToolbar() {
  window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
    detail: { heading: "Table", force: true, toggle: false },
  }));
}
