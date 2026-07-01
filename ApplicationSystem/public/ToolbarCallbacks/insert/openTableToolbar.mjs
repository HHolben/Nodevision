// Opens the HTML table editing sub-toolbar.

export default function openTableToolbar() {
  window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
    detail: { heading: "Table", force: true, toggle: false },
  }));
}
