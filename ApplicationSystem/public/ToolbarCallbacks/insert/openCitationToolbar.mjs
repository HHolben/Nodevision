export default function openCitationToolbar() {
  window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
    detail: { heading: "Citation", force: true, toggle: false },
  }));
}
