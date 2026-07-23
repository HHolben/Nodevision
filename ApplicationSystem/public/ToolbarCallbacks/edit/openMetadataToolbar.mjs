export default function openMetadataToolbar() {
  window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
    detail: { heading: "Metadata", force: true, toggle: false },
  }));
}
