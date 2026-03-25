// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertMedia.mjs
// Opens the Insert → Media subtoolbar for data-driven media insertion into HTML pages.
export default function insertMedia() {
  window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
    detail: { heading: "Media", force: true, toggle: false },
  }));
}

