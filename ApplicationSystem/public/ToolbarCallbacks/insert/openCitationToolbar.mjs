// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/openCitationToolbar.mjs
// This toolbar callback opens the citation subtoolbar for bibliography and citation insertion controls.
export default function openCitationToolbar() {
  window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
    detail: { heading: "Citation", force: true, toggle: false },
  }));
}
