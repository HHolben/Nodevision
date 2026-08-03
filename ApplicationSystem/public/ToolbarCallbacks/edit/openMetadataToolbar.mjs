// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/openMetadataToolbar.mjs
// This toolbar callback opens the metadata subtoolbar for document metadata controls.
export default function openMetadataToolbar() {
  window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
    detail: { heading: "Metadata", force: true, toggle: false },
  }));
}
